// /api/remind — follow-up reminder emails via Resend
//
// When a deal is saved with a remindDate, the dashboard POSTs here once. We hand
// the email to Resend with `scheduledAt` so Resend delivers it on the reminder
// date. No cron is involved — Resend stores and sends the scheduled email.
//
// Root cause this file used to have: it sent to paulferrante84@gmail.com, which
// is NOT the Resend account address, so Resend (sandbox sender onboarding@resend.dev)
// rejected every send — and the dashboard swallowed the error, so it failed
// silently forever. Recipient is now paulferrantemedia@gmail.com and failures
// are reported.

const DEFAULT_TO = process.env.REMINDER_TO || 'paulferrantemedia@gmail.com';
const FROM       = process.env.RESEND_FROM || 'Paul Ferrante Dashboard <onboarding@resend.dev>';

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
  } catch (e) { body = { fetchError: e.message }; }
  return { status, ok, body };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const key = process.env.RESEND_API_KEY;
  const env = process.env.VERCEL_ENV || 'unknown';
  const { brand, nextStep, remindDate, dealValue, to } = req.body || {};
  if (!brand || !nextStep || !remindDate) return res.status(400).json({ error: 'Missing required fields' });
  if (!key) return res.status(500).json({ error: 'Email service not configured (RESEND_API_KEY missing)', env });

  const recipient = to || DEFAULT_TO;
  const formattedDate = new Date(remindDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  // Deliver ~9am Pacific on the reminder date. PDT = UTC-7 -> 16:00Z.
  const scheduledAt = new Date(remindDate + 'T16:00:00.000Z').toISOString();

  const payload = {
    from: FROM,
    to: [recipient],
    subject: `🔔 Follow-up reminder: ${brand}`,
    scheduledAt,
    html: `
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
      </div>`,
  };

  const result = await sendViaResend(key, payload);
  console.log('[remind]', JSON.stringify({ env, recipient, scheduledAt, status: result.status, ok: result.ok, body: result.body }));
  if (!result.ok) return res.status(502).json({ error: 'Failed to send/schedule email', resend: result });
  return res.status(200).json({ success: true, id: result.body && result.body.id, scheduledAt, recipient });
}
