/**
 * Pharmacy attendance API (Google Apps Script web app).
 *
 * Setup (Project Settings > Script properties):
 *   ADMIN_PASSWORD  required, used by action "login"
 *   SHEET_ID        optional, overrides the default below
 *
 * Contract: every response is JSON { ok: true, data } or { ok: false, error, message }.
 *   GET  ?action=ping|events|records|categories|volunteers|lookup&psCode=...
 *   POST (Content-Type: text/plain, JSON body) { action, ... }
 *        public: addRecord, addVolunteer, login      admin (needs token): saveEvent, deleteEvent, removeDuplicates, saveCategories, deleteVolunteer, listUsers, saveUser, deleteUser
 *
 * Sensitive user columns (national ID, password) are never returned.
 */

var DEFAULT_SHEET_ID = '15Vd-K-0f7yEXTioI8-M5tQB2992UbktMGkCEbk3M-sU';
var SHEETS = { record: 'record', event: 'event', user: 'user', category: 'category', volunteer: 'volunteer' };
var CACHE_TTL = 120;          // seconds, server-side read cache
var SESSION_TTL = 6 * 3600;   // seconds (CacheService max)
var MAX_LOGIN_FAILS = 5;
var LOGIN_LOCK_SECONDS = 300;

var RECORD_HEADERS = ['Timestamp', 'Name', 'Position', 'Department', 'Date', 'Event', 'Points', 'PSCode', 'EventID'];
var VOLUNTEER_HEADERS = ['ID', 'Timestamp', 'PSCode', 'Name', 'Position', 'Department', 'Date', 'Activity', 'Detail', 'Round'];
var EVENT_HEADERS = ['ID', 'Name', 'Catagory', 'Point', 'Date', 'Organizer', 'Status', 'Description', 'Updated At'];

var USER_COL = {
  psCode: 'PS Code',
  name: 'ชื่อ-นามสกุล',
  group: 'กลุ่ม',
  level: 'ระดับ',
  unit: 'หน่วยงาน',
  status: 'status'
};

/* ------------------------------------------------------------------ routing */

function doGet(e) {
  var params = (e && e.parameter) || {};
  return handle_(params.action || 'ping', params, false);
}

function doPost(e) {
  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return out_(fail_('bad_request', 'Invalid JSON body'));
  }
  return handle_(body.action, body, true);
}

function handle_(action, params, isPost) {
  try {
    var readers = { ping: ping_, events: getEvents_, records: getRecords_, lookup: lookupUser_, categories: getCategories_, volunteers: getVolunteers_ };
    var writers = { addRecord: addRecord_, addVolunteer: addVolunteer_, login: login_ };
    var admins = { saveEvent: saveEvent_, deleteEvent: deleteEvent_, removeDuplicates: removeDuplicates_, saveCategories: saveCategories_, deleteVolunteer: deleteVolunteer_,
      listUsers: listUsers_, saveUser: saveUser_, deleteUser: deleteUser_ };

    if (!isPost && readers[action]) return out_(ok_(readers[action](params)));
    if (isPost && writers[action]) return out_(ok_(writers[action](params)));
    if (isPost && admins[action]) {
      requireAdmin_(params.token);
      return out_(ok_(admins[action](params)));
    }
    return out_(fail_('unknown_action', 'Unknown action: ' + action));
  } catch (err) {
    if (err && err.apiCode) return out_(fail_(err.apiCode, err.message));
    console.error(err && err.stack ? err.stack : err);
    return out_(fail_('server_error', 'Server error'));
  }
}

function ok_(data) { return { ok: true, data: data }; }
function fail_(error, message) { return { ok: false, error: error, message: message }; }
function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function apiError_(code, message) {
  var err = new Error(message);
  err.apiCode = code;
  return err;
}

/* ---------------------------------------------------------------- utilities */

function ss_() {
  var id = PropertiesService.getScriptProperties().getProperty('SHEET_ID') || DEFAULT_SHEET_ID;
  return SpreadsheetApp.openById(id);
}

