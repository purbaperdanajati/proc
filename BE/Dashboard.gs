/**
 * Dashboard.gs
 * Agregasi dashboard sesuai spesifikasi awal (TOTAL SATKER, ADA/TIDAK ADA
 * PENGADAAN, TOTAL PAKET, PAGU, HPS, KONTRAK, dst).
 *
 * CATATAN JUJUR (Tahap 2): PAGU dan PAKET belum punya CRUD (baru Tahap 3),
 * jadi kedua sheet itu saat ini kosong. Semua angka terkait paket/pagu di sini
 * akan benar-benar 0 untuk sekarang — itu correct behavior, bukan bug, karena
 * memang belum ada paket yang dibuat. Begitu Tahap 3 selesai, angka-angka ini
 * otomatis terisi tanpa file ini perlu disentuh lagi.
 */

var DashboardService = {
  handle: function (action, payload, token) {
    switch (action) {
      case 'getGlobal': return this.getGlobal(payload, token);
      case 'getMine': return this.getMine(payload, token);
      default: throw AppError_('UNKNOWN_ACTION', 'Aksi dashboard tidak dikenal: ' + action);
    }
  },

  // Hanya Admin — lihat Bagian E dokumen desain (matrix peran: dashboard global = Admin saja).
  getGlobal: function (payload, token) {
    requireAccess_(token, { allowRoles: ['ADMIN'] });
    var tahunAnggaranId = resolveTahunAnggaranId_(payload && payload.tahunAnggaranId);
    if (!tahunAnggaranId) {
      return { tahunAnggaranId: null, message: 'Belum ada Tahun Anggaran. Buat dulu di menu Tahun Anggaran.' };
    }

    var satkers = readAllRows_('SATKER').rows.filter(function (s) { return s.status === 'AKTIF'; });
    var counts = { BELUM_DIINPUT: 0, TIDAK_ADA_PENGADAAN: 0, BERJALAN: 0, COMPLETE: 0 };

    var satkerList = satkers.map(function (s) {
      var computed = computeSatkerStatus_(s.satker_id, tahunAnggaranId);
      counts[computed.status] = (counts[computed.status] || 0) + 1;
      return {
        satkerId: s.satker_id,
        namaSatker: s.nama_satker,
        jenisSatker: s.jenis_satker,
        status: computed.status,
        persentaseKelengkapan: computed.persentaseKelengkapan
      };
    });
    // Satker paling butuh perhatian (belum lengkap) ditampilkan lebih dulu.
    var urutanStatus = { BELUM_DIINPUT: 0, BERJALAN: 1, COMPLETE: 2, TIDAK_ADA_PENGADAAN: 3 };
    satkerList.sort(function (a, b) { return urutanStatus[a.status] - urutanStatus[b.status]; });

    var paketRows = readAllRows_('PAKET').rows.filter(function (p) { return p.tahun_anggaran_id === tahunAnggaranId; });
    var totalPaket = paketRows.length;
    var paketComplete = paketRows.filter(function (p) { return p.status_paket === 'COMPLETE'; }).length;

    var paguRows = readAllRows_('PAGU').rows.filter(function (p) { return p.tahun_anggaran_id === tahunAnggaranId; });
    var totalPagu = paguRows.reduce(function (sum, p) { return sum + (Number(p.pagu) || 0); }, 0);
    var totalHps = paketRows.reduce(function (sum, p) { return sum + (Number(p.nilai_hps) || 0); }, 0);
    var totalKontrak = paketRows.reduce(function (sum, p) { return sum + (Number(p.nilai_kontrak) || 0); }, 0);

    return {
      tahunAnggaranId: tahunAnggaranId,
      totalSatker: satkers.length,
      satkerAdaPengadaan: counts.BERJALAN + counts.COMPLETE,
      satkerTidakAdaPengadaan: counts.TIDAK_ADA_PENGADAAN,
      satkerBelumDiinput: counts.BELUM_DIINPUT,
      totalPaket: totalPaket,
      paketComplete: paketComplete,
      paketBelumComplete: totalPaket - paketComplete,
      totalPagu: totalPagu,
      totalHps: totalHps,
      totalKontrak: totalKontrak,
      progresPengadaan: totalPaket > 0 ? Math.round((paketComplete / totalPaket) * 100) : null,
      satkerList: satkerList
    };
  },

  // Semua role — scoped ke satker yang di-assign ke user yang login.
  getMine: function (payload, token) {
    var session = requireSession_(token);
    var user = findRowByField_('USERS', 'user_id', session.userId);
    var tahunAnggaranId = resolveTahunAnggaranId_(payload && payload.tahunAnggaranId);
    if (!tahunAnggaranId) {
      return { tahunAnggaranId: null, namaUser: user.nama, message: 'Belum ada Tahun Anggaran.' };
    }

    var myIds = getMyAssignedSatkerIds_(user.user_id, tahunAnggaranId);
    var mySatkers = readAllRows_('SATKER').rows.filter(function (s) { return myIds.indexOf(s.satker_id) !== -1; });

    var totalPaket = 0, paketComplete = 0;
    var satkerList = mySatkers.map(function (s) {
      var computed = computeSatkerStatus_(s.satker_id, tahunAnggaranId);
      totalPaket += computed.totalPaket;
      paketComplete += computed.paketComplete;
      return {
        satkerId: s.satker_id,
        namaSatker: s.nama_satker,
        jenisSatker: s.jenis_satker,
        status: computed.status,
        persentaseKelengkapan: computed.persentaseKelengkapan
      };
    });

    return {
      tahunAnggaranId: tahunAnggaranId,
      namaUser: user.nama,
      totalSatkerSaya: mySatkers.length,
      totalPaketSaya: totalPaket,
      paketCompleteSaya: paketComplete,
      paketBelumCompleteSaya: totalPaket - paketComplete,
      satkerList: satkerList
    };
  }
};

/**
 * Kalau tahunAnggaranId tidak diberikan: pilih tahun berstatus AKTIF yang
 * paling baru; kalau tidak ada yang AKTIF, pilih tahun mana pun yang paling
 * baru; kalau belum ada Tahun Anggaran sama sekali, null.
 */
function resolveTahunAnggaranId_(tahunAnggaranId) {
  if (tahunAnggaranId) return tahunAnggaranId;
  var years = readAllRows_('YEARS').rows;
  if (years.length === 0) return null;

  var aktif = years.filter(function (y) { return y.status === 'AKTIF'; });
  var pool = aktif.length > 0 ? aktif : years;
  pool.sort(function (a, b) { return Number(b.tahun) - Number(a.tahun); });
  return pool[0].tahun_anggaran_id;
}
