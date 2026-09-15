/**
 * JenisPengadaan.gs
 * CRUD master JENIS_PENGADAAN. Setup.gs sudah mengisi 5 contoh awal (Pemeliharaan
 * Gedung Perkantoran/BOS, Peralatan & Mesin, Ekstrakomptabel, Buku) -- admin bisa
 * tambah/ubah lewat sini, sesuai instruksi awal "jangan hardcode jenis pengadaan".
 */
var JenisPengadaanService = {
  handle: function (action, payload, token) {
    switch (action) {
      case 'list': return this.list(token);
      case 'create': return this.create(payload, token);
      case 'update': return this.update(payload, token);
      default: throw AppError_('UNKNOWN_ACTION', 'Aksi jenisPengadaan tidak dikenal: ' + action);
    }
  },

  list: function (token) {
    requireSession_(token); // semua role yang login boleh melihat daftar
    return readAllRows_('JENIS_PENGADAAN').rows;
  },

  create: function (payload, token) {
    var session = requireAccess_(token, { allowRoles: ['ADMIN'] }).session;
    payload = payload || {};
    var nama = String(payload.namaJenis || '').trim();
    var kode = String(payload.kode || '').trim();
    if (!nama || !kode) throw AppError_('BAD_REQUEST', 'Nama dan kode jenis pengadaan wajib diisi.');
    if (findRowByField_('JENIS_PENGADAAN', 'kode', kode)) throw AppError_('DUPLICATE', 'Kode jenis pengadaan sudah dipakai.');

    var id = nextId_('JP');
    var now = new Date().toISOString();
    appendRow_('JENIS_PENGADAAN', {
      jenis_pengadaan_id: id, nama_jenis: nama, kode: kode,
      deskripsi: payload.deskripsi || '', status: 'AKTIF', created_at: now, updated_at: now
    });
    logAudit_(session.userId, 'CREATE_JENIS_PENGADAAN', 'JENIS_PENGADAAN', id, 'Membuat jenis pengadaan: ' + nama);
    return { jenisPengadaanId: id };
  },

  update: function (payload, token) {
    var session = requireAccess_(token, { allowRoles: ['ADMIN'] }).session;
    payload = payload || {};
    var id = String(payload.jenisPengadaanId || '');
    if (!id) throw AppError_('BAD_REQUEST', 'jenisPengadaanId wajib diisi.');

    var updates = { updated_at: new Date().toISOString() };
    if (payload.namaJenis !== undefined) updates.nama_jenis = payload.namaJenis;
    if (payload.deskripsi !== undefined) updates.deskripsi = payload.deskripsi;
    if (payload.status !== undefined) updates.status = payload.status;

    var success = updateRowByField_('JENIS_PENGADAAN', 'jenis_pengadaan_id', id, updates);
    if (!success) throw AppError_('NOT_FOUND', 'Jenis pengadaan tidak ditemukan.');
    logAudit_(session.userId, 'UPDATE_JENIS_PENGADAAN', 'JENIS_PENGADAAN', id, 'Update jenis pengadaan');
    return {};
  }
};