function str_(v) { return v === null || v === undefined ? '' : String(v).trim(); }

function fmtDate_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, ss_().getSpreadsheetTimeZone(), 'yyyy-MM-dd');
  return str_(v);
}

function fmtTime_(v) {
  if (v instanceof Date) return v.toISOString();
  return str_(v);
}

/** Read a sheet into { sheet, headers (trimmed), col (name -> 0-based), rows }. Creates it when missing. */
function table_(name, defaultHeaders) {
  var ss = ss_();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(defaultHeaders);
  }
  var values = sheet.getDataRange().getValues();
  var headers = values.shift().map(function (h) { return str_(h); });
  var col = {};
  headers.forEach(function (h, i) { if (h && !(h in col)) col[h] = i; });
  return { sheet: sheet, headers: headers, col: col, rows: values };
}

/** Append missing header names to the sheet's first row (additive, never reorders). */
function ensureColumns_(t, names) {
  var added = false;
  names.forEach(function (n) {
    if (!(n in t.col)) {
      t.sheet.getRange(1, t.headers.length + 1).setValue(n);
      t.col[n] = t.headers.length;
      t.headers.push(n);
      added = true;
    }
  });
  return added;
}

function pick_(row, col, names) {
  for (var i = 0; i < names.length; i++) {
    if (names[i] in col) return row[col[names[i]]];
  }
  return '';
}

/* ------------------------------------------------------- chunked read cache */

function cacheGet_(key) {
  var c = CacheService.getScriptCache();
  var n = c.get(key + ':n');
  if (!n) return null;
  var keys = [];
  for (var i = 0; i < +n; i++) keys.push(key + ':' + i);
  var parts = c.getAll(keys);
  var s = '';
  for (var j = 0; j < keys.length; j++) {
    if (parts[keys[j]] == null) return null;
    s += parts[keys[j]];
  }
  return JSON.parse(s);
}

function cachePut_(key, obj) {
  var c = CacheService.getScriptCache();
  var s = JSON.stringify(obj);
  var size = 30000; // chars; Thai is 3 bytes in UTF-8, keep each value under the 100KB limit
  var entries = {};
  var n = Math.max(1, Math.ceil(s.length / size));
  for (var i = 0; i < n; i++) entries[key + ':' + i] = s.substr(i * size, size);
  entries[key + ':n'] = String(n);
  try { c.putAll(entries, CACHE_TTL); } catch (err) { /* cache is best-effort */ }
}

function cacheDel_(key) {
  var c = CacheService.getScriptCache();
  var n = c.get(key + ':n');
  var keys = [key + ':n'];
  for (var i = 0; i < +n; i++) keys.push(key + ':' + i);
  c.removeAll(keys);
}

/* --------------------------------------------------------------------- reads */

function ping_() { return { time: new Date().toISOString() }; }

/** Events are either enabled or disabled; older values (completed, cancelled, …) count as disabled. */
function normStatus_(v) {
  var s = str_(v).toLowerCase();
  if (s === '' || s === 'active') return 'active';
  return s === 'deleted' ? 'deleted' : 'inactive';
}

function toEvent_(row, col) {
  return {
    id: str_(pick_(row, col, ['ID'])),
    name: str_(pick_(row, col, ['Name'])),
    category: str_(pick_(row, col, ['Catagory', 'Category'])),
    points: parseFloat(pick_(row, col, ['Point', 'Points'])) || 0,
    date: fmtDate_(pick_(row, col, ['Date'])),
    organizer: str_(pick_(row, col, ['Organizer'])),
    status: normStatus_(pick_(row, col, ['Status'])),
    description: str_(pick_(row, col, ['Description'])),
    round: /^[12]\/\d{4}$/.test(str_(pick_(row, col, ['Round']))) ? str_(pick_(row, col, ['Round'])) : '',
    updatedAt: fmtTime_(pick_(row, col, ['Updated At']))
  };
}

