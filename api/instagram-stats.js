// /api/instagram-stats.js — Instagram Graph API analytics
// GET  /api/instagram-stats              → fetch (cached 30 min)
// GET  /api/instagram-stats?force=true   → force refresh (clears stored token, re-bootstraps from env)
// GET  /api/instagram-stats?cron=1       → lightweight token-refresh ping (called by Vercel Cron daily)
// GET  /api/instagram-stats?setup=true   → return IG User ID from token (first-time setup helper)

const IG_BASE    = 'https://graph.facebook.com/v20.0';
const CACHE_KEY  = 'pf_ig_stats_v1';
const TOKEN_KEY  = 'pf_ig_token_v1';
const CACHE_TTL  = 30 * 60 * 1000;  // 30 min

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

// ── Token management ───────────────────────────────────────────
// Strategy:
//  1. Redis has a valid long-lived token → use it; refresh daily to reset 60-day clock
//  2. Redis token expired / missing → use IG_ACCESS_TOKEN env var
//  3. If env var is short-lived (1h) → exchange via fb_exchange_token (needs IG_APP_ID + IG_APP_SECRET)
//  4. If env var is already long-lived → refresh via ig_refresh_token
//  5. Either way, store result in Redis so it auto-renews forever

// Convert a short-lived token into a 60-day long-lived token
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

// Extend an existing long-lived token for another 60 days
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
        // Proactively refresh: daily on read, or always when called from cron (forceRefresh)
        if (forceRefresh || hoursSince >= 24) {
          const refreshed = await refreshLongLived(stored.token);
          if (refreshed) {
            await kvSet(baseUrl, kvToken, TOKEN_KEY, refreshed);
            return refreshed.token;
          }
        }
        return stored.token;
      }
      // Stored token is expired — fall through to re-bootstrap from env var
    }
  }

  // No valid token in Redis → bootstrap from env var
  if (!envToken) return null;

  // Try to extend/refresh — handles both short-lived and long-lived env var tokens
  const refreshed = await refreshLongLived(envToken);   // works if already long-lived
  const exchanged = refreshed || await exchangeForLongLived(envToken); // works if short-lived

  if (exchanged && baseUrl && kvToken) {
    await kvSet(baseUrl, kvToken, TOKEN_KEY, exchanged);
    return exchanged.token;
  }

  // Fallback: use env var token as-is
  if (baseUrl && kvToken) {
    const toStore = { token: envToken, expiresAt: now + (60 * 86400000), refreshedAt: now };
    await kvSet(baseUrl, kvToken, TOKEN_KEY, toStore);
  }
  return envToken;
}

// ── Safely extract insight value from either API format ─────────
function extractInsightValue(metric, insightsData) {
  const found = (insightsData || []).find(m => m.name === metric);
  if (!found) return 0;
  if (typeof found.value === 'number') return found.value;
  if (Array.isArray(found.values) && found.values.length > 0) return found.values[0].value || 0;
  return 0;
}

// ── Main data fetch ─────────────────────────────────────────────
async function fetchIgData(userId, token) {
  // 1. Profile
  const profileRes = await fetch(`${IG_BASE}/${userId}?fields=followers_count,follows_count,media_count,name,username&access_token=${token}`);
  const profile = await profileRes.json();
  if (profile.error) throw new Error(`Instagram: ${profile.error.message}`);

  // 2. Recent media
  const mediaRes = await fetch(
    `${IG_BASE}/${userId}/media?fields=id,caption,media_type,timestamp,like_count,comments_count,thumbnail_url,media_url,permalink&limit=30&access_token=${token}`
  );
  const mediaData = await mediaRes.json();
  if (mediaData.error) throw new Error(`Instagram media: ${mediaData.error.message}`);

  // 3. Insights per post (parallel for speed)
  const posts = await Promise.all((mediaData.data || []).map(async (item) => {
    let reach = 0, impressions = 0, saved = 0, plays = 0;
    try {
      // NOTE: 'impressions' is only valid for IMAGE/CAROUSEL — using it for VIDEO/REEL causes the entire call to fail silently
      let metrics;
      if (item.media_type === 'REEL') {
        metrics = 'reach,saved,ig_reels_plays,total_interactions';
      } else if (item.media_type === 'VIDEO') {
        metrics = 'reach,saved,video_views,total_interactions';
      } else {
        metrics = 'reach,impressions,saved,total_interactions';
      }
      const insRes  = await fetch(`${IG_BASE}/${item.id}/insights?metric=${metrics}&access_token=${token}`);
      const insData = await insRes.json();
      const ins = insData.data || [];
      reach       = extractInsightValue('reach',              ins);
      impressions = extractInsightValue('impressions',        ins);
      saved       = extractInsightValue('saved',              ins);
      plays       = extractInsightValue('ig_reels_plays',     ins) ||
                    extractInsightValue('video_views',        ins) ||
                    extractInsightValue('plays',              ins);
    } catch {}

    const totalEng = (item.like_count || 0) + (item.comments_count || 0) + saved;
    const engRate  = reach > 0 ? parseFloat(((totalEng / reach) * 100).toFixed(2)) : 0;

    return {
      id:           item.id,
      caption:      (item.caption || '').slice(0, 180),
      mediaType:    item.media_type,      // IMAGE, VIDEO, CAROUSEL_ALBUM, REEL
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

  // Sort by reach desc
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
    aggregates: { total: n, avgReach, avgEngRate, avgLikeRate, avgSaveRate },
    _cachedAt: Date.now(),
  };
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

  // Cron mode: lightweight token-refresh ping triggered daily by Vercel Cron.
  // Forces refresh of the stored long-lived token to reset the 60-day clock,
  // even if the dashboard hasn't been opened. Skips cache and stats fetch
  // to keep function compute minimal.
  if (cron) {
    if (!baseUrl || !kvToken) {
      return res.status(500).json({ ok: false, error: 'KV not configured' });
    }
    const token   = await getToken(baseUrl, kvToken, { forceRefresh: true });
    const stored  = await kvGet(baseUrl, kvToken, TOKEN_KEY);
    const daysLeft = stored?.expiresAt
      ? Math.round((stored.expiresAt - Date.now()) / 86400000)
      : null;
    return res.status(200).json({
      ok: !!token,
      refreshedAt: new Date().toISOString(),
      tokenExpiresInDays: daysLeft,
      hasStoredToken: !!stored?.token,
    });
  }

  // Setup mode: find IG User ID from token (first-time helper)
  if (setup) {
    const token = process.env.IG_ACCESS_TOKEN;
    if (!token) return res.status(400).json({ ok: false, error: 'Set IG_ACCESS_TOKEN in Vercel env vars first' });
    try {
      const pageRes = await fetch(`${IG_BASE}/me/accounts?access_token=${token}`);
      const pageData = await pageRes.json();
      const pages = pageData.data || [];
      const results = await Promise.all(pages.map(async p => {
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

  // Force-reset: clear cached token so env var is picked up fresh
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
