/**
 * TRT Protocol leads → Google Sheet
 * Receives the form on achrafahmadi.com/trtprotocol BEFORE the client goes to WhatsApp.
 * One row per visitor: created when they start typing ("started"),
 * updated to "sent_to_whatsapp" when they press the button.
 *
 * SETUP (once):
 * 1. Create a new Google Sheet (e.g. "TRT Protocol Leads").
 * 2. Extensions → Apps Script → delete everything → paste this whole file → Save.
 * 3. Deploy → New deployment → type: Web app
 *      Execute as: Me
 *      Who has access: Anyone
 *    → Deploy → allow the permissions → copy the "Web app URL" (ends in /exec).
 * 4. Paste that URL into LEADS_URL at the top of trtprotocol.html (or send it to Claude).
 */

var SHEET_NAME = 'Leads';
var HEADERS = ['Time (Morocco)', 'Status', 'Name', 'WhatsApp', 'Plan', 'Value (MAD)', 'Goal', 'Language',
               'Source', 'Medium', 'Campaign / story', 'Referrer', 'Page', 'Lead ID', 'Last update'];

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var d = JSON.parse(e.postData.contents);
    var sh = getSheet_();
    var now = Utilities.formatDate(new Date(), 'Africa/Casablanca', 'yyyy-MM-dd HH:mm:ss');
    var row = [now, label_(d.status), clean_(d.name), "'" + clean_(d.phone).replace(/^'/, ''), clean_(d.plan), d.value || '', clean_(d.goal),
               clean_(d.lang), clean_(d.utm_source), clean_(d.utm_medium), clean_(d.utm_campaign),
               clean_(d.referrer), clean_(d.page), clean_(d.id), now];

    // Same visitor → update their row instead of adding a new one
    var idCol = HEADERS.indexOf('Lead ID') + 1;
    var last = sh.getLastRow();
    if (d.id && last > 1) {
      var ids = sh.getRange(2, idCol, last - 1, 1).getValues();
      for (var i = ids.length - 1; i >= 0; i--) {
        if (ids[i][0] === d.id) {
          var r = i + 2;
          var prev = sh.getRange(r, 2).getValue();
          if (prev === label_('sent_to_whatsapp')) row[1] = prev;   // never downgrade a sent lead
          row[0] = sh.getRange(r, 1).getValue();                      // keep first-seen time
          sh.getRange(r, 1, 1, row.length).setValues([row]);
          return ok_();
        }
      }
    }
    sh.appendRow(row);
    return ok_();
  } finally {
    lock.releaseLock();
  }
}

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) {
    sh.appendRow(HEADERS);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold').setBackground('#C9A84C');
    sh.setFrozenRows(1);
  }
  return sh;
}

function label_(s) {
  return s === 'sent_to_whatsapp' ? '✅ Sent to WhatsApp' : '⏳ Started, not sent';
}

// Stop formulas being injected via the form (e.g. a name starting with "=")
function clean_(v) {
  v = String(v == null ? '' : v).slice(0, 500);
  return /^[=+\-@]/.test(v) ? "'" + v : v;
}

function ok_() {
  return ContentService.createTextOutput('ok');
}

// Open the editor and run this once to test: it should add a row to the sheet.
function testRow() {
  doPost({ postData: { contents: JSON.stringify({ id: 'test1', status: 'started', name: 'Test', phone: '0612345678', plan: '3 months',
    value: 3500, goal: 'energy', lang: 'ar', utm_source: 'instagram', utm_medium: 'story', utm_campaign: 'test' }) } });
}