function getEvents_() {
  var cached = cacheGet_('events');
  if (cached) return cached;
  var t = table_(SHEETS.event, EVENT_HEADERS);
  var events = t.rows
    .filter(function (r) { return str_(pick_(r, t.col, ['ID'])) !== '' && str_(pick_(r, t.col, ['Name'])) !== ''; })
    .map(function (r) { return toEvent_(r, t.col); })
    .filter(function (e) { return e.status !== 'deleted'; });
  cachePut_('events', events);
  return events;
}

function getRecords_(params) {
  var all = cacheGet_('records');
  if (!all) {
    var t = table_(SHEETS.record, RECORD_HEADERS);
    all = t.rows
      .filter(function (r) { return str_(pick_(r, t.col, ['Name'])) !== ''; })
      .map(function (r) {
        return {
          timestamp: fmtTime_(pick_(r, t.col, ['Timestamp'])),
          name: str_(pick_(r, t.col, ['Name'])),
          position: str_(pick_(r, t.col, ['Position'])),
          department: str_(pick_(r, t.col, ['Department'])),
          date: fmtDate_(pick_(r, t.col, ['Date'])),
          event: str_(pick_(r, t.col, ['Event'])),
          eventId: str_(pick_(r, t.col, ['EventID'])),
          points: parseFloat(pick_(r, t.col, ['Points'])) || 0
        };
      });
    all.reverse(); // newest first (sheet is append-only)
    cachePut_('records', all);
  }
  var limit = parseInt(params && params.limit, 10);
  return limit > 0 ? { total: all.length, items: all.slice(0, limit) } : { total: all.length, items: all };
}

var INACTIVE_STATUS = ['inactive', 'disabled', 'suspended', '0', 'false', 'no', 'ปิด', 'ปิดใช้งาน', 'ไม่ใช้งาน', 'ระงับ', 'ลาออก', 'พ้นสภาพ'];

function normKey_(v) { return str_(v).replace(/\s+/g, '').toLowerCase(); }

/** Column index by header, ignoring case and whitespace ("PS Code" == "pscode"). -1 when absent. */
function findCol_(t, name) {
  var want = normKey_(name);
  for (var i = 0; i < t.headers.length; i++) if (normKey_(t.headers[i]) === want) return i;
  return -1;
}

/**
 * Find one user by PS Code. Only the PS Code column is read; the match ignores case and surrounding
 * whitespace and accepts numeric cells. Throws a specific error instead of returning null so the
 * caller can tell "no such code" from "account disabled" or "sheet misconfigured".
 * Returns only non-sensitive fields.
 */
function findUser_(psCode) {
  var t = table_(SHEETS.user, ['PS Code', 'ID 13 หลัก', USER_COL.name, 'กลุ่ม', USER_COL.level, USER_COL.unit, 'รหัสผ่าน', 'status']);
  var c = findCol_(t, USER_COL.psCode);
  if (c < 0) throw apiError_('config', 'ชีต user ไม่มีคอลัมน์ "PS Code"');

  var want = normKey_(psCode);
  var hit = -1;
  for (var i = 0; i < t.rows.length; i++) {
    if (normKey_(t.rows[i][c]) === want) { hit = i; break; }
  }
  if (hit < 0) throw apiError_('not_found', 'ไม่พบ PS Code นี้ในระบบ');

  var row = t.rows[hit];
  var sc = findCol_(t, USER_COL.status);
  var status = sc >= 0 ? str_(row[sc]) : '';
  if (INACTIVE_STATUS.indexOf(status.toLowerCase()) >= 0) {
    throw apiError_('inactive_user', 'บัญชีนี้ถูกปิดใช้งาน (status: ' + status + ')');
  }
  var nc = findCol_(t, USER_COL.name), lc = findCol_(t, USER_COL.level), uc = findCol_(t, USER_COL.unit);
  return {
    psCode: str_(row[c]),
    name: nc >= 0 ? str_(row[nc]) : '',
    position: lc >= 0 ? str_(row[lc]) : '',
    department: uc >= 0 ? str_(row[uc]) : ''
  };
}

