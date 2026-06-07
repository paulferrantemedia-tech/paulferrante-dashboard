// /api/sync — cross-device state sync via Upstash Redis
// PLUS Books module (consolidated to keep Vercel Hobby at 12/12 functions)
//
// Routes:
//   GET  /api/sync                                → load dashboard state (existing)
//   POST /api/sync                                → save dashboard state (existing)
//   POST /api/sync?action=process-receipt         → AI-extract a receipt from Drive, write to Sheet  [Apps Script calls this]
//   GET  /api/sync?action=books-data&year=2026    → read all Books rows (Expenses, Deals, etc.) for a year
//   POST /api/sync?action=update-expense          → patch a single Expenses row (review confirms, edits)
//   POST /api/sync?action=upsert-deal             → create/update a Deals row
//   POST /api/sync?action=manual-expense          → manual-entry expense (no AI extraction)
//   POST /api/sync?action=year-export&kind=csv    → returns CSV string for CPA
//   POST /api/sync?action=year-export&kind=audit  → returns audit-binder data
//
// Required env vars (existing): KV_REST_API_URL, KV_REST_API_TOKEN, ANTHROPIC_API_KEY
// New env vars for Books:
//   GOOGLE_SHEETS_ID                — the spreadsheet ID for RGG_Books
//   GOOGLE_SERVICE_ACCOUNT_EMAIL    — from the service account JSON
//   GOOGLE_SERVICE_ACCOUNT_KEY      — private_key from the service account JSON (preserve newlines)
//   GOOGLE_DRIVE_INBOX_ID           — folder ID of RGG_Receipts/<YEAR>/_inbox/
//   GOOGLE_DRIVE_PROCESSED_ID       — folder ID of RGG_Receipts/<YEAR>/_processed/
//   GOOGLE_DRIVE_FAILED_ID          — folder ID of RGG_Receipts/<YEAR>/_failed/
//   APPS_SCRIPT_SHARED_SECRET       — random string; Apps Script must send this in X-Books-Secret header

const KEY = 'pf_dashboard_state';
export const config = { maxDuration: 60 }; // allow the backlog importer time for vision calls

// ─────────────────────────────────────────────────────────────
// Existing Redis helpers (unchanged)
// ─────────────────────────────────────────────────────────────
async function kvGet(baseUrl, token) {
  const res = await fetch(`${baseUrl}/get/${KEY}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Redis GET failed: ${res.status}`);
  const data = await res.json();
  if (!data.result) return null;
  if (typeof data.result === 'string') {
    try { return JSON.parse(data.result); } catch { return null; }
  }
  return data.result;
}

async function kvSet(baseUrl, token, value) {
  const res = await fetch(`${baseUrl}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([['SET', KEY, JSON.stringify(value)]]),
  });
  if (!res.ok) throw new Error(`Redis SET failed: ${res.status}`);
  return res.json();
}

// ─────────────────────────────────────────────────────────────
// Google API auth (service-account JWT — no extra deps)
// ─────────────────────────────────────────────────────────────
async function getGoogleAccessToken() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!email || !rawKey) throw new Error('Google service account env vars missing');
  const privateKey = rawKey.replace(/\\n/g, '\n');

  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: email,
    scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };
  const header = { alg: 'RS256', typ: 'JWT' };
  const enc = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const unsigned = `${enc(header)}.${enc(claim)}`;

  // Sign with RS256 using node:crypto
  const { createSign, createPrivateKey } = await import('node:crypto');
  const keyObj = createPrivateKey(privateKey);
  const signer = createSign('RSA-SHA256');
  signer.update(unsigned);
  const signature = signer.sign(keyObj).toString('base64url');
  const jwt = `${unsigned}.${signature}`;

  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`Google token exchange failed: ${r.status} ${t}`);
  }
  const j = await r.json();
  return j.access_token;
}

// ─────────────────────────────────────────────────────────────
// Sheets helpers
// ─────────────────────────────────────────────────────────────
// Drive folder IDs are sometimes pasted from a browser URL with trailing junk
// like "<id>?dmr=1&ec=...". Strip anything after the id so lookups don't 404.
function cleanDriveId(x) { return String(x || '').replace(/[?#&].*$/, '').trim(); }
function driveFileIdFromUrl(u) { const t = String(u || ''); const m = t.match(/\/d\/([^/]+)/) || t.match(/[?&]id=([^&]+)/); return m ? m[1] : null; }

async function sheetsGet(token, sheetId, range) {
  const r = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!r.ok) throw new Error(`Sheets GET ${range} failed: ${r.status} ${await r.text()}`);
  const j = await r.json();
  return j.values || [];
}

async function sheetsAppend(token, sheetId, range, values) {
  const r = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values }),
    }
  );
  if (!r.ok) throw new Error(`Sheets APPEND ${range} failed: ${r.status} ${await r.text()}`);
  return r.json();
}

async function sheetsUpdate(token, sheetId, range, values) {
  const r = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values }),
    }
  );
  if (!r.ok) throw new Error(`Sheets UPDATE ${range} failed: ${r.status} ${await r.text()}`);
  return r.json();
}

// Convert a sheet (rows of values, first row = headers) into objects
function rowsToObjects(values) {
  if (!values || values.length < 2) return [];
  const headers = values[0];
  return values.slice(1).map((row, i) => {
    const o = { _rowIndex: i + 2 }; // 1-indexed; row 1 is headers
    headers.forEach((h, idx) => { o[h] = row[idx] ?? ''; });
    return o;
  });
}

// Convert an object into an ordered row array following a header list
function objectToRow(obj, headers) {
  return headers.map((h) => {
    const v = obj[h];
    if (v === undefined || v === null) return '';
    if (Array.isArray(v)) return v.join(',');
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
  });
}

// ─────────────────────────────────────────────────────────────
// Drive helpers
// ─────────────────────────────────────────────────────────────
async function driveDownloadFile(token, fileId) {
  // returns { mimeType, base64, fileName }
  // Anthropic vision caps images at 5 MB. For oversized images, try to get
  // a smaller version via several Drive URL strategies in order of preference.
  // PDFs always go through the normal path (Anthropic accepts larger PDFs).
  const ANTHROPIC_MAX = 5_242_880; // 5 MB in bytes
  const RESIZE_THRESHOLD = 4_500_000; // start trying smaller versions above this

  const meta = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,size,thumbnailLink`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!meta.ok) throw new Error(`Drive metadata failed: ${meta.status}`);
  const m = await meta.json();

  const isImage = m.mimeType && m.mimeType.startsWith('image/');
  const sizeBytes = Number(m.size || 0);

  // Helper: try to fetch a candidate URL with several auth strategies.
  // Returns a Buffer if it works and the result is under the cap, else null.
  async function tryFetchUnderCap(url, label) {
    const tries = [
      { headers: { Authorization: `Bearer ${token}` } },
      { headers: {} }, // unauthed (works for thumbnail URLs that bake auth in)
    ];
    for (const init of tries) {
      try {
        const r = await fetch(url, init);
        if (!r.ok) continue;
        const tbuf = Buffer.from(await r.arrayBuffer());
        if (tbuf.length > 0 && tbuf.length < ANTHROPIC_MAX) {
          console.log(`[resize] ${label} succeeded: ${tbuf.length} bytes`);
          return tbuf;
        }
      } catch (_) { /* try next */ }
    }
    return null;
  }

  // Oversized image path: try multiple resize strategies
  if (isImage && sizeBytes > RESIZE_THRESHOLD) {
    console.log(`[resize] image ${m.name} is ${sizeBytes} bytes — attempting downsize. thumbnailLink: ${m.thumbnailLink ? 'present' : 'MISSING'}`);

    const candidates = [];
    // Strategy 1: thumbnailLink with various size suffixes (covers =sNNN and =wNNN-hNNN formats)
    if (m.thumbnailLink) {
      for (const sz of [2000, 1800, 1600, 1400, 1200]) {
        candidates.push({
          url: m.thumbnailLink
            .replace(/=s\d+(?:[^&]*)?$/, `=s${sz}`)
            .replace(/=w\d+-h\d+(?:[^&]*)?$/, `=w${sz}-h${sz}`),
          label: `thumbnailLink=s${sz}`,
        });
      }
    }
    // Strategy 2: drive.google.com/thumbnail constructed URL at multiple sizes
    for (const sz of [2000, 1800, 1600, 1400, 1200]) {
      candidates.push({
        url: `https://drive.google.com/thumbnail?id=${fileId}&sz=w${sz}`,
        label: `drive.google.com/thumbnail&sz=w${sz}`,
      });
    }
    // Strategy 3: googleusercontent direct via fileId
    candidates.push({
      url: `https://lh3.googleusercontent.com/d/${fileId}=s2000`,
      label: 'lh3.googleusercontent.com=s2000',
    });

    for (const c of candidates) {
      const buf = await tryFetchUnderCap(c.url, c.label);
      if (buf) return { mimeType: 'image/jpeg', base64: buf.toString('base64'), fileName: m.name };
    }
    console.log('[resize] all downsize strategies failed for', m.name);
  }

  const dl = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!dl.ok) throw new Error(`Drive download failed: ${dl.status}`);
  const buf = Buffer.from(await dl.arrayBuffer());

  // Last-resort guard: image still too big and no resize strategy worked
  if (isImage && buf.length > ANTHROPIC_MAX) {
    throw new Error(`Image too large: ${buf.length} bytes (max ${ANTHROPIC_MAX}). All Drive thumbnail strategies failed — file may be too new for thumbnails. Wait 60s and retry, or compress before uploading.`);
  }

  return { mimeType: m.mimeType, base64: buf.toString('base64'), fileName: m.name };
}

