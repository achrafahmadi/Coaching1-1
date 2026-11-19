/**
 * Diet Generator — Achraf Ahmadi Coaching
 * Google Sheets backend for the diet app.
 *
 * SETUP (once):
 * 1. Open your Google Sheet → Extensions → Apps Script → paste this whole file → Save.
 * 2. Select the function "setup" at the top → Run → allow permissions.
 * 3. Deploy → New deployment → type "Web app"
 *      Execute as: Me      Who has access: Anyone
 *    → Deploy → copy the Web app URL (ends with /exec).
 * 4. Paste that URL into index.html at:  const API_URL = '...';
 */

const TABS = {
  clients: 'Clients',
  activity: 'Activity',
  weights: 'Weigh-ins',
};

const CLIENT_COLS = [
  'Phone', 'Name', 'Joined', 'Last active', 'Goal', 'Sex', 'Age', 'Height (cm)',
  'Start weight (kg)', 'Latest weight (kg)', 'Weekly change (kg)', 'Advice',
  'Training days', 'Activity', 'Body fat', 'Carb adj (g)', 'Maintenance kcal',
  'Training kcal', 'Protein (g)', 'Carbs (g)', 'Fat (g)', 'Rest kcal',
  'Meals logged', 'Perfect days', 'Streak', 'XP', 'Level', 'Training day plan',
  'Language', 'PIN (hashed)', 'State (do not edit)'
];
const ACTIVITY_COLS = ['Timestamp', 'Phone', 'Name', 'Type', 'Date', 'Details', 'kcal'];
const WEIGHT_COLS = ['Timestamp', 'Phone', 'Name', 'Date', 'Weight (kg)'];

/* ---------------- one-time setup ---------------- */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  makeTab_(ss, TABS.clients, CLIENT_COLS, '#0D1B2A');
  makeTab_(ss, TABS.activity, ACTIVITY_COLS, '#4F46E5');
  makeTab_(ss, TABS.weights, WEIGHT_COLS, '#15803D');
  const c = ss.getSheetByName(TABS.clients);
  c.getRange('A:A').setNumberFormat('@');
  c.setColumnWidth(12, 260); c.setColumnWidth(28, 420);
  c.hideColumns(CLIENT_COLS.length - 1, 2); // PIN + State
  ss.getSheetByName(TABS.activity).getRange('B:B').setNumberFormat('@');
  ss.getSheetByName(TABS.weights).getRange('B:B').setNumberFormat('@');
  const s1 = ss.getSheetByName('Sheet1');
  if (s1 && s1.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(s1);
  Logger.log('Setup done. Now deploy as a Web app.');
}
function makeTab_(ss, name, cols, color) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  sh.getRange(1, 1, 1, cols.length).setValues([cols])
    .setFontWeight('bold').setFontColor('#FFFFFF').setBackground(color);
  sh.setFrozenRows(1);
  sh.setFrozenColumns(name === TABS.clients ? 2 : 0);
  sh.setTabColor(color);
  sh.autoResizeColumns(1, cols.length);
}

/* ---------------- web app ---------------- */
function doGet() {
  return json_({ ok: true, app: 'Diet Generator API', time: new Date() });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    const req = JSON.parse(e.postData.contents || '{}');
    if (req.action === 'login') return json_(login_(req));
    if (req.action === 'sync') return json_(sync_(req));
    return json_({ ok: false, error: 'unknown_action' });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

/* ---------------- helpers ---------------- */
function cleanPhone_(p) { return String(p || '').replace(/[^\d]/g, '').replace(/^0+/, ''); }
function txt_(p) { return "'" + p; } // force plain text so Sheets keeps the full number
function hash_(s) {
  const raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, 'aac-diet:' + s);
  return raw.map(b => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');
}
function sheet_(name) { return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name); }
function findRow_(sh, phone) {
  const n = sh.getLastRow();
  if (n < 2) return -1;
  const ids = sh.getRange(2, 1, n - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) if (cleanPhone_(ids[i][0]) === phone) return i + 2;
  return -1;
}
function col_(name) { return CLIENT_COLS.indexOf(name) + 1; }