function lookupUser_(params) {
  var psCode = str_(params.psCode);
  if (!psCode || psCode.length > 30) throw apiError_('invalid_input', 'PS Code ไม่ถูกต้อง');
  return findUser_(psCode);
}

/* -------------------------------------------------------------------- writes */

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) throw apiError_('busy', 'ระบบไม่ว่าง กรุณาลองใหม่อีกครั้ง');
  try { return fn(); } finally { lock.releaseLock(); }
}

/** Identity and event details come from the sheets, never from the client. */
function addRecord_(b) {
  var psCode = str_(b.psCode);
  var eventId = str_(b.eventId);
  if (!psCode || !eventId) throw apiError_('invalid_input', 'ข้อมูลไม่ครบ');

  var user = findUser_(psCode);
  if (!user) throw apiError_('not_found', 'ไม่พบ PS Code นี้ในระบบ');
  var ev = getEvents_().filter(function (e) { return e.id === eventId; })[0];
  if (!ev) throw apiError_('not_found', 'ไม่พบกิจกรรม');
  if (ev.status !== 'active') throw apiError_('inactive_event', 'กิจกรรมนี้ปิดรับการบันทึกแล้ว');

  return withLock_(function () {
    var t = table_(SHEETS.record, RECORD_HEADERS);
    ensureColumns_(t, ['PSCode', 'EventID']);

    // Duplicate rule is unchanged: same Name + Date + Event.
    var last = t.sheet.getLastRow();
    if (last > 1) {
      var width = t.headers.length;
      var rows = t.sheet.getRange(2, 1, last - 1, width).getValues();
      for (var i = 0; i < rows.length; i++) {
        if (str_(rows[i][t.col['Name']]) === user.name &&
            fmtDate_(rows[i][t.col['Date']]) === ev.date &&
            str_(rows[i][t.col['Event']]) === ev.name) {
          throw apiError_('duplicate', 'ข้อมูลซ้ำ: ' + user.name + ' ได้บันทึกการเข้าร่วม ' + ev.name + ' แล้ว');
        }
      }
    }

    var row = new Array(t.headers.length).fill('');
    row[t.col['Timestamp']] = new Date();
    row[t.col['Name']] = user.name;
    row[t.col['Position']] = user.position;
    row[t.col['Department']] = user.department;
    row[t.col['Date']] = ev.date;
    row[t.col['Event']] = ev.name;
    row[t.col['Points']] = ev.points;
    row[t.col['PSCode']] = user.psCode;
    row[t.col['EventID']] = ev.id;
    t.sheet.appendRow(row);
    cacheDel_('records');
    return { name: user.name, event: ev.name, points: ev.points };
  });
}