async function driveMoveFile(token, fileId, newParentId, oldParentId) {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?addParents=${newParentId}&removeParents=${oldParentId}&fields=id,parents,webViewLink`;
  const r = await fetch(url, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`Drive move failed: ${r.status} ${await r.text()}`);
  return r.json();
}

async function driveGetWebLink(token, fileId) {
  const r = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?fields=webViewLink`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!r.ok) return null;
  const j = await r.json();
  return j.webViewLink || null;
}

// ─────────────────────────────────────────────────────────────
// Anthropic vision extraction
// ─────────────────────────────────────────────────────────────
const EXTRACTION_PROMPT = `You are extracting structured data from a receipt for tax purposes for a US-based LLC (RGG Media, a creator/media business).
Return ONLY a JSON object with this exact schema, no preamble:
{
  "vendor": string,
  "date": "YYYY-MM-DD",
  "amount_total": number,
  "currency": "USD" | "AUD" | "EUR" | etc.,
  "tax_amount": number | null,
  "tip_amount": number | null,
  "payment_method": string | null,
  "line_items": [ { "description": string, "amount": number } ],
  "category_suggestion": string,
  "category_reasoning": string,
  "suggested_business_purpose": string,
  "confidence": "high" | "medium" | "low",
  "confidence_notes": string | null,
  "is_business_likely": boolean,
  "raw_text": string
}
CATEGORY OPTIONS (pick exactly one for category_suggestion):
- Equipment & Hardware
- Software & Subscriptions
- Travel - Lodging
- Travel - Transportation
- Travel - Meals
- Meals & Entertainment
- Home Office
- Professional Services
- Marketing & Advertising
- Internet & Phone
- Production Costs
- Education & Research
- Bank & Payment Fees
- Office Supplies
- Other
Rules:
- If the receipt is unreadable or not a receipt, return all fields null with confidence "low" and explain in confidence_notes.
- Hotels/Airbnbs → "Travel - Lodging".
- Flights/Uber/Lyft/gas/rental cars → "Travel - Transportation".
- Restaurant meals where the date suggests travel → "Travel - Meals" (50% deductible).
- Local restaurant meals → "Meals & Entertainment" (50% deductible).
- Adobe/Notion/Canva/CapCut/Figma/hosting → "Software & Subscriptions".
- Cameras, mics, smart glasses, computers, storage drives → "Equipment & Hardware".
- If unsure, pick "Other" and explain.

EDGE CASES:
- Multi-page PDFs: extract from all pages and return a single consolidated total. Use the final/grand total, not subtotals from individual pages.
- Multiple receipts in one image: return the most prominent receipt. Set confidence to "low" and put "multiple receipts detected — extracted the most prominent" in confidence_notes.
- Foreign currency: extract the currency field accurately (USD, AUD, EUR, etc.). Do NOT convert. Keep amount_total in the original currency.
- Handwritten receipts: extract what you can. Set confidence to "low" and note "handwritten" in confidence_notes.
- Email confirmations (Airbnb, Uber, hotel/flight confirmations): treat them as receipts. Extract vendor, date, amount, currency normally.
- Screenshots of mobile order confirmations: extract normally — these are valid receipts.
- Tip vs total: amount_total is ALWAYS the final paid amount INCLUDING tip. If tip is shown separately, also populate tip_amount, but amount_total stays as the final-paid value.
- If image quality is too poor to read key fields with confidence: set confidence to "low" and explain in confidence_notes (blurry, glare, partial cutoff, etc.).

SUGGESTED BUSINESS PURPOSE GUIDANCE:
The owner runs RGG Media — a creator and media business focused on TikTok, Instagram, YouTube, UGC, brand partnerships, and travel/lifestyle content. Write a SPECIFIC, audit-defensible draft business purpose tied to that work. One sentence. Avoid generic phrases like "business expense" or "business meal" — be concrete about what the receipt likely supports.

Examples by category:
- Coffee shop / café (small ticket, single person implied): "Working session — content planning and scripting for RGG Media."
- Restaurant or coffee with multiple items implying two people: "Meeting with collaborator or brand contact — content partnership discussion."
- Hotel / Airbnb: "Lodging during content production trip to {city if visible from receipt}."
- Flight / Uber / Lyft / rental car: "Travel for content production / brand shoot."
- Adobe / Notion / Canva / CapCut / Figma / hosting / SaaS: "{Product name} subscription used for editing and producing RGG Media content."
- Camera / mic / lens / smart glasses / SD cards / drives: "{Item} used for video production for RGG Media TikTok / IG / YouTube content."
- Office supplies / home office: "Home office supply for content production workspace."
- Marketing & advertising: "Promotion / advertising spend for RGG Media content distribution."
- Internet / phone bill: "Internet / phone service used for RGG Media content production and brand outreach."
- Education / books / courses: "Educational material for content / business skills development."
- Bank / payment fee: "Bank or payment processing fee on RGG Media business account."
- Professional services (legal, CPA, contractor): "Professional services for RGG Media operations."
- If category is "Other" or you genuinely cannot infer a plausible business use: write "REVIEW NEEDED — unable to infer business purpose from receipt." Paul will fill it in.`;

async function anthropicExtract(base64, mimeType) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY missing');

  // Map mime types: images go in image content block; PDFs go in document block
  const isPdf = mimeType === 'application/pdf';
  const isImg = mimeType && mimeType.startsWith('image/');
  if (!isPdf && !isImg) {
    return { ok: false, error: `Unsupported mime ${mimeType}`, parsed: null };
  }

  const fileBlock = isPdf
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
    : { type: 'image',    source: { type: 'base64', media_type: mimeType,         data: base64 } };

  const body = {
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    messages: [{
      role: 'user',
      content: [ fileBlock, { type: 'text', text: EXTRACTION_PROMPT } ],
    }],
  };

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      // For PDF support
      'anthropic-beta': 'pdfs-2024-09-25',
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const txt = await r.text();
    return { ok: false, error: `Anthropic ${r.status}: ${txt}`, parsed: null };
  }
  const j = await r.json();
  const text = j?.content?.[0]?.text || '';
  // Strip code fences if present
  const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  let parsed = null;
  try { parsed = JSON.parse(clean); } catch (e) {
    return { ok: false, error: `JSON parse failed: ${e.message}`, parsed: null, raw: text };
  }
  return { ok: true, parsed };
}

