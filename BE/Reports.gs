/**
 * Reports.gs
 * Rekap & monitoring (Tahap 8). Semua rekap dibatasi ke satker yang jadi
 * tanggung jawab user kalau bukan Admin -- scoping-nya memakai helper yang
 * sama dengan modul lain (getMyAssignedSatkerIds_), bukan aturan sendiri.
 */

var ReportsService = {
  handle: function (action, payload, token) {
    switch (action) {
      case 'rekapSatker': return this.rekapSatker(payload, token);
      case 'rekapJenisPengadaan': return this.rekapJenisPengadaan(payload, token);
      case 'rekapUser': return this.rekapUser(payload, token);
      case 'paketBelumLengkap': return this.paketBelumLengkap(payload, token);
      case 'search': return this.search(payload, token);
      default: throw AppError_('UNKNOWN_ACTION', 'Aksi reports tidak dikenal: ' + action);
    }
  },

  rekapSatker: function (payload, token) {
    var ctx = getReportContext_(payload, token);
    var satkers = readAllRows_('SATKER').rows.filter(function (s) {
      return s.status === 'AKTIF' && (ctx.isAdmin || ctx.mySatkerIds.indexOf(s.satker_id) !== -1);
    });

    return satkers.map(function (s) {
      var paketSatker = ctx.paketRows.filter(function (p) { return p.satker_id === s.satker_id; });
      var paguSatker = ctx.paguRows.filter(function (g) { return g.satker_id === s.satker_id; });
      var statusInfo = computeSatkerStatus_(s.satker_id, ctx.tahunAnggaranId);
      return {
        satkerId: s.satker_id, namaSatker: s.nama_satker, jenisSatker: s.jenis_satker,
        totalPagu: jumlahkan_(paguSatker, 'pagu'),
        totalHps: jumlahkan_(paketSatker, 'nilai_hps'),
        totalKontrak: jumlahkan_(paketSatker, 'nilai_kontrak'),
        jumlahPaket: paketSatker.length,
        paketComplete: paketSatker.filter(function (p) { return p.status_paket === 'COMPLETE'; }).length,
        status: statusInfo.status,
        persentase: statusInfo.persentaseKelengkapan
      };
    });
  },

  rekapJenisPengadaan: function (payload, token) {
    var ctx = getReportContext_(payload, token);
    return readAllRows_('JENIS_PENGADAAN').rows.map(function (j) {
      var paketJenis = ctx.paketRows.filter(function (p) { return p.jenis_pengadaan_id === j.jenis_pengadaan_id; });
      var paguJenis = ctx.paguRows.filter(function (g) { return g.jenis_pengadaan_id === j.jenis_pengadaan_id; });
      return {
        jenisPengadaanId: j.jenis_pengadaan_id, namaJenis: j.nama_jenis,
        totalPagu: jumlahkan_(paguJenis, 'pagu'),
        totalHps: jumlahkan_(paketJenis, 'nilai_hps'),
        jumlahPaket: paketJenis.length,
        paketComplete: paketJenis.filter(function (p) { return p.status_paket === 'COMPLETE'; }).length
      };
    });
  },

  rekapUser: function (payload, token) {
    requireAccess_(token, { allowRoles: ['ADMIN'] });
    var tahunAnggaranId = resolveTahunAnggaranId_((payload || {}).tahunAnggaranId);
    var paketRows = readAllRows_('PAKET').rows.filter(function (p) { return p.tahun_anggaran_id === tahunAnggaranId; });

    return readAllRows_('USERS').rows
      .filter(function (u) { return u.status === 'AKTIF'; })
      .map(function (u) {
        var satkerIds = getMyAssignedSatkerIds_(u.user_id, tahunAnggaranId);
        var paketUser = paketRows.filter(function (p) { return satkerIds.indexOf(p.satker_id) !== -1; });
        return {
          userId: u.user_id, nama: u.nama, role: u.role,
          jumlahSatker: satkerIds.length,
          jumlahPaket: paketUser.length,
          paketComplete: paketUser.filter(function (p) { return p.status_paket === 'COMPLETE'; }).length,
          totalHps: jumlahkan_(paketUser, 'nilai_hps')
        };
      });
  },

  paketBelumLengkap: function (payload, token) {
    var ctx = getReportContext_(payload, token);
    var satkerMap = {};
    readAllRows_('SATKER').rows.forEach(function (s) { satkerMap[s.satker_id] = s.nama_satker; });

    return ctx.paketRows
      .filter(function (p) { return p.status_paket !== 'COMPLETE' && p.status_paket !== 'DIBATALKAN'; })
      .map(function (p) {
        var checklist = computeDocumentChecklist_(p.paket_id);
        var kurang = checklist.filter(function (c) { return c.wajibSekarang && !c.terpenuhi; })
          .map(function (c) { return c.namaDokumen; });
        return {
          paketId: p.paket_id, namaPaket: p.nama_paket,
          namaSatker: satkerMap[p.satker_id] || p.satker_id,
          status: p.status_paket,
          persentase: p.persentase_kelengkapan,
          dokumenKurang: kurang
        };
      });
  },

  // Pencarian global lintas satker/paket/penyedia -- tetap scoped per peran.
  search: function (payload, token) {
    var ctx = getReportContext_(payload, token);
    var q = String((payload || {}).query || '').trim().toLowerCase();
    if (q.length < 2) throw AppError_('BAD_REQUEST', 'Kata kunci pencarian minimal 2 karakter.');

    var cocok = function (nilai) { return String(nilai || '').toLowerCase().indexOf(q) !== -1; };

    var satkers = readAllRows_('SATKER').rows
      .filter(function (s) { return ctx.isAdmin || ctx.mySatkerIds.indexOf(s.satker_id) !== -1; })
      .filter(function (s) { return cocok(s.nama_satker) || cocok(s.kode_satker); })
      .map(function (s) { return { tipe: 'Satker', id: s.satker_id, label: s.nama_satker, keterangan: s.kode_satker }; });

    var pakets = ctx.paketRows
      .filter(function (p) { return cocok(p.nama_paket) || cocok(p.kode_paket); })
      .map(function (p) { return { tipe: 'Paket', id: p.paket_id, label: p.nama_paket, keterangan: p.status_paket }; });

    // Penyedia memang lintas-satker (Tahap 4), jadi tidak di-scope per satker.
    var providers = readAllRows_('PROVIDERS').rows
      .filter(function (pv) { return cocok(pv.nama_perusahaan) || cocok(pv.npwp); })
      .map(function (pv) { return { tipe: 'Penyedia', id: pv.penyedia_id, label: pv.nama_perusahaan, keterangan: pv.bentuk_usaha }; });

    return satkers.concat(pakets).concat(providers).slice(0, 50);
  }
};

function getReportContext_(payload, token) {
  var session = requireSession_(token);
  var user = findRowByField_('USERS', 'user_id', session.userId);
  var tahunAnggaranId = resolveTahunAnggaranId_((payload || {}).tahunAnggaranId);
  var isAdmin = user.role === 'ADMIN';
  var mySatkerIds = isAdmin ? [] : getMyAssignedSatkerIds_(user.user_id, tahunAnggaranId);

  var paketRows = readAllRows_('PAKET').rows.filter(function (p) {
    return p.tahun_anggaran_id === tahunAnggaranId && (isAdmin || mySatkerIds.indexOf(p.satker_id) !== -1);
  });
  var paguRows = readAllRows_('PAGU').rows.filter(function (g) {
    return g.tahun_anggaran_id === tahunAnggaranId && (isAdmin || mySatkerIds.indexOf(g.satker_id) !== -1);
  });

  return {
    user: user, isAdmin: isAdmin, mySatkerIds: mySatkerIds,
    tahunAnggaranId: tahunAnggaranId, paketRows: paketRows, paguRows: paguRows
  };
}

function jumlahkan_(rows, field) {
  var total = 0;
  rows.forEach(function (r) { total += Number(r[field]) || 0; });
  return total;
}