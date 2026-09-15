/**
 * DriveService.gs
 * Helper Drive BERSAMA -- dipakai Providers.gs (Company Profile) mulai Tahap 4
 * ini, dan akan dipakai lagi oleh Documents.gs mulai Tahap 5 untuk pola yang
 * sama (validasi upload, struktur folder), sesuai Bagian D & G dokumen desain.
 */

function getOrCreateFolder_(parentFolder, name) {
  var existing = parentFolder.getFoldersByName(name);
  if (existing.hasNext()) return existing.next();
  return parentFolder.createFolder(name);
}

function getMasterCompanyProfileRootFolder_() {
  var root = DriveApp.getFolderById(getRootDriveFolderId_());
  var master = getOrCreateFolder_(root, 'MASTER');
  return getOrCreateFolder_(master, 'COMPANY PROFILE');
}

// MIME type yang diizinkan -> magic bytes (byte pertama file) untuk memverifikasi
// isi file benar-benar sesuai jenis yang dilaporkan, bukan cuma dipercaya dari
// klien (Bagian G dokumen desain: "jangan mengandalkan MIME dari browser saja").
// null berarti jenis file itu tidak punya signature byte sederhana yang seragam
// -- dilewati cek signature-nya, tapi validasi ekstensi & ukuran tetap berlaku.
var ALLOWED_UPLOAD_MIME_TYPES = {
  'application/pdf': [0x25, 0x50, 0x44, 0x46],
  'image/jpeg': [0xFF, 0xD8],
  'image/png': [0x89, 0x50, 0x4E, 0x47],
  'application/msword': null,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [0x50, 0x4B],
  'application/vnd.ms-excel': null,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [0x50, 0x4B]
};

/**
 * Decode base64 -> Blob, sambil memvalidasi ukuran, MIME yang diizinkan, dan
 * magic bytes. Melempar AppError_ (pesan aman dikirim ke klien) kalau gagal.
 */
function validateAndDecodeUpload_(base64Data, mimeType, fileName, maxSizeMb) {
  if (!base64Data) throw AppError_('BAD_REQUEST', 'File tidak boleh kosong.');

  var bytes;
  try {
    bytes = Utilities.base64Decode(base64Data);
  } catch (e) {
    throw AppError_('BAD_REQUEST', 'Data file tidak valid (bukan base64 yang benar).');
  }

  var limitMb = maxSizeMb || getConfigNumber_('MAX_FILE_SIZE_MB', DEFAULTS.MAX_FILE_SIZE_MB);
  if (bytes.length > limitMb * 1024 * 1024) {
    throw AppError_('BAD_REQUEST', 'Ukuran file melebihi batas ' + limitMb + 'MB.');
  }

  if (!ALLOWED_UPLOAD_MIME_TYPES.hasOwnProperty(mimeType)) {
    throw AppError_('BAD_REQUEST', 'Jenis file tidak diizinkan: ' + mimeType);
  }

  var signature = ALLOWED_UPLOAD_MIME_TYPES[mimeType];
  if (signature) {
    for (var i = 0; i < signature.length; i++) {
      var b = bytes[i];
      if (b < 0) b += 256; // byte dari base64Decode Apps Script bisa signed (-128..127)
      if (b !== signature[i]) {
        throw AppError_('BAD_REQUEST', 'Isi file tidak cocok dengan jenis file yang dilaporkan (' + mimeType + ').');
      }
    }
  }

  return Utilities.newBlob(bytes, mimeType, fileName || 'file');
}