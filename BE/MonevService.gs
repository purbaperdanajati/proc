/**
 * MonevService.gs
 * Generate "Hasil Monev" (Tahap lanjutan) -- Berita Acara Hasil Monitoring dan
 * Evaluasi per paket. Mengikuti contoh dokumen yang Anda berikan: tabel barang
 * dengan kolom Uraian/Satuan/Volume Dipesan/Spesifikasi/Volume Diterima/Kondisi
 * Barang Diterima/Tindak Lanjut.
 *
 * Sesuai instruksi ("catatan/ceklist monev berdasarkan HPS yang ada"): getItems()
 * OTOMATIS mengisi baris awal dari HPS_ITEMS paket ini (nama/spesifikasi/satuan/
 * volume) kalau MONEV_ITEMS untuk paket itu masih kosong -- user tinggal
 * melengkapi kolom "Volume Diterima", "Kondisi", dan "Tindak Lanjut" saat
 * kegiatan monev berlangsung, tidak perlu input ulang daftar barang dari nol.
 * Nomor surat SELALU diisi manual, sama seperti KAK/SK/BAST.
 */

var MonevService = {
  handle: function (action, payload, token) {
    switch (action) {
      case 'getItems': return this.getItems(payload, token);
      case 'saveItems': return this.saveItems(payload, token);
      case 'preview': return this.preview(payload, token);
      case 'finalize': return this.finalize(payload, token);
      case 'history': return this.history(payload, token);
      case 'download': return this.download(payload, token);
      default: throw AppError_('UNKNOWN_ACTION', 'Aksi monev tidak dikenal: ' + action);
    }
  },

  getItems: function (payload, token) {
    var paket = getPaketForDocGen_(String((payload || {}).paketId || ''), token, false);
    var existing = readAllRows_('MONEV_ITEMS').rows
      .filter(function (m) { return m.paket_id === paket.paket_id; })
      .sort(function (a, b) { return (Number(a.row_index) || 0) - (Number(b.row_index) || 0); });
    if (existing.length > 0) return { items: existing, sudahAdaData: true };

    // Belum pernah diisi -- prefill dari item HPS paket ini (tidak ditulis ke
    // sheet dulu, cuma dikembalikan sebagai draft; baru tersimpan permanen kalau
    // user menekan Simpan lewat saveItems()).
    var hpsItems = readAllRows_('HPS_ITEMS').rows
      .filter(function (i) { return i.paket_id === paket.paket_id; })
      .sort(function (a, b) { return (Number(a.row_index) || 0) - (Number(b.row_index) || 0); });
    var draft = hpsItems.map(function (i, idx) {
      return {
        monev_item_id: '', paket_id: paket.paket_id, row_index: idx + 1,
        nama_barang: i.nama, spesifikasi: i.spesifikasi, satuan: i.satuan,
        volume_pesan: i.volume, volume_terima: i.volume,
        kondisi: 'Baik, sesuai spesifikasi', tindak_lanjut: '-'
      };
    });
    return { items: draft, sudahAdaData: false };
  },

  saveItems: function (payload, token) {
    payload = payload || {};
    var paket = getPaketForDocGen_(String(payload.paketId || ''), token, true);
    var access = requireAccess_(token, { allowRoles: ['ADMIN', 'PENGELOLA'], satkerId: paket.satker_id, tahunAnggaranId: paket.tahun_anggaran_id });

    var itemsMasuk = payload.items;
    if (!itemsMasuk || Object.prototype.toString.call(itemsMasuk) !== '[object Array]') {
      throw AppError_('BAD_REQUEST', 'Data item monev tidak valid.');
    }

    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      var sheet = getSheet_('MONEV_ITEMS');
      var values = sheet.getDataRange().getValues();
      var headers = values[0];
      var kolomPaket = headers.indexOf('paket_id');
      for (var r = values.length - 1; r >= 1; r--) {
        if (values[r][kolomPaket] === paket.paket_id) sheet.deleteRow(r + 1);
      }
      // Sama seperti HpsService.gs: deleteRow() langsung tidak lewat
      // appendRow_/updateRowByField_, jadi cache-nya harus dibatalkan manual.
      invalidateSheetCache_('MONEV_ITEMS');

      var now = new Date().toISOString();
      var jumlah = 0;
      itemsMasuk.forEach(function (item) {
        var namaBarang = String(item.namaBarang || item.nama_barang || '').trim();
        if (!namaBarang) return;
        jumlah++;
        appendRow_('MONEV_ITEMS', {
          monev_item_id: nextId_('MNV'), paket_id: paket.paket_id, row_index: jumlah,
          nama_barang: namaBarang, spesifikasi: item.spesifikasi || '', satuan: item.satuan || '',
          volume_pesan: item.volumePesan !== undefined ? item.volumePesan : (item.volume_pesan || ''),
          volume_terima: item.volumeTerima !== undefined ? item.volumeTerima : (item.volume_terima || ''),
          kondisi: item.kondisi || '', tindak_lanjut: item.tindakLanjut || item.tindak_lanjut || '',
          created_at: now, updated_at: now
        });
      });
      logAudit_(access.session.userId, 'SAVE_MONEV_ITEMS', 'MONEV_ITEMS', paket.paket_id, 'Menyimpan ' + jumlah + ' item monev');
      return { jumlahItem: jumlah };
    } finally {
      lock.releaseLock();
    }
  },

  preview: function (payload, token) {
    payload = payload || {};
    var paket = getPaketForDocGen_(String(payload.paketId || ''), token, true);
    return { html: buildMonevHtml_(paket, buildMonevOpts_(payload)) };
  },

  finalize: function (payload, token) {
    payload = payload || {};
    var paket = getPaketForDocGen_(String(payload.paketId || ''), token, true);
    var access = requireAccess_(token, { allowRoles: ['ADMIN', 'PENGELOLA'], satkerId: paket.satker_id, tahunAnggaranId: paket.tahun_anggaran_id });
    var opts = buildMonevOpts_(payload);
    if (!opts.nomorSurat) throw AppError_('BAD_REQUEST', 'Nomor surat wajib diisi.');

    var html = payload.htmlFinal ? String(payload.htmlFinal) : buildMonevHtml_(paket, opts);
    var pdfBlob;
    try {
      pdfBlob = Utilities.newBlob(html, MimeType.HTML, 'MONEV.html').getAs(MimeType.PDF);
    } catch (e) {
      Logger.log('Konversi HTML->PDF (Monev) gagal untuk paket ' + paket.paket_id + ': ' + e);
      throw AppError_('PDF_CONVERSION_FAILED', 'Gagal mengubah dokumen ke PDF. Coba lagi beberapa saat; kalau tetap gagal, gunakan pratinjau lalu cetak dari browser.');
    }

    var versionBaru = getNextDocVersion_(paket.paket_id, 'MONEV');
    var namaFile = 'Hasil Monev - ' + (paket.nama_paket || paket.paket_id) + ' - v' + versionBaru + '.pdf';
    pdfBlob.setName(namaFile);

    var file = getPaketDocumentFolder_(paket, 'Hasil Monev').createFile(pdfBlob);
    var id = nextId_('GEN');
    appendRow_('GENERATED_DOCUMENTS', {
      generated_document_id: id, paket_id: paket.paket_id, satker_id: '', tahun_anggaran_id: '',
      doc_type: 'MONEV', version: versionBaru, nomor_surat: opts.nomorSurat,
      generated_by: access.session.userId, generated_at: new Date().toISOString(),
      file_id: file.getId(), drive_url: file.getUrl(),
      snapshot_json: JSON.stringify(opts), change_note: payload.changeNote || '', status: 'ACTIVE'
    });
    logAudit_(access.session.userId, 'GENERATE_MONEV', 'GENERATED_DOCUMENTS', id,
      'Generate Hasil Monev v' + versionBaru + ' untuk paket ' + paket.paket_id);

    // HASIL-MONEV: kode requirement checklist (Tahap 5) yang memang sudah ada.
    linkGeneratedDocToChecklist_(paket, 'HASIL-MONEV', file, access.session.userId, opts.nomorSurat);
    computePaketCompletion_(paket.paket_id);

    return { generatedDocumentId: id, version: versionBaru, fileName: namaFile };
  },

  history: function (payload, token) {
    var paket = getPaketForDocGen_(String((payload || {}).paketId || ''), token, false);
    return readAllRows_('GENERATED_DOCUMENTS').rows
      .filter(function (g) { return g.paket_id === paket.paket_id && g.doc_type === 'MONEV'; })
      .map(function (g) {
        return { generated_document_id: g.generated_document_id, version: g.version, nomor_surat: g.nomor_surat, generated_at: g.generated_at, generated_by: g.generated_by, change_note: g.change_note, status: g.status };
      }).sort(function (a, b) { return Number(b.version) - Number(a.version); });
  },

  download: function (payload, token) {
    var gen = findRowByField_('GENERATED_DOCUMENTS', 'generated_document_id', String((payload || {}).generatedDocumentId || ''));
    if (!gen || gen.doc_type !== 'MONEV') throw AppError_('NOT_FOUND', 'Dokumen hasil monev tidak ditemukan.');
    getPaketForDocGen_(gen.paket_id, token, false);
    var file = DriveApp.getFileById(gen.file_id);
    var blob = file.getBlob();
    return { fileName: file.getName(), mimeType: blob.getContentType(), fileBase64: Utilities.base64Encode(blob.getBytes()) };
  }
};

