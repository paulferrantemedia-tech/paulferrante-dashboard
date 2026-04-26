// /api/tiktok-connect — Redirects browser to TikTok OAuth authorization page
// Visit this URL in browser to connect your TikTok account

export default function handler(req, res) {
  // Accept either naming convention (TT_* or TIKTOK_*)
  const clientKey = process.env.TT_CLIENT_KEY || process.env.TIKTOK_CLIENT_KEY;
  if (!clientKey) {
    return res.status(400).send(`
      <html><body style="background:#0a0a0a;color:#fff;font-family:sans-serif;padding:40px;max-width:500px">
        <h2 style="color:#f87171">TikTok client key not set</h2>
        <p>Add TT_CLIENT_KEY (or TIKTOK_CLIENT_KEY) to your Vercel environment variables first, then redeploy.</p>
      </body></html>
    `);
  }

  const redirectUri = encodeURIComponent(`https://paulferrante-dashboard-deploy.vercel.app/api/tiktok-auth`);
  const scopes      = 'user.info.basic,user.info.profile,user.info.stats,video.list';
  const state       = `pf_dashboard_${Date.now()}`;
  const authUrl     = `https://www.tiktok.com/v2/auth/authorize/?client_key=${clientKey}&scope=${scopes}&response_type=code&redirect_uri=${redirectUri}&state=${state}`;

  res.redirect(302, authUrl);
}
