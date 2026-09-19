/**
 * KakService.gs
 * Generate & finalize KAK (Tahap 6), mengikuti Bagian H dokumen desain +
 * Keputusan 2 (Opsi B -- template HTML, bukan Google Docs):
 *   1) preview()  -> ambil TEMPLATES.html_template yang cocok, isi placeholder
 *      {{...}} dari data paket/satker/pagu terkini, kirim HTML untuk pratinjau
 *      (dan sertakan info "perlu regenerasi" -- Bagian H poin 5).
 *   2) finalize() -> kunci versi itu jadi PDF, naikkan nomor versi, tulis baris
 *      GENERATED_DOCUMENTS berikut snapshot_json, lalu otomatis memenuhi
 *      checklist dokumen "KAK" (Tahap 5) lewat linkGeneratedDocToChecklist_.
 *
 * File ini juga menampung HELPER BERSAMA yang dipakai HpsService.gs (lihat
 * komentar di kepala HpsService.gs): buildDocumentData_, renderTemplate_,
 * getNextDocVersion_, linkGeneratedDocToChecklist_, escapeHtmlServer_,
 * formatRupiahServer_, terbilangRupiah_, getPaketForDocGen_ -- disatukan di
 * sini (bukan didup di dua file) supaya KAK dan HPS selalu memakai definisi
 * "data dokumen" dan "cara format" yang sama persis, sesuai Bagian H/I
 * dokumen desain yang eksplisit bilang HPS "mengikuti pola sama seperti KAK".
 *
 * PDF: sama seperti HpsService.gs, memakai Utilities.newBlob(html,
 * MimeType.HTML, ...).getAs(MimeType.PDF) -- rendering dasar saja (lihat
 * batasan #1 di README.md Bagian G), bukan DocumentApp manual.
 */

var KakService = {
  handle: function (action, payload, token) {
    switch (action) {
      case 'preview': return this.preview(payload, token);
      case 'finalize': return this.finalize(payload, token);
      case 'history': return this.history(payload, token);
      case 'download': return this.download(payload, token);
      default: throw AppError_('UNKNOWN_ACTION', 'Aksi kak tidak dikenal: ' + action);
    }
  },

  /**
   * Generate (draft): render template + hitung "perluRegenerasi" (Bagian H
   * poin 5) dengan membandingkan data live terhadap snapshot_json versi KAK
   * ACTIVE terakhir. Bukan blokir -- hanya info untuk banner "Peringatan
   * administratif" di klien (lihat renderKakSection di app.js).
   * Sengaja dibatasi ADMIN/PENGELOLA sama seperti finalize (Bagian E: "Generate/
   * Finalize KAK & HPS" -- Viewer tidak boleh, meski satkernya sendiri).
   */
  preview: function (payload, token) {
    payload = payload || {};
    var paket = getPaketForDocGen_(String(payload.paketId || ''), token, true);
    var kadaluarsa = hitungKadaluarsaKak_(paket);
    var nomorSurat = payload.nomorSurat !== undefined ? String(payload.nomorSurat || '') : nomorSuratTerakhir_(paket.paket_id, 'KAK');
    return { html: buildKakHtml_(paket, nomorSurat), perluRegenerasi: kadaluarsa, nomorSurat: nomorSurat };
  },

  finalize: function (payload, token) {
    payload = payload || {};
    var paket = getPaketForDocGen_(String(payload.paketId || ''), token, true);
    var access = requireAccess_(token, { allowRoles: ['ADMIN', 'PENGELOLA'], satkerId: paket.satker_id, tahunAnggaranId: paket.tahun_anggaran_id });
    var nomorSurat = String(payload.nomorSurat || '');

    // htmlFinal dari klien = hasil sunting ringan contenteditable di layar
    // (Bagian H poin 3) -- kalau tidak dikirim, generate ulang dari template.
    var html = payload.htmlFinal ? String(payload.htmlFinal) : buildKakHtml_(paket, nomorSurat);
    var pdfBlob;
    try {
      pdfBlob = Utilities.newBlob(html, MimeType.HTML, 'KAK.html').getAs(MimeType.PDF);
    } catch (e) {
      Logger.log('Konversi HTML->PDF (KAK) gagal untuk paket ' + paket.paket_id + ': ' + e);
      throw AppError_('PDF_CONVERSION_FAILED', 'Gagal mengubah dokumen ke PDF. Coba lagi beberapa saat; kalau tetap gagal, gunakan pratinjau lalu cetak dari browser.');
    }

    var versionBaru = getNextDocVersion_(paket.paket_id, 'KAK');
    var namaFile = 'KAK - ' + (paket.nama_paket || paket.paket_id) + ' - v' + versionBaru + '.pdf';
    pdfBlob.setName(namaFile);

    var file = getPaketDocumentFolder_(paket, 'KAK').createFile(pdfBlob);
    var data = buildDocumentData_(paket, nomorSurat);
    var id = nextId_('GEN');
    appendRow_('GENERATED_DOCUMENTS', {
      generated_document_id: id, paket_id: paket.paket_id, doc_type: 'KAK', version: versionBaru, nomor_surat: nomorSurat,
      generated_by: access.session.userId, generated_at: new Date().toISOString(),
      file_id: file.getId(), drive_url: file.getUrl(),
      snapshot_json: JSON.stringify(data), change_note: payload.changeNote || '', status: 'ACTIVE'
    });

    logAudit_(access.session.userId, 'GENERATE_KAK', 'GENERATED_DOCUMENTS', id,
      'Generate KAK v' + versionBaru + ' untuk paket ' + paket.paket_id);

    linkGeneratedDocToChecklist_(paket, 'KAK', file, access.session.userId);
    computePaketCompletion_(paket.paket_id);

    return { generatedDocumentId: id, version: versionBaru, fileName: namaFile };
  },

  history: function (payload, token) {
    var paket = getPaketForDocGen_(String((payload || {}).paketId || ''), token, false);
    return readAllRows_('GENERATED_DOCUMENTS').rows
      .filter(function (g) { return g.paket_id === paket.paket_id && g.doc_type === 'KAK'; })
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
    if (!gen || gen.doc_type !== 'KAK') throw AppError_('NOT_FOUND', 'Dokumen KAK tidak ditemukan.');
    getPaketForDocGen_(gen.paket_id, token, false);
    var file = DriveApp.getFileById(gen.file_id);
    var blob = file.getBlob();
    return { fileName: file.getName(), mimeType: blob.getContentType(), fileBase64: Utilities.base64Encode(blob.getBytes()) };
  }
};

