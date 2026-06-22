// /api/instagram-stats.js — Instagram Graph API analytics + daily snapshot system
// GET  /api/instagram-stats              → fetch (cached 30 min)
// GET  /api/instagram-stats?force=true   → force refresh (clears stored token, re-bootstraps from env)
// GET  /api/instagram-stats?cron=1       → daily: refresh IG token + write IG + YT snapshot row
// GET  /api/instagram-stats?setup=true   → return IG User ID from token (first-time setup helper)
// GET  /api/instagram-stats?snapshots=1  → return last 90 days of daily snapshots (IG + TT + YT)

const IG_BASE    = 'https://graph.facebook.com/v20.0';
const CACHE_KEY  = 'pf_ig_stats_v1';
const TOKEN_KEY  = 'pf_ig_token_v1';
const CACHE_TTL  = 30 * 60 * 1000;  // 30 min
const SNAP_TTL_S = 100 * 86400;     // 100 days — slightly more than 90-day target

// YT inlined here so the IG cron can write a YT snapshot too — Hobby plan
// caps at 2 cron jobs total and IG + TikTok already use both slots.
const YT_KEY        = 'AIzaSyBw6nbEtl_ZN_aaijpp4njYgXT6enGj-pU';
const YT_CHANNEL_ID = 'UCpi1tHHbTLZmGvOoREHZDsw';
const YT_BASE       = 'https://www.googleapis.com/youtube/v3';

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
async function kvSetWithTtl(baseUrl, token, key, value, ttlSeconds) {
  try {
    await fetch(`${baseUrl}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([['SET', key, JSON.stringify(value), 'EX', ttlSeconds]]),
    });
  } catch {}
}
async function kvMget(baseUrl, token, keys) {
  if (!keys.length) return [];
  try {
    const body = keys.map(k => ['GET', k]);
    const r = await fetch(`${baseUrl}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await r.json();
    return (data || []).map(row => {
      const v = row?.result;
      if (!v) return null;
      try { return typeof v === 'string' ? JSON.parse(v) : v; } catch { return null; }
    });
  } catch { return []; }
}

// ── Snapshot key/date helpers ───────────────────────────────────
function snapKey(dateStr) { return `pf_snap_${dateStr}`; }
function todayUtc() { return new Date().toISOString().split('T')[0]; }
function dateNDaysAgo(n) {
  const d = new Date(); d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().split('T')[0];
}

// ── Token management ───────────────────────────────────────────
async function exchangeForLongLived(shortToken) {
  const appId     = process.env.IG_APP_ID;
  const appSecret = process.env.IG_APP_SECRET;
  if (!appId || !appSecret) return null;
  try {
    const res  = await fetch(`${IG_BASE}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${shortToken}`);
    const data = await res.json();
    if (data.access_token) {
      return { token: data.access_token, expiresAt: Date.now() + ((data.expires_in || 5184000) * 1000), refreshedAt: Date.now() };
    }
  } catch {}
  return null;
}

async function refreshLongLived(token) {
  try {
    const res  = await fetch(`${IG_BASE}/oauth/access_token?grant_type=ig_refresh_token&access_token=${token}`);
    const data = await res.json();
    if (data.access_token) {
      return { token: data.access_token, expiresAt: Date.now() + ((data.expires_in || 5184000) * 1000), refreshedAt: Date.now() };
    }
  } catch {}
  return null;
}

async function getToken(baseUrl, kvToken, opts = {}) {
  const envToken = process.env.IG_ACCESS_TOKEN;
  const now      = Date.now();
  const forceRefresh = opts.forceRefresh === true;

  if (baseUrl && kvToken) {
    const stored = await kvGet(baseUrl, kvToken, TOKEN_KEY);

    if (stored?.token) {
      const stillValid  = stored.expiresAt && now < stored.expiresAt;
      const hoursSince  = (now - (stored.refreshedAt || 0)) / 3600000;

      if (stillValid) {
        if (forceRefresh || hoursSince >= 24) {
          let refreshed = await refreshLongLived(stored.token);
          if (!refreshed) refreshed = await exchangeForLongLived(stored.token);
          if (refreshed) {
            await kvSet(baseUrl, kvToken, TOKEN_KEY, refreshed);
            return refreshed.token;
          }
        }
        return stored.token;
      }
    }
  }

  if (!envToken) return null;

  const refreshed = await refreshLongLived(envToken);
  const exchanged = refreshed || await exchangeForLongLived(envToken);

  if (exchanged && baseUrl && kvToken) {
    await kvSet(baseUrl, kvToken, TOKEN_KEY, exchanged);
    return exchanged.token;
  }

  if (baseUrl && kvToken) {
    const toStore = { token: envToken, expiresAt: now + (60 * 86400000), refreshedAt: now };
    await kvSet(baseUrl, kvToken, TOKEN_KEY, toStore);
  }
  return envToken;
}

// ── Insight helpers ─────────────────────────────────────────────
function extractInsightValue(metric, insightsData) {
  const found = (insightsData || []).find(m => m.name === metric);
  if (!found) return 0;
  if (typeof found.value === 'number') return found.value;
  if (Array.isArray(found.values) && found.values.length > 0) return found.values[0].value || 0;
  return 0;
}

// Fetch per-media insights resiliently.
// Meta deprecated `impressions`, `plays`, `video_views`, and
// `ig_reels_aggregated_all_plays_count` on 2025-04-21 — they are replaced by a
// single universal `views` metric. Requesting a deprecated metric makes the
// WHOLE call 400, which previously zeroed reach + saved for every post.
// We try a rich set first, then degrade so one bad metric can't wipe everything,
// and we RETURN the error instead of swallowing it.
async function fetchPostInsights(item, token) {
  const isVideo = item.media_type === 'REEL' || item.media_type === 'VIDEO';
  const sets = isVideo
    ? ['reach,saved,views,total_interactions', 'reach,saved,views', 'reach,saved', 'reach']
    : ['reach,saved,total_interactions', 'reach,saved', 'reach'];
  let lastErr = null;
  for (const metrics of sets) {
    try {
      const insRes  = await fetch(`${IG_BASE}/${item.id}/insights?metric=${metrics}&access_token=${token}`);
      const insData = await insRes.json();
      if (insData.error) { lastErr = insData.error.message || JSON.stringify(insData.error); continue; }
      return { ins: insData.data || [], err: null, metricsUsed: metrics };
    } catch (e) { lastErr = e.message; }
  }
  return { ins: [], err: lastErr, metricsUsed: null };
}

// ── Main IG data fetch ─────────────────────────────────────────────
async function fetchIgData(userId, token) {
  const profileRes = await fetch(`${IG_BASE}/${userId}?fields=followers_count,follows_count,media_count,name,username&access_token=${token}`);
  const profile = await profileRes.json();
  if (profile.error) throw new Error(`Instagram: ${profile.error.message}`);

  const mediaRes = await fetch(
    `${IG_BASE}/${userId}/media?fields=id,caption,media_type,timestamp,like_count,comments_count,thumbnail_url,media_url,permalink&limit=30&access_token=${token}`
  );
  const mediaData = await mediaRes.json();
  if (mediaData.error) throw new Error(`Instagram media: ${mediaData.error.message}`);

  let firstInsightsError = null;
  const posts = await Promise.all((mediaData.data || []).map(async (item) => {
    let reach = 0, impressions = 0, saved = 0, plays = 0;
    const { ins, err } = await fetchPostInsights(item, token);
    if (err && !firstInsightsError) firstInsightsError = err;
    reach       = extractInsightValue('reach',  ins);
    saved       = extractInsightValue('saved',  ins);
    // `views` is the post-2025 universal replacement for plays/video_views/impressions
    plays       = extractInsightValue('views',          ins) ||
                  extractInsightValue('ig_reels_plays', ins) ||
                  extractInsightValue('video_views',    ins) ||
                  extractInsightValue('plays',          ins);
    impressions = extractInsightValue('impressions', ins); // legacy; 0 post-deprecation

    const totalEng = (item.like_count || 0) + (item.comments_count || 0) + saved;
    const engRate  = reach > 0 ? parseFloat(((totalEng / reach) * 100).toFixed(2)) : 0;

    return {
      id:           item.id,
      caption:      (item.caption || '').slice(0, 180),
      mediaType:    item.media_type,
      timestamp:    item.timestamp,
      permalink:    item.permalink,
      thumbnail:    item.thumbnail_url || item.media_url || null,
      likeCount:    item.like_count    || 0,
      commentCount: item.comments_count || 0,
      saveCount:    saved,
      playCount:    plays,
      reach,
      impressions,
      engagementRate: engRate,
      totalInteractions: totalEng,
    };
  }));

  posts.sort((a, b) => b.reach - a.reach || b.likeCount - a.likeCount);

  const n = posts.length;
  const avgReach    = n > 0 ? Math.round(posts.reduce((s, p) => s + p.reach,           0) / n) : 0;
  const avgEngRate  = n > 0 ? parseFloat((posts.reduce((s, p) => s + p.engagementRate, 0) / n).toFixed(2)) : 0;
  const avgLikeRate = n > 0 && avgReach > 0
    ? parseFloat((posts.reduce((s, p) => s + (p.reach > 0 ? p.likeCount / p.reach * 100 : 0), 0) / n).toFixed(2)) : 0;
  const avgSaveRate = n > 0 && avgReach > 0
    ? parseFloat((posts.reduce((s, p) => s + (p.reach > 0 ? p.saveCount / p.reach * 100 : 0), 0) / n).toFixed(2)) : 0;

  return {
    profile: {
      username:       profile.username,
      name:           profile.name,
      followersCount: profile.followers_count || 0,
      followingCount: profile.follows_count   || 0,
      mediaCount:     profile.media_count     || 0,
    },
    posts,
    // avgViews is an alias of avgReach so the Overview trends panel (which reads
    // aggregates.avgViews for every platform) populates for IG too. IG has no true
    // "views" metric — reach is its closest analog.
    aggregates: { total: n, avgReach, avgViews: avgReach, avgEngRate, avgLikeRate, avgSaveRate },
    _debug: { insightsError: firstInsightsError },
    _cachedAt: Date.now(),
  };
}

// ── YT inline snapshot (channel + recent video aggregates) ──────
// Inlined so the IG cron can also snapshot YouTube — staying within Hobby
// plan's 2-cron limit.
async function fetchYtSnapshot() {
  try {
    const chRes  = await fetch(`${YT_BASE}/channels?part=statistics,contentDetails&id=${YT_CHANNEL_ID}&key=${YT_KEY}`);
    const chData = await chRes.json();
    const item   = chData.items?.[0];
    if (!item) return null;
    const subs    = parseInt(item.statistics?.subscriberCount) || 0;
    const uploads = item.contentDetails?.relatedPlaylists?.uploads;

    let avgViews = 0, avgEngRate = 0;
    if (uploads) {
      const plRes  = await fetch(`${YT_BASE}/playlistItems?part=snippet&playlistId=${uploads}&maxResults=30&key=${YT_KEY}`);
      const plData = await plRes.json();
      const ids    = (plData.items || []).map(it => it.snippet?.resourceId?.videoId).filter(Boolean);
      if (ids.length) {
        const vRes  = await fetch(`${YT_BASE}/videos?part=statistics&id=${ids.join(',')}&key=${YT_KEY}`);
        const vData = await vRes.json();
        const items = vData.items || [];
        const n = items.length;
        if (n) {
          const totalViews = items.reduce((s, v) => s + (parseInt(v.statistics?.viewCount) || 0), 0);
          avgViews = Math.round(totalViews / n);
          const totalEngPct = items.reduce((s, v) => {
            const views = parseInt(v.statistics?.viewCount)    || 0;
            const likes = parseInt(v.statistics?.likeCount)    || 0;
            const comm  = parseInt(v.statistics?.commentCount) || 0;
            return s + (views > 0 ? ((likes + comm) / views) * 100 : 0);
          }, 0);
          avgEngRate = parseFloat((totalEngPct / n).toFixed(2));
        }
      }
    }
    return { followers: subs, avgViews, avgEngRate };
  } catch { return null; }
}

// ── Handler ─────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  const baseUrl  = process.env.KV_REST_API_URL;
  const kvToken  = process.env.KV_REST_API_TOKEN;
  const userId   = process.env.IG_USER_ID;
  const force    = req.query?.force === 'true';
  const setup    = req.query?.setup  === 'true';
  const cron     = req.query?.cron   === '1';
  const snaps    = req.query?.snapshots === '1';

  // Snapshot read mode — returns last 90 days of daily snapshot rows for the dashboard
  if (snaps) {
    if (!baseUrl || !kvToken) return res.status(500).json({ ok: false, error: 'KV not configured' });
    const keys = [];
    for (let i = 0; i < 90; i++) keys.push(snapKey(dateNDaysAgo(i)));
    const values = await kvMget(baseUrl, kvToken, keys);
    const snapshots = values.filter(Boolean).sort((a, b) => (a.date < b.date ? -1 : 1));
    return res.status(200).json({ ok: true, count: snapshots.length, snapshots });
  }

  // Cron mode: refresh IG token + write daily snapshot row (IG + YT)
  if (cron) {
    if (!baseUrl || !kvToken) {
      return res.status(500).json({ ok: false, error: 'KV not configured' });
    }
    const token   = await getToken(baseUrl, kvToken, { forceRefresh: true });
    const stored  = await kvGet(baseUrl, kvToken, TOKEN_KEY);
    const daysLeft = stored?.expiresAt
      ? Math.round((stored.expiresAt - Date.now()) / 86400000)
      : null;

    // Daily snapshot — merge our IG + YT sections into today's row.
    // The TT cron writes its own tt section into the same key separately.
    const date = todayUtc();
    const key  = snapKey(date);
    const existing = (await kvGet(baseUrl, kvToken, key)) || { date, ts: 0 };

    if (token && userId) {
      try {
        const igData = await fetchIgData(userId, token);
        existing.ig = {
          followers:  igData.profile.followersCount || 0,
          avgViews:   igData.aggregates.avgReach   || 0,
          avgEngRate: igData.aggregates.avgEngRate || 0,
        };
        // Also refresh the cache so the dashboard sees fresh data immediately
        await kvSet(baseUrl, kvToken, CACHE_KEY, igData);
      } catch (e) { existing.igError = e.message; }
    }

    try {
      const yt = await fetchYtSnapshot();
      if (yt) existing.yt = yt;
    } catch (e) { existing.ytError = e.message; }

    existing.ts = Date.now();
    await kvSetWithTtl(baseUrl, kvToken, key, existing, SNAP_TTL_S);

    return res.status(200).json({
      ok: !!token,
      refreshedAt: new Date().toISOString(),
      tokenExpiresInDays: daysLeft,
      hasStoredToken: !!stored?.token,
      snapshot: { date, ig: !!existing.ig, yt: !!existing.yt, tt: !!existing.tt },
    });
  }

  // Setup mode
  if (setup) {
    const token = process.env.IG_ACCESS_TOKEN;
    if (!token) return res.status(400).json({ ok: false, error: 'Set IG_ACCESS_TOKEN in Vercel env vars first' });
    try {
      const pageRes  = await fetch(`${IG_BASE}/me/accounts?access_token=${token}`);
      const pageData = await pageRes.json();
      const pages    = pageData.data || [];
      const results  = await Promise.all(pages.map(async p => {
        const igRes  = await fetch(`${IG_BASE}/${p.id}?fields=instagram_business_account&access_token=${token}`);
        const igData = await igRes.json();
        return { pageName: p.name, pageId: p.id, igUserId: igData.instagram_business_account?.id || null };
      }));
      return res.status(200).json({ ok: true, pages: results, hint: 'Copy the igUserId and set it as IG_USER_ID in Vercel env vars' });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  }

  if (!userId) return res.status(400).json({ ok: false, error: 'IG_USER_ID not configured — visit /api/instagram-stats?setup=true' });

  // Cache check
  if (!force && baseUrl && kvToken) {
    const cached = await kvGet(baseUrl, kvToken, CACHE_KEY);
    if (cached?._cachedAt && (Date.now() - cached._cachedAt) < CACHE_TTL) {
      return res.status(200).json({ ok: true, ...cached, fromCache: true });
    }
  }

  if (force && baseUrl && kvToken) {
    await kvSet(baseUrl, kvToken, TOKEN_KEY, null);
  }

  const token = await getToken(baseUrl, kvToken);
  if (!token) return res.status(400).json({ ok: false, error: 'IG_ACCESS_TOKEN not configured' });

  try {
    const data = await fetchIgData(userId, token);
    if (baseUrl && kvToken) await kvSet(baseUrl, kvToken, CACHE_KEY, data);
    return res.status(200).json({ ok: true, ...data, fromCache: false });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}
