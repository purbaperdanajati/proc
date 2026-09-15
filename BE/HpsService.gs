/**
 * HpsService.gs
 * Penyimpanan item HPS + generate dokumen HPS. Mengikuti prinsip Ponari:
 * "jumlah SELALU dihitung ulang di server (volume x harga_satuan), nilai hasil
 * paste/rumus dari Excel tidak pernah dipercaya" -- lihat Bagian I dokumen desain.
 *
 * Menyusun tabel HPS-nya memakai helper yang sama dengan KAK (Tahap 6):
 * buildDocumentData_, renderTemplate_, getNextDocVersion_, dst di KakService.gs.
 */

var HpsService = {
  handle: function (action, payload, token) {
    switch (action) {
      case 'get': return this.get(payload, token);
      case 'save': return this.save(payload, token);
      case 'preview': return this.preview(payload, token);
      case 'finalize': return this.finalize(payload, token);
      case 'history': return this.history(payload, token);
      case 'download': return this.download(payload, token);
      default: throw AppError_('UNKNOWN_ACTION', 'Aksi hps tidak dikenal: ' + action);
    }
  },

  get: function (payload, token) {
    var paket = getPaketForDocGen_(String((payload || {}).paketId || ''), token, false);
    var items = readAllRows_('HPS_ITEMS').rows
      .filter(function (i) { return i.paket_id === paket.paket_id; })
      .sort(function (a, b) { return (Number(a.row_index) || 0) - (Number(b.row_index) || 0); });
    return { items: items, total: hitungTotalHps_(items), nilaiHpsPaket: Number(paket.nilai_hps) || 0, paguPaket: Number(paket.pagu_snapshot) || 0 };
  },

  /**
   * Mengganti SELURUH item HPS paket ini dengan yang dikirim klien (grid
   * dikirim utuh, bukan per-baris) -- lebih sederhana dan menghindari
   * kebingungan sinkronisasi baris yang dihapus/ditambah di grid.
   */
  save: function (payload, token) {
    payload = payload || {};
    var paket = getPaketForDocGen_(String(payload.paketId || ''), token, true);
    var access = requireAccess_(token, { allowRoles: ['ADMIN', 'PENGELOLA'], satkerId: paket.satker_id, tahunAnggaranId: paket.tahun_anggaran_id });

    var itemsMasuk = payload.items;
    if (!itemsMasuk || Object.prototype.toString.call(itemsMasuk) !== '[object Array]') {
      throw AppError_('BAD_REQUEST', 'Data item HPS tidak valid.');
    }
    if (itemsMasuk.length > 500) {
      throw AppError_('BAD_REQUEST', 'Jumlah baris HPS terlalu banyak (maksimal 500 baris).');
    }

    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      hapusItemHpsPaket_(paket.paket_id);

      var now = new Date().toISOString();
      var itemsBersih = [];
      itemsMasuk.forEach(function (item, index) {
        var nama = String(item.nama || '').trim();
        var spesifikasi = String(item.spesifikasi || '').trim();
        // Baris yang benar-benar kosong (hasil grid kosong) dilewati, bukan disimpan.
        if (!nama && !spesifikasi) return;

        var volume = Number(item.volume) || 0;
        var hargaSatuan = Number(item.hargaSatuan) || 0;
        if (volume < 0 || hargaSatuan < 0) {
          throw AppError_('BAD_REQUEST', 'Volume dan harga satuan tidak boleh negatif (baris ' + (index + 1) + ').');
        }
        // INI INTINYA: jumlah dihitung server, apa pun yang dikirim klien diabaikan.
        var jumlah = volume * hargaSatuan;

        var bersih = {
          hps_item_id: nextId_('HPS'), paket_id: paket.paket_id,
          row_index: itemsBersih.length + 1, col_index: '', value: '',
          rowspan: Number(item.rowspan) || 1, colspan: Number(item.colspan) || 1,
          no_urut: itemsBersih.length + 1, nama: nama, spesifikasi: spesifikasi,
          volume: volume, satuan: String(item.satuan || '').trim(),
          harga_satuan: hargaSatuan, jumlah: jumlah,
          created_at: now, updated_at: now
        };
        itemsBersih.push(bersih);
        appendRow_('HPS_ITEMS', bersih);
      });

      var total = hitungTotalHps_(itemsBersih);
      updateRowByField_('PAKET', 'paket_id', paket.paket_id, { nilai_hps: total, updated_at: now, updated_by: access.session.userId });
      computePaketCompletion_(paket.paket_id);
      logAudit_(access.session.userId, 'SAVE_HPS', 'HPS_ITEMS', paket.paket_id,
        'Menyimpan ' + itemsBersih.length + ' item HPS, total ' + formatRupiahServer_(total));

      return {
        jumlahItem: itemsBersih.length,
        total: total,
        melebihiPagu: total > (Number(paket.pagu_snapshot) || 0)
      };
    } finally {
      lock.releaseLock();
    }
  },

  preview: function (payload, token) {
    var paket = getPaketForDocGen_(String((payload || {}).paketId || ''), token, false);
    return { html: buildHpsHtml_(paket) };
  },

  finalize: function (payload, token) {
    payload = payload || {};
    var paket = getPaketForDocGen_(String(payload.paketId || ''), token, true);
    var access = requireAccess_(token, { allowRoles: ['ADMIN', 'PENGELOLA'], satkerId: paket.satker_id, tahunAnggaranId: paket.tahun_anggaran_id });

    var html = payload.htmlFinal ? String(payload.htmlFinal) : buildHpsHtml_(paket);
    var pdfBlob;
    try {
      pdfBlob = Utilities.newBlob(html, MimeType.HTML, 'HPS.html').getAs(MimeType.PDF);
    } catch (e) {
      Logger.log('Konversi HTML->PDF (HPS) gagal untuk paket ' + paket.paket_id + ': ' + e);
      throw AppError_('PDF_CONVERSION_FAILED', 'Gagal mengubah dokumen ke PDF. Coba lagi beberapa saat; kalau tetap gagal, gunakan pratinjau lalu cetak dari browser.');
    }

    var versionBaru = getNextDocVersion_(paket.paket_id, 'HPS');
    var namaFile = 'HPS - ' + (paket.nama_paket || paket.paket_id) + ' - v' + versionBaru + '.pdf';
    pdfBlob.setName(namaFile);

    var file = getPaketDocumentFolder_(paket, 'HPS').createFile(pdfBlob);
    var data = buildDocumentData_(paket);
    var id = nextId_('GEN');
    appendRow_('GENERATED_DOCUMENTS', {
      generated_document_id: id, paket_id: paket.paket_id, doc_type: 'HPS', version: versionBaru,
      generated_by: access.session.userId, generated_at: new Date().toISOString(),
      file_id: file.getId(), drive_url: file.getUrl(),
      snapshot_json: JSON.stringify(data), change_note: payload.changeNote || '', status: 'ACTIVE'
    });

    logAudit_(access.session.userId, 'GENERATE_HPS', 'GENERATED_DOCUMENTS', id,
      'Generate HPS v' + versionBaru + ' untuk paket ' + paket.paket_id);

    linkGeneratedDocToChecklist_(paket, 'HPS', file, access.session.userId);
    computePaketCompletion_(paket.paket_id);

    return { generatedDocumentId: id, version: versionBaru, fileName: namaFile };
  },

  history: function (payload, token) {
    var paket = getPaketForDocGen_(String((payload || {}).paketId || ''), token, false);
    return readAllRows_('GENERATED_DOCUMENTS').rows
      .filter(function (g) { return g.paket_id === paket.paket_id && g.doc_type === 'HPS'; })
      .map(function (g) {
        return {
          generated_document_id: g.generated_document_id, version: g.version,
          generated_at: g.generated_at, generated_by: g.generated_by,
          change_note: g.change_note, status: g.status
        };
      })
      .sort(function (a, b) { return Number(b.version) - Number(a.version); });
  },

  download: function (payload, token) {
    var gen = findRowByField_('GENERATED_DOCUMENTS', 'generated_document_id', String((payload || {}).generatedDocumentId || ''));
    if (!gen) throw AppError_('NOT_FOUND', 'Dokumen hasil generate tidak ditemukan.');
    getPaketForDocGen_(gen.paket_id, token, false);
    var file = DriveApp.getFileById(gen.file_id);
    var blob = file.getBlob();
    return { fileName: file.getName(), mimeType: blob.getContentType(), fileBase64: Utilities.base64Encode(blob.getBytes()) };
  }
};

