// TEMPORARY one-time endpoint: batch attach receipt_url to expenses.
// Guarded by a token. DELETE AFTER USE.
const TOKEN = 'receipt-attach-oct5-2026';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const { token, mappings } = req.body || {};
  if (token !== TOKEN) return res.status(403).json({ error: 'bad token' });
  if (!Array.isArray(mappings)) return res.status(400).json({ error: 'mappings array required' });

  const { google } = await import('googleapis');
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: (process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '').replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });
  const sheetId = process.env.GOOGLE_SHEETS_ID;

  const results = [];
  for (const m of mappings) {
    try {
      const get = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId, range: 'Expenses!A1:AA',
      });
      const rows = get.data.values || [];
      const headers = rows[0];
      const idIdx = headers.indexOf('expense_id');
      const urlIdx = headers.indexOf('receipt_url');
      let rowNum = -1;
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][idIdx] === m.expense_id) { rowNum = i + 1; break; }
      }
      if (rowNum === -1) { results.push({ expense_id: m.expense_id, error: 'not found' }); continue; }
      const col = String.fromCharCode(65 + urlIdx);
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId, range: `Expenses!${col}${rowNum}`,
        valueInputOption: 'RAW', requestBody: { values: [[m.receipt_url]] },
      });
      results.push({ expense_id: m.expense_id, ok: true });
    } catch (e) {
      results.push({ expense_id: m.expense_id, error: e.message });
    }
  }
  return res.status(200).json({ ok: true, results });
}