var DEFAULT_KESIMPULAN_MONEV = [
  'Pelaksanaan pengadaan telah terealisasi 100% (seratus persen) sesuai Surat Pesanan.',
  'Seluruh barang/pekerjaan diterima sesuai jumlah dan spesifikasi.'
];

function buildMonevOpts_(payload) {
  var kesimpulan = payload.kesimpulan;
  if (!kesimpulan || Object.prototype.toString.call(kesimpulan) !== '[object Array]' || kesimpulan.length === 0) {
    kesimpulan = DEFAULT_KESIMPULAN_MONEV;
  }
  return { nomorSurat: String(payload.nomorSurat || ''), kesimpulan: kesimpulan };
}

function buildMonevHtml_(paket, opts) {
  var data = buildDocumentData_(paket);
  var provider = paket.penyedia_id ? findRowByField_('PROVIDERS', 'penyedia_id', paket.penyedia_id) : null;
  var items = readAllRows_('MONEV_ITEMS').rows
    .filter(function (i) { return i.paket_id === paket.paket_id; })
    .sort(function (a, b) { return (Number(a.row_index) || 0) - (Number(b.row_index) || 0); });

  var baris = items.map(function (i, idx) {
    return '<tr><td style="text-align:center;">' + (idx + 1) + '</td>' +
      '<td>' + escapeHtmlServer_(i.nama_barang) + '</td>' +
      '<td style="text-align:center;">' + escapeHtmlServer_(i.satuan) + '</td>' +
      '<td style="text-align:center;">' + escapeHtmlServer_(i.volume_pesan) + '</td>' +
      '<td style="font-size:9pt;">' + escapeHtmlServer_(i.spesifikasi) + '</td>' +
      '<td style="text-align:center;">' + escapeHtmlServer_(i.volume_terima) + '</td>' +
      '<td>' + escapeHtmlServer_(i.kondisi) + '</td>' +
      '<td>' + escapeHtmlServer_(i.tindak_lanjut) + '</td></tr>';
  }).join('') || '<tr><td colspan="8" style="text-align:center;">(belum ada item monev -- lengkapi lewat layar Monev sebelum generate)</td></tr>';

  var namaPenyedia = provider ? provider.nama_perusahaan : '(penyedia belum dipilih)';
  var alamatPenyedia = provider ? (provider.alamat || '-') : '-';
  var kesimpulanHtml = opts.kesimpulan.map(function (k, idx) { return (idx + 1) + '. ' + escapeHtmlServer_(k) + '<br>'; }).join('');

  return [
    '<div style="font-family:Arial,sans-serif;font-size:10.5pt;">', data.KOP_SURAT,
    '<div style="text-align:center;font-weight:bold;text-decoration:underline;">BERITA ACARA HASIL MONITORING DAN EVALUASI</div>',
    '<div style="text-align:center;">Nomor: ' + escapeHtmlServer_(opts.nomorSurat) + '</div><br>',
    'Pada hari ini, ' + escapeHtmlServer_(data.TANGGAL_CETAK) + ', Pejabat Pembuat Komitmen bertindak atas nama Kepala ' + escapeHtmlServer_(data.NAMA_SATKER) +
    ' telah melakukan kegiatan monitoring dan evaluasi terhadap ' + escapeHtmlServer_(data.NAMA_PAKET) + ' yang dilaksanakan oleh ' + escapeHtmlServer_(namaPenyedia) +
    ' yang beralamat di ' + escapeHtmlServer_(alamatPenyedia) + '.<br><br>',
    'Adapun hasil monitoring dan evaluasi adalah sebagai berikut:<br>',
    '<table style="width:100%;border-collapse:collapse;margin-top:6px;font-size:9.5pt;" border="1" cellpadding="4">',
    '<thead><tr style="font-weight:bold;text-align:center;"><th>No.</th><th>Uraian Barang</th><th>Satuan</th><th>Vol. Dipesan</th><th>Spesifikasi</th><th>Vol. Diterima</th><th>Kondisi Diterima</th><th>Tindak Lanjut</th></tr></thead>',
    '<tbody>' + baris + '</tbody></table><br>',
    'Kesimpulan hasil monitoring dan evaluasi terhadap prestasi pekerjaan yang telah dilaksanakan antara lain:<br>' + kesimpulanHtml + '<br>',
    'Demikian Berita Acara Hasil Monitoring dan Evaluasi ini dibuat dalam rangkap yang diperlukan untuk dapat dipergunakan sebagaimana mestinya.<br><br>',
    '<i style="font-size:9pt;">Lampiran: Dokumentasi Kegiatan Monitoring dan Evaluasi ' + escapeHtmlServer_(data.NAMA_PAKET) + ' (lihat checklist dokumen "Dokumentasi Monev").</i><br><br><br>',
    '<table style="width:100%;"><tr><td style="width:60%;"></td><td style="text-align:left;">',
    'Indramayu, ' + escapeHtmlServer_(data.TANGGAL_CETAK) + '<br>Pejabat Pembuat Komitmen,<br><br><br><br>',
    '<b>' + escapeHtmlServer_(data.PPK) + '</b><br>NIP. ' + escapeHtmlServer_(data.NIP_PPK),
    '</td></tr></table></div>'
  ].join('\n');
}