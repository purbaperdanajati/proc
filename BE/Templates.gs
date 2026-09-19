/**
 * Templates.gs
 * CRUD master TEMPLATES (Tahap 6). Template HTML untuk KAK/HPS berisi placeholder
 * {{...}} (Keputusan 2 dokumen desain) yang diisi lewat renderTemplate_ (KakService.gs)
 * saat dokumen di-generate. Boleh umum (jenis_pengadaan_id kosong = berlaku semua
 * jenis) atau khusus per jenis pengadaan -- lihat Bagian B/C dokumen desain.
 *
 * Sesuai matrix peran Bagian E: kelola template masuk kategori master data ->
 * ADMIN saja yang boleh CRUD, role lain hanya lihat (dipakai KakService.gs secara
 * internal, bukan lewat modul ini).
 */

var VALID_TEMPLATE_DOC_TYPE = ['KAK', 'HPS'];

var TemplatesService = {
  handle: function (action, payload, token) {
    switch (action) {
      case 'list': return this.list(payload, token);
      case 'detail': return this.detail(payload, token);
      case 'create': return this.create(payload, token);
      case 'update': return this.update(payload, token);
      case 'setStatus': return this.setStatus(payload, token);
      default: throw AppError_('UNKNOWN_ACTION', 'Aksi templates tidak dikenal: ' + action);
    }
  },

  list: function (payload, token) {
    requireSession_(token); // semua role yang login boleh melihat daftar template
    var rows = readAllRows_('TEMPLATES').rows;
    payload = payload || {};
    if (payload.docType) {
      rows = rows.filter(function (t) { return t.doc_type === payload.docType; });
    }
    if (payload.jenisPengadaanId !== undefined) {
      rows = rows.filter(function (t) { return t.jenis_pengadaan_id === payload.jenisPengadaanId; });
    }
    return rows;
  },

  detail: function (payload, token) {
    requireSession_(token);
    var id = String((payload && payload.templateId) || '');
    if (!id) throw AppError_('BAD_REQUEST', 'templateId wajib diisi.');
    var tpl = findRowByField_('TEMPLATES', 'template_id', id);
    if (!tpl) throw AppError_('NOT_FOUND', 'Template tidak ditemukan.');
    return tpl;
  },

  create: function (payload, token) {
    var session = requireAccess_(token, { allowRoles: ['ADMIN'] }).session;
    payload = payload || {};
    var docType = String(payload.docType || '');
    var namaTemplate = String(payload.namaTemplate || '').trim();
    var htmlTemplate = String(payload.htmlTemplate || '');

    if (VALID_TEMPLATE_DOC_TYPE.indexOf(docType) === -1) {
      throw AppError_('BAD_REQUEST', 'docType harus KAK atau HPS.');
    }
    if (!namaTemplate) throw AppError_('BAD_REQUEST', 'Nama template wajib diisi.');
    if (!htmlTemplate.trim()) throw AppError_('BAD_REQUEST', 'Isi template (htmlTemplate) wajib diisi.');

    var jenisPengadaanId = String(payload.jenisPengadaanId || '');
    if (jenisPengadaanId && !findRowByField_('JENIS_PENGADAAN', 'jenis_pengadaan_id', jenisPengadaanId)) {
      throw AppError_('NOT_FOUND', 'Jenis pengadaan tidak ditemukan.');
    }

    var id = nextId_('TPL');
    appendRow_('TEMPLATES', {
      template_id: id, jenis_pengadaan_id: jenisPengadaanId, doc_type: docType,
      nama_template: namaTemplate, html_template: htmlTemplate, status: 'AKTIF'
    });
    logAudit_(session.userId, 'CREATE_TEMPLATE', 'TEMPLATES', id,
      'Membuat template ' + docType + ': ' + namaTemplate + (jenisPengadaanId ? ' (khusus jenis ' + jenisPengadaanId + ')' : ' (umum)'));
    return { templateId: id };
  },

  update: function (payload, token) {
    var session = requireAccess_(token, { allowRoles: ['ADMIN'] }).session;
    payload = payload || {};
    var id = String(payload.templateId || '');
    if (!id) throw AppError_('BAD_REQUEST', 'templateId wajib diisi.');

    var updates = {};
    if (payload.namaTemplate !== undefined) {
      var nama = String(payload.namaTemplate || '').trim();
      if (!nama) throw AppError_('BAD_REQUEST', 'Nama template tidak boleh kosong.');
      updates.nama_template = nama;
    }
    if (payload.htmlTemplate !== undefined) {
      var html = String(payload.htmlTemplate || '');
      if (!html.trim()) throw AppError_('BAD_REQUEST', 'Isi template tidak boleh kosong.');
      updates.html_template = html;
    }
    if (payload.jenisPengadaanId !== undefined) {
      var jid = String(payload.jenisPengadaanId || '');
      if (jid && !findRowByField_('JENIS_PENGADAAN', 'jenis_pengadaan_id', jid)) {
        throw AppError_('NOT_FOUND', 'Jenis pengadaan tidak ditemukan.');
      }
      updates.jenis_pengadaan_id = jid;
    }

    var success = updateRowByField_('TEMPLATES', 'template_id', id, updates);
    if (!success) throw AppError_('NOT_FOUND', 'Template tidak ditemukan.');
    logAudit_(session.userId, 'UPDATE_TEMPLATE', 'TEMPLATES', id, 'Update template');
    return {};
  },

  // Nonaktifkan/aktifkan template -- tidak pernah dihapus permanen, supaya
  // GENERATED_DOCUMENTS lama yang mengacu (via snapshot_json) tetap koheren
  // secara historis dan template bisa diaktifkan lagi kalau ternyata salah pencet.
  setStatus: function (payload, token) {
    var session = requireAccess_(token, { allowRoles: ['ADMIN'] }).session;
    payload = payload || {};
    var id = String(payload.templateId || '');
    var status = String(payload.status || '');
    if (['AKTIF', 'NONAKTIF'].indexOf(status) === -1) throw AppError_('BAD_REQUEST', 'Status tidak valid.');

    var success = updateRowByField_('TEMPLATES', 'template_id', id, { status: status });
    if (!success) throw AppError_('NOT_FOUND', 'Template tidak ditemukan.');
    logAudit_(session.userId, 'SET_TEMPLATE_STATUS', 'TEMPLATES', id, 'Status template diubah ke ' + status);
    return {};
  }
};

/**
 * Memilih template AKTIF yang cocok untuk sebuah jenis pengadaan + jenis dokumen:
 * template KHUSUS (jenis_pengadaan_id sama persis) diprioritaskan, kalau tidak ada
 * baru jatuh ke template UMUM (jenis_pengadaan_id kosong) -- sesuai catatan ERD #3
 * dokumen desain ("kosong berarti pakai template default").
 * Dipakai KakService.gs (dan nanti HpsService.gs kalau ingin template HPS bisa
 * disunting admin juga -- saat ini HpsService.gs masih menyusun HTML-nya sendiri
 * secara terprogram karena jumlah barisnya dinamis).
 */
function findApplicableTemplate_(jenisPengadaanId, docType) {
  var templates = readAllRows_('TEMPLATES').rows.filter(function (t) {
    return t.status === 'AKTIF' && t.doc_type === docType;
  });
  var spesifik = templates.filter(function (t) { return t.jenis_pengadaan_id === jenisPengadaanId; });
  if (spesifik.length > 0) return spesifik[0];
  var umum = templates.filter(function (t) { return !t.jenis_pengadaan_id; });
  return umum.length > 0 ? umum[0] : null;
}
