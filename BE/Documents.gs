/**
 * Documents.gs
 * Upload/replace/hapus dokumen paket (versi lama diarsipkan, TIDAK dihapus)
 * dan penghitungan checklist dari MASTER_DOCUMENT_REQUIREMENTS. Dengan ini,
 * computePaketCompletion_ (Paket.gs) baru bisa benar-benar menyatakan
 * COMPLETE, sesuai algoritma penuh Bagian J dokumen desain.
 *
 * "Company Profile" SENGAJA DIKECUALIKAN dari upload per-paket -- statusnya
 * diambil langsung dari data PENYEDIA (Tahap 4), sesuai instruksi awal
 * "jangan upload company profile ulang, sistem mengambil file yang sudah ada".
 */

var DocumentsService = {
  handle: function (action, payload, token) {
    switch (action) {
      case 'getChecklist': return this.getChecklist(payload, token);
      case 'list': return this.list(payload, token);
      case 'upload': return this.upload(payload, token);
      case 'setNomorSurat': return this.setNomorSurat(payload, token);
      case 'delete': return this.deleteDoc(payload, token);
      case 'download': return this.download(payload, token);
      default: throw AppError_('UNKNOWN_ACTION', 'Aksi documents tidak dikenal: ' + action);
    }
  },

  getChecklist: function (payload, token) {
    payload = payload || {};
    var paketId = String(payload.paketId || '');
    if (!paketId) throw AppError_('BAD_REQUEST', 'paketId wajib diisi.');
    var paket = findRowByField_('PAKET', 'paket_id', paketId);
    if (!paket) throw AppError_('NOT_FOUND', 'Paket tidak ditemukan.');
    requireAccess_(token, { satkerId: paket.satker_id, tahunAnggaranId: paket.tahun_anggaran_id });
    return computeDocumentChecklist_(paketId);
  },

  list: function (payload, token) {
    payload = payload || {};
    var paketId = String(payload.paketId || '');
    if (!paketId) throw AppError_('BAD_REQUEST', 'paketId wajib diisi.');
    var paket = findRowByField_('PAKET', 'paket_id', paketId);
    if (!paket) throw AppError_('NOT_FOUND', 'Paket tidak ditemukan.');
    requireAccess_(token, { satkerId: paket.satker_id, tahunAnggaranId: paket.tahun_anggaran_id });
    return readAllRows_('DOCUMENTS').rows.filter(function (d) { return d.paket_id === paketId && d.status === 'ACTIVE'; });
  },

  /**
   * Upload BARU atau PENGGANTI (kalau requirement-nya bukan multiple_file dan
   * sudah ada dokumen aktif untuk requirement itu) -- versi lama diarsipkan,
   * tidak dihapus, sesuai instruksi awal.
   */
  upload: function (payload, token) {
    payload = payload || {};
    var paketId = String(payload.paketId || '');
    var requirementId = String(payload.documentRequirementId || '');
    if (!paketId || !requirementId) throw AppError_('BAD_REQUEST', 'paketId dan documentRequirementId wajib diisi.');

    var paket = findRowByField_('PAKET', 'paket_id', paketId);
    if (!paket) throw AppError_('NOT_FOUND', 'Paket tidak ditemukan.');
    var access = requireAccess_(token, { allowRoles: ['ADMIN', 'PENGELOLA'], satkerId: paket.satker_id, tahunAnggaranId: paket.tahun_anggaran_id });

    var requirement = findRowByField_('MASTER_DOCUMENT_REQUIREMENTS', 'document_requirement_id', requirementId);
    if (!requirement) throw AppError_('NOT_FOUND', 'Jenis dokumen tidak ditemukan.');
    if (requirement.kode_dokumen === 'COMPANY-PROFILE') {
      throw AppError_('BAD_REQUEST', 'Company Profile diambil otomatis dari data Penyedia, bukan diunggah di sini.');
    }

    var blob = validateAndDecodeUpload_(payload.fileBase64, payload.mimeType, payload.fileName, DEFAULTS.MAX_FILE_SIZE_MB);

    var existingActive = readAllRows_('DOCUMENTS').rows.filter(function (d) {
      return d.paket_id === paketId && d.document_requirement_id === requirementId && d.status === 'ACTIVE';
    });
    var previousDoc = (!requirement.multiple_file && existingActive.length > 0) ? existingActive[0] : null;

    var folder = getPaketDocumentFolder_(paket, requirement.nama_dokumen);
    if (previousDoc) {
      try {
        var oldFile = DriveApp.getFileById(previousDoc.drive_file_id);
        oldFile.moveTo(getOrCreateFolder_(folder, '_ARCHIVE'));
      } catch (e) {
        Logger.log('Tidak bisa mengarsipkan dokumen lama ' + previousDoc.document_id + ': ' + e);
      }
      updateRowByField_('DOCUMENTS', 'document_id', previousDoc.document_id, { status: 'ARCHIVED' });
    }

    var newFile = folder.createFile(blob);
    var id = nextId_('DOC');
    var now = new Date().toISOString();
    var newVersion = previousDoc ? (Number(previousDoc.version) || 1) + 1 : 1;
    // Nomor surat diisi manual oleh user (Bagian bug fix: dokumen fisik seperti
    // SK PPK/SK PP/BAST Manual/Dokumentasi Monev punya nomor surat dari satker
    // yang tidak bisa ditebak sistem) -- kalau tidak diisi saat mengganti versi,
    // bawa nomor surat versi sebelumnya supaya tidak hilang tanpa sengaja.
    var nomorSurat = payload.nomorSurat !== undefined ? String(payload.nomorSurat || '') :
      (previousDoc ? (previousDoc.nomor_surat || '') : '');
    appendRow_('DOCUMENTS', {
      document_id: id, paket_id: paketId, document_requirement_id: requirementId,
      file_name: payload.fileName || newFile.getName(), drive_file_id: newFile.getId(), drive_url: newFile.getUrl(),
      mime_type: payload.mimeType, file_size: blob.getBytes().length, nomor_surat: nomorSurat,
      uploaded_by: access.session.userId, uploaded_at: now, version: newVersion,
      previous_version_document_id: previousDoc ? previousDoc.document_id : '', status: 'ACTIVE'
    });

    logAudit_(access.session.userId, previousDoc ? 'REPLACE_DOCUMENT' : 'UPLOAD_DOCUMENT', 'DOCUMENTS', id,
      requirement.nama_dokumen + ' untuk paket ' + paketId + (previousDoc ? ' (versi ' + newVersion + ')' : ''));

    computePaketCompletion_(paketId);
    return { documentId: id, version: newVersion };
  },

  // Ubah nomor surat dokumen yang SUDAH terunggah tanpa perlu unggah ulang filenya.
  setNomorSurat: function (payload, token) {
    payload = payload || {};
    var documentId = String(payload.documentId || '');
    if (!documentId) throw AppError_('BAD_REQUEST', 'documentId wajib diisi.');
    var doc = findRowByField_('DOCUMENTS', 'document_id', documentId);
    if (!doc) throw AppError_('NOT_FOUND', 'Dokumen tidak ditemukan.');
    var paket = findRowByField_('PAKET', 'paket_id', doc.paket_id);
    if (!paket) throw AppError_('NOT_FOUND', 'Paket untuk dokumen ini tidak ditemukan.');
    var access = requireAccess_(token, { allowRoles: ['ADMIN', 'PENGELOLA'], satkerId: paket.satker_id, tahunAnggaranId: paket.tahun_anggaran_id });

    updateRowByField_('DOCUMENTS', 'document_id', documentId, { nomor_surat: String(payload.nomorSurat || '') });
    logAudit_(access.session.userId, 'SET_NOMOR_SURAT', 'DOCUMENTS', documentId, 'Ubah nomor surat dokumen');
    return {};
  },

  // Soft-delete: file TIDAK dihapus dari Drive, hanya diarsipkan + ditandai DELETED.
  deleteDoc: function (payload, token) {
    payload = payload || {};
    var documentId = String(payload.documentId || '');
    if (!documentId) throw AppError_('BAD_REQUEST', 'documentId wajib diisi.');
    var doc = findRowByField_('DOCUMENTS', 'document_id', documentId);
    if (!doc) throw AppError_('NOT_FOUND', 'Dokumen tidak ditemukan.');
    var paket = findRowByField_('PAKET', 'paket_id', doc.paket_id);
    if (!paket) throw AppError_('NOT_FOUND', 'Paket untuk dokumen ini tidak ditemukan.');
    var access = requireAccess_(token, { allowRoles: ['ADMIN', 'PENGELOLA'], satkerId: paket.satker_id, tahunAnggaranId: paket.tahun_anggaran_id });

    try {
      var file = DriveApp.getFileById(doc.drive_file_id);
      var requirement = findRowByField_('MASTER_DOCUMENT_REQUIREMENTS', 'document_requirement_id', doc.document_requirement_id);
      var folder = getPaketDocumentFolder_(paket, requirement ? requirement.nama_dokumen : 'LAINNYA');
      file.moveTo(getOrCreateFolder_(folder, '_ARCHIVE'));
    } catch (e) {
      Logger.log('Tidak bisa mengarsipkan file saat hapus dokumen ' + documentId + ': ' + e);
    }
    updateRowByField_('DOCUMENTS', 'document_id', documentId, { status: 'DELETED' });
    logAudit_(access.session.userId, 'DELETE_DOCUMENT', 'DOCUMENTS', documentId, 'Menghapus (arsip) dokumen: ' + doc.file_name);
    computePaketCompletion_(doc.paket_id);
    return {};
  },

  // Proxy penuh lewat backend (Bagian D: jangan expose URL Drive mentah).
  download: function (payload, token) {
    payload = payload || {};
    var documentId = String(payload.documentId || '');
    var doc = findRowByField_('DOCUMENTS', 'document_id', documentId);
    if (!doc) throw AppError_('NOT_FOUND', 'Dokumen tidak ditemukan.');
    var paket = findRowByField_('PAKET', 'paket_id', doc.paket_id);
    if (!paket) throw AppError_('NOT_FOUND', 'Paket untuk dokumen ini tidak ditemukan.');
    requireAccess_(token, { satkerId: paket.satker_id, tahunAnggaranId: paket.tahun_anggaran_id });

    var file = DriveApp.getFileById(doc.drive_file_id);
    var blob = file.getBlob();
    return {
      fileName: doc.file_name,
      mimeType: blob.getContentType(),
      fileBase64: Utilities.base64Encode(blob.getBytes())
    };
  }
};

