/**
 * SkService.gs
 * Generate SK PPK dan SK Pejabat Pengadaan -- BEDA dari KAK/HPS: SK ini di level
 * SATKER + TAHUN ANGGARAN (bukan per paket), karena satu SK PPK/SK PP berlaku
 * untuk SELURUH paket satker itu di tahun tersebut, ditandatangani KPA. Contoh
 * dokumen yang Anda berikan (SK Penunjukan PPK & Pejabat Pengadaan) jadi acuan
 * struktur template (lihat SEED_TEMPLATE_SK_PPK/SEED_TEMPLATE_SK_PP di Setup.gs).
 *
 * Setelah di-finalize, SK-nya OTOMATIS dipakai untuk memenuhi checklist dokumen
 * "SK PPK"/"SK Pejabat Pengadaan" (Tahap 5) di SEMUA paket aktif satker+tahun
 * itu -- user tidak perlu upload manual satu-satu per paket.
 *
 * Nomor surat & tahun SK SELALU diisi manual (payload.nomorSurat/tahunSk),
 * sama seperti KAK -- sistem tidak pernah menebak nomor SK.
 */

var SkService = {
  handle: function (action, payload, token) {
    switch (action) {
      case 'preview': return this.preview(payload, token);
      case 'finalize': return this.finalize(payload, token);
      case 'history': return this.history(payload, token);
      case 'download': return this.download(payload, token);
      default: throw AppError_('UNKNOWN_ACTION', 'Aksi sk tidak dikenal: ' + action);
    }
  },

  preview: function (payload, token) {
    payload = payload || {};
    var jenis = validateSkJenis_(payload.jenis);
    var ctx = getSkContext_(String(payload.satkerId || ''), String(payload.tahunAnggaranId || ''), token, true);
    var nomorSurat = String(payload.nomorSurat || '');
    var tahunSk = String(payload.tahunSk || ctx.year.tahun || '');
    return { html: buildSkHtml_(ctx, jenis, nomorSurat, tahunSk) };
  },

  finalize: function (payload, token) {
    payload = payload || {};
    var jenis = validateSkJenis_(payload.jenis);
    var ctx = getSkContext_(String(payload.satkerId || ''), String(payload.tahunAnggaranId || ''), token, true);
    var access = requireAccess_(token, { allowRoles: ['ADMIN', 'PENGELOLA'], satkerId: ctx.satker.satker_id, tahunAnggaranId: ctx.tahunAnggaranId });
    var nomorSurat = String(payload.nomorSurat || '');
    var tahunSk = String(payload.tahunSk || ctx.year.tahun || '');
    if (!nomorSurat) throw AppError_('BAD_REQUEST', 'Nomor surat SK wajib diisi.');

    var html = payload.htmlFinal ? String(payload.htmlFinal) : buildSkHtml_(ctx, jenis, nomorSurat, tahunSk);
    var pdfBlob;
    try {
      pdfBlob = Utilities.newBlob(html, MimeType.HTML, jenis + '.html').getAs(MimeType.PDF);
    } catch (e) {
      Logger.log('Konversi HTML->PDF (' + jenis + ') gagal untuk satker ' + ctx.satker.satker_id + ': ' + e);
      throw AppError_('PDF_CONVERSION_FAILED', 'Gagal mengubah dokumen ke PDF. Coba lagi beberapa saat; kalau tetap gagal, gunakan pratinjau lalu cetak dari browser.');
    }

    var namaJenis = jenis === 'SK-PPK' ? 'SK PPK' : 'SK Pejabat Pengadaan';
    var versionBaru = getNextDocVersionSatker_(ctx.satker.satker_id, ctx.tahunAnggaranId, jenis);
    var namaFile = namaJenis + ' - ' + ctx.satker.nama_satker + ' ' + tahunSk + ' - v' + versionBaru + '.pdf';
    pdfBlob.setName(namaFile);

    var folder = getOrCreateFolder_(getSatkerSkFolder_(ctx.satker), jenis);
    var file = folder.createFile(pdfBlob);
    var id = nextId_('GEN');
    appendRow_('GENERATED_DOCUMENTS', {
      generated_document_id: id, paket_id: '', satker_id: ctx.satker.satker_id, tahun_anggaran_id: ctx.tahunAnggaranId,
      doc_type: jenis, version: versionBaru, nomor_surat: nomorSurat,
      generated_by: access.session.userId, generated_at: new Date().toISOString(),
      file_id: file.getId(), drive_url: file.getUrl(),
      snapshot_json: JSON.stringify({ nomorSurat: nomorSurat, tahunSk: tahunSk }), change_note: payload.changeNote || '', status: 'ACTIVE'
    });
    logAudit_(access.session.userId, 'GENERATE_' + jenis.replace('-', '_'), 'GENERATED_DOCUMENTS', id,
      'Generate ' + namaJenis + ' v' + versionBaru + ' untuk satker ' + ctx.satker.satker_id + ' TA ' + ctx.tahunAnggaranId);

    // Otomatis melengkapi checklist SK-PPK/SK-PP di SEMUA paket aktif satker+tahun ini.
    var paketTerdampak = readAllRows_('PAKET').rows.filter(function (p) {
      return p.satker_id === ctx.satker.satker_id && p.tahun_anggaran_id === ctx.tahunAnggaranId && p.status_paket !== 'DIBATALKAN';
    });
    paketTerdampak.forEach(function (p) {
      linkGeneratedDocToChecklist_(p, jenis, file, access.session.userId, nomorSurat);
      computePaketCompletion_(p.paket_id);
    });

    return { generatedDocumentId: id, version: versionBaru, fileName: namaFile, jumlahPaketTerdampak: paketTerdampak.length };
  },

  history: function (payload, token) {
    payload = payload || {};
    var ctx = getSkContext_(String(payload.satkerId || ''), String(payload.tahunAnggaranId || ''), token, false);
    var rows = readAllRows_('GENERATED_DOCUMENTS').rows.filter(function (g) {
      return g.satker_id === ctx.satker.satker_id && g.tahun_anggaran_id === ctx.tahunAnggaranId &&
        (g.doc_type === 'SK-PPK' || g.doc_type === 'SK-PP');
    });
    if (payload.jenis) rows = rows.filter(function (g) { return g.doc_type === payload.jenis; });
    return rows.map(function (g) {
      return {
        generated_document_id: g.generated_document_id, doc_type: g.doc_type, version: g.version,
        nomor_surat: g.nomor_surat, generated_at: g.generated_at, generated_by: g.generated_by,
        change_note: g.change_note, status: g.status
      };
    }).sort(function (a, b) { return Number(b.version) - Number(a.version); });
  },

  download: function (payload, token) {
    var gen = findRowByField_('GENERATED_DOCUMENTS', 'generated_document_id', String((payload || {}).generatedDocumentId || ''));
    if (!gen || (gen.doc_type !== 'SK-PPK' && gen.doc_type !== 'SK-PP')) throw AppError_('NOT_FOUND', 'Dokumen SK tidak ditemukan.');
    requireAccess_(token, { satkerId: gen.satker_id, tahunAnggaranId: gen.tahun_anggaran_id });
    var file = DriveApp.getFileById(gen.file_id);
    var blob = file.getBlob();
    return { fileName: file.getName(), mimeType: blob.getContentType(), fileBase64: Utilities.base64Encode(blob.getBytes()) };
  }
};

