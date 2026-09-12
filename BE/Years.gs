/**
 * Years.gs
 * CRUD master TAHUN ANGGARAN. Lihat = semua user login; ubah = Admin saja.
 */

var YearsService = {
  handle: function (action, payload, token) {
    switch (action) {
      case 'list': return this.list(token);
      case 'create': return this.create(payload, token);
      case 'update': return this.update(payload, token);
      default: throw AppError_('UNKNOWN_ACTION', 'Aksi years tidak dikenal: ' + action);
    }
  },

  list: function (token) {
    requireSession_(token); // semua role yang login boleh melihat daftar tahun anggaran
    return readAllRows_('YEARS').rows;
  },

  create: function (payload, token) {
    var session = requireAccess_(token, { allowRoles: ['ADMIN'] }).session;
    payload = payload || {};
    var tahun = Number(payload.tahun);
    if (!tahun || tahun < 2000 || tahun > 2100) throw AppError_('BAD_REQUEST', 'Tahun tidak valid.');

    var id = 'TA-' + tahun;
    if (findRowByField_('YEARS', 'tahun_anggaran_id', id)) {
      throw AppError_('DUPLICATE', 'Tahun anggaran ' + tahun + ' sudah ada.');
    }

    var now = new Date().toISOString();
    appendRow_('YEARS', {
      tahun_anggaran_id: id,
      tahun: tahun,
      status: payload.status || 'AKTIF',
      tanggal_mulai: payload.tanggalMulai || '',
      tanggal_selesai: payload.tanggalSelesai || '',
      catatan: payload.catatan || '',
      created_at: now,
      created_by: session.userId
    });
    logAudit_(session.userId, 'CREATE_YEAR', 'YEARS', id, 'Membuat tahun anggaran ' + tahun);
    return { tahunAnggaranId: id };
  },

  update: function (payload, token) {
    var session = requireAccess_(token, { allowRoles: ['ADMIN'] }).session;
    payload = payload || {};
    var id = String(payload.tahunAnggaranId || '');
    if (!id) throw AppError_('BAD_REQUEST', 'tahunAnggaranId wajib diisi.');

    var updates = {};
    if (payload.status !== undefined) updates.status = payload.status;
    if (payload.tanggalMulai !== undefined) updates.tanggal_mulai = payload.tanggalMulai;
    if (payload.tanggalSelesai !== undefined) updates.tanggal_selesai = payload.tanggalSelesai;
    if (payload.catatan !== undefined) updates.catatan = payload.catatan;

    var success = updateRowByField_('YEARS', 'tahun_anggaran_id', id, updates);
    if (!success) throw AppError_('NOT_FOUND', 'Tahun anggaran tidak ditemukan.');
    logAudit_(session.userId, 'UPDATE_YEAR', 'YEARS', id, 'Update tahun anggaran');
    return {};
  }
};
