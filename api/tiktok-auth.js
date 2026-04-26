// /api/tiktok-auth — TikTok OAuth callback handler
// TikTok redirects here after user authorizes. Exchanges code for tokens, stores in Redis.

async function kvSet(baseUrl, token, key, value) {
  await fetch(`${baseUrl}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([['SET', key, JSON.stringify(value)]]),
  });
}

export default async function handler(req, res) {
  const { code, error: authError, error_description } = req.query;

  if (authError) {
    return res.status(400).send(errorPage(`TikTok auth failed: ${error_description || authError}`));
  }
  if (!code) {
    return res.status(400).send(errorPage('No authorization code received from TikTok.'));
  }

  const clientKey    = process.env.TT_CLIENT_KEY;
  const clientSecret = process.env.TT_CLIENT_SECRET;
  const redirectUri  = 'https://paulferrante-dashboard-deploy.vercel.app/api/tiktok-auth';
  const baseUrl      = process.env.KV_REST_API_URL;
  const kvToken      = process.env.KV_REST_API_TOKEN;

  if (!clientKey || !clientSecret) {
    return res.status(500).send(errorPage('TT_CLIENT_KEY or TT_CLIENT_SECRET not configured in Vercel.'));
  }

  try {
    // Exchange authorization code for tokens
    const tokenRes = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_key:    clientKey,
        client_secret: clientSecret,
        code,
        grant_type:    'authorization_code',
        redirect_uri:  redirectUri,
      }),
    });

    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      return res.status(400).send(errorPage(`Token exchange failed: ${tokenData.error_description || tokenData.error}`));
    }

    // Store tokens in Redis (refresh token lasts 365 days, access token 24h)
    if (baseUrl && kvToken) {
      await kvSet(baseUrl, kvToken, 'pf_tt_tokens_v1', {
        accessToken:   tokenData.access_token,
        refreshToken:  tokenData.refresh_token,
        openId:        tokenData.open_id,
        scope:         tokenData.scope,
        expiresAt:     Date.now() + ((tokenData.expires_in || 86400) * 1000),
        connectedAt:   Date.now(),
      });
    }

    return res.status(200).send(successPage());
  } catch (e) {
    return res.status(500).send(errorPage(`Server error: ${e.message}`));
  }
}

function successPage() {
  return `<!DOCTYPE html>
<html><head><title>TikTok Connected</title></head>
<body style="background:#0a0a0a;color:#fff;font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;flex-direction:column;gap:16px;padding:20px;text-align:center">
  <div style="font-size:56px">✓</div>
  <div style="font-size:22px;font-weight:800">TikTok Connected!</div>
  <div style="font-size:14px;color:#888;max-width:320px;line-height:1.6">Your TikTok account is now linked to the dashboard. Analytics will appear in the Analytics tab within a few seconds.</div>
  <button onclick="window.close()" style="margin-top:8px;background:#88EAF6;color:#0a0a0a;border:none;border-radius:10px;padding:14px 28px;font-weight:800;font-size:14px;cursor:pointer;font-family:inherit">Close this window</button>
</body></html>`;
}

function errorPage(msg) {
  return `<!DOCTYPE html>
<html><head><title>TikTok Auth Error</title></head>
<body style="background:#0a0a0a;color:#fff;font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;flex-direction:column;gap:16px;padding:20px;text-align:center">
  <div style="font-size:56px">⚠</div>
  <div style="font-size:22px;font-weight:800;color:#f87171">Connection Failed</div>
  <div style="font-size:13px;color:#888;max-width:400px;line-height:1.6">${msg}</div>
  <button onclick="window.close()" style="margin-top:8px;background:#1e1e1e;color:#fff;border:1px solid #333;border-radius:10px;padding:14px 28px;font-weight:700;font-size:14px;cursor:pointer;font-family:inherit">Close</button>
</body></html>`;
}