function saveEvent_(b) {
  var name = str_(b.name);
  if (!name || name.length > 200) throw apiError_('invalid_input', 'กรุณาระบุชื่อกิจกรรม');
  var date = str_(b.date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw apiError_('invalid_input', 'วันที่ไม่ถูกต้อง');
  var status = str_(b.status).toLowerCase() || 'active';
  if (['active', 'inactive'].indexOf(status) < 0) throw apiError_('invalid_input', 'สถานะไม่ถูกต้อง');
  var points = parseFloat(b.points);
  if (isNaN(points) || points < 0 || points > 1000) throw apiError_('invalid_input', 'คะแนนไม่ถูกต้อง');

  // Evaluation round, e.g. "1/2570" (round 1 of fiscal year 2570). Optional.
  var round = str_(b.round);
  if (round && !/^[12]\/\d{4}$/.test(round)) throw apiError_('invalid_input', 'รอบประเมินไม่ถูกต้อง');

  return withLock_(function () {
    var t = table_(SHEETS.event, EVENT_HEADERS);
    var catCol = 'Catagory' in t.col ? 'Catagory' : ('Category' in t.col ? 'Category' : 'Catagory');
    ensureColumns_(t, [catCol, 'Round']);
    var pointCol = 'Point' in t.col ? 'Point' : 'Points';

    var id = str_(b.id);
    var rowIndex = -1;
    if (id) {
      for (var i = 0; i < t.rows.length; i++) {
        if (str_(t.rows[i][t.col['ID']]) === id) { rowIndex = i + 2; break; }
      }
      if (rowIndex < 0) throw apiError_('not_found', 'ไม่พบกิจกรรม');
    }
    var row = new Array(t.headers.length).fill('');
    if (rowIndex > 0) {
      t.rows[rowIndex - 2].forEach(function (v, i) { row[i] = v; });
    }

    if (rowIndex < 0) id = Utilities.getUuid().slice(0, 8) + Date.now().toString(36);
    row[t.col['ID']] = id;
    row[t.col['Name']] = name;
    row[t.col[catCol]] = str_(b.category).slice(0, 100);
    row[t.col[pointCol]] = points;
    row[t.col['Date']] = date;
    row[t.col['Organizer']] = str_(b.organizer).slice(0, 200);
    row[t.col['Status']] = status;
    row[t.col['Description']] = str_(b.description).slice(0, 2000);
    row[t.col['Updated At']] = new Date();
    row[t.col['Round']] = round;

    // Plain-text format first: Sheets would otherwise read "1/2570" as a date.
    var target = rowIndex > 0 ? rowIndex : t.sheet.getLastRow() + 1;
    t.sheet.getRange(target, t.col['Round'] + 1).setNumberFormat('@');
    t.sheet.getRange(target, 1, 1, row.length).setValues([row]);
    cacheDel_('events');
    return { id: id };
  });
}

/**
 * Event categories managed by the admin, stored in the "category" sheet (one name per row, in display order).
 * Until an admin saves a list, the distinct categories already used by events are offered instead.
 */
function getCategories_() {
  var cached = cacheGet_('categories');
  if (cached) return cached;
  var t = table_(SHEETS.category, ['Name']);
  var c = findCol_(t, 'Name');
  var names = [];
  if (c >= 0) {
    t.rows.forEach(function (r) { var n = str_(r[c]); if (n) names.push(n); });
  }
  if (!names.length) {
    getEvents_().forEach(function (e) { if (e.category && names.indexOf(e.category) < 0) names.push(e.category); });
    names.sort();
  }
  cachePut_('categories', names);
  return names;
}

function saveCategories_(b) {
  if (!Array.isArray(b.names) || b.names.length > 50) throw apiError_('invalid_input', 'รายการประเภทไม่ถูกต้อง');
  var seen = {};
  var names = [];
  b.names.forEach(function (n) {
    n = str_(n);
    if (!n) return;
    if (n.length > 100) throw apiError_('invalid_input', 'ชื่อประเภทยาวเกินไป');
    var k = n.toLowerCase();
    if (!seen[k]) { seen[k] = true; names.push(n); }
  });
  return withLock_(function () {
    var t = table_(SHEETS.category, ['Name']);
    var last = t.sheet.getLastRow();
    if (last > 1) t.sheet.getRange(2, 1, last - 1, 1).clearContent();
    if (names.length) {
      var range = t.sheet.getRange(2, 1, names.length, 1);
      range.setNumberFormat('@');
      range.setValues(names.map(function (n) { return [n]; }));
    }
    cacheDel_('categories');
    return names;
  });
}

/** Soft delete: records keep referring to the event name. */
function deleteEvent_(b) {
  var id = str_(b.id);
  if (!id) throw apiError_('invalid_input', 'ไม่ระบุกิจกรรม');
  return withLock_(function () {
    var t = table_(SHEETS.event, EVENT_HEADERS);
    for (var i = 0; i < t.rows.length; i++) {
      if (str_(t.rows[i][t.col['ID']]) === id) {
        t.sheet.getRange(i + 2, t.col['Status'] + 1).setValue('deleted');
        t.sheet.getRange(i + 2, t.col['Updated At'] + 1).setValue(new Date());
        cacheDel_('events');
        return { id: id };
      }
    }
    throw apiError_('not_found', 'ไม่พบกิจกรรม');
  });
}

function removeDuplicates_() {
  return withLock_(function () {
    var t = table_(SHEETS.record, RECORD_HEADERS);
    var seen = {};
    var toDelete = [];
    t.rows.forEach(function (r, i) {
      var key = [str_(r[t.col['Name']]), fmtDate_(r[t.col['Date']]), str_(r[t.col['Event']])].join('|');
      if (seen[key]) toDelete.push(i + 2); else seen[key] = true;
    });
    for (var j = toDelete.length - 1; j >= 0; j--) t.sheet.deleteRow(toDelete[j]);
    cacheDel_('records');
    return { removed: toDelete.length };
  });
}

/* ----------------------------------------------------------- user management (admin) */

var USER_DEFAULT_HEADERS = ['PS Code', 'ID 13 หลัก', USER_COL.name, USER_COL.group, USER_COL.level, USER_COL.unit, 'รหัสผ่าน', 'status'];

function userTable_() {
  var t = table_(SHEETS.user, USER_DEFAULT_HEADERS);
  if (findCol_(t, USER_COL.psCode) < 0) throw apiError_('config', 'ชีต user ไม่มีคอลัมน์ "PS Code"');
  return t;
}

function isInactive_(status) { return INACTIVE_STATUS.indexOf(str_(status).toLowerCase()) >= 0; }

/**
 * Admin view of the user sheet. The national ID and password columns are never read into the response,
 * and saveUser leaves them untouched.
 */
function listUsers_() {
  var t = userTable_();
  var c = {
    ps: findCol_(t, USER_COL.psCode), name: findCol_(t, USER_COL.name), group: findCol_(t, USER_COL.group),
    level: findCol_(t, USER_COL.level), unit: findCol_(t, USER_COL.unit), status: findCol_(t, USER_COL.status)
  };
  function cell(r, i) { return i >= 0 ? str_(r[i]) : ''; }
  return t.rows
    .filter(function (r) { return str_(r[c.ps]) !== ''; })
    .map(function (r) {
      return {
        psCode: cell(r, c.ps), name: cell(r, c.name), group: cell(r, c.group),
        level: cell(r, c.level), unit: cell(r, c.unit),
        status: isInactive_(cell(r, c.status)) ? 'inactive' : 'active'
      };
    });
}

/** Create (no originalPsCode) or update (originalPsCode set). The PS Code itself cannot be changed on update. */
function saveUser_(b) {
  var psCode = str_(b.psCode);
  var original = str_(b.originalPsCode);
  var name = str_(b.name);
  var status = str_(b.status).toLowerCase() || 'active';
  if (!psCode || psCode.length > 30) throw apiError_('invalid_input', 'PS Code ไม่ถูกต้อง');
  if (!name || name.length > 200) throw apiError_('invalid_input', 'กรุณาระบุชื่อ-นามสกุล');
  if (['active', 'inactive'].indexOf(status) < 0) throw apiError_('invalid_input', 'สถานะไม่ถูกต้อง');
  if (original && normKey_(original) !== normKey_(psCode)) throw apiError_('invalid_input', 'ไม่สามารถเปลี่ยน PS Code ได้ ให้เพิ่มผู้ใช้ใหม่แทน');

  return withLock_(function () {
    var t = userTable_();
    var missing = [USER_COL.name, USER_COL.group, USER_COL.level, USER_COL.unit, USER_COL.status].filter(function (n) { return findCol_(t, n) < 0; });
    if (missing.length) ensureColumns_(t, missing);
    var c = {
      ps: findCol_(t, USER_COL.psCode), name: findCol_(t, USER_COL.name), group: findCol_(t, USER_COL.group),
      level: findCol_(t, USER_COL.level), unit: findCol_(t, USER_COL.unit), status: findCol_(t, USER_COL.status)
    };

    var hit = -1;
    for (var i = 0; i < t.rows.length; i++) {
      if (normKey_(t.rows[i][c.ps]) === normKey_(psCode)) { hit = i; break; }
    }
    if (original && hit < 0) throw apiError_('not_found', 'ไม่พบผู้ใช้');
    if (!original && hit >= 0) throw apiError_('duplicate', 'มี PS Code นี้อยู่แล้ว');

    var row = new Array(t.headers.length).fill('');
    if (hit >= 0) t.rows[hit].forEach(function (v, k) { row[k] = v; });
    if (hit < 0) row[c.ps] = psCode;
    row[c.name] = name;
    row[c.group] = str_(b.group).slice(0, 100);
    row[c.level] = str_(b.level).slice(0, 100);
    row[c.unit] = str_(b.unit).slice(0, 200);
    row[c.status] = status;

    var target = hit >= 0 ? hit + 2 : t.sheet.getLastRow() + 1;
    // Text format keeps codes such as "007" from becoming numbers.
    if (hit < 0) t.sheet.getRange(target, c.ps + 1).setNumberFormat('@');
    t.sheet.getRange(target, 1, 1, row.length).setValues([row]);
    return { psCode: str_(row[c.ps]) };
  });
}

/** Hard delete. Past attendance rows keep the person's name, so history is unaffected. */
function deleteUser_(b) {
  var psCode = str_(b.psCode);
  if (!psCode) throw apiError_('invalid_input', 'ไม่ระบุผู้ใช้');
  return withLock_(function () {
    var t = userTable_();
    var c = findCol_(t, USER_COL.psCode);
    for (var i = 0; i < t.rows.length; i++) {
      if (normKey_(t.rows[i][c]) === normKey_(psCode)) {
        t.sheet.deleteRow(i + 2);
        return { psCode: psCode };
      }
    }
    throw apiError_('not_found', 'ไม่พบผู้ใช้');
  });
}

/* ---------------------------------------------------------------- volunteer work */

/** Thai fiscal evaluation round for a yyyy-MM-dd date: round 1 = Oct–Mar, round 2 = Apr–Sep ("1/2570"). */
function evalRound_(dateStr) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!m) return '';
  var year = +m[1], month = +m[2];
  var fiscalYear = (month >= 10 ? year + 1 : year) + 543;
  return ((month >= 10 || month <= 3) ? 1 : 2) + '/' + fiscalYear;
}

