/**
 * Audit.gs
 * Pencatat audit trail (dipanggil semua modul lain) dan endpoint untuk melihatnya.
 * TIDAK PERNAH mencatat password, jawaban/secret CAPTCHA, atau token sesi mentah —
 * lihat Bagian F dokumen desain, "Disiplin logging".
 */

function logAudit_(userId, action, module, recordId, description) {
  try {
    appendRow_('AUDIT_LOGS', {
      audit_id: timeBasedId_('AUD'),
      timestamp: new Date().toISOString(),
      user_id: userId || '',
      action: action,
      module: module,
      record_id: recordId || '',
      description: description || '',
      ip_address: '', // Apps Script tidak punya akses andal ke IP klien — lihat Bagian O/N
      user_agent: ''
    });
  } catch (e) {
    // Kegagalan menulis audit log TIDAK BOLEH menggagalkan aksi utama pengguna.
    Logger.log('Gagal menulis audit log: ' + e);
  }
}

// Log teknis ringan untuk pelacakan error server (requestId), terpisah dari AUDIT_LOGS
// bisnis. Tidak pernah berisi payload sensitif.
function logServer_(requestId, actionPath, result) {
  Logger.log('[' + requestId + '] ' + actionPath + ' -> ' + result);
}

var AuditService = {
  handle: function (action, payload, token) {
    switch (action) {
      case 'list': return this.list(payload, token);
      default: throw AppError_('UNKNOWN_ACTION', 'Aksi audit tidak dikenal: ' + action);
    }
  },

  list: function (payload, token) {
    requireAccess_(token, { allowRoles: ['ADMIN'] });
    var rows = readAllRows_('AUDIT_LOGS').rows;
    if (payload) {
      if (payload.module) rows = rows.filter(function (r) { return r.module === payload.module; });
      if (payload.userId) rows = rows.filter(function (r) { return r.user_id === payload.userId; });
    }
    // Terbaru dulu; dibatasi 200 baris per panggilan supaya respons tetap ringan.
    return rows.slice(-200).reverse();
  }
};
