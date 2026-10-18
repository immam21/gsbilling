# GSheetPOS website

A one-page marketing site with an onboarding enquiry form.

```
index.html                 the whole website (HTML + CSS + JS, no build step)
privacy.html               privacy notice (edit the [brackets])
api/enquiry.js             Vercel serverless function that receives the form
apps-script/Enquiries.gs   Google Apps Script that saves each enquiry in a Google Sheet and emails you
vercel.json, package.json  Vercel settings
```

## 1. Make the Google Sheet that receives enquiries (5 minutes)
1. Create a new Google Sheet named **GSheetPOS Enquiries**.
2. **Extensions > Apps Script**, delete the default code, paste in `apps-script/Enquiries.gs`.
3. Change `TOKEN` to a long random text (for example 30 random letters and digits) and `OWNER_EMAIL` to your email. Save.
4. Choose the function **setup** and click Run (authorize when asked). This creates the header row and a Status dropdown.
5. **Deploy > New deployment > Web app**. Execute as: **Me**. Who has access: **Anyone**. Deploy and copy the **Web app URL**.

## 2. Edit the site (2 minutes)
In `index.html`, find `var CONFIG` near the bottom:
- `whatsapp`: your WhatsApp number with country code, digits only, e.g. `919876543210`.
  The floating WhatsApp button and the "Chat on WhatsApp" buttons stay hidden until you set this.
- In `privacy.html` fill the [brackets] (date, business name, phone, email).

Check these statements are true for your business before you publish (they are in the FAQ and pricing card):
- "Setup help and 30 days of support are included."
- "We contact you shortly" after the form is sent.
- "Guided setup on a video call."

## 3. Deploy on Vercel
1. Put this folder in a GitHub repository (or use the Vercel CLI: run `vercel` inside this folder).
2. On vercel.com choose **Add New > Project**, import the repository, and keep the defaults (no build command needed).
3. Before deploying, open **Settings > Environment Variables** and add:
   - `APPS_SCRIPT_URL` = the Web app URL from step 1
   - `ENQUIRY_TOKEN`  = the same TOKEN text you typed in Enquiries.gs
4. Deploy. Open your site, send a test enquiry, and check the Google Sheet and your email.
5. Add your own domain under **Settings > Domains**.

If you change the environment variables later, redeploy the project once so they take effect.

## How the form works
Browser -> `/api/enquiry` (checks the data, blocks simple bots) -> Apps Script web app (checks the token) -> new row in your Sheet + email to you.
If saving fails, the visitor sees a button to send the same details to you on WhatsApp, so no enquiry is lost.

## Changing the name, price or text
Search `index.html` for `GSheetPOS` and `1,599` and replace them. Colours are the CSS variables at the top of the file.
Add real screenshots, customer quotes and your photo when you have them: they sell better than any text.

## Good to know
- The site shows sample screens with sample data and says so. Keep it that way: only show real shop names or photos with permission.
- Keep the footer line that says the product is not affiliated with Google or WhatsApp.
- Have the privacy notice reviewed, since you collect phone numbers.