function buildKakHtml_(paket, nomorSurat) {
  var template = findApplicableTemplate_(paket.jenis_pengadaan_id, 'KAK');
  if (!template) {
    throw AppError_('NOT_FOUND', 'Template KAK belum tersedia untuk jenis pengadaan ini. Hubungi admin untuk membuat/mengaktifkan template (menu Templates), atau jalankan initializeDatabase() ulang untuk mengisi template umum default.');
  }
  var data = buildDocumentData_(paket, nomorSurat);
  var html = renderTemplate_(template.html_template, data);
  // BUG FIX (kop surat KAK hilang): kalau template yang dipakai belum punya
  // placeholder {{KOP_SURAT}} (mis. template lama yang sudah kadung disimpan
  // admin SEBELUM perbaikan ini), letterhead-nya ditempel otomatis di paling
  // atas -- supaya kop surat Kemenag + Satker tetap tampil apa pun isi
  // template-nya, bukan bergantung admin mengedit ulang template secara manual.
  if (html.indexOf(data.KOP_SURAT) === -1) {
    html = data.KOP_SURAT + html;
  }
  return html;
}

// Nomor surat KAK versi terakhir yang di-finalize -- dipakai sebagai nilai awal
// kolom "Nomor Surat" saat preview dibuka lagi (bukan blokir, cuma kemudahan;
// user tetap bisa mengubahnya sebelum finalize ulang).
function nomorSuratTerakhir_(paketId, docType) {
  var docs = readAllRows_('GENERATED_DOCUMENTS').rows
    .filter(function (g) { return g.paket_id === paketId && g.doc_type === docType && g.status === 'ACTIVE'; })
    .sort(function (a, b) { return Number(b.version) - Number(a.version); });
  return docs.length > 0 ? String(docs[0].nomor_surat || '') : '';
}

