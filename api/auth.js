// /api/auth.js — simple login for the Paul Ferrante dashboard
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, password } = req.body || {};
  const validEmail    = process.env.DASHBOARD_EMAIL;
  const validPassword = process.env.DASHBOARD_PASSWORD;
  const secret        = process.env.DASHBOARD_SECRET || 'pf_secret_2026';

  if (!validEmail || !validPassword) {
    return res.status(500).json({ ok: false, error: 'Auth not configured — set DASHBOARD_EMAIL, DASHBOARD_PASSWORD in Vercel env vars.' });
  }

  if (email === validEmail && password === validPassword) {
    // Simple deterministic token — valid as long as credentials don't change
    const token = Buffer.from(`${email}:${secret}`).toString('base64');
    return res.status(200).json({ ok: true, token });
  }

  return res.status(401).json({ ok: false, error: 'Incorrect email or password.' });
}
