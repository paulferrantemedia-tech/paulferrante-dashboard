// /api/remind — follow-up reminder emails via Resend
//
// Design: when a deal is saved with a remindDate, the dashboard POSTs here once.
// We hand the email to Resend with `scheduledAt` so Resend delivers it on the
// reminder date. No cron is involved (Resend stores + sends the scheduled email).
//
// Diagnostics (GET, requires &secret=):
//   /api/remind?test=now&to=you@x.com&secret=pf_secret_2026         -> send NOW, return Resend status+body
//   /api/remind?test=schedule&to=you@x.com&min=2&secret=pf_secret_2026 -> schedule ~N min out
//   optional &from=Name <addr@verified-domain>  to test a verified sender

const DEFAULT_TO = process.env.REMINDER_TO || 'paulferrantemedia@gmail.com';
const FROM       = process.env.RESEND_FROM || 'Paul Ferrante Dashboard <onboarding@resend.dev>';
const SECRET     = process.env.DASHBOARD_SECRET || 'pf_secret_2026';

async function sendViaResend(key, payload) {
  let status = 0, ok = false, body = null;
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    status = r.status; ok = r.ok;
    const text = await r.text();
    try { body = JSON.parse(text); } catch { body = text; }
  } catch (e) {
    body = { fetchError: e.message };
  }
  return { status, ok, body };
}

function reminderHtml({ brand, nextStep, dealValue, formattedDate }) {
  return `
    <div style="font-family: Inter, sans-serif; background: #0a0a0a; color: #fff; padding: 32px; border-radius: 12px; max-width: 520px;">
      <div style="color: #88EAF6; font-size: 12px; letter-spacing: 3px; text-transform: uppercase; margin-bottom: 8px;">paul_ferrante | command center</div>
      <h2 style="margin: 0 0 24px; font-size: 22px;">Follow-up reminder 🔔</h2>
      <div style="background: #2A4A5E; border-radius: 10px; padding: 20px; margin-bottom: 20px;">
        <div style="font-size: 11px; color: #88EAF6; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 6px;">Brand</div>
        <div style="font-size: 20px; font-weight: 800;">${brand}</div>
        ${dealValue ? `<div style="font-size: 13px; color: #E1D9AE; margin-top: 4px;">$${dealValue}</div>` : ''}
      </div>
      <div style="background: #111; border: 1px solid #2A4A5E; border-radius: 10px; padding: 16px; margin-bottom: 20px;">
        <div style="font-size: 11px; color: #88EAF6; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 6px;">Next Step</div>
        <div style="font-size: 15px; color: #fff;">${nextStep}</div>
      </div>
      <div style="font-size: 12px; color: #6E6E6E;">Reminder set for ${formattedDate}</div>
      <div style="margin-top: 24px;">
        <a href="https://paulferrante-dashboard-deploy.vercel.app" style="background: #88EAF6; color: #0a0a0a; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 800; font-size: 13px;">Open Dashboard →</a>
      </div>
    </div>`;
}

export default async function handler(req, res) {
  const key = process.env.RESEND_API_KEY;
  const env = process.env.VERCEL_ENV || 'unknown';
  const q = req.query || {};

  // ── GET diagnostics ──────────────────────────────────────────
  if (req.method === 'GET' && q.test) {
    if (q.secret !== SECRET) return res.status(403).json({ error: 'bad or missing secret' });
    if (!key) return res.status(500).json({ ok: false, env, reason: 'RESEND_API_KEY missing in this environment' });
    const to   = q.to || DEFAULT_TO;
    const from = q.from || FROM;
    const payload = {
      from, to: [to],
      subject: `✅ Command center test — ${new Date().toISOString()}`,
      html: `<p>Test email from the command center reminder pipeline.</p><p>from: ${from}<br>to: ${to}<br>env: ${env}</p>`,
    };
    if (q.test === 'schedule') {
      const mins = parseInt(q.min || '2', 10);
      payload.scheduledAt = new Date(Date.now() + mins * 60000).toISOString();
    }
    const result = await sendViaResend(key, payload);
    console.log('[remind-test]', JSON.stringify({ env, from, to, scheduledAt: payload.scheduledAt || null, status: result.status, ok: result.ok, body: result.body }));
    return res.status(result.ok ? 200 : 502).json({ env, from, to, scheduledAt: payload.scheduledAt || null, resend: result });
  }

  // ── POST: real reminder (called when a deal is saved) ────────
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { brand, nextStep, remindDate, dealValue, to } = req.body || {};
  if (!brand || !nextStep || !remindDate) return res.status(400).json({ error: 'Missing required fields' });
  if (!key) return res.status(500).json({ error: 'Email service not configured (RESEND_API_KEY missing)', env });

  const recipient = to || DEFAULT_TO;
  const formattedDate = new Date(remindDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  // Deliver at ~9am Pacific on the reminder date. PDT = UTC-7 → 16:00Z.
  const scheduledAt = new Date(remindDate + 'T16:00:00.000Z').toISOString();

  const payload = { from: FROM, to: [recipient], subject: `🔔 Follow-up reminder: ${brand}`, scheduledAt, html: reminderHtml({ brand, nextStep, dealValue, formattedDate }) };
  const result = await sendViaResend(key, payload);
  console.log('[remind]', JSON.stringify({ env, recipient, scheduledAt, status: result.status, ok: result.ok, body: result.body }));
  if (!result.ok) return res.status(502).json({ error: 'Failed to send/schedule email', resend: result });
  return res.status(200).json({ success: true, id: result.body && result.body.id, scheduledAt, recipient });
}
