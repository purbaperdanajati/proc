/**
 * Satkers.gs
 * CRUD master SATKER, dan konfigurasi per-tahun SATKER_TAHUN (DIPA, KPA, PPK,
 * Pejabat Pengadaan, serta status "ada_pengadaan" yang membedakan
 * "Tidak Ada Pengadaan" dari "Belum Diinput" — lihat Bagian J dokumen desain).
 */

var VALID_JENIS_SATKER = ['MAN', 'MIN', 'MTsN', 'KUA', 'PENDIS', 'SEKJEN', 'LAINNYA'];

var SatkersService = {
  handle: function (action, payload, token) {
    switch (action) {
      case 'list': return this.list(payload, token);
      case 'detail': return this.detail(payload, token);
      case 'create': return this.create(payload, token);
      case 'update': return this.update(payload, token);
      case 'setStatus': return this.setStatus(payload, token);
      case 'getSatkerTahun': return this.getSatkerTahun(payload, token);
      case 'saveSatkerTahun': return this.saveSatkerTahun(payload, token);
      default: throw AppError_('UNKNOWN_ACTION', 'Aksi satkers tidak dikenal: ' + action);
    }
  },

  // Admin melihat semua satker; role lain hanya melihat satker yang di-assign ke dirinya.
  // Kalau tahunAnggaranId disertakan, setiap satker juga dilampiri status Bagian J
  // (BELUM_DIINPUT/TIDAK_ADA_PENGADAAN/BERJALAN/COMPLETE) + persentase kelengkapan.
  list: function (payload, token) {
    var session = requireSession_(token);
    var user = findRowByField_('USERS', 'user_id', session.userId);
    var all = readAllRows_('SATKER').rows;

    var visible = all;
    if (user.role !== 'ADMIN') {
      var tahunForScope = payload && payload.tahunAnggaranId;
      var myIds = getMyAssignedSatkerIds_(user.user_id, tahunForScope);
      visible = all.filter(function (s) { return myIds.indexOf(s.satker_id) !== -1; });
    }

    var tahunAnggaranId = payload && payload.tahunAnggaranId;
    if (!tahunAnggaranId) return visible;

    return visible.map(function (s) {
      var computed = computeSatkerStatus_(s.satker_id, tahunAnggaranId);
      var copy = {};
      Object.keys(s).forEach(function (k) { copy[k] = s[k]; });
      copy.status_tahun_ini = computed.status;
      copy.persentase_kelengkapan = computed.persentaseKelengkapan;
      copy.total_paket = computed.totalPaket;
      copy.paket_complete = computed.paketComplete;
      return copy;
    });
  },

  detail: function (payload, token) {
    payload = payload || {};
    var satkerId = String(payload.satkerId || '');
    if (!satkerId) throw AppError_('BAD_REQUEST', 'satkerId wajib diisi.');
    requireAccess_(token, { satkerId: satkerId, tahunAnggaranId: payload.tahunAnggaranId });

    var satker = findRowByField_('SATKER', 'satker_id', satkerId);
    if (!satker) throw AppError_('NOT_FOUND', 'Satker tidak ditemukan.');

    var result = {};
    Object.keys(satker).forEach(function (k) { result[k] = satker[k]; });

    if (payload.tahunAnggaranId) {
      var computed = computeSatkerStatus_(satkerId, payload.tahunAnggaranId);
      result.status_tahun_ini = computed.status;
      result.persentase_kelengkapan = computed.persentaseKelengkapan;
      result.total_paket = computed.totalPaket;
      result.paket_complete = computed.paketComplete;

      var satkerTahunRows = readAllRows_('SATKER_TAHUN').rows;
      for (var i = 0; i < satkerTahunRows.length; i++) {
        if (satkerTahunRows[i].satker_id === satkerId && satkerTahunRows[i].tahun_anggaran_id === payload.tahunAnggaranId) {
          result.satkerTahun = satkerTahunRows[i];
          break;
        }
      }
    }
    return result;
  },

  create: function (payload, token) {
    var session = requireAccess_(token, { allowRoles: ['ADMIN'] }).session;
    payload = payload || {};
    var kode = String(payload.kodeSatker || '').trim();
    var nama = String(payload.namaSatker || '').trim();
    var jenis = String(payload.jenisSatker || '');

    if (!kode || !nama) throw AppError_('BAD_REQUEST', 'Kode dan nama satker wajib diisi.');
    if (VALID_JENIS_SATKER.indexOf(jenis) === -1) throw AppError_('BAD_REQUEST', 'Jenis satker tidak valid.');
    if (findRowByField_('SATKER', 'kode_satker', kode)) throw AppError_('DUPLICATE', 'Kode satker sudah dipakai.');

    var id = nextId_('SAT');
    var now = new Date().toISOString();
    appendRow_('SATKER', {
      satker_id: id, kode_satker: kode, nama_satker: nama, jenis_satker: jenis,
      wilayah: payload.wilayah || '', alamat: payload.alamat || '',
      website: payload.website || '', email: payload.email || '',
      telepon: payload.telepon || '', kodepos: payload.kodepos || '', status: 'AKTIF',
      catatan: payload.catatan || '', created_at: now, updated_at: now,
      created_by: session.userId, updated_by: session.userId
    });
    logAudit_(session.userId, 'CREATE_SATKER', 'SATKER', id, 'Membuat satker: ' + nama + ' (' + jenis + ')');
    return { satkerId: id };
  },

  update: function (payload, token) {
    var session = requireAccess_(token, { allowRoles: ['ADMIN'] }).session;
    payload = payload || {};
    var id = String(payload.satkerId || '');
    if (!id) throw AppError_('BAD_REQUEST', 'satkerId wajib diisi.');

    var updates = { updated_at: new Date().toISOString(), updated_by: session.userId };
    if (payload.kodeSatker !== undefined) updates.kode_satker = payload.kodeSatker;
    if (payload.namaSatker !== undefined) updates.nama_satker = payload.namaSatker;
    if (payload.jenisSatker !== undefined) {
      if (VALID_JENIS_SATKER.indexOf(payload.jenisSatker) === -1) throw AppError_('BAD_REQUEST', 'Jenis satker tidak valid.');
      updates.jenis_satker = payload.jenisSatker;
    }
    if (payload.wilayah !== undefined) updates.wilayah = payload.wilayah;
    if (payload.alamat !== undefined) updates.alamat = payload.alamat;
    if (payload.website !== undefined) updates.website = payload.website;
    if (payload.email !== undefined) updates.email = payload.email;
    if (payload.telepon !== undefined) updates.telepon = payload.telepon;
    if (payload.kodepos !== undefined) updates.kodepos = payload.kodepos;
    if (payload.catatan !== undefined) updates.catatan = payload.catatan;

    var success = updateRowByField_('SATKER', 'satker_id', id, updates);
    if (!success) throw AppError_('NOT_FOUND', 'Satker tidak ditemukan.');
    logAudit_(session.userId, 'UPDATE_SATKER', 'SATKER', id, 'Update data satker');
    return {};
  },

  setStatus: function (payload, token) {
    var session = requireAccess_(token, { allowRoles: ['ADMIN'] }).session;
    payload = payload || {};
    var id = String(payload.satkerId || '');
    var status = String(payload.status || '');
    if (['AKTIF', 'NONAKTIF'].indexOf(status) === -1) throw AppError_('BAD_REQUEST', 'Status tidak valid.');

    var success = updateRowByField_('SATKER', 'satker_id', id, { status: status, updated_at: new Date().toISOString() });
    if (!success) throw AppError_('NOT_FOUND', 'Satker tidak ditemukan.');
    logAudit_(session.userId, 'SET_SATKER_STATUS', 'SATKER', id, 'Status satker diubah ke ' + status);
    return {};
  },

  getSatkerTahun: function (payload, token) {
    payload = payload || {};
    var satkerId = String(payload.satkerId || '');
    var tahunAnggaranId = String(payload.tahunAnggaranId || '');
    if (!satkerId || !tahunAnggaranId) throw AppError_('BAD_REQUEST', 'satkerId dan tahunAnggaranId wajib diisi.');
    requireAccess_(token, { satkerId: satkerId, tahunAnggaranId: tahunAnggaranId });

    var rows = readAllRows_('SATKER_TAHUN').rows;
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].satker_id === satkerId && rows[i].tahun_anggaran_id === tahunAnggaranId) return rows[i];
    }
    return null; // belum dikonfigurasi untuk tahun ini
  },

  saveSatkerTahun: function (payload, token) {
    var session = requireAccess_(token, { allowRoles: ['ADMIN'] }).session;
    payload = payload || {};
    var satkerId = String(payload.satkerId || '');
    var tahunAnggaranId = String(payload.tahunAnggaranId || '');
    if (!satkerId || !tahunAnggaranId) throw AppError_('BAD_REQUEST', 'satkerId dan tahunAnggaranId wajib diisi.');

    var adaPengadaan = String(payload.adaPengadaan || 'BELUM_DITENTUKAN');
    if (['BELUM_DITENTUKAN', 'ADA', 'TIDAK_ADA'].indexOf(adaPengadaan) === -1) {
      throw AppError_('BAD_REQUEST', 'Nilai adaPengadaan tidak valid.');
    }

    var fields = {
      sp_dipa: payload.spDipa || '',
      tanggal_dipa: payload.tanggalDipa || '',
      kpa_nama: payload.kpaNama || '',
      kpa_nip: payload.kpaNip || '',
      ppk_nama: payload.ppkNama || '',
      ppk_nip: payload.ppkNip || '',
      pejabat_pengadaan_nama: payload.pejabatPengadaanNama || '',
      pejabat_pengadaan_nip: payload.pejabatPengadaanNip || '',
      ada_pengadaan: adaPengadaan,
      catatan: payload.catatan || ''
    };

    var existing = null;
    var rows = readAllRows_('SATKER_TAHUN').rows;
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].satker_id === satkerId && rows[i].tahun_anggaran_id === tahunAnggaranId) { existing = rows[i]; break; }
    }

    if (existing) {
      fields.updated_at = new Date().toISOString();
      updateRowByField_('SATKER_TAHUN', 'satker_tahun_id', existing.satker_tahun_id, fields);
      logAudit_(session.userId, 'UPDATE_SATKER_TAHUN', 'SATKER_TAHUN', existing.satker_tahun_id, 'Update konfigurasi satker-tahun');
      return { satkerTahunId: existing.satker_tahun_id };
    }

    var id = nextId_('ST');
    var now = new Date().toISOString();
    fields.satker_tahun_id = id;
    fields.satker_id = satkerId;
    fields.tahun_anggaran_id = tahunAnggaranId;
    fields.status = 'AKTIF';
    fields.created_at = now;
    fields.updated_at = now;
    appendRow_('SATKER_TAHUN', fields);
    logAudit_(session.userId, 'CREATE_SATKER_TAHUN', 'SATKER_TAHUN', id, 'Buat konfigurasi satker-tahun');
    return { satkerTahunId: id };
  }
};