function validateSkJenis_(jenis) {
  if (jenis !== 'SK-PPK' && jenis !== 'SK-PP') throw AppError_('BAD_REQUEST', 'jenis harus SK-PPK atau SK-PP.');
  return jenis;
}

function getSkContext_(satkerId, tahunAnggaranId, token, requireWrite) {
  if (!satkerId || !tahunAnggaranId) throw AppError_('BAD_REQUEST', 'satkerId dan tahunAnggaranId wajib diisi.');
  var satker = findRowByField_('SATKER', 'satker_id', satkerId);
  if (!satker) throw AppError_('NOT_FOUND', 'Satker tidak ditemukan.');
  if (requireWrite) {
    requireAccess_(token, { allowRoles: ['ADMIN', 'PENGELOLA'], satkerId: satkerId, tahunAnggaranId: tahunAnggaranId });
  } else {
    requireAccess_(token, { satkerId: satkerId, tahunAnggaranId: tahunAnggaranId });
  }
  var year = findRowByField_('YEARS', 'tahun_anggaran_id', tahunAnggaranId) || {};
  var satkerTahun = null;
  var rows = readAllRows_('SATKER_TAHUN').rows;
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].satker_id === satkerId && rows[i].tahun_anggaran_id === tahunAnggaranId) { satkerTahun = rows[i]; break; }
  }
  return { satker: satker, year: year, satkerTahun: satkerTahun || {}, tahunAnggaranId: tahunAnggaranId };
}