// ─────────────────────────────────────────────────────────────
// Books column schemas
// ─────────────────────────────────────────────────────────────
const EXPENSE_HEADERS = [
  'expense_id','date','vendor','amount','currency',
  'category_auto','category','category_reasoning','payment_method','business_purpose',
  'receipt_url','auto_linked_deal_id','linked_deal_id','linked_deal_id_2',
  'extraction_confidence','confidence_notes','extracted_text',
  'entered_by','extracted_at','flags','reviewed','notes','personal_suspect',
];
const DEAL_HEADERS = [
  'deal_id','brand','deal_value','status','platform',
  'deliverable_url','invoice_url','shoot_start_date','shoot_end_date',
  'usage_rights','paid_date','notes',
];
const VENDOR_HEADERS = ['vendor_normalized','category','confirmation_count','last_confirmed_at','business_purpose_template'];
const LOG_HEADERS = ['log_id','file_name','file_id','started_at','completed_at','status','error_message','expense_id'];

const CATEGORIES = [
  'Equipment & Hardware','Software & Subscriptions','Travel - Lodging','Travel - Transportation',
  'Travel - Meals','Meals & Entertainment','Home Office','Professional Services',
  'Marketing & Advertising','Internet & Phone','Production Costs','Education & Research',
  'Bank & Payment Fees','Office Supplies','Other',
];
const TRAVEL_CATEGORIES = ['Travel - Lodging','Travel - Transportation','Travel - Meals'];