/**
 * Menghitung status satker untuk satu tahun anggaran, mengikuti algoritma
 * Bagian J dokumen desain. Dipakai oleh SatkersService DAN DashboardService.
 *
 * Sengaja membaca sheet PAKET langsung meski Tahap 3 (CRUD Paket) belum ada —
 * saat ini sheet itu kosong sehingga totalPaket akan selalu 0 (status BERJALAN
 * kalau ada_pengadaan=ADA). Ini BENAR, bukan bug: begitu Tahap 3 mulai mengisi
 * PAKET, fungsi ini otomatis mulai menghitung angka sungguhan tanpa diubah lagi.
 */
function computeSatkerStatus_(satkerId, tahunAnggaranId) {
  var satkerTahunRows = readAllRows_('SATKER_TAHUN').rows;
  var satkerTahun = null;
  for (var i = 0; i < satkerTahunRows.length; i++) {
    if (satkerTahunRows[i].satker_id === satkerId && satkerTahunRows[i].tahun_anggaran_id === tahunAnggaranId) {
      satkerTahun = satkerTahunRows[i];
      break;
    }
  }

  var adaPengadaan = satkerTahun ? satkerTahun.ada_pengadaan : '';

  if (!satkerTahun || !adaPengadaan || adaPengadaan === 'BELUM_DITENTUKAN') {
    return { status: 'BELUM_DIINPUT', totalPaket: 0, paketComplete: 0, persentaseKelengkapan: null };
  }
  if (adaPengadaan === 'TIDAK_ADA') {
    return { status: 'TIDAK_ADA_PENGADAAN', totalPaket: 0, paketComplete: 0, persentaseKelengkapan: null };
  }

  // adaPengadaan === 'ADA'
  var paketRows = readAllRows_('PAKET').rows.filter(function (p) {
    return p.satker_id === satkerId && p.tahun_anggaran_id === tahunAnggaranId;
  });
  var totalPaket = paketRows.length;
  var paketComplete = paketRows.filter(function (p) { return p.status_paket === 'COMPLETE'; }).length;

  if (totalPaket === 0) {
    return { status: 'BERJALAN', totalPaket: 0, paketComplete: 0, persentaseKelengkapan: null };
  }
  var persentase = Math.round((paketComplete / totalPaket) * 100);
  var status = (paketComplete === totalPaket) ? 'COMPLETE' : 'BERJALAN';
  return { status: status, totalPaket: totalPaket, paketComplete: paketComplete, persentaseKelengkapan: persentase };
}