/**
 * Checklist untuk satu paket, berdasar MASTER_DOCUMENT_REQUIREMENTS yang
 * berlaku (jenis_pengadaan_id kosong = berlaku semua jenis). Dipakai oleh
 * DocumentsService.getChecklist DAN computePaketCompletion_ (Paket.gs).
 */
function computeDocumentChecklist_(paketId) {
  var paket = findRowByField_('PAKET', 'paket_id', paketId);
  if (!paket) return [];

  var requirements = readAllRows_('MASTER_DOCUMENT_REQUIREMENTS').rows.filter(function (r) {
    return r.status === 'AKTIF' && (!r.jenis_pengadaan_id || r.jenis_pengadaan_id === paket.jenis_pengadaan_id);
  });
  requirements.sort(function (a, b) { return (Number(a.urutan) || 0) - (Number(b.urutan) || 0); });

  var activeDocs = readAllRows_('DOCUMENTS').rows.filter(function (d) { return d.paket_id === paketId && d.status === 'ACTIVE'; });
  var provider = paket.penyedia_id ? findRowByField_('PROVIDERS', 'penyedia_id', paket.penyedia_id) : null;

  return requirements.map(function (r) {
    var wajibSekarang = r.wajib === 'WAJIB' || (r.wajib === 'KONDISIONAL' && evaluateKondisi_(r.kondisi, paket));
    var terpenuhi, dokumenTerkait;

    if (r.kode_dokumen === 'COMPANY-PROFILE') {
      terpenuhi = !!(provider && provider.company_profile_file_id);
      dokumenTerkait = [];
    } else {
      dokumenTerkait = activeDocs.filter(function (d) { return d.document_requirement_id === r.document_requirement_id; });
      terpenuhi = dokumenTerkait.length > 0;
    }

    return {
      documentRequirementId: r.document_requirement_id,
      namaDokumen: r.nama_dokumen,
      kodeDokumen: r.kode_dokumen,
      wajib: r.wajib,
      wajibSekarang: wajibSekarang,
      multipleFile: !!r.multiple_file,
      terpenuhi: terpenuhi,
      documents: dokumenTerkait
    };
  });
}

