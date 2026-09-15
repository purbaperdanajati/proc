/**
 * Pagu.gs
 * CRUD PAGU (batas anggaran per satker + tahun anggaran + jenis pengadaan).
 * Hanya Admin yang bisa buat/ubah (Bagian E dokumen desain: matrix peran) --
 * Pengelola/Viewer cuma lihat, scoped ke satker yang di-assign ke mereka.
 */
var PaguService = {
  handle: function (action, payload, token) {
    switch (action) {
      case 'list': return this.list(payload, token);
      case 'create': return this.create(payload, token);
      case 'update': return this.update(payload, token);
      case 'getSummary': return this.getSummary(payload, token);
      default: throw AppError_('UNKNOWN_ACTION', 'Aksi pagu tidak dikenal: ' + action);
    }
  },

  list: function (payload, token) {
    var session = requireSession_(token);
    var user = findRowByField_('USERS', 'user_id', session.userId);
    payload = payload || {};
    var tahunAnggaranId = String(payload.tahunAnggaranId || '');
    if (!tahunAnggaranId) throw AppError_('BAD_REQUEST', 'tahunAnggaranId wajib diisi.');

    var rows = readAllRows_('PAGU').rows.filter(function (p) { return p.tahun_anggaran_id === tahunAnggaranId; });

    if (user.role !== 'ADMIN') {
      var myIds = getMyAssignedSatkerIds_(user.user_id, tahunAnggaranId);
      rows = rows.filter(function (p) { return myIds.indexOf(p.satker_id) !== -1; });
    }
    if (payload.satkerId) {
      rows = rows.filter(function (p) { return p.satker_id === payload.satkerId; });
    }
    return attachPaguUsage_(rows);
  },

  create: function (payload, token) {
    var session = requireAccess_(token, { allowRoles: ['ADMIN'] }).session;
    payload = payload || {};
    var tahunAnggaranId = String(payload.tahunAnggaranId || '');
    var satkerId = String(payload.satkerId || '');
    var jenisPengadaanId = String(payload.jenisPengadaanId || '');
    var pagu = Number(payload.pagu);

    if (!tahunAnggaranId || !satkerId || !jenisPengadaanId) {
      throw AppError_('BAD_REQUEST', 'tahunAnggaranId, satkerId, dan jenisPengadaanId wajib diisi.');
    }
    if (!(pagu >= 0)) throw AppError_('BAD_REQUEST', 'Pagu tidak boleh negatif atau kosong.');
    if (!findRowByField_('SATKER', 'satker_id', satkerId)) throw AppError_('NOT_FOUND', 'Satker tidak ditemukan.');
    if (!findRowByField_('JENIS_PENGADAAN', 'jenis_pengadaan_id', jenisPengadaanId)) throw AppError_('NOT_FOUND', 'Jenis pengadaan tidak ditemukan.');

    var dup = readAllRows_('PAGU').rows.some(function (p) {
      return p.tahun_anggaran_id === tahunAnggaranId && p.satker_id === satkerId &&
        p.jenis_pengadaan_id === jenisPengadaanId && p.status === 'AKTIF';
    });
    if (dup) throw AppError_('DUPLICATE', 'Pagu untuk kombinasi satker + jenis pengadaan + tahun ini sudah ada.');

    var id = nextId_('PGU');
    var now = new Date().toISOString();
    appendRow_('PAGU', {
      pagu_id: id, tahun_anggaran_id: tahunAnggaranId, satker_id: satkerId, jenis_pengadaan_id: jenisPengadaanId,
      sumber_dana: payload.sumberDana || '', kode_anggaran: payload.kodeAnggaran || '', pagu: pagu,
      status: 'AKTIF', catatan: payload.catatan || '', created_at: now, updated_at: now, created_by: session.userId
    });
    logAudit_(session.userId, 'CREATE_PAGU', 'PAGU', id, 'Membuat pagu Rp' + pagu + ' untuk satker ' + satkerId);
    return { paguId: id };
  },

  update: function (payload, token) {
    var session = requireAccess_(token, { allowRoles: ['ADMIN'] }).session;
    payload = payload || {};
    var id = String(payload.paguId || '');
    if (!id) throw AppError_('BAD_REQUEST', 'paguId wajib diisi.');

    var updates = { updated_at: new Date().toISOString() };
    if (payload.sumberDana !== undefined) updates.sumber_dana = payload.sumberDana;
    if (payload.kodeAnggaran !== undefined) updates.kode_anggaran = payload.kodeAnggaran;
    if (payload.pagu !== undefined) {
      var pagu = Number(payload.pagu);
      if (!(pagu >= 0)) throw AppError_('BAD_REQUEST', 'Pagu tidak boleh negatif.');
      updates.pagu = pagu;
    }
    if (payload.status !== undefined) updates.status = payload.status;
    if (payload.catatan !== undefined) updates.catatan = payload.catatan;

    var success = updateRowByField_('PAGU', 'pagu_id', id, updates);
    if (!success) throw AppError_('NOT_FOUND', 'Pagu tidak ditemukan.');
    logAudit_(session.userId, 'UPDATE_PAGU', 'PAGU', id, 'Update pagu');
    return {};
  },

  // Bagian C: "Sistem harus menghitung total pagu, terpakai, dan sisa."
  getSummary: function (payload, token) {
    var session = requireSession_(token);
    payload = payload || {};
    var tahunAnggaranId = String(payload.tahunAnggaranId || '');
    if (!tahunAnggaranId) throw AppError_('BAD_REQUEST', 'tahunAnggaranId wajib diisi.');

    var user = findRowByField_('USERS', 'user_id', session.userId);
    var paguRows = readAllRows_('PAGU').rows.filter(function (p) { return p.tahun_anggaran_id === tahunAnggaranId; });
    if (user.role !== 'ADMIN') {
      var myIds = getMyAssignedSatkerIds_(user.user_id, tahunAnggaranId);
      paguRows = paguRows.filter(function (p) { return myIds.indexOf(p.satker_id) !== -1; });
    }
    var totalPagu = paguRows.reduce(function (s, p) { return s + (Number(p.pagu) || 0); }, 0);
    var paketRows = readAllRows_('PAKET').rows.filter(function (p) { return p.tahun_anggaran_id === tahunAnggaranId; });
    var totalTerpakai = paketRows.reduce(function (s, p) { return s + (Number(p.pagu_snapshot) || 0); }, 0);
    return { totalPagu: totalPagu, totalTerpakai: totalTerpakai, sisaPagu: totalPagu - totalTerpakai };
  }
};

/**
 * Melampirkan info pemakaian ke tiap baris pagu (berapa paket sudah dibuat
 * dari pagu ini, berapa sisanya) -- dipakai list() di atas dan layar Paket
 * (untuk menampilkan sisa pagu saat memilih pagu di form buat paket baru).
 */
function attachPaguUsage_(paguRows) {
  var paketRows = readAllRows_('PAKET').rows;
  return paguRows.map(function (p) {
    var paketUntukPaguIni = paketRows.filter(function (pk) { return pk.pagu_id === p.pagu_id && pk.status_paket !== 'DIBATALKAN'; });
    var terpakai = paketUntukPaguIni.reduce(function (s, pk) { return s + (Number(pk.pagu_snapshot) || 0); }, 0);
    var copy = {};
    Object.keys(p).forEach(function (k) { copy[k] = p[k]; });
    copy.terpakai = terpakai;
    copy.sisa = (Number(p.pagu) || 0) - terpakai;
    copy.jumlah_paket = paketUntukPaguIni.length;
    return copy;
  });
}