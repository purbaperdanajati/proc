/**
 * Paket.gs
 * CRUD PAKET. Field pejabat (PPK/PP/KPA) dan pagu_snapshot diisi OTOMATIS
 * (snapshot) dari SATKER_TAHUN dan PAGU saat paket dibuat -- pola snapshot
 * untuk dokumen legal, lihat catatan ERD #4 di dokumen desain.
 *
 * computePaketCompletion_ di file ini sekarang memakai ALGORITMA LENGKAP
 * Bagian J dokumen desain (sejak Tahap 5 menambahkan checklist dokumen):
 * data dasar + penyedia (kalau diperlukan) + seluruh dokumen wajib/kondisional
 * terpenuhi -> baru status_paket bisa jadi COMPLETE. Sebelum Tahap 5, fungsi
 * ini hanya mengecek data dasar+penyedia -- sekarang computeDocumentChecklist_
 * (Documents.gs) melengkapi bagian yang tadinya belum ada.
 */
var VALID_METODE_PENGADAAN = ['Penunjukan Langsung', 'E-Purchasing', 'Tender', 'Tender Cepat', 'Pengadaan Langsung', 'Swakelola', 'Lainnya'];

var PaketService = {
  handle: function (action, payload, token) {
    switch (action) {
      case 'list': return this.list(payload, token);
      case 'detail': return this.detail(payload, token);
      case 'create': return this.create(payload, token);
      case 'update': return this.update(payload, token);
      case 'cancel': return this.cancel(payload, token);
      default: throw AppError_('UNKNOWN_ACTION', 'Aksi paket tidak dikenal: ' + action);
    }
  },

  list: function (payload, token) {
    var session = requireSession_(token);
    var user = findRowByField_('USERS', 'user_id', session.userId);
    payload = payload || {};
    var tahunAnggaranId = String(payload.tahunAnggaranId || '');
    if (!tahunAnggaranId) throw AppError_('BAD_REQUEST', 'tahunAnggaranId wajib diisi.');

    var rows = readAllRows_('PAKET').rows.filter(function (p) { return p.tahun_anggaran_id === tahunAnggaranId; });
    if (user.role !== 'ADMIN') {
      var myIds = getMyAssignedSatkerIds_(user.user_id, tahunAnggaranId);
      rows = rows.filter(function (p) { return myIds.indexOf(p.satker_id) !== -1; });
    }
    if (payload.satkerId) rows = rows.filter(function (p) { return p.satker_id === payload.satkerId; });
    return rows;
  },

  detail: function (payload, token) {
    payload = payload || {};
    var paketId = String(payload.paketId || '');
    if (!paketId) throw AppError_('BAD_REQUEST', 'paketId wajib diisi.');
    var paket = findRowByField_('PAKET', 'paket_id', paketId);
    if (!paket) throw AppError_('NOT_FOUND', 'Paket tidak ditemukan.');
    requireAccess_(token, { satkerId: paket.satker_id, tahunAnggaranId: paket.tahun_anggaran_id });
    return paket;
  },

  create: function (payload, token) {
    payload = payload || {};
    var satkerId = String(payload.satkerId || '');
    var tahunAnggaranId = String(payload.tahunAnggaranId || '');
    var paguId = String(payload.paguId || '');
    var namaPaket = String(payload.namaPaket || '').trim();

    if (!satkerId || !tahunAnggaranId || !paguId || !namaPaket) {
      throw AppError_('BAD_REQUEST', 'satkerId, tahunAnggaranId, paguId, dan namaPaket wajib diisi.');
    }
    var access = requireAccess_(token, { allowRoles: ['ADMIN', 'PENGELOLA'], satkerId: satkerId, tahunAnggaranId: tahunAnggaranId });

    var pagu = findRowByField_('PAGU', 'pagu_id', paguId);
    if (!pagu) throw AppError_('NOT_FOUND', 'Pagu tidak ditemukan.');
    if (pagu.satker_id !== satkerId || pagu.tahun_anggaran_id !== tahunAnggaranId) {
      throw AppError_('BAD_REQUEST', 'Pagu yang dipilih tidak sesuai dengan satker/tahun anggaran ini.');
    }

    var nilaiHps = (payload.nilaiHps !== undefined && payload.nilaiHps !== '') ? Number(payload.nilaiHps) : 0;
    var nilaiKontrak = (payload.nilaiKontrak !== undefined && payload.nilaiKontrak !== '') ? Number(payload.nilaiKontrak) : 0;
    if (nilaiHps < 0 || nilaiKontrak < 0) throw AppError_('BAD_REQUEST', 'Nilai HPS/Kontrak tidak boleh negatif.');
    if (payload.metodePengadaan && VALID_METODE_PENGADAAN.indexOf(payload.metodePengadaan) === -1) {
      throw AppError_('BAD_REQUEST', 'Metode pengadaan tidak valid.');
    }

    // Snapshot pejabat dari SATKER_TAHUN saat ini.
    var satkerTahunRows = readAllRows_('SATKER_TAHUN').rows;
    var st = null;
    for (var i = 0; i < satkerTahunRows.length; i++) {
      if (satkerTahunRows[i].satker_id === satkerId && satkerTahunRows[i].tahun_anggaran_id === tahunAnggaranId) { st = satkerTahunRows[i]; break; }
    }

    var penyediaId = String(payload.penyediaId || '');
    if (penyediaId) {
      var providerCheck = findRowByField_('PROVIDERS', 'penyedia_id', penyediaId);
      if (!providerCheck) throw AppError_('NOT_FOUND', 'Penyedia tidak ditemukan.');
    }

    var id = nextId_('PKT');
    var now = new Date().toISOString();
    var paguSnapshot = Number(pagu.pagu) || 0;
    appendRow_('PAKET', {
      paket_id: id, tahun_anggaran_id: tahunAnggaranId, satker_id: satkerId,
      jenis_pengadaan_id: pagu.jenis_pengadaan_id, pagu_id: paguId,
      kode_paket: payload.kodePaket || id, nama_paket: namaPaket, sumber_dana: pagu.sumber_dana,
      pagu_snapshot: paguSnapshot, nilai_hps: nilaiHps, nilai_kontrak: nilaiKontrak,
      metode_pengadaan: payload.metodePengadaan || '', jenis_kontrak: payload.jenisKontrak || '',
      tanggal_mulai: payload.tanggalMulai || '', tanggal_selesai: payload.tanggalSelesai || '',
      penyedia_id: penyediaId,
      ppk_nama: st ? st.ppk_nama : '', ppk_nip: st ? st.ppk_nip : '',
      pp_nama: st ? st.pejabat_pengadaan_nama : '', pp_nip: st ? st.pejabat_pengadaan_nip : '',
      kpa_nama: st ? st.kpa_nama : '', kpa_nip: st ? st.kpa_nip : '',
      ada_pph: payload.adaPph ? true : false,
      memerlukan_penyedia: payload.memerlukanPenyedia !== undefined ? !!payload.memerlukanPenyedia : true,
      status_paket: 'DRAFT', persentase_kelengkapan: '', drive_folder_id: '',
      created_at: now, updated_at: now, created_by: access.session.userId, updated_by: access.session.userId
    });
    computePaketCompletion_(id);
    logAudit_(access.session.userId, 'CREATE_PAKET', 'PAKET', id, 'Membuat paket: ' + namaPaket);
    return { paketId: id, hpsMelebihiPagu: nilaiHps > paguSnapshot };
  },

  update: function (payload, token) {
    payload = payload || {};
    var id = String(payload.paketId || '');
    if (!id) throw AppError_('BAD_REQUEST', 'paketId wajib diisi.');
    var paket = findRowByField_('PAKET', 'paket_id', id);
    if (!paket) throw AppError_('NOT_FOUND', 'Paket tidak ditemukan.');
    var access = requireAccess_(token, { allowRoles: ['ADMIN', 'PENGELOLA'], satkerId: paket.satker_id, tahunAnggaranId: paket.tahun_anggaran_id });

    var updates = { updated_at: new Date().toISOString(), updated_by: access.session.userId };
    if (payload.namaPaket !== undefined) updates.nama_paket = payload.namaPaket;
    if (payload.metodePengadaan !== undefined) {
      if (payload.metodePengadaan && VALID_METODE_PENGADAAN.indexOf(payload.metodePengadaan) === -1) {
        throw AppError_('BAD_REQUEST', 'Metode pengadaan tidak valid.');
      }
      updates.metode_pengadaan = payload.metodePengadaan;
    }
    if (payload.jenisKontrak !== undefined) updates.jenis_kontrak = payload.jenisKontrak;
    if (payload.tanggalMulai !== undefined) updates.tanggal_mulai = payload.tanggalMulai;
    if (payload.tanggalSelesai !== undefined) updates.tanggal_selesai = payload.tanggalSelesai;
    if (payload.adaPph !== undefined) updates.ada_pph = !!payload.adaPph;
    if (payload.memerlukanPenyedia !== undefined) updates.memerlukan_penyedia = !!payload.memerlukanPenyedia;
    if (payload.penyediaId !== undefined) {
      if (payload.penyediaId && !findRowByField_('PROVIDERS', 'penyedia_id', payload.penyediaId)) {
        throw AppError_('NOT_FOUND', 'Penyedia tidak ditemukan.');
      }
      updates.penyedia_id = payload.penyediaId;
    }
    if (payload.nilaiHps !== undefined) {
      var nilaiHps = Number(payload.nilaiHps);
      if (!(nilaiHps >= 0)) throw AppError_('BAD_REQUEST', 'Nilai HPS tidak boleh negatif.');
      updates.nilai_hps = nilaiHps;
    }
    if (payload.nilaiKontrak !== undefined) {
      var nilaiKontrak = Number(payload.nilaiKontrak);
      if (!(nilaiKontrak >= 0)) throw AppError_('BAD_REQUEST', 'Nilai Kontrak tidak boleh negatif.');
      updates.nilai_kontrak = nilaiKontrak;
    }

    updateRowByField_('PAKET', 'paket_id', id, updates);
    computePaketCompletion_(id);
    logAudit_(access.session.userId, 'UPDATE_PAKET', 'PAKET', id, 'Update data paket');

    var refreshed = findRowByField_('PAKET', 'paket_id', id);
    return { hpsMelebihiPagu: Number(refreshed.nilai_hps) > Number(refreshed.pagu_snapshot) };
  },

  cancel: function (payload, token) {
    payload = payload || {};
    var id = String(payload.paketId || '');
    if (!id) throw AppError_('BAD_REQUEST', 'paketId wajib diisi.');
    var paket = findRowByField_('PAKET', 'paket_id', id);
    if (!paket) throw AppError_('NOT_FOUND', 'Paket tidak ditemukan.');
    var access = requireAccess_(token, { allowRoles: ['ADMIN', 'PENGELOLA'], satkerId: paket.satker_id, tahunAnggaranId: paket.tahun_anggaran_id });

    updateRowByField_('PAKET', 'paket_id', id, { status_paket: 'DIBATALKAN', updated_at: new Date().toISOString(), updated_by: access.session.userId });
    logAudit_(access.session.userId, 'CANCEL_PAKET', 'PAKET', id, 'Membatalkan paket');
    return {};
  }
};