/**
 * Evaluasi "kondisi" dalam format TERBATAS field=value (mis. "ada_pph=true"),
 * BUKAN eval() bebas -- mencegah risiko injeksi kode lewat data yang diisi
 * admin (Bagian C & N dokumen desain).
 */
function evaluateKondisi_(kondisi, paket) {
  if (!kondisi) return false;
  var parts = String(kondisi).split('=');
  if (parts.length !== 2) return false;
  var field = parts[0].trim();
  var expected = parts[1].trim().toLowerCase();
  var actual = paket[field];
  if (expected === 'true') return actual === true || actual === 'true' || actual === 'TRUE';
  if (expected === 'false') return actual === false || actual === 'false' || actual === '' || actual === undefined;
  return String(actual).toLowerCase() === expected;
}

/**
 * Folder Drive milik paket ini. Memakai PAKET.drive_folder_id yang sudah
 * di-cache kalau ada (Bagian D: "tidak perlu resolve path sama sekali"
 * setelah pertama kali) -- hanya menyusun ulang path & menyimpan ID-nya
 * kalau field itu kosong atau folder-nya sudah tidak valid lagi.
 */
function getPaketRootFolder_(paket) {
  if (paket.drive_folder_id) {
    try {
      return DriveApp.getFolderById(paket.drive_folder_id);
    } catch (e) {
      Logger.log('drive_folder_id tersimpan untuk paket ' + paket.paket_id + ' tidak valid lagi, membuat ulang: ' + e);
    }
  }
  var root = DriveApp.getFolderById(getRootDriveFolderId_());
  var yearFolder = getOrCreateFolder_(root, String(paket.tahun_anggaran_id).replace('TA-', ''));
  var satker = findRowByField_('SATKER', 'satker_id', paket.satker_id);
  var satkerFolder = getOrCreateFolder_(yearFolder, satker ? satker.nama_satker : paket.satker_id);
  var paketFolder = getOrCreateFolder_(satkerFolder, paket.kode_paket || paket.paket_id);
  updateRowByField_('PAKET', 'paket_id', paket.paket_id, { drive_folder_id: paketFolder.getId() });
  return paketFolder;
}

function getPaketDocumentFolder_(paket, subFolderName) {
  return getOrCreateFolder_(getPaketRootFolder_(paket), subFolderName);
}