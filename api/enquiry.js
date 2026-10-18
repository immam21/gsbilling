// Vercel serverless function: receives the enquiry form and saves it to your Google Sheet (through an Apps Script web app).
// Environment variables to set in Vercel (Project > Settings > Environment Variables):
//   APPS_SCRIPT_URL  = the Web app URL of apps-script/Enquiries.gs
//   ENQUIRY_TOKEN    = the same secret text you typed in Enquiries.gs (TOKEN)

const FIELDS = ['name', 'business', 'phone', 'email', 'city', 'type', 'gstin', 'products', 'bills', 'software', 'scanner', 'needs', 'lang', 'ctime', 'message'];
const MAX = { message: 1500, software: 200, needs: 200 };

function clean(v, max) {
  return String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max || 120);
}

const URL_OK = /^https:\/\/script\.google\.com\/macros\/s\/[^/\s]+\/exec$/;

module.exports = async function handler(req, res) {
  try { return await run(req, res); }
  catch (e) {
    console.error('enquiry: unexpected error:', e && e.stack ? e.stack : e);
    return res.status(500).json({ ok: false, error: 'Something went wrong on our side.', detail: String(e && e.message ? e.message : e) });
  }
};

async function run(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const url = String(process.env.APPS_SCRIPT_URL || '').trim().replace(/^["']|["']$/g, '');
  const token = String(process.env.ENQUIRY_TOKEN || '').trim();

  // Open  https://YOUR-SITE/api/enquiry  in the browser to check the set-up (shows only yes/no, never the secrets)
  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, APPS_SCRIPT_URL_set: !!url, APPS_SCRIPT_URL_looks_right: URL_OK.test(url), ENQUIRY_TOKEN_set: !!token });
  }
  if (req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return res.status(405).json({ ok: false, error: 'Method not allowed' }); }

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

  const missing = [!url && 'APPS_SCRIPT_URL', !token && 'ENQUIRY_TOKEN'].filter(Boolean);
  if (missing.length) {
    console.error('enquiry: missing environment variable(s): ' + missing.join(', ') + '. Add them in Vercel > Settings > Environment Variables, then redeploy.');
    return res.status(500).json({ ok: false, error: 'The enquiry service is not set up yet.', detail: 'Missing: ' + missing.join(', ') });
  }
  if (!URL_OK.test(url)) {
    console.error('enquiry: APPS_SCRIPT_URL does not look like a Web app URL ending in /exec');
    return res.status(500).json({ ok: false, error: 'The enquiry service is not set up correctly.', detail: 'APPS_SCRIPT_URL must be the Apps Script Web app URL ending in /exec' });
  }

  try {
    const r = await fetch(url, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },      // plain text avoids a CORS pre-flight with Apps Script
      body: JSON.stringify(Object.assign({ token: token }, d)),
    });
    const text = await r.text();
    let j = null; try { j = JSON.parse(text); } catch (e) { /* not JSON */ }
    if (!j) {
      console.error('enquiry: Apps Script did not return JSON (status ' + r.status + '). Is "Who has access" set to Anyone? Start of reply: ' + text.slice(0, 160).replace(/\s+/g, ' '));
      return res.status(502).json({ ok: false, error: 'We could not save your enquiry right now.', detail: 'Apps Script did not return JSON. Deploy it as a Web app with access set to Anyone, and use the newest version.' });
    }
    if (!j.ok) {
      console.error('enquiry: Apps Script refused: ' + j.error);
      return res.status(502).json({ ok: false, error: 'We could not save your enquiry right now.', detail: 'Apps Script said: ' + j.error });
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('enquiry: could not reach Apps Script:', e && e.message);
    return res.status(502).json({ ok: false, error: 'We could not save your enquiry right now.', detail: String(e && e.message ? e.message : e) });
  }
}

function safeJson(s) { try { return JSON.parse(s); } catch (e) { return {}; } }
