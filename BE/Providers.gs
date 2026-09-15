/**
 * Providers.gs
 * CRUD PENYEDIA + Company Profile (upload ke Drive dengan versioning -- versi
 * lama TIDAK dihapus, dipindah ke sub-folder _ARCHIVE, sesuai instruksi awal).
 * Penyedia adalah master data LINTAS-SATKER (dipakai berkali-kali di paket
 * berbeda), jadi sengaja TIDAK di-scope ke assignment satker seperti modul lain.
 */
var VALID_BENTUK_USAHA = ['PT', 'CV', 'Firma', 'Koperasi', 'Perorangan', 'UD', 'Lainnya'];

var ProvidersService = {
  handle: function (action, payload, token) {
    switch (action) {
      case 'list': return this.list(token);
      case 'detail': return this.detail(payload, token);
      case 'create': return this.create(payload, token);
      case 'update': return this.update(payload, token);
      case 'setStatus': return this.setStatus(payload, token);
      case 'uploadCompanyProfile': return this.uploadCompanyProfile(payload, token);
      case 'getCompanyProfileFile': return this.getCompanyProfileFile(payload, token);
      default: throw AppError_('UNKNOWN_ACTION', 'Aksi providers tidak dikenal: ' + action);
    }
  },

  list: function (token) {
    requireSession_(token); // lintas-satker: semua role yang login boleh lihat
    return readAllRows_('PROVIDERS').rows;
  },

  detail: function (payload, token) {
    requireSession_(token);
    payload = payload || {};
    var id = String(payload.penyediaId || '');
    if (!id) throw AppError_('BAD_REQUEST', 'penyediaId wajib diisi.');
    var provider = findRowByField_('PROVIDERS', 'penyedia_id', id);
    if (!provider) throw AppError_('NOT_FOUND', 'Penyedia tidak ditemukan.');
    return provider;
  },

  create: function (payload, token) {
    var session = requireAccess_(token, { allowRoles: ['ADMIN', 'PENGELOLA'] }).session;
    payload = payload || {};
    var nama = String(payload.namaPerusahaan || '').trim();
    if (!nama) throw AppError_('BAD_REQUEST', 'Nama perusahaan wajib diisi.');
    if (payload.bentukUsaha && VALID_BENTUK_USAHA.indexOf(payload.bentukUsaha) === -1) {
      throw AppError_('BAD_REQUEST', 'Bentuk usaha tidak valid.');
    }
    if (payload.npwp && findRowByField_('PROVIDERS', 'npwp', payload.npwp)) {
      throw AppError_('DUPLICATE', 'NPWP ini sudah terdaftar untuk penyedia lain.');
    }

    var id = nextId_('PRV');
    var now = new Date().toISOString();
    appendRow_('PROVIDERS', {
      penyedia_id: id, nama_perusahaan: nama, bentuk_usaha: payload.bentukUsaha || '',
      npwp: payload.npwp || '', nib: payload.nib || '', alamat: payload.alamat || '',
      email: payload.email || '', telepon: payload.telepon || '',
      nama_direktur: payload.namaDirektur || '', nama_pic: payload.namaPic || '', nomor_pic: payload.nomorPic || '',
      rekening: payload.rekening || '', bank: payload.bank || '',
      status: 'AKTIF', catatan: payload.catatan || '',
      company_profile_file_id: '', company_profile_version: 0,
      created_at: now, updated_at: now
    });
    logAudit_(session.userId, 'CREATE_PROVIDER', 'PROVIDERS', id, 'Membuat penyedia: ' + nama);
    return { penyediaId: id };
  },

  update: function (payload, token) {
    var session = requireAccess_(token, { allowRoles: ['ADMIN', 'PENGELOLA'] }).session;
    payload = payload || {};
    var id = String(payload.penyediaId || '');
    if (!id) throw AppError_('BAD_REQUEST', 'penyediaId wajib diisi.');

    var fieldMap = {
      namaPerusahaan: 'nama_perusahaan', bentukUsaha: 'bentuk_usaha', npwp: 'npwp', nib: 'nib',
      alamat: 'alamat', email: 'email', telepon: 'telepon', namaDirektur: 'nama_direktur',
      namaPic: 'nama_pic', nomorPic: 'nomor_pic', rekening: 'rekening', bank: 'bank', catatan: 'catatan'
    };
    var updates = { updated_at: new Date().toISOString() };
    Object.keys(fieldMap).forEach(function (key) {
      if (payload[key] !== undefined) updates[fieldMap[key]] = payload[key];
    });
    if (updates.bentuk_usaha && VALID_BENTUK_USAHA.indexOf(updates.bentuk_usaha) === -1) {
      throw AppError_('BAD_REQUEST', 'Bentuk usaha tidak valid.');
    }

    var success = updateRowByField_('PROVIDERS', 'penyedia_id', id, updates);
    if (!success) throw AppError_('NOT_FOUND', 'Penyedia tidak ditemukan.');
    logAudit_(session.userId, 'UPDATE_PROVIDER', 'PROVIDERS', id, 'Update data penyedia');
    return {};
  },

  setStatus: function (payload, token) {
    // Sengaja ADMIN saja (bukan Pengelola) -- penyedia dipakai lintas-satker,
    // menonaktifkan sembarangan bisa memengaruhi paket satker lain juga.
    var session = requireAccess_(token, { allowRoles: ['ADMIN'] }).session;
    payload = payload || {};
    var id = String(payload.penyediaId || '');
    var status = String(payload.status || '');
    if (['AKTIF', 'NONAKTIF'].indexOf(status) === -1) throw AppError_('BAD_REQUEST', 'Status tidak valid.');
    var success = updateRowByField_('PROVIDERS', 'penyedia_id', id, { status: status, updated_at: new Date().toISOString() });
    if (!success) throw AppError_('NOT_FOUND', 'Penyedia tidak ditemukan.');
    logAudit_(session.userId, 'SET_PROVIDER_STATUS', 'PROVIDERS', id, 'Status penyedia diubah ke ' + status);
    return {};
  },

  uploadCompanyProfile: function (payload, token) {
    var session = requireAccess_(token, { allowRoles: ['ADMIN', 'PENGELOLA'] }).session;
    payload = payload || {};
    var id = String(payload.penyediaId || '');
    if (!id) throw AppError_('BAD_REQUEST', 'penyediaId wajib diisi.');
    var provider = findRowByField_('PROVIDERS', 'penyedia_id', id);
    if (!provider) throw AppError_('NOT_FOUND', 'Penyedia tidak ditemukan.');

    var blob = validateAndDecodeUpload_(payload.fileBase64, payload.mimeType, payload.fileName, DEFAULTS.MAX_FILE_SIZE_MB);

    var root = getMasterCompanyProfileRootFolder_();
    var providerFolder = getOrCreateFolder_(root, id + ' - ' + provider.nama_perusahaan);

    // Versi lama TIDAK dihapus -- dipindah ke _ARCHIVE, baru file baru dibuat.
    if (provider.company_profile_file_id) {
      try {
        var oldFile = DriveApp.getFileById(provider.company_profile_file_id);
        var archiveFolder = getOrCreateFolder_(providerFolder, '_ARCHIVE');
        oldFile.moveTo(archiveFolder);
      } catch (e) {
        Logger.log('Tidak bisa mengarsipkan company profile lama untuk ' + id + ': ' + e);
      }
    }

    var newFile = providerFolder.createFile(blob);
    var newVersion = (Number(provider.company_profile_version) || 0) + 1;

    updateRowByField_('PROVIDERS', 'penyedia_id', id, {
      company_profile_file_id: newFile.getId(),
      company_profile_version: newVersion,
      updated_at: new Date().toISOString()
    });
    logAudit_(session.userId, 'UPDATE_COMPANY_PROFILE', 'PROVIDERS', id,
      'Company profile diperbarui ke versi ' + newVersion + ' untuk ' + provider.nama_perusahaan);
    return { fileId: newFile.getId(), version: newVersion };
  },

  // Proxy penuh lewat backend (Bagian D: jangan expose URL Drive mentah ke
  // klien) -- validasi sesi dulu, baru kirim isi file sebagai base64.
  getCompanyProfileFile: function (payload, token) {
    requireSession_(token);
    payload = payload || {};
    var id = String(payload.penyediaId || '');
    var provider = findRowByField_('PROVIDERS', 'penyedia_id', id);
    if (!provider) throw AppError_('NOT_FOUND', 'Penyedia tidak ditemukan.');
    if (!provider.company_profile_file_id) throw AppError_('NOT_FOUND', 'Company profile belum diunggah.');

    var file = DriveApp.getFileById(provider.company_profile_file_id);
    var blob = file.getBlob();
    return {
      fileName: file.getName(),
      mimeType: blob.getContentType(),
      fileBase64: Utilities.base64Encode(blob.getBytes())
    };
  }
};