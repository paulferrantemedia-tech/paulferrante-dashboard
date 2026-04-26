// /api/instagram-token.js
// Visit: /api/instagram-token?token=YOUR_TOKEN&secret=pf_secret_2026
// Accepts a fresh Instagram token, auto-extends it to 60 days, stores in Redis.
// After this, the dashboard will work immediately — no redeploy needed.

const IG_BASE   = 'https://graph.facebook.com/v20.0';
const TOKEN_KEY = 'pf_ig_token_v1';

async function kvSet(baseUrl, kvToken, key, value) {
  try {
    await fetch(`${baseUrl}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${kvToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([['SET', key, JSON.stringify(value)]]),
    });
  } catch {}
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  // Simple secret check
  const secret   = req.query?.secret;
  const expected = process.env.DASHBOARD_SECRET || 'pf_secret_2026';
  if (secret !== expected) {
    return res.status(401).send(`
      <html><body style="font-family:sans-serif;padding:40px;background:#0a0a0a;color:#f87171">
        <h2>❌ Unauthorized</h2><p>Wrong or missing secret.</p>
      </body></html>
    `);
  }

  const newToken = req.query?.token;
  if (!newToken) {
    return res.status(400).send(`
      <html><body style="font-family:sans-serif;padding:40px;background:#0a0a0a;color:#88EAF6">
        <h2>Instagram Token Updater</h2>
        <p style="color:#ccc">Add <code>?token=YOUR_TOKEN</code> to the URL.</p>
        <p style="color:#ccc">Get a token from <a href="https://developers.facebook.com/tools/explorer" style="color:#88EAF6">Graph API Explorer</a>.</p>
      </body></html>
    `);
  }

  const baseUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (!baseUrl || !kvToken) {
    return res.status(500).send(`<html><body style="font-family:sans-serif;padding:40px;background:#0a0a0a;color:#f87171"><h2>❌ Redis not configured</h2></body></html>`);
  }

  const appId     = process.env.IG_APP_ID;
  const appSecret = process.env.IG_APP_SECRET;
  const now       = Date.now();

  let finalToken = newToken;
  let expiresAt  = now + (60 * 86400000); // default 60 days
  let method     = 'stored as-is (60 day assumed)';

  // 1. Try ig_refresh_token (works if already long-lived)
  try {
    const r = await fetch(`${IG_BASE}/oauth/access_token?grant_type=ig_refresh_token&access_token=${newToken}`);
    const d = await r.json();
    if (d.access_token) {
      finalToken = d.access_token;
      expiresAt  = now + ((d.expires_in || 5184000) * 1000);
      method     = 'extended via ig_refresh_token';
    }
  } catch {}

  // 2. If that didn't work, try fb_exchange_token (converts short-lived → long-lived)
  if (finalToken === newToken && appId && appSecret) {
    try {
      const r = await fetch(`${IG_BASE}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${newToken}`);
      const d = await r.json();
      if (d.access_token) {
        finalToken = d.access_token;
        expiresAt  = now + ((d.expires_in || 5184000) * 1000);
        method     = 'extended via fb_exchange_token (short→long-lived)';
      }
    } catch {}
  }

  await kvSet(baseUrl, kvToken, TOKEN_KEY, { token: finalToken, expiresAt, refreshedAt: now });

  const daysLeft = Math.round((expiresAt - now) / 86400000);
  const expDate  = new Date(expiresAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  return res.status(200).send(`
    <html><body style="font-family:sans-serif;padding:40px;background:#0a0a0a;color:#fff;max-width:600px">
      <h2 style="color:#96C9AA">✅ Instagram Token Updated</h2>
      <p><strong>Method:</strong> ${method}</p>
      <p><strong>Expires:</strong> ${expDate} (~${daysLeft} days)</p>
      <p style="color:#88EAF6;margin-top:24px">You can now close this tab and refresh your dashboard.</p>
      <p style="color:#6E6E6E;font-size:12px;margin-top:40px">Token is stored in Redis. The dashboard will auto-renew it daily going forward.</p>
    </body></html>
  `);
}
