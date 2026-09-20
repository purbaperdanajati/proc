/**
 * BastService.gs
 * Generate "BAST Manual" (Tahap lanjutan) per paket -- SATU dokumen PDF berisi
 * 3 bagian mengikuti contoh yang Anda berikan: Berita Acara Pemeriksaan Barang
 * (BAP), Berita Acara Serah Terima Pekerjaan (BAST), dan Berita Acara Pembayaran.
 * Tabel "uraian pekerjaan/volume/satuan" DIAMBIL LANGSUNG dari HPS_ITEMS paket
 * ini (kolom harga tidak ikut ditampilkan di BAP/BAST, sesuai contoh) -- tidak
 * perlu input ulang daftar barang/pekerjaan.
 *
 * Nomor surat SELALU diisi manual (payload.nomorSurat) -- dipakai sebagai nomor
 * dasar, lalu otomatis disisipi akhiran ".a" (BAP) / ".b" (BAST) / ".c"
 * (Pembayaran) mengikuti pola penomoran pada contoh dokumen (mis. "82.a/...",
 * "82.b/...", "82.c/..."). Hasil akhirnya tetap bisa disunting manual di
 * pratinjau sebelum di-generate PDF, kalau pola instansi Anda berbeda.
 *
 * HTML disusun terprogram (bukan lewat TEMPLATES admin) karena tabelnya dinamis
 * mengikuti jumlah item HPS -- pola yang sama dengan HpsService.gs.
 * Tidak berlaku untuk "BAST E-Katalog" -- itu tetap dokumen upload biasa lewat
 * Documents.gs (dari sistem e-katalog/SIKAP, bukan dibuat di sini).
 */

var BastService = {
  handle: function (action, payload, token) {
    switch (action) {
      case 'preview': return this.preview(payload, token);
      case 'finalize': return this.finalize(payload, token);
      case 'history': return this.history(payload, token);
      case 'download': return this.download(payload, token);
      default: throw AppError_('UNKNOWN_ACTION', 'Aksi bast tidak dikenal: ' + action);
    }
  },

  preview: function (payload, token) {
    payload = payload || {};
    var paket = getPaketForDocGen_(String(payload.paketId || ''), token, true);
    return { html: buildBastHtml_(paket, buildBastOpts_(payload)) };
  },

  finalize: function (payload, token) {
    payload = payload || {};
    var paket = getPaketForDocGen_(String(payload.paketId || ''), token, true);
    var access = requireAccess_(token, { allowRoles: ['ADMIN', 'PENGELOLA'], satkerId: paket.satker_id, tahunAnggaranId: paket.tahun_anggaran_id });
    var nomorSurat = String(payload.nomorSurat || '');
    if (!nomorSurat) throw AppError_('BAD_REQUEST', 'Nomor surat (BAP) wajib diisi.');
    var opts = buildBastOpts_(payload);

    var html = payload.htmlFinal ? String(payload.htmlFinal) : buildBastHtml_(paket, opts);
    var pdfBlob;
    try {
      pdfBlob = Utilities.newBlob(html, MimeType.HTML, 'BAST.html').getAs(MimeType.PDF);
    } catch (e) {
      Logger.log('Konversi HTML->PDF (BAST) gagal untuk paket ' + paket.paket_id + ': ' + e);
      throw AppError_('PDF_CONVERSION_FAILED', 'Gagal mengubah dokumen ke PDF. Coba lagi beberapa saat; kalau tetap gagal, gunakan pratinjau lalu cetak dari browser.');
    }

    var versionBaru = getNextDocVersion_(paket.paket_id, 'BAST');
    var namaFile = 'BAST Manual - ' + (paket.nama_paket || paket.paket_id) + ' - v' + versionBaru + '.pdf';
    pdfBlob.setName(namaFile);

    var file = getPaketDocumentFolder_(paket, 'BAST Manual').createFile(pdfBlob);
    var id = nextId_('GEN');
    appendRow_('GENERATED_DOCUMENTS', {
      generated_document_id: id, paket_id: paket.paket_id, satker_id: '', tahun_anggaran_id: '',
      doc_type: 'BAST', version: versionBaru, nomor_surat: nomorSurat,
      generated_by: access.session.userId, generated_at: new Date().toISOString(),
      file_id: file.getId(), drive_url: file.getUrl(),
      snapshot_json: JSON.stringify(opts), change_note: payload.changeNote || '', status: 'ACTIVE'
    });
    logAudit_(access.session.userId, 'GENERATE_BAST', 'GENERATED_DOCUMENTS', id,
      'Generate BAST Manual v' + versionBaru + ' untuk paket ' + paket.paket_id);

    // BAST-MANUAL: kode requirement checklist (Tahap 5) yang memang sudah ada.
    linkGeneratedDocToChecklist_(paket, 'BAST-MANUAL', file, access.session.userId, nomorSurat);
    computePaketCompletion_(paket.paket_id);

    return { generatedDocumentId: id, version: versionBaru, fileName: namaFile };
  },

  history: function (payload, token) {
    var paket = getPaketForDocGen_(String((payload || {}).paketId || ''), token, false);
    return readAllRows_('GENERATED_DOCUMENTS').rows
      .filter(function (g) { return g.paket_id === paket.paket_id && g.doc_type === 'BAST'; })
      .map(function (g) {
        return { generated_document_id: g.generated_document_id, version: g.version, nomor_surat: g.nomor_surat, generated_at: g.generated_at, generated_by: g.generated_by, change_note: g.change_note, status: g.status };
      }).sort(function (a, b) { return Number(b.version) - Number(a.version); });
  },

  download: function (payload, token) {
    var gen = findRowByField_('GENERATED_DOCUMENTS', 'generated_document_id', String((payload || {}).generatedDocumentId || ''));
    if (!gen || gen.doc_type !== 'BAST') throw AppError_('NOT_FOUND', 'Dokumen BAST tidak ditemukan.');
    getPaketForDocGen_(gen.paket_id, token, false);
    var file = DriveApp.getFileById(gen.file_id);
    var blob = file.getBlob();
    return { fileName: file.getName(), mimeType: blob.getContentType(), fileBase64: Utilities.base64Encode(blob.getBytes()) };
  }
};