/** Public list. PS Code is deliberately left out: it is the identity used to submit. */
function getVolunteers_(params) {
  var all = cacheGet_('volunteers');
  if (!all) {
    var t = table_(SHEETS.volunteer, VOLUNTEER_HEADERS);
    all = t.rows
      .filter(function (r) { return str_(pick_(r, t.col, ['ID'])) !== ''; })
      .map(function (r) {
        var date = fmtDate_(pick_(r, t.col, ['Date']));
        var round = str_(pick_(r, t.col, ['Round']));
        return {
          id: str_(pick_(r, t.col, ['ID'])),
          timestamp: fmtTime_(pick_(r, t.col, ['Timestamp'])),
          name: str_(pick_(r, t.col, ['Name'])),
          position: str_(pick_(r, t.col, ['Position'])),
          department: str_(pick_(r, t.col, ['Department'])),
          date: date,
          activity: str_(pick_(r, t.col, ['Activity'])),
          detail: str_(pick_(r, t.col, ['Detail'])),
          round: /^[12]\/\d{4}$/.test(round) ? round : evalRound_(date)
        };
      });
    all.reverse(); // newest first
    cachePut_('volunteers', all);
  }
  var limit = parseInt(params && params.limit, 10);
  return limit > 0 ? { total: all.length, items: all.slice(0, limit) } : { total: all.length, items: all };
}