function uuid() {
  // RFC 4122 v4-ish; not cryptographically perfect but fine for IDs here
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function nowIso() { return new Date().toISOString(); }

function normalizeVendor(v) {
  return String(v || '').toLowerCase().trim().replace(/\s+/g, ' ');
}

function computeFlags(row, vendorMemorySet) {
  const flags = [];
  if (row.extraction_confidence === '__failed__') flags.push('extraction_failed');
  if (row.extraction_confidence === 'low')        flags.push('low_confidence_extraction');
  if (!row.business_purpose || String(row.business_purpose).trim().length < 10) flags.push('missing_purpose');
  if (row.auto_linked_deal_id && String(row.reviewed).toLowerCase() !== 'true') flags.push('auto_link_pending');
  if (Number(row.amount) > 200 && !row.linked_deal_id && TRAVEL_CATEGORIES.includes(row.category)
      && String(row.reviewed).toLowerCase() !== 'true') flags.push('unlinked_high_value');
  if (row.category === 'Other') flags.push('category_other');
  if (vendorMemorySet && row.vendor && !vendorMemorySet.has(normalizeVendor(row.vendor))
      && row.extraction_confidence !== 'high') flags.push('vendor_unknown');
  if (String(row.personal_suspect).toLowerCase() === 'true' && String(row.reviewed).toLowerCase() !== 'true') {
    flags.push('personal_suspect');
  }
  if (row.extracted_at) {
    const days = (Date.now() - new Date(row.extracted_at).getTime()) / 86400000;
    if (days > 30 && String(row.reviewed).toLowerCase() !== 'true') flags.push('over_30_days_unreviewed');
  }
  return flags;
}

// ─────────────────────────────────────────────────────────────
// process-receipt action (called by Apps Script)
// ─────────────────────────────────────────────────────────────
async function handleProcessReceipt(req, res) {
  // Apps Script must send this header
  if ((req.headers['x-books-secret'] || '') !== (process.env.APPS_SCRIPT_SHARED_SECRET || '__unset__')) {
    return res.status(401).json({ error: 'invalid shared secret' });
  }

  const { fileId, fileName } = req.body || {};
  if (!fileId) return res.status(400).json({ error: 'fileId required' });

  const sheetId = process.env.GOOGLE_SHEETS_ID;
  const inboxId = cleanDriveId(process.env.GOOGLE_DRIVE_INBOX_ID);
  const processedId = cleanDriveId(process.env.GOOGLE_DRIVE_PROCESSED_ID);
  const failedId = cleanDriveId(process.env.GOOGLE_DRIVE_FAILED_ID);
  if (!sheetId || !inboxId || !processedId || !failedId) {
    return res.status(500).json({ error: 'Books env vars missing' });
  }

  const logId = uuid();
  const startedAt = nowIso();
  let token;
  try { token = await getGoogleAccessToken(); }
  catch (e) { return res.status(500).json({ error: `Google auth failed: ${e.message}` }); }

  // Append a "started" log row first so we have a paper trail
  try {
    await sheetsAppend(token, sheetId, 'ProcessingLog!A1', [[
      logId, fileName || '', fileId, startedAt, '', 'started', '', '',
    ]]);
  } catch (_) { /* logging failures should not block extraction */ }

  let extractRes, fileMeta;
  try {
    fileMeta = await driveDownloadFile(token, fileId);
    extractRes = await anthropicExtract(fileMeta.base64, fileMeta.mimeType);
  } catch (e) {
    // Move to _failed/
    try { await driveMoveFile(token, fileId, failedId, inboxId); } catch (_) {}
    await logComplete(token, sheetId, logId, 'failed', e.message, '');
    return res.status(500).json({ error: e.message, logId });
  }

  if (!extractRes.ok) {
    try { await driveMoveFile(token, fileId, failedId, inboxId); } catch (_) {}
    // Still write a row marked extraction_failed so Paul can manually fix
    const expenseId = uuid();
    const row = {
      expense_id: expenseId, date: '', vendor: fileName || '(unknown)', amount: '',
      currency: 'USD', category_auto: '', category: '', category_reasoning: '',
      payment_method: '', business_purpose: '',
      receipt_url: await driveGetWebLink(token, fileId) || '',
      auto_linked_deal_id: '', linked_deal_id: '', linked_deal_id_2: '',
      extraction_confidence: '__failed__', confidence_notes: extractRes.error || 'extraction failed',
      extracted_text: extractRes.raw || '',
      entered_by: 'ai', extracted_at: nowIso(), flags: 'extraction_failed', reviewed: 'FALSE', notes: '',
    };
    await sheetsAppend(token, sheetId, 'Expenses!A1', [objectToRow(row, EXPENSE_HEADERS)]);
    await logComplete(token, sheetId, logId, 'failed', extractRes.error || 'unknown', expenseId);
    return res.status(200).json({ ok: false, expense_id: expenseId, error: extractRes.error });
  }

  const p = extractRes.parsed || {};
  // VendorMemory lookup — overrides AI category AND business purpose if confirmed before
  let categoryFinal = p.category_suggestion || 'Other';
  let categoryAuto = p.category_suggestion || 'Other';
  let vendorOverride = null;
  let purposeFromMemory = null;
  try {
    const vm = await sheetsGet(token, sheetId, 'VendorMemory!A1:E');
    const vmObjs = rowsToObjects(vm);
    const norm = normalizeVendor(p.vendor);
    const hit = vmObjs.find((r) => normalizeVendor(r.vendor_normalized) === norm);
    if (hit && hit.category) { categoryFinal = hit.category; vendorOverride = hit.category; }
    if (hit && hit.business_purpose_template) { purposeFromMemory = hit.business_purpose_template; }
  } catch (_) {}

  // Auto-deal-linking
  let autoLinkedDealId = '';
  let linkedDealForPurpose = null;
  try {
    const deals = rowsToObjects(await sheetsGet(token, sheetId, 'Deals!A1:L'));
    const recDate = p.date;
    if (recDate) {
      const overlap = deals.filter((d) =>
        d.shoot_start_date && d.shoot_end_date &&
        d.shoot_start_date <= recDate && recDate <= d.shoot_end_date
      );
      if (overlap.length === 1) { autoLinkedDealId = overlap[0].deal_id; linkedDealForPurpose = overlap[0]; }
      else if (overlap.length > 1) {
        // multiple — pick highest-value
        overlap.sort((a, b) => Number(b.deal_value || 0) - Number(a.deal_value || 0));
        autoLinkedDealId = overlap[0].deal_id;
        linkedDealForPurpose = overlap[0];
      }
    }
  } catch (_) {}

  // Business purpose precedence: deal-link > VendorMemory template > AI suggestion > blank
  let businessPurpose = '';
  if (linkedDealForPurpose) {
    const brand = linkedDealForPurpose.brand || '(brand)';
    const platform = linkedDealForPurpose.platform || '';
    businessPurpose = `Production expense for ${brand} deal${platform ? ` (${platform})` : ''}.`;
  } else if (purposeFromMemory) {
    businessPurpose = purposeFromMemory;
  } else if (p.suggested_business_purpose) {
    businessPurpose = p.suggested_business_purpose;
  }

  // Move file to _processed/
  let receiptUrl = '';
  try {
    await driveMoveFile(token, fileId, processedId, inboxId);
    receiptUrl = await driveGetWebLink(token, fileId) || '';
  } catch (_) {}

  const expenseId = uuid();
  const row = {
    expense_id: expenseId,
    date: p.date || '',
    vendor: p.vendor || '',
    amount: p.amount_total ?? '',
    currency: p.currency || 'USD',
    category_auto: categoryAuto,
    category: categoryFinal,
    category_reasoning: vendorOverride
      ? `VendorMemory override (${vendorOverride}). AI suggested: ${p.category_suggestion}. ${p.category_reasoning || ''}`
      : (p.category_reasoning || ''),
    payment_method: p.payment_method || '',
    business_purpose: businessPurpose,
    receipt_url: receiptUrl,
    auto_linked_deal_id: autoLinkedDealId,
    linked_deal_id: autoLinkedDealId, // default to auto, Paul can change
    linked_deal_id_2: '',
    extraction_confidence: p.confidence || 'medium',
    confidence_notes: p.confidence_notes || '',
    extracted_text: p.raw_text || '',
    entered_by: 'ai',
    extracted_at: nowIso(),
    flags: '', // computed on read
    reviewed: 'FALSE',
    notes: '',
  };
  await sheetsAppend(token, sheetId, 'Expenses!A1', [objectToRow(row, EXPENSE_HEADERS)]);
  await logComplete(token, sheetId, logId,
    p.confidence === 'low' ? 'low_confidence' : 'success', '', expenseId);

  return res.status(200).json({ ok: true, expense_id: expenseId, parsed: p, auto_linked_deal_id: autoLinkedDealId });
}

async function logComplete(token, sheetId, logId, status, errMsg, expenseId) {
  // Append a "completed" log row (we don't try to update the started row — append-only is simpler)
  try {
    await sheetsAppend(token, sheetId, 'ProcessingLog!A1', [[
      logId, '', '', '', nowIso(), status, errMsg || '', expenseId || '',
    ]]);
  } catch (_) {}
}

// ─────────────────────────────────────────────────────────────
// books-data action (read for the dashboard)
// ─────────────────────────────────────────────────────────────
async function handleProcessInbox(req, res) {
  // SAFE backlog linker. DEFAULT = RELINK-ONLY (never adds rows -> totals cannot
  // change). It pages through the inbox by &offset so unmatched files don't loop.
  // Matching is tolerant: amount rounded to 2dp, date within +/-1 calendar day,
  // vendor fuzzy (letters only, ignores store numbers/punctuation). A file whose
  // id already appears in any receipt_url is skipped (idempotent). Pass &add=1 to
  // also create rows for genuinely-new receipts (off by default for safety).
  const secret = (req.query.secret || '').toString();
  const expected = process.env.DASHBOARD_SECRET || 'pf_secret_2026';
  if (secret !== expected) return res.status(403).json({ error: 'bad or missing secret' });

  const sheetId = process.env.GOOGLE_SHEETS_ID;
  const inboxId = cleanDriveId(process.env.GOOGLE_DRIVE_INBOX_ID);
  const processedId = cleanDriveId(process.env.GOOGLE_DRIVE_PROCESSED_ID);
  if (!sheetId || !inboxId) return res.status(500).json({ error: 'Books env vars missing' });

  const dryRun = String(req.query.commit || '') !== '1';
  const allowAdd = String(req.query.add || '') === '1';
  const limit = Math.max(1, Math.min(8, parseInt(req.query.limit || '1', 10) || 1));
  const offset = Math.max(0, parseInt(req.query.offset || '0', 10) || 0);

  let token;
  try { token = await getGoogleAccessToken(); }
  catch (e) { return res.status(500).json({ error: `Google auth failed: ${e.message}` }); }

  let files = [];
  try {
    const q = encodeURIComponent(`'${inboxId}' in parents and trashed=false`);
    const r = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,mimeType)&pageSize=400&orderBy=createdTime`, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) return res.status(500).json({ error: `inbox list failed: ${r.status} ${(await r.text()).slice(0, 200)}` });
    files = ((await r.json()).files || []).filter((x) => /^image\//.test(x.mimeType) || x.mimeType === 'application/pdf');
  } catch (e) { return res.status(500).json({ error: e.message }); }

  const total = files.length;
  const slice = files.slice(offset, offset + limit);

  let existing = [];
  try { existing = rowsToObjects(await sheetsGet(token, sheetId, 'Expenses!A1:W')).filter((r) => r.expense_id); } catch (_) {}
  const linkedFileIds = new Set(existing.map((r) => driveFileIdFromUrl(r.receipt_url)).filter(Boolean));

  // ── Tolerant matching ──
  const amtEq = (a, b) => Math.abs(Number(a || 0) - Number(b || 0)) < 0.01; // 2dp: 52.7 == 52.70
  const dayDiff = (d1, d2) => { const a = new Date(d1 + 'T12:00:00'), b = new Date(d2 + 'T12:00:00'); if (isNaN(a) || isNaN(b)) return 999; return Math.abs(Math.round((a - b) / 86400000)); };
  const dateClose = (a, b) => !!a && !!b && dayDiff(a, b) <= 1; // +/- 1 calendar day, tz-safe
  const lettersOnly = (v) => String(v || '').toLowerCase().replace(/[^a-z]/g, ''); // drops digits/#/punct
  const tokens = (v) => String(v || '').toLowerCase().split(/[^a-z]+/).filter((w) => w.length >= 3);
  const vendorClose = (a, b) => {
    const x = lettersOnly(a), y = lettersOnly(b);
    if (!x || !y) return false;
    if (x === y || x.includes(y) || y.includes(x)) return true;
    const ta = new Set(tokens(a)); return tokens(b).some((w) => ta.has(w)); // share a 3+ letter word
  };

  const results = [];
  let relinked = 0, addedNew = 0, alreadyLinked = 0, unmatched = 0, failed = 0;

  for (const file of slice) {
    if (linkedFileIds.has(file.id)) { alreadyLinked++; results.push({ file: file.name, fileId: file.id, action: 'already-linked (skip)' }); continue; }
    let p;
    try {
      const meta = await driveDownloadFile(token, file.id);
      const ex = await anthropicExtract(meta.base64, meta.mimeType);
      if (!ex.ok) throw new Error(ex.error || 'extraction failed');
      p = ex.parsed || {};
    } catch (e) { failed++; results.push({ file: file.name, fileId: file.id, action: 'failed', error: String(e.message).slice(0, 140) }); continue; }

    const url = `https://drive.google.com/file/d/${file.id}/view`; // id-bearing, reliable
    const cands = (p.date && Number(p.amount_total) > 0)
      ? existing.filter((r) => amtEq(r.amount, p.amount_total) && dateClose(r.date, p.date) && vendorClose(r.vendor, p.vendor))
      : [];
    const match = cands.find((r) => !(r.receipt_url && String(r.receipt_url).trim())) || cands[0];

    if (match) {
      relinked++;
      const rr = { file: file.name, fileId: file.id, action: 'RELINK (no total change)', extracted: { vendor: p.vendor, amount: p.amount_total, date: p.date }, matched: { expense_id: match.expense_id, vendor: match.vendor, amount: match.amount, date: match.date }, receipt_url_written: url };
      results.push(rr);
      if (!dryRun) {
        try {
          const merged = { ...match, receipt_url: url };
          delete merged._rowIndex; delete merged.flags_computed;
          await sheetsUpdate(token, sheetId, `Expenses!A${match._rowIndex}:W${match._rowIndex}`, [objectToRow(merged, EXPENSE_HEADERS)]);
          match.receipt_url = url;
        } catch (e) { rr.writeError = String(e.message).slice(0, 120); }
        try { await driveMoveFile(token, file.id, processedId, inboxId); } catch (_) { /* move optional */ }
      }
    } else if (allowAdd) {
      addedNew++;
      const rr = { file: file.name, fileId: file.id, action: 'ADD new (allowAdd)', extracted: { vendor: p.vendor, amount: p.amount_total, date: p.date }, receipt_url_written: url };
      results.push(rr);
      if (!dryRun) {
        const row = { expense_id: uuid(), date: p.date || '', vendor: p.vendor || '', amount: p.amount_total ?? '', currency: p.currency || 'USD', category_auto: p.category_suggestion || 'Other', category: p.category_suggestion || 'Other', category_reasoning: p.category_reasoning || '', payment_method: p.payment_method || '', business_purpose: p.suggested_business_purpose || '', receipt_url: url, auto_linked_deal_id: '', linked_deal_id: '', linked_deal_id_2: '', extraction_confidence: p.confidence || 'medium', confidence_notes: p.confidence_notes || '', extracted_text: p.raw_text || '', entered_by: 'ai-backlog', extracted_at: nowIso(), flags: '', reviewed: 'FALSE', notes: 'Imported from inbox backlog' };
        try { await sheetsAppend(token, sheetId, 'Expenses!A1', [objectToRow(row, EXPENSE_HEADERS)]); existing.push({ ...row }); } catch (e) { rr.writeError = String(e.message).slice(0, 120); }
      }
    } else {
      unmatched++;
      results.push({ file: file.name, fileId: file.id, action: 'UNMATCHED (left as-is, no row added)', extracted: { vendor: p.vendor, amount: p.amount_total, date: p.date } });
    }
  }

  const nextOffset = offset + slice.length;
  return res.status(200).json({
    mode: dryRun ? 'DRY-RUN — preview only' : 'COMMITTED',
    relinkOnly: !allowAdd,
    totalImagesInInbox: total,
    offset, processedThisCall: slice.length, nextOffset, done: nextOffset >= total,
    summary: { relinked, addedNew, alreadyLinked, unmatched, failed },
    nextStep: nextOffset >= total ? 'Done — full pass complete.' : `More to scan — call again with &offset=${nextOffset}.`,
    details: results,
  });
}