// Opsi tambahan yang boleh diisi manual saat generate -- semuanya opsional,
// dikosongkan berarti baris terkait tidak ditampilkan/dipakai nilai default.
function buildBastOpts_(payload) {
  return {
    nomorSurat: String(payload.nomorSurat || ''),
    nomorSuratPesanan: String(payload.nomorSuratPesanan || ''),
    tanggalSuratPesanan: String(payload.tanggalSuratPesanan || ''),
    persentaseKemajuan: String(payload.persentaseKemajuan || '100')
  };
}

// "82/Mts.../2026" -> "82.a/Mts.../2026" -- mengikuti pola penomoran BAP/BAST/
// Pembayaran pada contoh dokumen (nomor dasar sama, akhiran segmen pertama beda).
function sisipkanSufiksNomor_(nomorDasar, sufiks) {
  if (!nomorDasar) return '';
  var idx = nomorDasar.indexOf('/');
  if (idx === -1) return nomorDasar + sufiks;
  return nomorDasar.slice(0, idx) + sufiks + nomorDasar.slice(idx);
}

function buildBastHtml_(paket, opts) {
  var data = buildDocumentData_(paket);
  var provider = paket.penyedia_id ? findRowByField_('PROVIDERS', 'penyedia_id', paket.penyedia_id) : null;
  var items = readAllRows_('HPS_ITEMS').rows
    .filter(function (i) { return i.paket_id === paket.paket_id; })
    .sort(function (a, b) { return (Number(a.row_index) || 0) - (Number(b.row_index) || 0); });

  var barisItem = items.map(function (i, idx) {
    return '<tr><td style="text-align:center;">' + (idx + 1) + '</td><td>' + escapeHtmlServer_(i.nama) +
      (i.spesifikasi ? '<br><span style="font-size:9pt;">' + escapeHtmlServer_(i.spesifikasi) + '</span>' : '') + '</td>' +
      '<td style="text-align:center;">' + escapeHtmlServer_(i.volume) + '</td><td style="text-align:center;">' + escapeHtmlServer_(i.satuan) + '</td></tr>';
  }).join('') || '<tr><td colspan="4" style="text-align:center;">(belum ada item HPS untuk paket ini)</td></tr>';

  var namaPenyedia = provider ? provider.nama_perusahaan : '(penyedia belum dipilih)';
  var alamatPenyedia = provider ? (provider.alamat || '-') : '-';
  var direkturPenyedia = provider ? (provider.nama_direktur || '-') : '-';

  var nomorBap = sisipkanSufiksNomor_(opts.nomorSurat, '.a');
  var nomorBast = sisipkanSufiksNomor_(opts.nomorSurat, '.b');
  var nomorBayar = sisipkanSufiksNomor_(opts.nomorSurat, '.c');

  var suratPesananHtml = opts.nomorSuratPesanan
    ? 'Surat Pesanan Nomor: ' + escapeHtmlServer_(opts.nomorSuratPesanan) + (opts.tanggalSuratPesanan ? ' tanggal ' + escapeHtmlServer_(formatTanggalIndonesia_(opts.tanggalSuratPesanan)) : '')
    : '<i style="font-size:9pt;">(Nomor Surat Pesanan belum diisi)</i>';

  var kontrak = Number(paket.nilai_kontrak) || 0;
  var adaPph = !!paket.ada_pph;
  var dpp = adaPph ? Math.round(kontrak / 1.11) : kontrak;
  var ppn = adaPph ? (kontrak - dpp) : 0;

  var kop = data.KOP_SURAT;
  var style = 'font-family:Arial,sans-serif;font-size:11pt;text-align:justify;';

  return [
    '<div style="' + style + '">', kop,
    '<div style="text-align:center;font-weight:bold;text-decoration:underline;">BERITA ACARA PEMERIKSAAN BARANG</div>',
    '<div style="text-align:center;">Nomor: ' + escapeHtmlServer_(nomorBap) + '</div><br>',
    'Pada hari ini, ' + escapeHtmlServer_(data.TANGGAL_CETAK) + ', Pejabat Pembuat Komitmen bertindak atas nama Kepala ' + escapeHtmlServer_(data.NAMA_SATKER) +
    ' telah melakukan pemeriksaan terhadap ' + escapeHtmlServer_(data.NAMA_PAKET) + ' yang dilaksanakan oleh ' + escapeHtmlServer_(namaPenyedia) +
    ' yang beralamat di ' + escapeHtmlServer_(alamatPenyedia) + '.<br><br>',
    'Berdasarkan antara lain: ' + suratPesananHtml + '. Adapun hasil pemeriksaan adalah sebagai berikut:<br>',
    '<table style="width:100%;border-collapse:collapse;margin-top:6px;" border="1" cellpadding="4">',
    '<thead><tr style="font-weight:bold;text-align:center;"><th>No.</th><th>Uraian Pekerjaan/Barang</th><th>Volume</th><th>Satuan</th></tr></thead>',
    '<tbody>' + barisItem + '</tbody></table><br>',
    'Kesimpulan hasil pemeriksaan terhadap prestasi pekerjaan yang telah dilaksanakan antara lain:<br>',
    '1. Kemajuan pelaksanaan tersebut sebesar ' + escapeHtmlServer_(opts.persentaseKemajuan) + '%.<br>',
    '2. Hal-hal lain yang luput dari pemeriksaan dan menyimpang atau tidak sesuai menjadi tanggung jawab Penyedia.<br><br>',
    '<table style="width:100%;"><tr><td style="width:50%;text-align:center;">PIHAK KEDUA<br>' + escapeHtmlServer_(namaPenyedia) + ',<br><br><br><br><b>' + escapeHtmlServer_(direkturPenyedia) + '</b><br>Direktur</td>',
    '<td style="width:50%;text-align:center;">PIHAK KESATU<br>Pejabat Pembuat Komitmen,<br><br><br><br><b>' + escapeHtmlServer_(data.PPK) + '</b><br>NIP. ' + escapeHtmlServer_(data.NIP_PPK) + '</td></tr></table>',
    '<div style="page-break-before:always;"></div>', kop,

    '<div style="text-align:center;font-weight:bold;text-decoration:underline;">BERITA ACARA SERAH TERIMA PEKERJAAN</div>',
    '<div style="text-align:center;">Nomor: ' + escapeHtmlServer_(nomorBast) + '</div><br>',
    'Pada hari ini, ' + escapeHtmlServer_(data.TANGGAL_CETAK) + ', kami yang bertanda tangan di bawah ini sepakat melakukan serah terima hasil pekerjaan ' + escapeHtmlServer_(data.NAMA_PAKET) + ':<br><br>',
    '<table style="width:100%;border-collapse:collapse;" border="1" cellpadding="4">',
    '<thead><tr style="font-weight:bold;text-align:center;"><th>No.</th><th>Uraian Pekerjaan/Barang</th><th>Volume</th><th>Satuan</th></tr></thead>',
    '<tbody>' + barisItem + '</tbody></table><br>',
    'PIHAK KEDUA menyerahkan hasil pekerjaan dalam keadaan baik dan prestasi telah mencapai ' + escapeHtmlServer_(opts.persentaseKemajuan) + '%, berdasarkan ' + suratPesananHtml +
    ' dan Berita Acara Pemeriksaan Barang Nomor: ' + escapeHtmlServer_(nomorBap) + '.<br><br>',
    '<table style="width:100%;"><tr><td style="width:50%;text-align:center;">PIHAK KEDUA<br>' + escapeHtmlServer_(namaPenyedia) + ',<br><br><br><br><b>' + escapeHtmlServer_(direkturPenyedia) + '</b><br>Direktur</td>',
    '<td style="width:50%;text-align:center;">PIHAK KESATU<br>Pejabat Pembuat Komitmen,<br><br><br><br><b>' + escapeHtmlServer_(data.PPK) + '</b><br>NIP. ' + escapeHtmlServer_(data.NIP_PPK) + '</td></tr></table>',
    '<div style="page-break-before:always;"></div>', kop,

    '<div style="text-align:center;font-weight:bold;text-decoration:underline;">BERITA ACARA PEMBAYARAN</div>',
    '<div style="text-align:center;">Nomor: ' + escapeHtmlServer_(nomorBayar) + '</div><br>',
    'Pada hari ini, ' + escapeHtmlServer_(data.TANGGAL_CETAK) + ', bertempat di ' + escapeHtmlServer_(data.NAMA_SATKER) + ', para pihak menyatakan:<br><br>',
    '<table style="width:100%;" cellpadding="3">',
    '<tr><td style="width:30%;vertical-align:top;">Paket Pekerjaan</td><td>: ' + escapeHtmlServer_(data.NAMA_PAKET) + '</td></tr>',
    '<tr><td style="vertical-align:top;">Penyedia</td><td>: ' + escapeHtmlServer_(namaPenyedia) + '</td></tr>',
    '<tr><td style="vertical-align:top;">Nilai Kontrak</td><td>: ' + formatRupiahServer_(kontrak) + ' (' + escapeHtmlServer_(terbilangRupiah_(kontrak)) + ')</td></tr>',
    '</table><br>',
    (adaPph ?
      ('Rincian: DPP = ' + formatRupiahServer_(dpp) + ', PPN 11% = ' + formatRupiahServer_(ppn) + '.<br><br>') :
      ('Dibayarkan penuh sebesar nilai kontrak (tidak dipotong PPN).<br><br>')),
    'Pembayaran dilakukan ke rekening ' + escapeHtmlServer_(provider ? (provider.bank || '-') : '-') + ' Nomor ' + escapeHtmlServer_(provider ? (provider.rekening || '-') : '-') + ' atas nama ' + escapeHtmlServer_(namaPenyedia) + '.<br><br><br>',
    '<table style="width:100%;"><tr><td style="width:50%;text-align:center;">Pejabat Pembuat Komitmen,<br><br><br><br><b>' + escapeHtmlServer_(data.PPK) + '</b><br>NIP. ' + escapeHtmlServer_(data.NIP_PPK) + '</td>',
    '<td style="width:50%;text-align:center;">' + escapeHtmlServer_(namaPenyedia) + ',<br><br><br><br><b>' + escapeHtmlServer_(direkturPenyedia) + '</b><br>Direktur</td></tr></table>',
    '</div>'
  ].join('\n');
}