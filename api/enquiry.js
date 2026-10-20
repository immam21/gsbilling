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

const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL || '';
const ENQUIRY_TOKEN = process.env.ENQUIRY_TOKEN || '';
const WHATSAPP_NUMBER = '919688772477';

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
  if (!APPS_SCRIPT_URL || !ENQUIRY_TOKEN) {
    return { ok: false, reason: 'not-configured' };
  }

  const payload = {
    token: ENQUIRY_TOKEN,
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

  const response = await fetch(APPS_SCRIPT_URL, {
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
      enquiry_method: 'Google Sheet + WhatsApp',
      google_sheet_configured: !!(APPS_SCRIPT_URL && ENQUIRY_TOKEN),
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

    if (Number(body.t) < 2500 && body.source !== 'popup') {
      return res.status(200).json({ ok: true, ignored: true });
    }

    const d = {};
    FIELDS.forEach((key) => {
      d[key] = clean(body[key], MAX[key]);
    });

    d.name = clean(body.name, 120);
    d.phone = normalizePhone(body.phone || d.phone);

    if (body.source === 'popup') {
      if (!d.name || !d.phone || !/^[6-9]\d{9}$/.test(d.phone)) {
        return res.status(400).json({ ok: false, error: 'Please enter your valid name and WhatsApp number.' });
      }

      const sheetResult = await saveToGoogleSheet({
        name: d.name,
        phone: d.phone,
        business: 'Popup lead',
        city: 'Not provided',
        type: 'Popup lead',
        email: '',
        gstin: '',
        products: '',
        bills: '',
        software: '',
        scanner: 'Not provided',
        needs: '',
        lang: 'Not provided',
        ctime: 'Not provided',
        message: 'Captured via website popup lead form.'
      });

      if (sheetResult.ok) {
        return res.status(200).json({ ok: true, saved: true, message: 'Lead saved to Google Sheet.' });
      }

      return res.status(200).json({ ok: true, saved: false, message: 'Lead received locally. Configure Google Sheets to save it automatically.' });
    }

    d.phone = normalizePhone(d.phone);
    if (d.name.length < 2 || d.business.length < 2 || d.city.length < 2 || !d.type) {
      return res.status(400).json({ ok: false, error: 'Please fill all required fields.' });
    }

    if (!/^[6-9]\d{9}$/.test(d.phone)) {
      return res.status(400).json({ ok: false, error: 'Please enter a valid 10-digit mobile number.' });
    }

    if (d.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email)) {
      return res.status(400).json({ ok: false, error: 'Please enter a valid email address.' });
    }

    if (!/^\d{10,15}$/.test(WHATSAPP_NUMBER) || WHATSAPP_NUMBER === '919876543210') {
      return res.status(500).json({ ok: false, error: 'Please configure the business WhatsApp number.' });
    }

    const lines = [
      '*New Software Enquiry*',
      '',
      '*Name:* ' + d.name,
      '*Business Name:* ' + d.business,
      '*Mobile:* ' + d.phone,
      '*Email:* ' + (d.email || 'Not provided'),
      '*City:* ' + d.city,
      '*Business Type:* ' + d.type,
      '*GSTIN:* ' + (d.gstin || 'Not provided'),
      '*Products:* ' + (d.products || 'Not provided'),
      '*Daily Bills:* ' + (d.bills || 'Not provided'),
      '*Current Software:* ' + (d.software || 'Not provided'),
      '*Scanner:* ' + (d.scanner || 'Not provided'),
      '*Requirements:* ' + (d.needs || 'Not provided'),
      '*Preferred Language:* ' + (d.lang || 'Not provided'),
      '*Contact Time:* ' + (d.ctime || 'Not provided'),
      '*Message:* ' + (d.message || 'Not provided')
    ];

    const whatsappUrl = 'https://wa.me/' + WHATSAPP_NUMBER + '?text=' + encodeURIComponent(lines.join('\n'));

    await saveToGoogleSheet(d).catch(() => {});

    return res.status(200).json({
      ok: true,
      method: 'whatsapp',
      whatsappUrl,
      message: 'WhatsApp enquiry link generated.'
    });
  } catch (e) {
    console.error('Enquiry error:', e && e.message ? e.message : e);
    return res.status(500).json({ ok: false, error: 'Something went wrong. Please try again.' });
  }
};

function safeJson(s) {
  try { return JSON.parse(s); } catch (e) { return {}; }
}

