// /api/remind — follow-up reminder emails via Resend
//
// When a deal is saved with a remindDate, the dashboard POSTs here once. We hand
// the email to Resend with `scheduled_at` so Resend delivers it on the reminder
// date. No cron is involved — Resend stores and sends the scheduled email.
//
// BUG FIXED 2026-06-20: the payload used `scheduledAt` (camelCase). Resend's REST
// API only recognises `scheduled_at` (snake_case) — the camelCase form is the SDK
// spelling, converted client-side by the SDK, but this file calls the raw HTTP API.
// Resend silently ignored the unknown field and sent EVERY reminder immediately (on
// the deal's creation day) instead of on the selected date. Now sends `scheduled_at`.
//
// Timezone: the reminder "date" is a calendar day in America/Los_Angeles (Paul is in
// Santa Monica). We deliver at ~09:00 Pacific on that day via `${remindDate}T16:00:00Z`
// (16:00Z = 09:00 PDT / 08:00 PST — same LA calendar day either way, so the email
// never slips to the day before or after).
//
// Earlier root cause (already fixed): it sent to paulferrante84@gmail.com, which is
// NOT the Resend account address, so Resend rejected every send silently. Recipient
// is now paulferrantemedia@gmail.com and failures are reported.

const DEFAULT_TO = process.env.REMINDER_TO || 'paulferrantemedia@gmail.com';
const FROM       = process.env.RESEND_FROM || 'Paul Ferrante Dashboard <onboarding@resend.dev>';

async function sendViaResend(key, payload, idempotencyKey) {
  let status = 0, ok = false, body = null;
  try {
    const headers = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
    // Phase 2 idempotency: identical requests within 24h are de-duplicated by Resend,
    // so a double-save can't produce two scheduled emails.
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    status = r.status; ok = r.ok;
    const text = await r.text();
    try { body = JSON.parse(text); } catch { body = text; }
  } catch (e) { body = { fetchError: e.message }; }
  return { status, ok, body };
}

// Cancel a previously scheduled Resend email — used when a deal's reminder date
// changes, so the old scheduled send doesn't still fire on the stale date.
async function cancelResend(key, id) {
  try {
    const r = await fetch(`https://api.resend.com/emails/${id}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
    });
    return { ok: r.ok, status: r.status };
  } catch (e) { return { ok: false, error: e.message }; }
}

// GET /api/remind?action=notify&key=SECRET&title=...&summary=...&idemp=...
// Emails an arbitrary summary immediately via Resend. Added for the daily brand-deal scan task,
// which can only make GET requests. Recipient is FIXED to your own address (no open relay); a key
// gates it. No new serverless function (kept in remind.js to stay within the Hobby 12-function cap).
async function handleNotify(req, res, key) {
  const env = process.env.VERCEL_ENV || 'unknown';
  const expected = process.env.NOTIFY_SECRET || process.env.DASHBOARD_SECRET || 'pf_secret_2026';
  if (String(req.query.key || '') !== expected) return res.status(403).json({ error: 'bad or missing key' });
  const title = String(req.query.title || 'Daily Brand-Deal Scan');
  const summary = String(req.query.summary || '');
  if (!summary) return res.status(400).json({ error: 'missing summary' });
  if (!key) return res.status(500).json({ error: 'Email service not configured (RESEND_API_KEY missing)', env });
  const recipient = process.env.REMINDER_TO || DEFAULT_TO; // FIXED to your address — not caller-supplied
  const idempotencyKey = req.query.idemp ? String(req.query.idemp) : undefined;
  const payload = {
    from: FROM,
    to: [recipient],
    subject: title,
    html: `<div style="font-family:Inter,Arial,sans-serif;background:#0a0a0a;color:#fff;padding:28px;border-radius:12px;max-width:600px;">
      <div style="color:#88EAF6;font-size:12px;letter-spacing:3px;text-transform:uppercase;margin-bottom:10px;">paul_ferrante | command center</div>
      <h2 style="margin:0 0 18px;font-size:20px;">${title}</h2>
      <div style="font-size:14px;line-height:1.55;color:#eaeaea;">${summary}</div>
      <div style="margin-top:22px;"><a href="https://paulferrante-dashboard-deploy.vercel.app" style="background:#88EAF6;color:#0a0a0a;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:800;font-size:12px;">Open Command Center →</a></div>
    </div>`,
  };
  const result = await sendViaResend(key, payload, idempotencyKey); // no scheduled_at -> sends now
  console.log('[notify]', JSON.stringify({ env, recipient, ok: result.ok, status: result.status, idempotencyKey: idempotencyKey || null }));
  if (!result.ok) return res.status(502).json({ error: 'Failed to send summary email', resend: result });
  return res.status(200).json({ ok: true, recipient });
}

export default async function handler(req, res) {
  const key = process.env.RESEND_API_KEY;
  // GET notify mode (daily scan summary email).
  if (req.method === 'GET' && req.query.action === 'notify') return handleNotify(req, res, key);

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const env = process.env.VERCEL_ENV || 'unknown';
  const { brand, nextStep, remindDate, dealValue, to, idempotencyKey, cancelId } = req.body || {};
  if (!brand || !nextStep || !remindDate) return res.status(400).json({ error: 'Missing required fields' });
  if (!key) return res.status(500).json({ error: 'Email service not configured (RESEND_API_KEY missing)', env });

  // Guard: never schedule a reminder for a date that isn't a real future/today
  // calendar day. A null/blank/past date must NOT fall through and fire now.
  const todayLA = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(remindDate)) return res.status(400).json({ error: 'remindDate must be YYYY-MM-DD', remindDate });
  if (remindDate < todayLA) return res.status(400).json({ error: 'remindDate is in the past — not scheduling', remindDate, todayLA });

  // If this deal already had a reminder scheduled and the date changed, cancel the
  // stale one first so it doesn't still fire on the old date.
  let cancelled = null;
  if (cancelId) cancelled = await cancelResend(key, cancelId);

  const recipient = to || DEFAULT_TO;
  const formattedDate = new Date(remindDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  // Deliver ~9am Pacific on the reminder date (16:00Z = 09:00 PDT / 08:00 PST).
  const scheduledAt = new Date(remindDate + 'T16:00:00.000Z').toISOString();

  const payload = {
    from: FROM,
    to: [recipient],
    subject: `🔔 Follow-up reminder: ${brand}`,
    scheduled_at: scheduledAt,
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

  const result = await sendViaResend(key, payload, idempotencyKey);
  console.log('[remind]', JSON.stringify({
    env, recipient, remindDate, todayLA, scheduledAt,
    idempotencyKey: idempotencyKey || null, cancelled,
    status: result.status, ok: result.ok, body: result.body,
  }));
  if (!result.ok) return res.status(502).json({ error: 'Failed to send/schedule email', resend: result });
  return res.status(200).json({ success: true, id: result.body && result.body.id, scheduledAt, recipient, cancelled });
}