async function handleBooksDiag(req, res) {
  // GET /api/sync?action=books-diag&secret=...  → live auth + inbox folder + sync log + receipt_url population
  const secret = (req.query.secret || '').toString();
  const expected = process.env.DASHBOARD_SECRET || 'pf_secret_2026';
  if (secret !== expected) return res.status(403).json({ error: 'bad or missing secret' });

  const out = {
    env: {
      GOOGLE_SHEETS_ID: !!process.env.GOOGLE_SHEETS_ID,
      GOOGLE_SERVICE_ACCOUNT_EMAIL: !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      GOOGLE_SERVICE_ACCOUNT_KEY: !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
      GOOGLE_DRIVE_INBOX_ID: !!process.env.GOOGLE_DRIVE_INBOX_ID,
      GOOGLE_DRIVE_PROCESSED_ID: !!process.env.GOOGLE_DRIVE_PROCESSED_ID,
      APPS_SCRIPT_SHARED_SECRET: !!process.env.APPS_SCRIPT_SHARED_SECRET,
      ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
    },
    auth: null, inboxFolder: null, lastSync: null, receipts: null,
  };

  let token;
  try { token = await getGoogleAccessToken(); out.auth = { ok: true, note: 'Google service-account token obtained' }; }
  catch (e) { out.auth = { ok: false, error: e.message }; return res.status(200).json(out); }

  out.serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || null;

  // Inbox folder access (THE top suspect for "stopped pulling")
  const inboxId = cleanDriveId(process.env.GOOGLE_DRIVE_INBOX_ID);
  const listInbox = async (allDrives) => {
    const q = encodeURIComponent(`'${inboxId}' in parents and trashed=false`);
    const extra = allDrives ? '&supportsAllDrives=true&includeItemsFromAllDrives=true' : '';
    const r = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,mimeType,createdTime)&pageSize=100&orderBy=createdTime desc${extra}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) return { ok:false, status:r.status, body:(await r.text()).slice(0,200) };
    const j = await r.json(); const files = j.files || [];
    return { ok:true, count: files.length, sample: files.slice(0,10).map((x)=>({ name:x.name, mimeType:x.mimeType, createdTime:x.createdTime })) };
  };
  try {
    if (!inboxId) { out.inboxFolder = { error: 'GOOGLE_DRIVE_INBOX_ID not set' }; }
    else {
      out.inboxFolder = { folderId: inboxId, plain: await listInbox(false), withSharedDriveFlags: await listInbox(true) };
      // folder metadata by id
      const mr = await fetch(`https://www.googleapis.com/drive/v3/files/${inboxId}?fields=id,name,parents,trashed,driveId&supportsAllDrives=true`, { headers: { Authorization: `Bearer ${token}` } });
      out.inboxFolderMeta = mr.ok ? await mr.json() : { error: `${mr.status} ${(await mr.text()).slice(0,160)}` };
      const cr = await fetch(`https://www.googleapis.com/drive/v3/files/${inboxId}?fields=capabilities(canEdit,canAddChildren,canRemoveChildren,canDelete)&supportsAllDrives=true`, { headers: { Authorization: `Bearer ${token}` } });
      out.inboxWriteAccess = cr.ok ? (await cr.json()).capabilities : { error: `${cr.status}` };
    }
  } catch (e) { out.inboxFolder = { error: e.message }; }

  // Which folders CAN the service account see? (helps find the real inbox id)
  try {
    const q = encodeURIComponent("mimeType='application/vnd.google-apps.folder' and trashed=false");
    const r = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,parents,driveId)&pageSize=50&supportsAllDrives=true&includeItemsFromAllDrives=true`, { headers: { Authorization: `Bearer ${token}` } });
    out.accessibleFolders = r.ok ? ((await r.json()).files || []).map((x)=>({ id:x.id, name:x.name, driveId:x.driveId||null })) : { error: `${r.status}` };
  } catch (e) { out.accessibleFolders = { error: e.message }; }

  // Last sync log + receipt_url population on existing expenses
  try {
    const sheetId = process.env.GOOGLE_SHEETS_ID;
    const [logVals, eVals] = await Promise.all([
      sheetsGet(token, sheetId, 'ProcessingLog!A1:H').catch(() => null),
      sheetsGet(token, sheetId, 'Expenses!A1:W').catch(() => null),
    ]);
    if (logVals) { const lg = rowsToObjects(logVals); const last = lg[lg.length - 1]; out.lastSync = { logRows: lg.length, mostRecent: last ? { started_at: last.started_at, completed_at: last.completed_at, status: last.status, file_name: last.file_name, error_message: last.error_message } : 'no rows' }; }
    else out.lastSync = { note: 'ProcessingLog sheet not readable' };
    if (eVals) {
      const exps = rowsToObjects(eVals).filter((r) => r.expense_id);
      const withUrl = exps.filter((r) => r.receipt_url && String(r.receipt_url).trim());
      out.receipts = {
        totalExpenseRows: exps.length,
        withReceiptUrl: withUrl.length,
        withoutReceiptUrl: exps.length - withUrl.length,
        unreviewedTotal: exps.filter((r) => String(r.reviewed).toLowerCase() !== 'true').length,
        unreviewedWithReceipt: exps.filter((r) => String(r.reviewed).toLowerCase() !== 'true' && r.receipt_url && String(r.receipt_url).trim()).length,
        expensesYtdTotal: exps.reduce((sm, r) => sm + (Number(r.amount) || 0), 0).toFixed(2),
        possibleDuplicates: (() => {
          const groups = {};
          exps.forEach((r) => { const k = (r.date||'') + '|' + (Number(r.amount)||0).toFixed(2); (groups[k] = groups[k] || []).push(r); });
          return Object.entries(groups).filter(([, rows]) => rows.length > 1)
            .map(([k, rows]) => ({ key: k, count: rows.length, vendors: rows.map((r) => r.vendor), ids: rows.map((r) => (r.expense_id||'').slice(0,8)) }));
        })(),
        allRecords: exps.map((r) => ({ id: (r.expense_id||'').slice(0,8), vendor: r.vendor, amount: r.amount, date: r.date, reviewed: r.reviewed, linked: !!(r.receipt_url && String(r.receipt_url).trim()) })),
      };
    }
  } catch (e) { out.lastSync = { error: e.message }; }

  return res.status(200).json(out);
}

async function handleBooksData(req, res) {
  const sheetId = process.env.GOOGLE_SHEETS_ID;
  if (!sheetId) return res.status(500).json({ error: 'GOOGLE_SHEETS_ID missing' });
  const year = req.query.year || new Date().getFullYear();

  let token;
  try { token = await getGoogleAccessToken(); }
  catch (e) { return res.status(500).json({ error: `Google auth failed: ${e.message}` }); }

  try {
    const [eVals, dVals, vVals] = await Promise.all([
      sheetsGet(token, sheetId, 'Expenses!A1:W'),
      sheetsGet(token, sheetId, 'Deals!A1:L'),
      sheetsGet(token, sheetId, 'VendorMemory!A1:E'),
    ]);
    // Filter out deleted (blank) rows AND rows outside the requested year
    const expenses = rowsToObjects(eVals).filter((r) => {
      if (!r.expense_id) return false; // blank/deleted row
      if (!r.date) return false; // no date — skip from year view
      return String(r.date).startsWith(String(year));
    });
    const deals = rowsToObjects(dVals);
    const vendorMemory = rowsToObjects(vVals);
    const vmSet = new Set(vendorMemory.map((v) => normalizeVendor(v.vendor_normalized)));
    expenses.forEach((r) => { r.flags_computed = computeFlags(r, vmSet); });

    return res.status(200).json({ ok: true, year: Number(year), expenses, deals, vendorMemory });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

// ─────────────────────────────────────────────────────────────
// update-expense action
// ─────────────────────────────────────────────────────────────
async function handleUpdateExpense(req, res) {
  const sheetId = process.env.GOOGLE_SHEETS_ID;
  const { expense_id, patch, confirm_vendor_category } = req.body || {};
  if (!sheetId || !expense_id || !patch) return res.status(400).json({ error: 'expense_id and patch required' });

  let token;
  try { token = await getGoogleAccessToken(); }
  catch (e) { return res.status(500).json({ error: `Google auth failed: ${e.message}` }); }

  try {
    const vals = await sheetsGet(token, sheetId, 'Expenses!A1:W');
    const objs = rowsToObjects(vals);
    const target = objs.find((r) => r.expense_id === expense_id);
    if (!target) return res.status(404).json({ error: 'expense not found' });

    const merged = { ...target, ...patch };
    // Strip helpers
    delete merged._rowIndex; delete merged.flags_computed;
    const rowArr = objectToRow(merged, EXPENSE_HEADERS);
    await sheetsUpdate(token, sheetId, `Expenses!A${target._rowIndex}:W${target._rowIndex}`, [rowArr]);

    // VendorMemory learning loop — saves both category AND business purpose for this vendor
    if (confirm_vendor_category && merged.vendor && merged.category) {
      await upsertVendorMemory(token, sheetId, merged.vendor, merged.category, merged.business_purpose || '');
    }

    return res.status(200).json({ ok: true, expense: merged });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

async function upsertVendorMemory(token, sheetId, vendor, category, businessPurposeTemplate) {
  const norm = normalizeVendor(vendor);
  const purposeTpl = (businessPurposeTemplate || '').toString();
  const vals = await sheetsGet(token, sheetId, 'VendorMemory!A1:E');
  const objs = rowsToObjects(vals);
  const hit = objs.find((r) => normalizeVendor(r.vendor_normalized) === norm);
  if (hit) {
    // Keep existing purpose template if new one is blank — don't overwrite a learned purpose with empty
    const finalPurpose = purposeTpl || hit.business_purpose_template || '';
    const newRow = [norm, category, String(Number(hit.confirmation_count || 0) + 1), nowIso(), finalPurpose];
    await sheetsUpdate(token, sheetId, `VendorMemory!A${hit._rowIndex}:E${hit._rowIndex}`, [newRow]);
  } else {
    await sheetsAppend(token, sheetId, 'VendorMemory!A1', [[norm, category, '1', nowIso(), purposeTpl]]);
  }
}

// ─────────────────────────────────────────────────────────────
// upsert-deal action
// ─────────────────────────────────────────────────────────────
async function handleUpsertDeal(req, res) {
  const sheetId = process.env.GOOGLE_SHEETS_ID;
  const deal = req.body || {};
  if (!sheetId || !deal.brand) return res.status(400).json({ error: 'brand required' });

  let token;
  try { token = await getGoogleAccessToken(); }
  catch (e) { return res.status(500).json({ error: `Google auth failed: ${e.message}` }); }

  try {
    const vals = await sheetsGet(token, sheetId, 'Deals!A1:L');
    const objs = rowsToObjects(vals);
    const dealId = deal.deal_id || uuid();
    const merged = { ...deal, deal_id: dealId };
    const hit = objs.find((r) => r.deal_id === dealId);
    const rowArr = objectToRow(merged, DEAL_HEADERS);
    if (hit) {
      await sheetsUpdate(token, sheetId, `Deals!A${hit._rowIndex}:L${hit._rowIndex}`, [rowArr]);
    } else {
      await sheetsAppend(token, sheetId, 'Deals!A1', [rowArr]);
    }
    return res.status(200).json({ ok: true, deal: merged });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

// ─────────────────────────────────────────────────────────────
// manual-expense action
// ─────────────────────────────────────────────────────────────
async function handleManualExpense(req, res) {
  const sheetId = process.env.GOOGLE_SHEETS_ID;
  const exp = req.body || {};
  if (!sheetId) return res.status(500).json({ error: 'GOOGLE_SHEETS_ID missing' });

  let token;
  try { token = await getGoogleAccessToken(); }
  catch (e) { return res.status(500).json({ error: `Google auth failed: ${e.message}` }); }

  const expenseId = exp.expense_id || uuid();
  const row = {
    expense_id: expenseId,
    date: exp.date || '',
    vendor: exp.vendor || '',
    amount: exp.amount || '',
    currency: exp.currency || 'USD',
    category_auto: '',
    category: exp.category || 'Other',
    category_reasoning: 'manual entry',
    payment_method: exp.payment_method || '',
    business_purpose: exp.business_purpose || '',
    receipt_url: exp.receipt_url || '',
    auto_linked_deal_id: '',
    linked_deal_id: exp.linked_deal_id || '',
    linked_deal_id_2: exp.linked_deal_id_2 || '',
    extraction_confidence: 'high',
    confidence_notes: '',
    extracted_text: '',
    entered_by: exp.entered_by || 'paul',
    extracted_at: nowIso(),
    flags: '',
    reviewed: 'TRUE',
    notes: exp.notes || '',
  };
  try {
    await sheetsAppend(token, sheetId, 'Expenses!A1', [objectToRow(row, EXPENSE_HEADERS)]);
    return res.status(200).json({ ok: true, expense_id: expenseId });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

// ─────────────────────────────────────────────────────────────
// year-export action — CSV for CPA
// ─────────────────────────────────────────────────────────────
function csvEscape(v) {
  if (v == null) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

async function handleYearExport(req, res) {
  const sheetId = process.env.GOOGLE_SHEETS_ID;
  const year = req.query.year || new Date().getFullYear();
  const kind = req.query.kind || 'csv';
  if (!sheetId) return res.status(500).json({ error: 'GOOGLE_SHEETS_ID missing' });

  let token;
  try { token = await getGoogleAccessToken(); }
  catch (e) { return res.status(500).json({ error: `Google auth failed: ${e.message}` }); }

  const expenses = rowsToObjects(await sheetsGet(token, sheetId, 'Expenses!A1:W'))
    .filter((r) => String(r.date || '').startsWith(String(year)));

  if (kind === 'csv') {
    const cols = ['date','vendor','amount','currency','category','business_purpose','payment_method','receipt_url','linked_deal_id','reviewed'];
    const lines = [cols.join(',')];
    // Sorted by category, then date
    expenses.sort((a, b) => (a.category || '').localeCompare(b.category || '') || (a.date || '').localeCompare(b.date || ''));
    expenses.forEach((r) => lines.push(cols.map((c) => csvEscape(r[c])).join(',')));
    // Append totals per category
    const totals = {};
    expenses.forEach((r) => { totals[r.category || 'Uncategorized'] = (totals[r.category || 'Uncategorized'] || 0) + Number(r.amount || 0); });
    lines.push('');
    lines.push('CATEGORY TOTALS');
    Object.keys(totals).sort().forEach((c) => lines.push(`${csvEscape(c)},${totals[c].toFixed(2)}`));
    res.setHeader('Content-Type', 'text/csv');
    return res.status(200).send(lines.join('\n'));
  }

  // Audit binder data — front-end will render the PDF
  const deals = rowsToObjects(await sheetsGet(token, sheetId, 'Deals!A1:L'));
  return res.status(200).json({ ok: true, year: Number(year), expenses, deals });
}

// ─────────────────────────────────────────────────────────────
// bulk-import-csv action — import a chunk of credit-card-statement rows
// Body: { csvChunk: string (CSV text), year: number, headerLine: string }
// Frontend splits a large CSV into chunks and POSTs each separately to keep
// each call under Vercel Hobby's 10s function timeout.
// ─────────────────────────────────────────────────────────────
const BULK_IMPORT_PROMPT = `You are parsing a chunk of a credit card statement for RGG Media (a creator/media business: TikTok, IG, YouTube, UGC, brand partnerships, travel/lifestyle content). The cardholder uses this card almost exclusively for business — flag any transaction that looks personal so it can be reviewed.

