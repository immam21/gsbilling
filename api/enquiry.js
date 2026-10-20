// Vercel Serverless Function: enquiry handler
// Supports:
// - popup lead capture from visitors
// - full onboarding form submissions
// - optional forwarding to Google Apps Script for Sheet storage
//
// SETUP:
// 1. Save this file as api/enquiry.js
// 2. Replace WHATSAPP_NUMBER with your business WhatsApp number.
// 3. Set APPS_SCRIPT_URL and ENQUIRY_TOKEN if you want popup + form data saved in Google Sheets.
// 4. Deploy to Vercel.

const FIELDS = [
  'name',
  'business',
  'phone',
  'email',
  'city',
  'type',
  'gstin',
  'products',
  'bills',
  'software',
  'scanner',
  'needs',
  'lang',
  'ctime',
  'message'
];

const MAX = {
  message: 1500,
  software: 200,
  needs: 200
};

const WHATSAPP_NUMBER = '919688772477';

function getAppsScriptUrl() {
  return process.env.APPS_SCRIPT_URL || '';
}

function getEnquiryToken() {
  return process.env.ENQUIRY_TOKEN || '';
}

function clean(v, max) {
  return String(v == null ? '' : v)
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max || 120);
}

function normalizePhone(value) {
  let d = String(value || '').replace(/\D/g, '');
  if (d.length === 12 && d.indexOf('91') === 0) d = d.slice(2);
  if (d.length === 11 && d.charAt(0) === '0') d = d.slice(1);
  return d;
}

async function saveToGoogleSheet(data) {
  const appsScriptUrl = getAppsScriptUrl();
  const enquiryToken = getEnquiryToken();

  if (!appsScriptUrl || !enquiryToken) {
    return { ok: false, reason: 'not-configured' };
  }

  const payload = {
    token: enquiryToken,
    name: clean(data.name, 120),
    business: clean(data.business || 'Popup lead', 120),
    phone: normalizePhone(data.phone),
    email: clean(data.email || '', 120),
    city: clean(data.city || 'Not provided', 120),
    type: clean(data.type || 'Popup lead', 120),
    gstin: clean(data.gstin || '', 30),
    products: clean(data.products || '', 120),
    bills: clean(data.bills || '', 120),
    software: clean(data.software || '', 200),
    scanner: clean(data.scanner || 'Not provided', 120),
    needs: clean(data.needs || '', 200),
    lang: clean(data.lang || 'Not provided', 80),
    ctime: clean(data.ctime || 'Not provided', 80),
    message: clean(data.message || '', 1500),
    website: clean(data.website || '', 120)
  };

  const response = await fetch(appsScriptUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const text = await response.text();
  let parsed = {};
  try { parsed = JSON.parse(text); } catch (e) { parsed = { ok: false, raw: text }; }
  return { ok: !!parsed.ok, ...parsed };
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      enquiry_method: 'Google Sheet first, WhatsApp fallback',
      google_sheet_configured: !!(getAppsScriptUrl() && getEnquiryToken()),
      whatsapp_configured: /^\d{10,15}$/.test(WHATSAPP_NUMBER) && WHATSAPP_NUMBER !== '919876543210'
    });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? safeJson(req.body) : req.body || {};

    if (body.website) {
      return res.status(200).json({ ok: true, ignored: true });
    }

    const d = {};
    FIELDS.forEach((key) => {
      d[key] = clean(body[key], MAX[key]);
    });

    d.name = clean(body.name, 120);
    d.business = clean(body.business || '', 120);
    d.phone = normalizePhone(body.phone || d.phone);
    d.city = clean(body.city || '', 120);
    d.type = clean(body.type || 'Quick enquiry', 120);

    if (!d.name || !d.phone || !/^[6-9]\d{9}$/.test(d.phone)) {
      return res.status(400).json({ ok: false, error: 'Please enter your name and valid WhatsApp number.' });
    }

    if (d.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email)) {
      return res.status(400).json({ ok: false, error: 'Please enter a valid email address.' });
    }

    const lines = [
      '*New GSheetPOS Enquiry*',
      '',
      '*Name:* ' + d.name,
      '*Phone:* ' + d.phone,
      '*Business:* ' + (d.business || 'Not provided'),
      '*City:* ' + (d.city || 'Not provided'),
      '*Message:* ' + (d.message || 'Not provided')
    ];

    const whatsappUrl = 'https://wa.me/' + WHATSAPP_NUMBER + '?text=' + encodeURIComponent(lines.join('\n'));

    const sheetPayload = {
      name: d.name,
      phone: d.phone,
      business: d.business || 'Quick enquiry',
      city: d.city || 'Not provided',
      type: d.type || 'Quick enquiry',
      email: d.email || '',
      gstin: d.gstin || '',
      products: d.products || '',
      bills: d.bills || '',
      software: d.software || '',
      scanner: d.scanner || 'Not provided',
      needs: d.needs || '',
      lang: d.lang || 'Not provided',
      ctime: d.ctime || 'Not provided',
      message: d.message || ''
    };

    const sheetResult = await saveToGoogleSheet(sheetPayload);
    if (sheetResult.ok) {
      return res.status(200).json({ ok: true, saved: true, method: 'sheet', message: 'Lead saved to Google Sheet.' });
    }

    return res.status(200).json({
      ok: false,
      fallbackWhatsApp: whatsappUrl,
      method: 'whatsapp',
      message: 'Google Sheet save failed. Redirecting to WhatsApp.'
    });
  } catch (e) {
    console.error('Enquiry error:', e && e.message ? e.message : e);
    return res.status(500).json({ ok: false, error: 'Something went wrong. Please try again.' });
  }
};

function safeJson(s) {
  try { return JSON.parse(s); } catch (e) { return {}; }
}