function addVolunteer_(b) {
  var psCode = str_(b.psCode);
  var date = str_(b.date);
  var activity = str_(b.activity);
  var detail = str_(b.detail);
  if (!psCode) throw apiError_('invalid_input', 'กรุณากรอก PS Code');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw apiError_('invalid_input', 'วันที่ไม่ถูกต้อง');
  if (!activity || activity.length > 200) throw apiError_('invalid_input', 'กรุณาระบุกิจกรรมจิตอาสา (ไม่เกิน 200 ตัวอักษร)');
  if (detail.length > 1000) throw apiError_('invalid_input', 'รายละเอียดยาวเกินไป');
  var today = Utilities.formatDate(new Date(), ss_().getSpreadsheetTimeZone(), 'yyyy-MM-dd');
  if (date > today) throw apiError_('invalid_input', 'ไม่สามารถบันทึกวันที่ในอนาคตได้');

  var user = findUser_(psCode);

  return withLock_(function () {
    var t = table_(SHEETS.volunteer, VOLUNTEER_HEADERS);
    ensureColumns_(t, VOLUNTEER_HEADERS);

    // Same person, same day, same activity is a duplicate.
    for (var i = 0; i < t.rows.length; i++) {
      var r = t.rows[i];
      if (normKey_(r[t.col['PSCode']]) === normKey_(user.psCode) &&
          fmtDate_(r[t.col['Date']]) === date &&
          normKey_(r[t.col['Activity']]) === normKey_(activity)) {
        throw apiError_('duplicate', 'ข้อมูลซ้ำ: ' + user.name + ' ได้บันทึกกิจกรรมนี้ในวันที่ ' + date + ' แล้ว');
      }
    }

    var id = Utilities.getUuid().slice(0, 8) + Date.now().toString(36);
    var round = evalRound_(date);
    var row = new Array(t.headers.length).fill('');
    row[t.col['ID']] = id;
    row[t.col['Timestamp']] = new Date();
    row[t.col['PSCode']] = user.psCode;
    row[t.col['Name']] = user.name;
    row[t.col['Position']] = user.position;
    row[t.col['Department']] = user.department;
    row[t.col['Date']] = date;
    row[t.col['Activity']] = activity;
    row[t.col['Detail']] = detail;
    row[t.col['Round']] = round;

    // Plain text for Round, or Sheets reads "1/2570" as a date.
    var target = t.sheet.getLastRow() + 1;
    t.sheet.getRange(target, t.col['Round'] + 1).setNumberFormat('@');
    t.sheet.getRange(target, 1, 1, row.length).setValues([row]);
    cacheDel_('volunteers');
    return { id: id, name: user.name, round: round };
  });
}