/**
 * Cari data pangkat/golongan + jabatan struktural dari master PEJABAT dengan
 * mencocokkan NIP -- SATKER_TAHUN hanya simpan nama+NIP, dua field tambahan ini
 * (dibutuhkan format SK) diambil dari PEJABAT kalau orangnya ada di master itu.
 * Kalau tidak ketemu (mis. belum didaftarkan di menu Data Pejabat), dikosongkan
 * saja -- user tetap bisa mengisinya manual di pratinjau (contenteditable)
 * sebelum Generate & Simpan PDF.
 */
function cariPangkatJabatanByNip_(nip) {
  if (!nip) return { pangkatGolongan: '', jabatan: '' };
  var p = findRowByField_('PEJABAT', 'nip', nip);
  return p ? { pangkatGolongan: p.pangkat_golongan || '', jabatan: p.jabatan || '' } : { pangkatGolongan: '', jabatan: '' };
}

function buildSkHtml_(ctx, jenis, nomorSurat, tahunSk) {
  var template = findApplicableTemplate_('', jenis);
  if (!template) {
    throw AppError_('NOT_FOUND', 'Template ' + jenis + ' belum tersedia. Jalankan initializeDatabase() ulang untuk mengisi template default, atau buat lewat menu Templates.');
  }

  var st = ctx.satkerTahun;
  var namaAppointee = jenis === 'SK-PPK' ? st.ppk_nama : st.pejabat_pengadaan_nama;
  var nipAppointee = jenis === 'SK-PPK' ? st.ppk_nip : st.pejabat_pengadaan_nip;
  var tambahan = cariPangkatJabatanByNip_(nipAppointee);

  var data = {
    KOP_SURAT: buildKopSurat_(ctx.satker),
    NAMA_SATKER: ctx.satker.nama_satker || '',
    NAMA_SATKER_UPPER: (ctx.satker.nama_satker || '').toUpperCase(),
    TAHUN_ANGGARAN: ctx.year.tahun ? String(ctx.year.tahun) : '',
    TAHUN_SK: tahunSk || '',
    NOMOR_SURAT: nomorSurat || '',
    SP_DIPA: st.sp_dipa || '',
    TANGGAL_DIPA: formatTanggalIndonesia_(st.tanggal_dipa),
    KPA: st.kpa_nama || '',
    NIP_KPA: st.kpa_nip || '',
    TANGGAL_CETAK: formatTanggalIndonesia_(new Date())
  };
  if (jenis === 'SK-PPK') {
    data.NAMA_PPK = namaAppointee || '';
    data.NIP_PPK = nipAppointee || '';
    data.PANGKAT_GOLONGAN_PPK = tambahan.pangkatGolongan;
    data.JABATAN_PPK = tambahan.jabatan;
  } else {
    data.NAMA_PP = namaAppointee || '';
    data.NIP_PP = nipAppointee || '';
    data.PANGKAT_GOLONGAN_PP = tambahan.pangkatGolongan;
    data.JABATAN_PP = tambahan.jabatan;
  }

  var html = renderTemplate_(template.html_template, data);
  if (html.indexOf(data.KOP_SURAT) === -1) html = data.KOP_SURAT + html;
  return html;
}

function getNextDocVersionSatker_(satkerId, tahunAnggaranId, docType) {
  var rows = readAllRows_('GENERATED_DOCUMENTS').rows.filter(function (g) {
    return g.satker_id === satkerId && g.tahun_anggaran_id === tahunAnggaranId && g.doc_type === docType;
  });
  var maxVersion = 0;
  rows.forEach(function (g) { var v = Number(g.version) || 0; if (v > maxVersion) maxVersion = v; });
  return maxVersion + 1;
}

function getSatkerSkFolder_(satker) {
  var root = DriveApp.getFolderById(getRootDriveFolderId_());
  var satkerFolder = getOrCreateFolder_(root, satker.nama_satker || satker.satker_id);
  return getOrCreateFolder_(satkerFolder, 'SK');
}