Return ONLY a JSON array. Each item has this exact shape:
{
  "date": "YYYY-MM-DD",
  "vendor": string,                  // Cleaned merchant name (strip transaction ID suffixes, location codes, etc)
  "amount": number,                  // Positive for charges, negative for refunds/credits
  "currency": "USD",
  "category_suggestion": string,     // Pick from category list
  "category_reasoning": string,      // One sentence
  "suggested_business_purpose": string,
  "is_likely_personal": boolean,     // True if this looks like a personal expense (groceries, personal streaming, gas station purchase that's not travel-related, etc)
  "personal_reason": string | null,  // Why you flagged it personal (null if not flagged)
  "skip": boolean,                   // True ONLY if this row isn't a real transaction (header row, payment-to-card row, fee disclosure, etc)
  "skip_reason": string | null
}

CATEGORY OPTIONS:
- Equipment & Hardware
- Software & Subscriptions
- Travel - Lodging
- Travel - Transportation
- Travel - Meals
- Meals & Entertainment
- Home Office
- Professional Services
- Marketing & Advertising
- Internet & Phone
- Production Costs
- Education & Research
- Bank & Payment Fees
- Office Supplies
- Other

CATEGORIZATION RULES:
- Hotels/Airbnbs/lodging → "Travel - Lodging"
- Flights/Uber/Lyft/gas/rental cars → "Travel - Transportation"
- Restaurant meals where vendor or context suggests travel → "Travel - Meals"
- Local restaurant meals, coffee → "Meals & Entertainment"
- Adobe/Notion/Canva/CapCut/Figma/hosting/SaaS → "Software & Subscriptions"
- Cameras, mics, lights, smart glasses, computers, drives → "Equipment & Hardware"
- AT&T/T-Mobile/Verizon/Spectrum/Comcast → "Internet & Phone"
- Bank fees/card fees/ATM fees → "Bank & Payment Fees"
- If unsure → "Other"

