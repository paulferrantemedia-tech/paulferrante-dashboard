// /api/tiktok-stats.js — TikTok Content API analytics
// Access token auto-refreshes using stored refresh token (valid 365 days)

const TT_BASE   = 'https://open.tiktokapis.com/v2';
const CACHE_KEY = 'pf_tt_stats_v1';
const TOKEN_KEY = 'pf_tt_tokens_v1';
const CACHE_TTL = 30 * 60 * 1000; // 30 min

// ── Redis helpers ───────────────────────────────────────────────
async function kvGet(baseUrl, token, key) {
  try {
    const res  = await fetch(`${baseUrl}/get/${key}`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (!data.result) return null;
    return typeof data.result === 'string' ? JSON.parse(data.result) : data.result;
  } catch { return null; }
}
async function kvSet(baseUrl, token, key, value) {
  try {
    await fetch(`${baseUrl}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([['SET', key, JSON.stringify(value)]]),
    });
  } catch {}
}

// ── Token management (auto-refresh access token using refresh token) ──
async function getValidToken(baseUrl, kvToken, clientKey, clientSecret) {
  if (!baseUrl || !kvToken) return null;
  const stored = await kvGet(baseUrl, kvToken, TOKEN_KEY);
  if (!stored) return null;

  // Access token still valid (with 5-min buffer)
  if (stored.expiresAt && Date.now() < stored.expiresAt - 300000) {
    return { token: stored.accessToken, openId: stored.openId };
  }

  // Refresh the access token
  try {
    const refreshRes = await fetch(`${TT_BASE}/oauth/token/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_key:    clientKey,
        client_secret: clientSecret,
        grant_type:    'refresh_token',
        refresh_token: stored.refreshToken,
      }),
    });
    const data = await refreshRes.json();
    if (data.error || !data.access_token) return null;

    const updated = {
      ...stored,
      accessToken:  data.access_token,
      refreshToken: data.refresh_token || stored.refreshToken,
      expiresAt:    Date.now() + ((data.expires_in || 86400) * 1000),
    };
    await kvSet(baseUrl, kvToken, TOKEN_KEY, updated);
    return { token: updated.accessToken, openId: updated.openId };
  } catch { return null; }
}

// ── Main data fetch ─────────────────────────────────────────────
async function fetchTtData(tokenData) {
  const headers = {
    Authorization:  `Bearer ${tokenData.token}`,
    'Content-Type': 'application/json',
  };

  // 1. User info
  const userRes = await fetch(
    `${TT_BASE}/user/info/?fields=display_name,follower_count,following_count,likes_count,video_count`,
    { headers }
  );
  const userData = await userRes.json();
  if (userData.error?.code && userData.error.code !== 'ok') {
    throw new Error(`TikTok user info: ${userData.error.message || userData.error.code}`);
  }

  // 2. Video list (most recent 20)
  const videoRes = await fetch(`${TT_BASE}/video/list/?fields=id,title,create_time,like_count,comment_count,share_count,view_count,duration`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ max_count: 20 }),
  });
  const videoData = await videoRes.json();

  const user = userData.data?.user || {};
  const profile = {
    displayName:    user.display_name    || '',
    followerCount:  user.follower_count  || 0,
    followingCount: user.following_count || 0,
    likesCount:     user.likes_count     || 0,
    videoCount:     user.video_count     || 0,
  };

  const rawVideos = videoData.data?.videos || [];
  const videos = rawVideos.map(v => {
    const views    = v.view_count    || 0;
    const likes    = v.like_count    || 0;
    const comments = v.comment_count || 0;
    const shares   = v.share_count   || 0;
    const total    = likes + comments + shares;
    const engRate  = views > 0 ? parseFloat(((total / views) * 100).toFixed(2)) : 0;
    return {
      id:            v.id,
      title:         v.title || '(untitled)',
      createdAt:     new Date((v.create_time || 0) * 1000).toISOString(),
      viewCount:     views,
      likeCount:     likes,
      commentCount:  comments,
      shareCount:    shares,
      duration:      v.duration || 0,
      engagementRate: engRate,
      shareRate:     views > 0 ? parseFloat(((shares / views) * 100).toFixed(2)) : 0,
    };
  }).sort((a, b) => b.viewCount - a.viewCount);

  const n       = videos.length;
  const avgViews   = n > 0 ? Math.round(videos.reduce((s, v) => s + v.viewCount,      0) / n) : 0;
  const avgEngRate = n > 0 ? parseFloat((videos.reduce((s, v) => s + v.engagementRate, 0) / n).toFixed(2)) : 0;
  const avgShareRate = n > 0 ? parseFloat((videos.reduce((s, v) => s + v.shareRate,    0) / n).toFixed(2)) : 0;

  return {
    profile,
    videos,
    aggregates: { total: n, avgViews, avgEngRate, avgShareRate },
    _cachedAt: Date.now(),
  };
}

// ── Handler ─────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  const baseUrl      = process.env.KV_REST_API_URL;
  const kvToken      = process.env.KV_REST_API_TOKEN;
  const clientKey    = process.env.TT_CLIENT_KEY;
  const clientSecret = process.env.TT_CLIENT_SECRET;
  const force        = req.query?.force === 'true';

  if (!clientKey || !clientSecret) {
    return res.status(400).json({ ok: false, error: 'TikTok credentials not configured', hint: 'Add TT_CLIENT_KEY and TT_CLIENT_SECRET to Vercel env vars' });
  }
  if (!baseUrl || !kvToken) {
    return res.status(400).json({ ok: false, error: 'Redis not configured' });
  }

  // Cache check
  if (!force) {
    const cached = await kvGet(baseUrl, kvToken, CACHE_KEY);
    if (cached?._cachedAt && (Date.now() - cached._cachedAt) < CACHE_TTL) {
      return res.status(200).json({ ok: true, ...cached, fromCache: true });
    }
  }

  const tokenData = await getValidToken(baseUrl, kvToken, clientKey, clientSecret);
  if (!tokenData) {
    return res.status(401).json({ ok: false, notConnected: true, error: 'TikTok not connected — visit /api/tiktok-connect to authorize' });
  }

  try {
    const data = await fetchTtData(tokenData);
    await kvSet(baseUrl, kvToken, CACHE_KEY, data);
    return res.status(200).json({ ok: true, ...data, fromCache: false });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}