function deleteVolunteer_(b) {
  var id = str_(b.id);
  if (!id) throw apiError_('invalid_input', 'ไม่ระบุรายการ');
  return withLock_(function () {
    var t = table_(SHEETS.volunteer, VOLUNTEER_HEADERS);
    for (var i = 0; i < t.rows.length; i++) {
      if (str_(t.rows[i][t.col['ID']]) === id) {
        t.sheet.deleteRow(i + 2);
        cacheDel_('volunteers');
        return { id: id };
      }
    }
    throw apiError_('not_found', 'ไม่พบรายการ');
  });
}

/* ---------------------------------------------------------------- admin auth */

function safeEqual_(a, b) {
  a = String(a); b = String(b);
  var diff = a.length ^ b.length;
  for (var i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

function login_(b) {
  var cache = CacheService.getScriptCache();
  var fails = parseInt(cache.get('loginFails') || '0', 10);
  if (fails >= MAX_LOGIN_FAILS) throw apiError_('locked', 'ลองผิดหลายครั้งเกินไป กรุณารอ 5 นาที');

  var expected = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD');
  if (!expected) throw apiError_('not_configured', 'ยังไม่ได้ตั้งค่ารหัสผ่านผู้ดูแล');
  if (!safeEqual_(str_(b.password), expected)) {
    cache.put('loginFails', String(fails + 1), LOGIN_LOCK_SECONDS);
    throw apiError_('bad_password', 'รหัสผ่านไม่ถูกต้อง');
  }
  cache.remove('loginFails');
  var token = Utilities.getUuid() + Utilities.getUuid();
  cache.put('session:' + token, '1', SESSION_TTL);
  return { token: token, expiresIn: SESSION_TTL };
}

function requireAdmin_(token) {
  token = str_(token);
  if (!token || !CacheService.getScriptCache().get('session:' + token)) {
    throw apiError_('unauthorized', 'กรุณาเข้าสู่ระบบผู้ดูแลใหม่');
  }
}
