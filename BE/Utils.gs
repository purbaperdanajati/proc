/**
 * Utils.gs
 * Helper generik dipakai lintas modul: akses sheet ala-objek, generator ID,
 * hashing password, token sesi, dan amplop respons API standar.
 */

// ===================== AKSES SHEET SEBAGAI OBJEK =====================

function getSheet_(name) {
  var ss = SpreadsheetApp.openById(getSpreadsheetId_());
  var sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error('Sheet tidak ditemukan: ' + name + '. Sudah jalankan initializeDatabase()?');
  return sheet;
}

/**
 * Membaca SELURUH sheet sekali (getDataRange), lalu memetakan tiap baris
 * jadi objek {header: value, ...} + _row (nomor baris asli di sheet, 1-based).
 * Sengaja TIDAK memanggil getRange().getValue() berulang dalam loop.
 */
function readAllRows_(sheetName) {
  var sheet = getSheet_(sheetName);
  var values = sheet.getDataRange().getValues();
  if (values.length < 1) return { headers: [], rows: [] };
  var headers = values[0];
  var rows = [];
  var tz = Session.getScriptTimeZone();
  for (var r = 1; r < values.length; r++) {
    var obj = { _row: r + 1 };
    for (var c = 0; c < headers.length; c++) {
      var v = values[r][c];
      // BUG FIX (zona waktu): string tanggal polos "YYYY-MM-DD" yang ditulis
      // dari <input type="date"> (tanggal_mulai, tanggal_selesai, tanggal_dipa,
      // dst.) dikenali Google Sheets sebagai tanggal dan diam-diam diubah jadi
      // nilai Date -- lalu saat dikirim ke klien sebagai JSON, Date itu
      // di-serialize lewat .toISOString() (UTC), yang bisa menggeser tanggalnya
      // maju/mundur satu hari tergantung timezone spreadsheet vs browser user.
      // Diubah balik ke string "yyyy-MM-dd" di sini memakai timezone PROYEK
      // yang sama dipakai Sheets untuk menafsirkannya semula -- round-trip jadi
      // selalu tepat, apa pun timezone browser yang membuka aplikasi.
      // Field datetime lengkap (created_at dkk, format ISO+T+Z) tidak
      // terpengaruh karena Sheets tidak mengenali pola itu sebagai tanggal.
      if (v instanceof Date) {
        v = Utilities.formatDate(v, tz, 'yyyy-MM-dd');
      }
      obj[headers[c]] = v;
    }
    rows.push(obj);
  }
  return { headers: headers, rows: rows };
}

function findRowByField_(sheetName, matchField, matchValue) {
  var data = readAllRows_(sheetName);
  for (var i = 0; i < data.rows.length; i++) {
    if (data.rows[i][matchField] === matchValue) return data.rows[i];
  }
  return null;
}

function appendRow_(sheetName, rowObject) {
  var sheet = getSheet_(sheetName);
  var lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var rowArr = [];
  for (var i = 0; i < headers.length; i++) {
    var v = rowObject[headers[i]];
    rowArr.push(v === undefined || v === null ? '' : v);
  }
  sheet.appendRow(rowArr);
  return rowObject;
}

/**
 * Update SATU baris yang cocok dengan matchField=matchValue.
 * Membangun ulang baris penuh di memori lalu menulisnya dengan SATU setValues(),
 * bukan setValue() per sel, supaya lebih hemat panggilan API Sheets.
 */
function updateRowByField_(sheetName, matchField, matchValue, updates) {
  var sheet = getSheet_(sheetName);
  var values = sheet.getDataRange().getValues();
  var headers = values[0];
  var colIndex = headers.indexOf(matchField);
  if (colIndex === -1) throw new Error('Field tidak ditemukan: ' + matchField + ' pada sheet ' + sheetName);

  for (var r = 1; r < values.length; r++) {
    if (values[r][colIndex] === matchValue) {
      var newRow = values[r].slice();
      Object.keys(updates).forEach(function (key) {
        var c = headers.indexOf(key);
        if (c !== -1) newRow[c] = updates[key];
      });
      sheet.getRange(r + 1, 1, 1, headers.length).setValues([newRow]);
      return true;
    }
  }
  return false;
}

// ===================== GENERATOR ID =====================

/**
 * ID berurutan (mis. SAT-00001) lewat sheet tersembunyi _COUNTERS + LockService,
 * atomik meski dipanggil bersamaan. Dipakai untuk tabel frekuensi tulis rendah/sedang.
 */
function nextId_(prefix) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sheet = getSheet_('_COUNTERS');
    var values = sheet.getDataRange().getValues();
    var rowIndex = -1;
    var current = 0;
    for (var r = 1; r < values.length; r++) {
      if (values[r][0] === prefix) {
        rowIndex = r;
        current = values[r][1];
        break;
      }
    }
    var next = Number(current) + 1;
    if (rowIndex === -1) {
      sheet.appendRow([prefix, next]);
    } else {
      sheet.getRange(rowIndex + 1, 2).setValue(next);
    }
    var padded = String(next);
    while (padded.length < 5) padded = '0' + padded;
    return prefix + '-' + padded;
  } finally {
    lock.releaseLock();
  }
}

/**
 * ID berbasis waktu+acak (tanpa lock) untuk tabel append-berat (AUDIT_LOGS, SESSIONS,
 * NOTIFICATIONS) — supaya penulisan yang sering tidak jadi titik kemacetan LockService.
 */
function timeBasedId_(prefix) {
  return prefix + '-' + new Date().getTime() + '-' + Math.random().toString(36).slice(2, 7);
}

// ===================== HASHING PASSWORD =====================

function generateSalt_() {
  return Utilities.getUuid() + Utilities.getUuid();
}

/**
 * PBKDF2-manual sederhana karena Apps Script tidak menyediakan bcrypt/Argon2/PBKDF2
 * bawaan (lihat Bagian F & O dokumen desain). Iterasi disimpan per-user supaya
 * work factor bisa dinaikkan nanti tanpa merusak hash lama.
 */
function hashPassword_(password, salt, iterations) {
  var data = password + salt;
  var digestBytes;
  for (var i = 0; i < iterations; i++) {
    digestBytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, data);
    data = Utilities.base64Encode(digestBytes) + salt;
  }
  return Utilities.base64Encode(digestBytes);
}

function verifyPassword_(password, salt, iterations, expectedHash) {
  var computed = hashPassword_(password, salt, iterations);
  return constantTimeEquals_(computed, expectedHash);
}

// Perbandingan waktu-konstan supaya tidak membocorkan info lewat timing.
function constantTimeEquals_(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

// ===================== TOKEN SESI =====================

function generateSessionToken_() {
  // Utilities.getUuid() memakai sumber acak yang aman — JANGAN pernah pakai Math.random()
  // untuk token keamanan.
  return Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
}

function hashToken_(token) {
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token);
  return Utilities.base64Encode(digest);
}

// ===================== AMPLOP RESPONS API =====================

function ok_(data, message) {
  return {
    success: true,
    data: data || {},
    message: message || '',
    meta: { requestId: Utilities.getUuid(), timestamp: new Date().toISOString() }
  };
}

function fail_(errorCode, message) {
  return {
    success: false,
    errorCode: errorCode,
    message: message,
    meta: { requestId: Utilities.getUuid(), timestamp: new Date().toISOString() }
  };
}

// Error terkontrol yang boleh pesannya dikirim ke klien (beda dari error tak terduga,
// yang pesannya disamarkan di Code.gs supaya stack trace tidak pernah bocor ke user).
function AppError_(code, message) {
  var e = new Error(message);
  e.code = code;
  return e;
}