/**
 * Bandingkan field "legal-relevan" (pejabat, sumber dana, pagu, metode/jenis
 * kontrak, nomor & tanggal DIPA) pada data live terhadap snapshot_json versi
 * KAK ACTIVE terakhir. TANGGAL_CETAK sengaja TIDAK ikut dibandingkan karena
 * selalu beda tiap kali buildDocumentData_ dipanggil (bukan indikasi data
 * "berubah"). Ini murni banner administratif (Bagian H poin 5) -- tidak
 * pernah memblokir apa pun.
 */
function hitungKadaluarsaKak_(paket) {
  var docs = readAllRows_('GENERATED_DOCUMENTS').rows
    .filter(function (g) { return g.paket_id === paket.paket_id && g.doc_type === 'KAK' && g.status === 'ACTIVE'; })
    .sort(function (a, b) { return Number(b.version) - Number(a.version); });
  if (docs.length === 0) return { perlu: false, versiTerakhir: null, alasan: [] };

  var latest = docs[0];
  var snapshotLama = {};
  try { snapshotLama = JSON.parse(latest.snapshot_json || '{}'); } catch (e) { snapshotLama = {}; }
  var dataSekarang = buildDocumentData_(paket);

  var labelField = {
    PPK: 'PPK', NIP_PPK: 'NIP PPK', KPA: 'KPA', PEJABAT_PENGADAAN: 'Pejabat Pengadaan',
    SUMBER_DANA: 'Sumber Dana', PAGU: 'Pagu', JENIS_KONTRAK: 'Jenis Kontrak',
    METODE_PENGADAAN: 'Metode Pengadaan', SP_DIPA: 'Nomor DIPA', TANGGAL_DIPA: 'Tanggal DIPA'
  };
  var alasan = [];
  Object.keys(labelField).forEach(function (f) {
    if (String(snapshotLama[f] || '') !== String(dataSekarang[f] || '')) alasan.push(labelField[f]);
  });

  return { perlu: alasan.length > 0, versiTerakhir: Number(latest.version), alasan: alasan };
}

// ===================== HELPER BERSAMA KAK + HPS =====================

/**
 * Ambil paket + validasi akses sekaligus, dipakai KakService & HpsService.
 * requireWrite=true -> hanya ADMIN/PENGELOLA (aksi "Generate/Finalize", Bagian
 * E). requireWrite=false -> semua role yang punya akses ke satker paket ini
 * (Lihat/unduh).
 */
function getPaketForDocGen_(paketId, token, requireWrite) {
  if (!paketId) throw AppError_('BAD_REQUEST', 'paketId wajib diisi.');
  var paket = findRowByField_('PAKET', 'paket_id', paketId);
  if (!paket) throw AppError_('NOT_FOUND', 'Paket tidak ditemukan.');
  if (requireWrite) {
    requireAccess_(token, { allowRoles: ['ADMIN', 'PENGELOLA'], satkerId: paket.satker_id, tahunAnggaranId: paket.tahun_anggaran_id });
  } else {
    requireAccess_(token, { satkerId: paket.satker_id, tahunAnggaranId: paket.tahun_anggaran_id });
  }
  return paket;
}

/**
 * Kumpulan nilai untuk mengisi placeholder {{...}} template KAK/HPS, dirangkai
 * dari PAKET + SATKER + SATKER_TAHUN + YEARS + JENIS_PENGADAAN + PROVIDERS
 * (Bagian H poin 1 dokumen desain). Nama field-nya SENGAJA UPPERCASE_SNAKE
 * supaya cocok 1:1 dengan nama placeholder di TEMPLATES.html_template.
 * ppk_nama/pp_nama/kpa_nama di PAKET (snapshot saat paket dibuat) diprioritaskan
 * dari SATKER_TAHUN (data terkini) -- ini sekaligus dasar deteksi kadaluarsa.
 */
