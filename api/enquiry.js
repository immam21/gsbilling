// Vercel Serverless Function: WhatsApp-only Enquiry Handler
// Google Sheets / Apps Script submission has been removed.
//
// SETUP:
// 1. Save this file as api/enquiry.js
// 2. Replace WHATSAPP_NUMBER with your business WhatsApp number.
// 3. Deploy to Vercel.
//
// FLOW:
// Website form -> Vercel API -> WhatsApp link
// The customer must press Send inside WhatsApp.
//
// NOTE:
// This API does not automatically send WhatsApp messages.

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

// Replace with your business WhatsApp number.
// India example: 919876543210
const WHATSAPP_NUMBER = '919688772477';

function clean(v, max) {
  return String(v == null ? '' : v)
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max || 120);
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  // Health check
  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      enquiry_method: 'WhatsApp only',
      whatsapp_configured:
        /^\d{10,15}$/.test(WHATSAPP_NUMBER) &&
        WHATSAPP_NUMBER !== '919876543210'
    });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');

    return res.status(405).json({
      ok: false,
      error: 'Method not allowed'
    });
  }

  try {
    const body =
      typeof req.body === 'string'
        ? safeJson(req.body)
        : req.body || {};

    // Spam protection: hidden honeypot field
    if (body.website) {
      return res.status(200).json({ ok: true });
    }

    // Spam protection: minimum form completion time of 3 seconds
    if (Number(body.t) < 3000) {
      return res.status(200).json({ ok: true });
    }

    // Clean submitted fields
    const d = {};

    FIELDS.forEach((key) => {
      d[key] = clean(body[key], MAX[key]);
    });

    // Normalize phone number
    d.phone = d.phone.replace(/\D/g, '');

    if (d.phone.length === 12 && d.phone.startsWith('91')) {
      d.phone = d.phone.slice(2);
    }

    if (d.phone.length === 11 && d.phone.startsWith('0')) {
      d.phone = d.phone.slice(1);
    }

    // Required field validation
    if (
      d.name.length < 2 ||
      d.business.length < 2 ||
      d.city.length < 2 ||
      !d.type
    ) {
      return res.status(400).json({
        ok: false,
        error: 'Please fill all required fields.'
      });
    }

    if (!/^[6-9]\d{9}$/.test(d.phone)) {
      return res.status(400).json({
        ok: false,
        error: 'Please enter a valid 10-digit mobile number.'
      });
    }

    if (
      d.email &&
      !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email)
    ) {
      return res.status(400).json({
        ok: false,
        error: 'Please enter a valid email address.'
      });
    }

    // Ensure the business WhatsApp number is configured
    if (
      !/^\d{10,15}$/.test(WHATSAPP_NUMBER) ||
      WHATSAPP_NUMBER === '919876543210'
    ) {
      return res.status(500).json({
        ok: false,
        error: 'Please configure the business WhatsApp number.'
      });
    }

    // Build the enquiry message
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

    const message = lines.join('\n');

    const whatsappUrl =
      'https://wa.me/' +
      WHATSAPP_NUMBER +
      '?text=' +
      encodeURIComponent(message);

    // No Apps Script request. No Google Sheets write.
    return res.status(200).json({
      ok: true,
      method: 'whatsapp',
      whatsappUrl: whatsappUrl,
      message: 'WhatsApp enquiry link generated.'
    });

  } catch (e) {
    console.error('WhatsApp enquiry error:', e.message);

    return res.status(500).json({
      ok: false,
      error: 'Something went wrong. Please try again.'
    });
  }
};

function safeJson(s) {
  try {
    return JSON.parse(s);
  } catch (e) {
    return {};
  }
}