PERSONAL-EXPENSE DETECTION (flag is_likely_personal=true if):
- Grocery stores (Whole Foods, Trader Joe's, Vons, Ralphs) unless tagged for travel context
- Pharmacy / drugstore / personal-care purchases
- Personal subscriptions: Netflix, Hulu, Disney+, HBO, Spotify (UNLESS clearly business — Spotify could be production music)
- Personal medical / dental / fitness (gym, yoga, spa)
- Pet supplies, vet bills
- Clothing / department stores (Nordstrom, Target, Macy's)
- Home utilities (water, gas, electric — unless clear home office allocation)
- Personal restaurants on weekends in home city without travel context
- Anything that doesn't have a plausible RGG Media content-creation justification

Be ASSERTIVE about flagging — Paul wants to err on the side of flagging suspicious items so he can review. He'd rather see false positives than miss personal charges.

SKIP rows that aren't real transactions:
- Header rows (first row of CSV with column names)
- Payment-to-card rows ("PAYMENT THANK YOU" / "AUTOPAY" / similar)
- Adjustment/fee disclosure rows that aren't charges
- Empty rows

SUGGESTED BUSINESS PURPOSE GUIDANCE (only if NOT skipped):
- Coffee/restaurants: "Working session — content planning" or "Meeting with collaborator"
- Software: "{Product name} subscription used for editing RGG Media content"
- Travel: "Travel for content production / brand shoot"
- Equipment: "{Item} used for video production for RGG Media"
- Generic fallback: "Business expense for RGG Media content production / operations"

Return only the JSON array, no preamble.`;

async function handleBulkImportCsv(req, res) {
  const { csvChunk, headerLine, year } = req.body || {};
  if (!csvChunk) return res.status(400).json({ error: 'csvChunk required (CSV text body)' });

  const sheetId = process.env.GOOGLE_SHEETS_ID;
  if (!sheetId) return res.status(500).json({ error: 'GOOGLE_SHEETS_ID missing' });

  let token;
  try { token = await getGoogleAccessToken(); }
  catch (e) { return res.status(500).json({ error: `Google auth failed: ${e.message}` }); }

  // Send chunk to Claude for parsing + categorization
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY missing' });

  const userText = `Year filter: only include transactions dated within ${year}. Skip everything outside that year.\n\nHeader line:\n${headerLine || '(none provided — infer from chunk)'}\n\nCSV chunk:\n${csvChunk}`;
  const body = {
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    messages: [{ role: 'user', content: [
      { type: 'text', text: BULK_IMPORT_PROMPT },
      { type: 'text', text: userText },
    ] }],
  };

  let parsed;
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const txt = await r.text();
      return res.status(500).json({ error: `Anthropic ${r.status}: ${txt}` });
    }
    const j = await r.json();
    let text = (j?.content?.[0]?.text || '').trim();
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) throw new Error('Claude did not return an array');
  } catch (e) {
    return res.status(500).json({ error: `Parse failed: ${e.message}` });
  }

  // Load existing data for dedup + VendorMemory
  let existing = [];
  let vendorMemoryObjs = [];
  let dealsByDate = [];
  try {
    [existing, vendorMemoryObjs, dealsByDate] = await Promise.all([
      sheetsGet(token, sheetId, 'Expenses!A1:W').then(rowsToObjects),
      sheetsGet(token, sheetId, 'VendorMemory!A1:E').then(rowsToObjects),
      sheetsGet(token, sheetId, 'Deals!A1:L').then(rowsToObjects),
    ]);
  } catch (e) {
    return res.status(500).json({ error: `Sheet read failed: ${e.message}` });
  }
  const existingKeys = new Set(existing.map((r) =>
    `${String(r.date).trim()}|${normalizeVendor(r.vendor)}|${Number(r.amount || 0).toFixed(2)}`
  ));
  const vmMap = new Map(vendorMemoryObjs.map((v) => [normalizeVendor(v.vendor_normalized), v]));

  const newRows = [];
  const stats = { imported: 0, skipped_duplicate: 0, skipped_other_year: 0, skipped_not_transaction: 0, flagged_personal: 0 };

  for (const item of parsed) {
    if (item.skip) { stats.skipped_not_transaction++; continue; }
    if (!item.date || !String(item.date).startsWith(String(year))) { stats.skipped_other_year++; continue; }
    if (item.amount == null || isNaN(Number(item.amount))) continue;

    const key = `${String(item.date).trim()}|${normalizeVendor(item.vendor)}|${Number(item.amount).toFixed(2)}`;
    if (existingKeys.has(key)) { stats.skipped_duplicate++; continue; }
    existingKeys.add(key); // prevent dup within the same chunk too

    // VendorMemory override
    let categoryFinal = item.category_suggestion || 'Other';
    let purposeFinal = item.suggested_business_purpose || '';
    const norm = normalizeVendor(item.vendor);
    const memHit = vmMap.get(norm);
    if (memHit) {
      if (memHit.category) categoryFinal = memHit.category;
      if (memHit.business_purpose_template) purposeFinal = memHit.business_purpose_template;
    }

    // Auto-deal-link if shoot window matches
    let autoDeal = '';
    const overlap = dealsByDate.filter((d) => d.shoot_start_date && d.shoot_end_date
      && d.shoot_start_date <= item.date && item.date <= d.shoot_end_date);
    if (overlap.length === 1) autoDeal = overlap[0].deal_id;
    else if (overlap.length > 1) {
      overlap.sort((a, b) => Number(b.deal_value || 0) - Number(a.deal_value || 0));
      autoDeal = overlap[0].deal_id;
      // override purpose for deal-linked rows
      const brand = overlap[0].brand || '(brand)';
      const platform = overlap[0].platform || '';
      purposeFinal = `Production expense for ${brand} deal${platform ? ` (${platform})` : ''}.`;
    } else if (overlap.length === 1) {
      const brand = overlap[0].brand || '(brand)';
      const platform = overlap[0].platform || '';
      purposeFinal = `Production expense for ${brand} deal${platform ? ` (${platform})` : ''}.`;
    }

    const expenseId = uuid();
    const isPersonal = !!item.is_likely_personal;
    if (isPersonal) stats.flagged_personal++;

    const rowObj = {
      expense_id: expenseId,
      date: item.date,
      vendor: item.vendor || '',
      amount: item.amount,
      currency: item.currency || 'USD',
      category_auto: item.category_suggestion || 'Other',
      category: categoryFinal,
      category_reasoning: item.category_reasoning || '',
      payment_method: 'Card statement',
      business_purpose: purposeFinal,
      receipt_url: '',
      auto_linked_deal_id: autoDeal,
      linked_deal_id: autoDeal,
      linked_deal_id_2: '',
      extraction_confidence: isPersonal ? 'medium' : 'high',
      confidence_notes: isPersonal && item.personal_reason ? `Personal-suspect: ${item.personal_reason}` : '',
      extracted_text: '',
      entered_by: 'csv_import',
      extracted_at: nowIso(),
      flags: '',
      reviewed: 'FALSE',
      notes: '',
      personal_suspect: isPersonal ? 'TRUE' : 'FALSE',
    };
    newRows.push(objectToRow(rowObj, EXPENSE_HEADERS));
    stats.imported++;
  }

  if (newRows.length > 0) {
    try {
      await sheetsAppend(token, sheetId, 'Expenses!A1', newRows);
    } catch (e) {
      return res.status(500).json({ error: `Sheet append failed: ${e.message}` });
    }
  }

  return res.status(200).json({ ok: true, ...stats });
}

// ─────────────────────────────────────────────────────────────
// delete-expense / bulk-delete-expenses actions
// Body: { expense_id } or { expense_ids: [...] }
// Strategy: clear the row's cells (we don't physically delete the row to avoid
// shifting row indexes that other concurrent operations might rely on).
// The row will not appear in books-data because we filter blank rows on read.
// ─────────────────────────────────────────────────────────────
async function handleDeleteExpense(req, res) {
  const sheetId = process.env.GOOGLE_SHEETS_ID;
  const ids = req.body?.expense_ids || (req.body?.expense_id ? [req.body.expense_id] : []);
  if (!sheetId) return res.status(500).json({ error: 'GOOGLE_SHEETS_ID missing' });
  if (!ids.length) return res.status(400).json({ error: 'expense_id or expense_ids required' });

  let token;
  try { token = await getGoogleAccessToken(); }
  catch (e) { return res.status(500).json({ error: `Google auth failed: ${e.message}` }); }

  try {
    const objs = rowsToObjects(await sheetsGet(token, sheetId, 'Expenses!A1:W'));
    const idSet = new Set(ids);
    const targets = objs.filter((r) => idSet.has(r.expense_id));
    if (targets.length === 0) return res.status(404).json({ error: 'no matching expense ids' });

    // Clear each target row by writing an empty row in its place
    const blankRow = EXPENSE_HEADERS.map(() => '');
    for (const target of targets) {
      await sheetsUpdate(token, sheetId, `Expenses!A${target._rowIndex}:W${target._rowIndex}`, [blankRow]);
    }
    return res.status(200).json({ ok: true, deleted: targets.length });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

// ─────────────────────────────────────────────────────────────
// Main handler — dispatches based on action query param
// ─────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Books-Secret');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const action = (req.query.action || '').toString();

  // Books actions take precedence when action= is set
  if (action === 'process-receipt')  return handleProcessReceipt(req, res);
  if (action === 'process-inbox')    return handleProcessInbox(req, res);
  if (action === 'books-data')       return handleBooksData(req, res);
  if (action === 'books-diag')       return handleBooksDiag(req, res);
  if (action === 'update-expense')   return handleUpdateExpense(req, res);
  if (action === 'upsert-deal')      return handleUpsertDeal(req, res);
  if (action === 'manual-expense')   return handleManualExpense(req, res);
  if (action === 'year-export')      return handleYearExport(req, res);
  if (action === 'bulk-import-csv')  return handleBulkImportCsv(req, res);
  if (action === 'delete-expense')   return handleDeleteExpense(req, res);
  if (action === 'bulk-delete-expenses') return handleDeleteExpense(req, res);

  // Original behavior: GET/POST dashboard state via Redis
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
      if (!state || typeof state !== 'object') return res.status(400).json({ error: 'Body must be a JSON object' });
      await kvSet(baseUrl, token, { ...state, _savedAt: Date.now() });
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