function buildDocumentData_(paket, nomorSurat) {
  var satker = findRowByField_('SATKER', 'satker_id', paket.satker_id) || {};
  var year = findRowByField_('YEARS', 'tahun_anggaran_id', paket.tahun_anggaran_id) || {};
  var jenis = findRowByField_('JENIS_PENGADAAN', 'jenis_pengadaan_id', paket.jenis_pengadaan_id) || {};

  var satkerTahun = null;
  var stRows = readAllRows_('SATKER_TAHUN').rows;
  for (var i = 0; i < stRows.length; i++) {
    if (stRows[i].satker_id === paket.satker_id && stRows[i].tahun_anggaran_id === paket.tahun_anggaran_id) {
      satkerTahun = stRows[i];
      break;
    }
  }
  satkerTahun = satkerTahun || {};

  var provider = paket.penyedia_id ? findRowByField_('PROVIDERS', 'penyedia_id', paket.penyedia_id) : null;
  var paguAngka = Number(paket.pagu_snapshot) || 0;

  return {
    NAMA_SATKER: satker.nama_satker || '',
    ALAMAT_SATKER: satker.alamat || '',
    WEBSITE_SATKER: satker.website || '',
    EMAIL_SATKER: satker.email || '',
    TELEPON_SATKER: satker.telepon || '',
    KODEPOS_SATKER: satker.kodepos || '',
    KOP_SURAT: buildKopSurat_(satker),
    NOMOR_SURAT: nomorSurat || '',
    NAMA_PAKET: paket.nama_paket || '',
    JENIS_PENGADAAN: jenis.nama_jenis || '',
    TAHUN_ANGGARAN: year.tahun ? String(year.tahun) : '',
    SP_DIPA: satkerTahun.sp_dipa || '',
    TANGGAL_DIPA: formatTanggalIndonesia_(satkerTahun.tanggal_dipa),
    KPA: paket.kpa_nama || satkerTahun.kpa_nama || '',
    NIP_KPA: paket.kpa_nip || satkerTahun.kpa_nip || '',
    PPK: paket.ppk_nama || satkerTahun.ppk_nama || '',
    NIP_PPK: paket.ppk_nip || satkerTahun.ppk_nip || '',
    PEJABAT_PENGADAAN: paket.pp_nama || satkerTahun.pejabat_pengadaan_nama || '',
    NIP_PEJABAT_PENGADAAN: paket.pp_nip || satkerTahun.pejabat_pengadaan_nip || '',
    SUMBER_DANA: paket.sumber_dana || '',
    PAGU: formatRupiahServer_(paguAngka),
    PAGU_TERBILANG: terbilangRupiah_(paguAngka),
    JENIS_KONTRAK: paket.jenis_kontrak || '',
    JANGKA_WAKTU: hitungJangkaWaktuHari_(paket.tanggal_mulai, paket.tanggal_selesai),
    LOKASI: satker.alamat || satker.wilayah || '',
    METODE_PENGADAAN: paket.metode_pengadaan || '',
    NAMA_PENYEDIA: provider ? provider.nama_perusahaan : '',
    TANGGAL_CETAK: formatTanggalIndonesia_(new Date())
  };
}

/**
 * Ganti {{KEY}} di template dengan data[KEY] (escaped -- lihat Bagian H poin
 * 2: "tetap perlu escape HTML pada nilai pengganti"). Key yang tidak ada di
 * data diganti string kosong, bukan dibiarkan sebagai {{...}} mentah, supaya
 * checklist uji KAK-001 ("tidak ada {{...}} tersisa") selalu lolos.
 */
function renderTemplate_(template, data) {
  return String(template).replace(/\{\{\s*([A-Z0-9_]+)\s*\}\}/g, function (match, key) {
    var value = data.hasOwnProperty(key) ? data[key] : '';
    return escapeHtmlServer_(value);
  });
}

function getNextDocVersion_(paketId, docType) {
  var rows = readAllRows_('GENERATED_DOCUMENTS').rows.filter(function (g) {
    return g.paket_id === paketId && g.doc_type === docType;
  });
  var maxVersion = 0;
  rows.forEach(function (g) {
    var v = Number(g.version) || 0;
    if (v > maxVersion) maxVersion = v;
  });
  return maxVersion + 1;
}

/**
 * Menautkan dokumen hasil generate (file PDF KAK/HPS yang baru dibuat) ke
 * checklist dokumen paket (Tahap 5): dicari MASTER_DOCUMENT_REQUIREMENTS yang
 * kode_dokumen-nya sama dengan docType ('KAK'/'HPS'), lalu ditulis sebagai
 * baris DOCUMENTS baru -- versi lama diarsipkan, persis pola Documents.gs.upload,
 * supaya computePaketCompletion_ bisa langsung mendeteksinya tanpa perlu upload
 * manual terpisah ("KAK final otomatis memenuhi checklist dokumen Tahap 5",
 * README.md Tahap 6). Kalau requirement KAK/HPS memang tidak ada/dinonaktifkan
 * admin, fungsi ini diam saja -- dokumen tetap tersimpan sah di GENERATED_DOCUMENTS,
 * cuma tidak ikut menandai checklist.
 */