/* ---------------- login ---------------- */
function login_(req) {
  const phone = cleanPhone_(req.phone);
  const pin = String(req.pin || '');
  if (phone.length < 8) return { ok: false, error: 'bad_phone' };
  if (!/^\d{4}$/.test(pin)) return { ok: false, error: 'bad_pin' };
  const sh = sheet_(TABS.clients);
  const row = findRow_(sh, phone);
  const now = new Date();
  if (row === -1) {
    const vals = CLIENT_COLS.map(() => '');
    vals[col_('Phone') - 1] = txt_(phone);
    vals[col_('Name') - 1] = String(req.name || '').slice(0, 60);
    vals[col_('Joined') - 1] = now;
    vals[col_('Last active') - 1] = now;
    vals[col_('PIN (hashed)') - 1] = hash_(phone + ':' + pin);
    sh.appendRow(vals);
    logActivity_(phone, req.name, 'signup', '', 'New client');
    return { ok: true, isNew: true, state: null };
  }
  const saved = sh.getRange(row, col_('PIN (hashed)')).getValue();
  if (saved && saved !== hash_(phone + ':' + pin)) return { ok: false, error: 'wrong_pin' };
  sh.getRange(row, col_('Last active')).setValue(now);
  const name = sh.getRange(row, col_('Name')).getValue();
  let state = null;
  try { state = JSON.parse(sh.getRange(row, col_('State (do not edit)')).getValue() || 'null'); } catch (x) {}
  return { ok: true, isNew: false, name: name, state: state };
}

/* ---------------- sync ---------------- */
function sync_(req) {
  const phone = cleanPhone_(req.phone);
  const sh = sheet_(TABS.clients);
  const row = findRow_(sh, phone);
  if (row === -1) return { ok: false, error: 'not_found' };
  const saved = sh.getRange(row, col_('PIN (hashed)')).getValue();
  if (saved !== hash_(phone + ':' + String(req.pin || ''))) return { ok: false, error: 'wrong_pin' };

  const s = req.summary || {};
  const set = (k, v) => { if (v !== undefined && v !== null) sh.getRange(row, col_(k)).setValue(v); };
  set('Last active', new Date());
  set('Name', s.name);
  set('Goal', s.goal); set('Sex', s.sex); set('Age', s.age); set('Height (cm)', s.height);
  set('Start weight (kg)', s.startWeight); set('Latest weight (kg)', s.latestWeight);
  set('Weekly change (kg)', s.weeklyChange); set('Advice', s.advice);
  set('Training days', s.days); set('Activity', s.activity); set('Body fat', s.bf);
  set('Carb adj (g)', s.carbAdj); set('Maintenance kcal', s.tdee);
  set('Training kcal', s.kcal); set('Protein (g)', s.P); set('Carbs (g)', s.C); set('Fat (g)', s.F);
  set('Rest kcal', s.restKcal); set('Meals logged', s.mealsLogged); set('Perfect days', s.perfectDays);
  set('Streak', s.streak); set('XP', s.xp); set('Level', s.level);
  set('Training day plan', s.plan); set('Language', s.lang);
  if (req.state) {
    const str = JSON.stringify(req.state);
    if (str.length < 48000) sh.getRange(row, col_('State (do not edit)')).setValue(str);
  }

  const ev = req.event;
  if (ev && ev.type) {
    logActivity_(phone, s.name, ev.type, ev.date || '', ev.details || '', ev.kcal || '');
    if (ev.type === 'weight' && ev.kg) {
      sheet_(TABS.weights).appendRow([new Date(), txt_(phone), s.name || '', ev.date || '', Number(ev.kg)]);
    }
  }
  return { ok: true };
}

function logActivity_(phone, name, type, date, details, kcal) {
  sheet_(TABS.activity).appendRow([new Date(), txt_(phone), name || '', type, date || '', details || '', kcal || '']);
}
