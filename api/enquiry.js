// Vercel serverless function: receives the enquiry form and saves it to your Google Sheet (through an Apps Script web app).
// Environment variables to set in Vercel (Project > Settings > Environment Variables):
//   APPS_SCRIPT_URL  = the Web app URL of apps-script/Enquiries.gs
//   ENQUIRY_TOKEN    = the same secret text you typed in Enquiries.gs (TOKEN)

const FIELDS = ['name', 'business', 'phone', 'email', 'city', 'type', 'gstin', 'products', 'bills', 'software', 'scanner', 'needs', 'lang', 'ctime', 'message'];
const MAX = { message: 1500, software: 200, needs: 200 };

function clean(v, max) {
  return String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max || 120);
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ ok: false, error: 'Method not allowed' }); }

  const body = typeof req.body === 'string' ? safeJson(req.body) : (req.body || {});
  // spam checks: hidden field must be empty, and a real person needs a few seconds to fill the form
  if (body.website) return res.status(200).json({ ok: true });
  if (Number(body.t) < 3000) return res.status(200).json({ ok: true });

  const d = {};
  FIELDS.forEach((k) => { d[k] = clean(body[k], MAX[k]); });
  d.phone = d.phone.replace(/\D/g, '');
  if (d.phone.length === 12 && d.phone.startsWith('91')) d.phone = d.phone.slice(2);
  if (d.phone.length === 11 && d.phone.startsWith('0')) d.phone = d.phone.slice(1);

  if (d.name.length < 2 || d.business.length < 2 || d.city.length < 2 || !d.type) return res.status(400).json({ ok: false, error: 'Please fill all required fields.' });
  if (!/^[6-9]\d{9}$/.test(d.phone)) return res.status(400).json({ ok: false, error: 'Please enter a valid 10-digit mobile number.' });
  if (d.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email)) return res.status(400).json({ ok: false, error: 'Please enter a valid email address.' });

  const url = process.env.APPS_SCRIPT_URL, token = process.env.ENQUIRY_TOKEN;
  if (!url || !token) return res.status(500).json({ ok: false, error: 'The enquiry service is not set up yet.' });

  try {
    const r = await fetch(url, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },      // plain text avoids a CORS pre-flight with Apps Script
      body: JSON.stringify(Object.assign({ token: token }, d)),
    });
    const j = await r.json();
    if (!j || !j.ok) throw new Error((j && j.error) || 'Save failed');
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(502).json({ ok: false, error: 'We could not save your enquiry right now.' });
  }
};

function safeJson(s) { try { return JSON.parse(s); } catch (e) { return {}; } }