function linkGeneratedDocToChecklist_(paket, docType, file, userId) {
  var requirement = readAllRows_('MASTER_DOCUMENT_REQUIREMENTS').rows.filter(function (r) {
    return r.status === 'AKTIF' && r.kode_dokumen === docType &&
      (!r.jenis_pengadaan_id || r.jenis_pengadaan_id === paket.jenis_pengadaan_id);
  })[0];
  if (!requirement) return;

  var existingActive = readAllRows_('DOCUMENTS').rows.filter(function (d) {
    return d.paket_id === paket.paket_id && d.document_requirement_id === requirement.document_requirement_id && d.status === 'ACTIVE';
  });
  var previousDoc = existingActive.length > 0 ? existingActive[0] : null;

  if (previousDoc) {
    try {
      var oldFile = DriveApp.getFileById(previousDoc.drive_file_id);
      oldFile.moveTo(getOrCreateFolder_(getPaketDocumentFolder_(paket, requirement.nama_dokumen), '_ARCHIVE'));
    } catch (e) {
      Logger.log('Tidak bisa mengarsipkan dokumen checklist lama (' + docType + ') untuk paket ' + paket.paket_id + ': ' + e);
    }
    updateRowByField_('DOCUMENTS', 'document_id', previousDoc.document_id, { status: 'ARCHIVED' });
  }

  var id = nextId_('DOC');
  var now = new Date().toISOString();
  var newVersion = previousDoc ? (Number(previousDoc.version) || 1) + 1 : 1;
  appendRow_('DOCUMENTS', {
    document_id: id, paket_id: paket.paket_id, document_requirement_id: requirement.document_requirement_id,
    file_name: file.getName(), drive_file_id: file.getId(), drive_url: file.getUrl(),
    mime_type: 'application/pdf', file_size: file.getSize(),
    uploaded_by: userId, uploaded_at: now, version: newVersion,
    previous_version_document_id: previousDoc ? previousDoc.document_id : '', status: 'ACTIVE'
  });
}

// ===================== FORMAT & ESCAPE (server-side) =====================

// Selalu escape nilai yang berasal dari data (Sheet/user) sebelum disisipkan ke
// HTML template -- padanan server dari escapeHtml() di js/utils.js (frontend),
// sesuai Bagian H poin 2 & Risiko Keamanan #5 dokumen desain.
// ===================== KOP SURAT (letterhead) =====================
// Dipakai lewat placeholder {{KOP_SURAT}} di template, ATAU ditempel otomatis
// di buildKakHtml_ kalau template belum memuat placeholder itu (lihat komentar
// di buildKakHtml_). Kontak (website/email/telepon/kodepos) baru tampil kalau
// diisi di data Satker -- baris kontak dilewati sepenuhnya kalau semuanya kosong.
function buildKopSurat_(satker) {
  var kontak = [];
  if (satker.telepon) kontak.push('Telp. ' + escapeHtmlServer_(satker.telepon));
  if (satker.email) kontak.push('Email: ' + escapeHtmlServer_(satker.email));
  if (satker.website) kontak.push('Website: ' + escapeHtmlServer_(satker.website));
  var alamatLengkap = (satker.alamat || '') + (satker.kodepos ? ' ' + satker.kodepos : '');

  return [
    '<div style="text-align:center;border-bottom:3px double #000;padding-bottom:8px;margin-bottom:14px;">',
    '<div style="font-weight:bold;font-size:13pt;">KEMENTERIAN AGAMA REPUBLIK INDONESIA</div>',
    '<div style="font-weight:bold;font-size:12pt;">KANTOR KEMENTERIAN AGAMA KABUPATEN INDRAMAYU</div>',
    '<div style="font-weight:bold;font-size:12pt;">' + escapeHtmlServer_((satker.nama_satker || '').toUpperCase()) + '</div>',
    (alamatLengkap.trim() ? '<div style="font-size:9pt;">' + escapeHtmlServer_(alamatLengkap.trim()) + '</div>' : ''),
    (kontak.length > 0 ? '<div style="font-size:9pt;">' + kontak.join(' &bull; ') + '</div>' : ''),
    '</div>'
  ].join('\n');
}