function computePaketCompletion_(paketId) {
  var paket = findRowByField_('PAKET', 'paket_id', paketId);
  if (!paket || paket.status_paket === 'DIBATALKAN') return;

  var dataDasarLengkap = !!paket.nama_paket && Number(paket.pagu_snapshot) > 0 &&
    !!paket.metode_pengadaan && !!paket.tanggal_mulai && !!paket.tanggal_selesai;
  var penyediaLengkap = paket.memerlukan_penyedia ? !!paket.penyedia_id : true;

  // computeDocumentChecklist_ ada di Documents.gs (Tahap 5) -- baru sejak
  // tahap itu ada, fungsi ini bisa benar-benar menyatakan COMPLETE.
  var checklist = computeDocumentChecklist_(paketId);
  var totalWajibSekarang = 0, totalTerpenuhi = 0;
  checklist.forEach(function (item) {
    if (item.wajibSekarang) {
      totalWajibSekarang++;
      if (item.terpenuhi) totalTerpenuhi++;
    }
  });
  var dokumenLengkap = totalWajibSekarang === 0 || totalTerpenuhi === totalWajibSekarang;

  var status = (dataDasarLengkap && penyediaLengkap && dokumenLengkap) ? 'COMPLETE' :
    (dataDasarLengkap ? 'DATA_LENGKAP' : 'DRAFT');

  var persentase = totalWajibSekarang > 0
    ? Math.round((totalTerpenuhi / totalWajibSekarang) * 100)
    : ((dataDasarLengkap && penyediaLengkap) ? 100 : 0);

  updateRowByField_('PAKET', 'paket_id', paketId, { status_paket: status, persentase_kelengkapan: persentase });
}