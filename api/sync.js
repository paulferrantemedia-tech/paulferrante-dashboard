// /api/sync — cross-device state sync via Upstash Redis
// GET  /api/sync  → load dashboard state
// POST /api/sync  → save dashboard state

const KEY = 'pf_dashboard_state';

async function kvGet(baseUrl, token) {
  const res = await fetch(`${baseUrl}/get/${KEY}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Redis GET failed: ${res.status}`);
  const data = await res.json();
  if (!data.result) return null;
  // result may be a string (parse it) or already an object
  if (typeof data.result === 'string') {
    try { return JSON.parse(data.result); } catch { return null; }
  }
  return data.result;
}

async function kvSet(baseUrl, token, value) {
  // Use pipeline format so value is stored as a plain JSON string — no double-encoding
  const res = await fetch(`${baseUrl}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([['SET', KEY, JSON.stringify(value)]]),
  });
  if (!res.ok) throw new Error(`Redis SET failed: ${res.status}`);
  return res.json();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  // Prevent any layer (browser, CDN, Vercel edge) from caching sync responses
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const baseUrl = process.env.KV_REST_API_URL;
  const token   = process.env.KV_REST_API_TOKEN;

  if (!baseUrl || !token) {
    return res.status(500).json({ error: 'KV not configured', hint: 'KV_REST_API_URL and KV_REST_API_TOKEN must be set' });
  }

  if (req.method === 'GET') {
    try {
      const state = await kvGet(baseUrl, token);
      return res.status(200).json({ ok: true, state });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  }

  if (req.method === 'POST') {
    try {
      const state = req.body;
      if (!state || typeof state !== 'object') {
        return res.status(400).json({ error: 'Body must be a JSON object' });
      }
      await kvSet(baseUrl, token, { ...state, _savedAt: Date.now() });
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
