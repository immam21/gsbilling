/**
 * ENQUIRY COLLECTOR  (Google Apps Script)
 * Saves every website enquiry as a row in a Google Sheet and emails you.
 *
 * SET UP
 *  1. Create a new Google Sheet, name it "GSheetPOS Enquiries".
 *  2. Extensions > Apps Script. Paste this whole file into Code.gs.
 *  3. Change TOKEN below to a long random text (the same text goes into Vercel as ENQUIRY_TOKEN).
 *  4. Change OWNER_EMAIL to your email.
 *  5. Run the function  setup  once (authorize it). This creates the header row and status dropdown.
 *  6. Deploy > New deployment > Web app > Execute as: Me > Who has access: Anyone > Deploy. Copy the Web app URL
 *     and put it into Vercel as APPS_SCRIPT_URL.
 *  7. After any later change: Deploy > Manage deployments > Edit > New version > Deploy.
 */
var TOKEN = 'CHANGE-ME-TO-A-LONG-RANDOM-TEXT';
var OWNER_EMAIL = 'you@example.com';

var HEADERS = ['Received', 'Status', 'Name', 'Business', 'Phone', 'Email', 'City', 'Business type', 'GSTIN', 'Products', 'Bills/day',
  'Current software', 'Has scanner', 'Needs', 'Language', 'Best time to call', 'Message', 'Notes'];

function setup() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  sh.setName('Enquiries');
  sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold').setBackground('#4f46e5').setFontColor('#ffffff');
  sh.setFrozenRows(1);
  sh.getRange('B2:B2000').setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInList(['New', 'Called', 'Demo booked', 'Paid', 'Onboarded', 'Not interested'], true).build());
  sh.getRange('E2:E2000').setNumberFormat('@');
  sh.getRange('A2:A2000').setNumberFormat('dd-mmm-yyyy hh:mm');
  var w = [150, 110, 140, 170, 120, 180, 110, 170, 130, 90, 90, 160, 90, 220, 90, 130, 300, 220];
  for (var i = 0; i < w.length; i++) sh.setColumnWidth(i + 1, w[i]);
}

function doPost(e) {
  var out;
  try {
    var d = JSON.parse(e.postData.contents);
    if (d.token !== TOKEN) throw new Error('Not allowed');
    var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Enquiries');
    if (!sh) throw new Error('Run setup first');
    var row = [new Date(), 'New', d.name, d.business, String(d.phone), d.email, d.city, d.type, d.gstin, d.products, d.bills,
      d.software, d.scanner, d.needs, d.lang, d.ctime, d.message, ''];
    sh.appendRow(row);
    try {
      MailApp.sendEmail(OWNER_EMAIL, 'New GSheetPOS enquiry: ' + d.business + ' (' + d.city + ')',
        'Name: ' + d.name + '\nBusiness: ' + d.business + '\nPhone/WhatsApp: ' + d.phone + '\nEmail: ' + d.email + '\nCity: ' + d.city +
        '\nType: ' + d.type + '\nProducts: ' + d.products + '   Bills/day: ' + d.bills + '\nScanner: ' + d.scanner + '\nNeeds: ' + d.needs +
        '\nCall in: ' + d.lang + ', ' + d.ctime + '\nMessage: ' + d.message + '\n\nWhatsApp: https://wa.me/91' + d.phone);
    } catch (mailErr) { /* the row is saved even if the email fails */ }
    out = { ok: true };
  } catch (err) { out = { ok: false, error: String(err && err.message ? err.message : err) }; }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}