function hitungTotalHps_(items) {
  var total = 0;
  items.forEach(function (i) { total += Number(i.jumlah) || 0; });
  return total;
}

function hapusItemHpsPaket_(paketId) {
  var sheet = getSheet_('HPS_ITEMS');
  var values = sheet.getDataRange().getValues();
  var headers = values[0];
  var kolomPaket = headers.indexOf('paket_id');
  if (kolomPaket === -1) return;
  // Dihapus dari bawah ke atas supaya nomor baris di atasnya tidak bergeser
  // saat penghapusan sedang berjalan.
  for (var r = values.length - 1; r >= 1; r--) {
    if (values[r][kolomPaket] === paketId) sheet.deleteRow(r + 1);
  }
}

/**
 * Menyusun HTML dokumen HPS: kop + judul + tabel item + JUMLAH + blok tanda
 * tangan PPK, mengikuti struktur dokumen contoh yang Anda berikan.
 * Tabel disusun terprogram (jumlah baris mengikuti item), berbeda dari KAK
 * yang teksnya relatif tetap -- karena itu tidak memakai template TEMPLATES.
 */
function buildHpsHtml_(paket) {
  var data = buildDocumentData_(paket);
  var items = readAllRows_('HPS_ITEMS').rows
    .filter(function (i) { return i.paket_id === paket.paket_id; })
    .sort(function (a, b) { return (Number(a.row_index) || 0) - (Number(b.row_index) || 0); });

  var baris = items.map(function (i, idx) {
    return '<tr>' +
      '<td style="text-align:center;">' + (idx + 1) + '</td>' +
      '<td>' + escapeHtmlServer_(i.nama) + '</td>' +
      '<td style="font-size:9pt;">' + escapeHtmlServer_(i.spesifikasi) + '</td>' +
      '<td style="text-align:center;">' + escapeHtmlServer_(i.volume) + '</td>' +
      '<td style="text-align:center;">' + escapeHtmlServer_(i.satuan) + '</td>' +
      '<td style="text-align:right;">' + formatRupiahServer_(i.harga_satuan).replace(',-', '') + '</td>' +
      '<td style="text-align:right;">' + formatRupiahServer_(i.jumlah).replace(',-', '') + '</td>' +
      '</tr>';
  }).join('');

  var total = hitungTotalHps_(items);

  return [
    '<div style="font-family:Arial,sans-serif;font-size:11pt;">',
    '<div style="text-align:center;font-weight:bold;border-bottom:2px solid #000;padding-bottom:6px;">',
    'KEMENTERIAN AGAMA REPUBLIK INDONESIA<br>',
    'KANTOR KEMENTERIAN AGAMA KABUPATEN INDRAMAYU<br>',
    escapeHtmlServer_(data.NAMA_SATKER).toUpperCase(),
    '<div style="font-weight:normal;font-size:9pt;">Alamat: ' + escapeHtmlServer_(data.ALAMAT_SATKER) + '</div>',
    '</div><br>',
    '<div style="text-align:center;font-weight:bold;">HARGA PERKIRAAN SENDIRI (HPS)<br>',
    escapeHtmlServer_(data.NAMA_PAKET) + '</div><br>',
    '<table style="width:100%;border-collapse:collapse;" border="1" cellpadding="4">',
    '<thead><tr style="font-weight:bold;text-align:center;">',
    '<th>NO.</th><th>NAMA</th><th>SPESIFIKASI</th><th>VOL</th><th>SATUAN</th><th>HARGA SATUAN</th><th>JUMLAH</th>',
    '</tr></thead><tbody>',
    baris || '<tr><td colspan="7" style="text-align:center;">(belum ada item HPS)</td></tr>',
    '<tr style="font-weight:bold;"><td colspan="6" style="text-align:left;">JUMLAH</td>',
    '<td style="text-align:right;">' + formatRupiahServer_(total) + '</td></tr>',
    '</tbody></table><br>',
    '<div style="font-size:10pt;"><i>Terbilang: ' + escapeHtmlServer_(terbilangRupiah_(total)) + '</i></div><br><br>',
    '<table style="width:100%;"><tr><td style="width:60%;"></td><td style="text-align:left;">',
    'Indramayu, ' + escapeHtmlServer_(data.TANGGAL_CETAK) + '<br>Pejabat Pembuat Komitmen,<br><br><br><br>',
    '<b>' + escapeHtmlServer_(data.PPK) + '</b><br>NIP. ' + escapeHtmlServer_(data.NIP_PPK),
    '</td></tr></table></div>'
  ].join('\n');
}