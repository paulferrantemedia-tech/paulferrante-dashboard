// /api/youtube-stats.js — Fetches YouTube channel + video analytics
// Caches results in Redis for 1 hour to preserve quota

const CACHE_KEY = 'pf_yt_stats_v1';
const CACHE_TTL = 60 * 60 * 1000; // 1 hour in ms

const YT_KEY        = 'AIzaSyBw6nbEtl_ZN_aaijpp4njYgXT6enGj-pU';
const YT_CHANNEL_ID = 'UCpi1tHHbTLZmGvOoREHZDsw';
const YT_BASE       = 'https://www.googleapis.com/youtube/v3';

// ── Redis helpers ───────────────────────────────────────────────
async function kvGet(baseUrl, token, key) {
  try {
    const res  = await fetch(`${baseUrl}/get/${key}`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (!data.result) return null;
    const parsed = typeof data.result === 'string' ? JSON.parse(data.result) : data.result;
    return parsed;
  } catch { return null; }
}

async function kvSet(baseUrl, token, key, value) {
  try {
    await fetch(`${baseUrl}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([['SET', key, JSON.stringify(value)]]),
    });
  } catch { /* cache write failure is non-fatal */ }
}

// ── YouTube API fetchers ────────────────────────────────────────
async function fetchChannelStats() {
  const url = `${YT_BASE}/channels?part=statistics,contentDetails&id=${YT_CHANNEL_ID}&key=${YT_KEY}`;
  const res  = await fetch(url);
  const data = await res.json();
  if (!data.items?.[0]) throw new Error('Channel not found');
  const s = data.items[0].statistics;
  return {
    channel: {
      subscriberCount: parseInt(s.subscriberCount) || 0,
      viewCount:       parseInt(s.viewCount)       || 0,
      videoCount:      parseInt(s.videoCount)      || 0,
    },
    uploadsPlaylistId: data.items[0].contentDetails.relatedPlaylists.uploads,
  };
}

async function fetchRecentVideoIds(uploadsPlaylistId, maxResults = 50) {
  const url  = `${YT_BASE}/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=${maxResults}&key=${YT_KEY}`;
  const res  = await fetch(url);
  const data = await res.json();
  return (data.items || []).map(item => item.snippet.resourceId.videoId);
}

function parseDuration(iso) {
  // PT4M13S → "4:13"
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  const h = parseInt(m?.[1] || 0);
  const min = parseInt(m?.[2] || 0);
  const sec = parseInt(m?.[3] || 0);
  const total = h * 3600 + min * 60 + sec;
  if (h > 0) return { str: `${h}:${String(min).padStart(2,'0')}:${String(sec).padStart(2,'0')}`, total };
  return { str: `${min}:${String(sec).padStart(2,'0')}`, total };
}

async function fetchVideoDetails(videoIds) {
  if (!videoIds.length) return [];
  // Batch in groups of 50
  const batches = [];
  for (let i = 0; i < videoIds.length; i += 50) batches.push(videoIds.slice(i, i + 50));

  const videos = [];
  for (const batch of batches) {
    const url  = `${YT_BASE}/videos?part=statistics,snippet,contentDetails&id=${batch.join(',')}&key=${YT_KEY}`;
    const res  = await fetch(url);
    const data = await res.json();
    for (const v of (data.items || [])) {
      const views    = parseInt(v.statistics.viewCount)    || 0;
      const likes    = parseInt(v.statistics.likeCount)    || 0;
      const comments = parseInt(v.statistics.commentCount) || 0;
      const engRate  = views > 0 ? parseFloat(((likes + comments) / views * 100).toFixed(2)) : 0;
      const { str: durationStr, total: durationSec } = parseDuration(v.contentDetails.duration || 'PT0S');

      videos.push({
        id:           v.id,
        title:        v.snippet.title,
        publishedAt:  v.snippet.publishedAt,
        thumbnail:    v.snippet.thumbnails?.medium?.url || v.snippet.thumbnails?.default?.url || null,
        viewCount:    views,
        likeCount:    likes,
        commentCount: comments,
        engagementRate: engRate,
        duration:     durationStr,
        durationSec,
        tags:         (v.snippet.tags || []).slice(0, 10),
        description:  (v.snippet.description || '').slice(0, 300),
      });
    }
  }

  // Sort by views descending
  return videos.sort((a, b) => b.viewCount - a.viewCount);
}

// ── Main fetch ──────────────────────────────────────────────────
async function buildYtData() {
  const { channel, uploadsPlaylistId } = await fetchChannelStats();
  const videoIds = await fetchRecentVideoIds(uploadsPlaylistId, 50);
  const videos   = await fetchVideoDetails(videoIds);

  // Compute aggregates
  const totalVids   = videos.length;
  const avgViews    = totalVids > 0 ? Math.round(videos.reduce((s, v) => s + v.viewCount, 0) / totalVids) : 0;
  const avgEngRate  = totalVids > 0 ? parseFloat((videos.reduce((s, v) => s + v.engagementRate, 0) / totalVids).toFixed(2)) : 0;
  const avgLikeRate = totalVids > 0 ? parseFloat((videos.reduce((s, v) => s + (v.viewCount > 0 ? v.likeCount / v.viewCount * 100 : 0), 0) / totalVids).toFixed(2)) : 0;
  const avgCommentRate = totalVids > 0 ? parseFloat((videos.reduce((s, v) => s + (v.viewCount > 0 ? v.commentCount / v.viewCount * 100 : 0), 0) / totalVids).toFixed(2)) : 0;

  return {
    channel,
    videos,
    aggregates: { avgViews, avgEngRate, avgLikeRate, avgCommentRate, totalVids },
    _cachedAt: Date.now(),
  };
}

// ── Handler ─────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  const baseUrl = process.env.KV_REST_API_URL;
  const token   = process.env.KV_REST_API_TOKEN;
  const force   = req.query?.force === 'true';

  // Try cache (unless force refresh)
  if (!force && baseUrl && token) {
    const cached = await kvGet(baseUrl, token, CACHE_KEY);
    if (cached && cached._cachedAt && (Date.now() - cached._cachedAt) < CACHE_TTL) {
      return res.status(200).json({ ok: true, ...cached, fromCache: true });
    }
  }

  try {
    const data = await buildYtData();
    if (baseUrl && token) await kvSet(baseUrl, token, CACHE_KEY, data);
    return res.status(200).json({ ok: true, ...data, fromCache: false });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}
