/**
 * Code.gs
 * Entry point Web App — MURNI API JSON. Frontend (HTML/CSS/JS) sekarang di-host
 * terpisah di GitHub Pages, jadi file ini tidak lagi menyajikan HTML lewat
 * HtmlService seperti versi sebelumnya. Lihat README.md di root paket ini untuk
 * penjelasan arsitektur lengkap dan alasan pemilihan pendekatan CORS di bawah.
 */

function doGet(e) {
  // Dua kegunaan:
  // 1) Dibuka langsung tanpa parameter di browser -> pesan status, berguna untuk
  //    memastikan Web App sudah ter-deploy dan hidup.
  // 2) Dipanggil dengan query string (?module=...&action=...) -> jalur GET untuk
  //    tes cepat manual (mis. lewat browser/Postman) SAJA. Frontend produksi
  //    (github-pages) SELALU memakai POST lewat doPost di bawah — jangan sampai
  //    ada aksi yang membawa data sensitif (password dsb.) lewat GET, karena
  //    query string bisa tercatat di riwayat browser/log server.
  if (e && e.parameter && e.parameter.module) {
    return handleRequest_(e, 'GET');
  }
  return jsonResponse_({
    success: true,
    message: 'SI Pengadaan Barang/Jasa API aktif. Gunakan POST untuk mengakses aksi.',
    meta: { timestamp: new Date().toISOString() }
  });
}

function doPost(e) {
  return handleRequest_(e, 'POST');
}

/**
 * Mem-parsing request dari GET (query string) atau POST (body TEXT/PLAIN berisi
 * JSON — bukan application/json, lihat catatan CORS di README), lalu
 * mendelegasikan ke apiCall() — dispatcher yang PERSIS SAMA dengan versi
 * sebelumnya, tidak berubah sama sekali.
 */
function handleRequest_(e, method) {
  var module, action, payload, sessionToken;
  try {
    if (method === 'POST') {
      var raw = (e.postData && e.postData.contents) || '{}';
      var body = JSON.parse(raw);
      module = body.module;
      action = body.action;
      payload = body.payload || {};
      sessionToken = body.sessionToken || '';
    } else {
      module = e.parameter.module;
      action = e.parameter.action;
      payload = e.parameter.payload ? JSON.parse(e.parameter.payload) : {};
      sessionToken = e.parameter.sessionToken || '';
    }
  } catch (parseErr) {
    return jsonResponse_(fail_('BAD_REQUEST', 'Format request tidak valid (JSON tidak bisa dibaca).'));
  }

  var result = apiCall(module, action, payload, sessionToken);
  return jsonResponse_(result);
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Dispatcher tunggal — TIDAK BERUBAH dari versi sebelumnya. Ini sebabnya
 * pemisahan frontend/backend hari ini murah: seluruh *Service.gs sama sekali
 * tidak tahu (dan tidak perlu tahu) bagaimana request-nya sampai ke sini,
 * baik dulu lewat google.script.run maupun sekarang lewat fetch() dari domain lain.
 */
function apiCall(module, action, payload, sessionToken) {
  var requestId = Utilities.getUuid();
  var actionPath = module + '.' + action;
  try {
    var result;
    switch (module) {
      case 'auth': result = AuthService.handle(action, payload || {}, sessionToken); break;
      case 'users': result = UsersService.handle(action, payload || {}, sessionToken); break;
      case 'satkers': result = SatkersService.handle(action, payload || {}, sessionToken); break;
      case 'assignments': result = AssignmentsService.handle(action, payload || {}, sessionToken); break;
      case 'years': result = YearsService.handle(action, payload || {}, sessionToken); break;
      case 'audit': result = AuditService.handle(action, payload || {}, sessionToken); break;
      case 'dashboard': result = DashboardService.handle(action, payload || {}, sessionToken); break;
      default: throw AppError_('UNKNOWN_MODULE', 'Modul tidak dikenal: ' + module);
    }
    logServer_(requestId, actionPath, 'SUCCESS');
    return ok_(result);
  } catch (err) {
    var code = (err && err.code) || 'INTERNAL_ERROR';
    // Pesan yang boleh sampai ke user HANYA yang berasal dari AppError_ (err.code ada).
    // Error tak terduga disamarkan supaya stack trace tidak pernah bocor ke klien.
    var msg = (err && err.code) ? err.message : 'Terjadi kesalahan pada server. Hubungi admin.';
    logServer_(requestId, actionPath, 'ERROR(' + code + '): ' + (err && err.message));
    if (!err || !err.code) {
      Logger.log('Unhandled error [' + requestId + '] ' + actionPath + ': ' + (err && err.stack || err));
    }
    return fail_(code, msg);
  }
}
