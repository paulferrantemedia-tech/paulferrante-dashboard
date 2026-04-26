// POST /api/remind — called from the dashboard when a deal is saved with a remindDate
// Uses Resend (free tier) to send email reminders to Paul
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { brand, nextStep, remindDate, dealValue } = req.body;

  if (!brand || !nextStep || !remindDate) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    return res.status(500).json({ error: 'Email service not configured' });
  }

  const formattedDate = new Date(remindDate + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  // Schedule the email for 9am on the reminder date (Australian Eastern Time = UTC+10/+11)
  // We use UTC+10 (AEST) as a safe default — this means ~9am AEST year-round
  const scheduledAt = new Date(remindDate + 'T23:00:00.000Z').toISOString(); // 9am AEST next day in UTC

  const emailBody = {
    from: 'Paul Ferrante Dashboard <onboarding@resend.dev>',
    to: ['paulferrante84@gmail.com'],
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
      </div>
    `,
  };

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailBody),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(500).json({ error: 'Failed to send email', details: err });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