function escapeHtmlServer_(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatRupiahServer_(number) {
  var n = Math.round(Number(number) || 0);
  var negative = n < 0;
  n = Math.abs(n);
  var str = String(n);
  var formatted = '';
  var count = 0;
  for (var i = str.length - 1; i >= 0; i--) {
    formatted = str.charAt(i) + formatted;
    count++;
    if (count % 3 === 0 && i !== 0) formatted = '.' + formatted;
  }
  return (negative ? '-' : '') + 'Rp' + formatted + ',-';
}

var NAMA_BULAN_INDONESIA_ = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

function formatTanggalIndonesia_(dateInput) {
  if (!dateInput) return '';
  var d = (dateInput instanceof Date) ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);
  return d.getDate() + ' ' + NAMA_BULAN_INDONESIA_[d.getMonth()] + ' ' + d.getFullYear();
}

// "30 (tiga puluh) hari kalender" -- dipakai placeholder {{JANGKA_WAKTU}}.
// Dihitung inklusif tanggal mulai (selisih hari + 1), minimal 1 hari.
function hitungJangkaWaktuHari_(tanggalMulai, tanggalSelesai) {
  if (!tanggalMulai || !tanggalSelesai) return '';
  var mulai = new Date(tanggalMulai);
  var selesai = new Date(tanggalSelesai);
  if (isNaN(mulai.getTime()) || isNaN(selesai.getTime())) return '';
  var hari = Math.round((selesai.getTime() - mulai.getTime()) / 86400000) + 1;
  if (hari < 1) hari = 1;
  return hari + ' (' + terbilangAngka_(hari) + ') hari kalender';
}

// ===================== TERBILANG (angka -> teks Indonesia) =====================
// Dipakai {{PAGU_TERBILANG}} (KAK) dan "Terbilang: ..." di dokumen HPS
// (buildHpsHtml_, HpsService.gs) -- serta hitungJangkaWaktuHari_ di atas.

function terbilangAngka_(n) {
  n = Math.floor(Math.abs(Number(n) || 0));
  var satuan = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh',
    'sebelas', 'dua belas', 'tiga belas', 'empat belas', 'lima belas', 'enam belas', 'tujuh belas', 'delapan belas', 'sembilan belas'];

  if (n < 20) return satuan[n];
  if (n < 100) {
    var sisaPuluh = n % 10;
    return satuan[Math.floor(n / 10)] + ' puluh' + (sisaPuluh ? ' ' + satuan[sisaPuluh] : '');
  }
  if (n < 200) return 'seratus' + (n - 100 > 0 ? ' ' + terbilangAngka_(n - 100) : '');
  if (n < 1000) {
    var sisaRatus = n % 100;
    return satuan[Math.floor(n / 100)] + ' ratus' + (sisaRatus ? ' ' + terbilangAngka_(sisaRatus) : '');
  }
  if (n < 2000) return 'seribu' + (n - 1000 > 0 ? ' ' + terbilangAngka_(n - 1000) : '');
  if (n < 1000000) {
    var sisaRibu = n % 1000;
    return terbilangAngka_(Math.floor(n / 1000)) + ' ribu' + (sisaRibu ? ' ' + terbilangAngka_(sisaRibu) : '');
  }
  if (n < 1000000000) {
    var sisaJuta = n % 1000000;
    return terbilangAngka_(Math.floor(n / 1000000)) + ' juta' + (sisaJuta ? ' ' + terbilangAngka_(sisaJuta) : '');
  }
  if (n < 1000000000000) {
    var sisaMiliar = n % 1000000000;
    return terbilangAngka_(Math.floor(n / 1000000000)) + ' miliar' + (sisaMiliar ? ' ' + terbilangAngka_(sisaMiliar) : '');
  }
  var sisaTriliun = n % 1000000000000;
  return terbilangAngka_(Math.floor(n / 1000000000000)) + ' triliun' + (sisaTriliun ? ' ' + terbilangAngka_(sisaTriliun) : '');
}

function terbilangRupiah_(number) {
  var n = Math.round(Number(number) || 0);
  if (n === 0) return 'Nol Rupiah';
  var negative = n < 0;
  var kata = terbilangAngka_(n);
  kata = kata.charAt(0).toUpperCase() + kata.slice(1);
  return (negative ? 'Minus ' : '') + kata + ' Rupiah';
}
