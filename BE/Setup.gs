/**
 * Setup.gs
 * Fungsi-fungsi ini dijalankan MANUAL SEKALI dari editor Apps Script (pilih nama
 * fungsi di dropdown toolbar, klik Run) — TIDAK PERNAH dipanggil otomatis dari
 * Web App/apiCall(). Lihat README.md untuk urutan langkah lengkapnya.
 */

// Definisi header tiap sheet. Mencakup seluruh tabel dari dokumen desain (Bagian C),
// bukan cuma yang dipakai Tahap 1 — supaya struktur Spreadsheet tidak perlu diubah
// lagi saat Tahap 2 dst. mulai dikerjakan.
var SHEET_DEFINITIONS = {
  CONFIG: ['key', 'value', 'description', 'updated_at', 'updated_by'],
  YEARS: ['tahun_anggaran_id', 'tahun', 'status', 'tanggal_mulai', 'tanggal_selesai', 'catatan', 'created_at', 'created_by'],
  SATKER: ['satker_id', 'kode_satker', 'nama_satker', 'jenis_satker', 'wilayah', 'alamat', 'status', 'catatan', 'created_at', 'updated_at', 'created_by', 'updated_by'],
  SATKER_TAHUN: ['satker_tahun_id', 'satker_id', 'tahun_anggaran_id', 'sp_dipa', 'tanggal_dipa', 'kpa_nama', 'kpa_nip', 'ppk_nama', 'ppk_nip', 'pejabat_pengadaan_nama', 'pejabat_pengadaan_nip', 'ada_pengadaan', 'status', 'catatan', 'created_at', 'updated_at'],
  USERS: ['user_id', 'nama', 'nip', 'email', 'username', 'password_hash', 'password_salt', 'password_iterations', 'role', 'status', 'last_login', 'failed_login_count', 'locked_until', 'created_at', 'updated_at'],
  USER_ASSIGNMENTS: ['assignment_id', 'tahun_anggaran_id', 'user_id', 'satker_id', 'tanggal_mulai', 'tanggal_selesai', 'status', 'created_at', 'created_by'],
  JENIS_PENGADAAN: ['jenis_pengadaan_id', 'nama_jenis', 'kode', 'deskripsi', 'status', 'created_at', 'updated_at'],
  PAGU: ['pagu_id', 'tahun_anggaran_id', 'satker_id', 'jenis_pengadaan_id', 'sumber_dana', 'kode_anggaran', 'pagu', 'status', 'catatan', 'created_at', 'updated_at', 'created_by'],
  PAKET: ['paket_id', 'tahun_anggaran_id', 'satker_id', 'jenis_pengadaan_id', 'pagu_id', 'kode_paket', 'nama_paket', 'sumber_dana', 'pagu_snapshot', 'nilai_hps', 'nilai_kontrak', 'metode_pengadaan', 'jenis_kontrak', 'tanggal_mulai', 'tanggal_selesai', 'penyedia_id', 'ppk_nama', 'ppk_nip', 'pp_nama', 'pp_nip', 'kpa_nama', 'kpa_nip', 'ada_pph', 'memerlukan_penyedia', 'status_paket', 'persentase_kelengkapan', 'drive_folder_id', 'created_at', 'updated_at', 'created_by', 'updated_by'],
  PROVIDERS: ['penyedia_id', 'nama_perusahaan', 'bentuk_usaha', 'npwp', 'nib', 'alamat', 'email', 'telepon', 'nama_direktur', 'nama_pic', 'nomor_pic', 'rekening', 'bank', 'status', 'catatan', 'company_profile_file_id', 'company_profile_version', 'created_at', 'updated_at'],
  MASTER_DOCUMENT_REQUIREMENTS: ['document_requirement_id', 'jenis_pengadaan_id', 'nama_dokumen', 'kode_dokumen', 'wajib', 'kondisi', 'multiple_file', 'urutan', 'status'],
  DOCUMENTS: ['document_id', 'paket_id', 'document_requirement_id', 'file_name', 'drive_file_id', 'drive_url', 'mime_type', 'file_size', 'uploaded_by', 'uploaded_at', 'version', 'previous_version_document_id', 'status'],
  HPS_ITEMS: ['hps_item_id', 'paket_id', 'row_index', 'col_index', 'value', 'rowspan', 'colspan', 'no_urut', 'nama', 'spesifikasi', 'volume', 'satuan', 'harga_satuan', 'jumlah', 'created_at', 'updated_at'],
  GENERATED_DOCUMENTS: ['generated_document_id', 'paket_id', 'doc_type', 'version', 'generated_by', 'generated_at', 'file_id', 'drive_url', 'snapshot_json', 'change_note', 'status'],
  TEMPLATES: ['template_id', 'jenis_pengadaan_id', 'doc_type', 'nama_template', 'html_template', 'status'],
  AUDIT_LOGS: ['audit_id', 'timestamp', 'user_id', 'action', 'module', 'record_id', 'description', 'ip_address', 'user_agent'],
  SESSIONS: ['session_id', 'user_id', 'token_hash', 'created_at', 'expires_at', 'last_activity', 'status'],
  NOTIFICATIONS: ['notification_id', 'tahun_anggaran_id', 'satker_id', 'paket_id', 'user_id', 'type', 'message', 'is_read', 'created_at'],
  _COUNTERS: ['entity', 'last_value']
};

// Isi awal jenis pengadaan (Tahap 3 akan memakainya, tapi dibuat sekalian di sini
// supaya master data dasar sudah siap). Nama/kode ini CONTOH sesuai dokumen KAK/HPS
// yang diberikan — admin bisa menambah/mengubah lewat UI nanti (Tahap 3), bukan hardcode permanen.
var SEED_JENIS_PENGADAAN = [
  { kode: 'GEDUNG-KANTOR', nama: 'Pemeliharaan Gedung (Perkantoran)' },
  { kode: 'GEDUNG-BOS', nama: 'Pemeliharaan Gedung (Dana BOS)' },
  { kode: 'PERALATAN-MESIN', nama: 'Peralatan & Mesin' },
  { kode: 'EKSTRAKOMPTABEL', nama: 'Ekstrakomptabel' },
  { kode: 'BUKU', nama: 'Buku' }
];

function initializeDatabase() {
  var ss = SpreadsheetApp.openById(getSpreadsheetId_());

  Object.keys(SHEET_DEFINITIONS).forEach(function (name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) sheet = ss.insertSheet(name);
    var headers = SHEET_DEFINITIONS[name];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  });

  // Hapus "Sheet1" bawaan Spreadsheet baru, kalau masih ada & sheet lain sudah dibuat.
  var defaultSheet = ss.getSheetByName('Sheet1');
  if (defaultSheet && ss.getSheets().length > 1) {
    ss.deleteSheet(defaultSheet);
  }

  // Seed JENIS_PENGADAAN kalau sheet-nya masih kosong (belum ada baris data).
  var existingJenis = readAllRows_('JENIS_PENGADAAN').rows;
  if (existingJenis.length === 0) {
    SEED_JENIS_PENGADAAN.forEach(function (jp) {
      var now = new Date().toISOString();
      appendRow_('JENIS_PENGADAAN', {
        jenis_pengadaan_id: nextId_('JP'), nama_jenis: jp.nama, kode: jp.kode,
        deskripsi: '', status: 'AKTIF', created_at: now, updated_at: now
      });
    });
  }

  Logger.log('initializeDatabase() selesai: struktur sheet dibuat/diverifikasi.');
}

function initializeDriveStructure() {
  var rootId = getRootDriveFolderId_();
  var root = DriveApp.getFolderById(rootId);
  var master = getOrCreateFolder_(root, 'MASTER');
  getOrCreateFolder_(master, 'PENYEDIA');
  getOrCreateFolder_(master, 'COMPANY PROFILE');
  getOrCreateFolder_(master, 'ASSETS');
  getOrCreateFolder_(master, 'TEMPLATES');
  Logger.log('initializeDriveStructure() selesai: folder dasar MASTER/* dibuat.');
}

function getOrCreateFolder_(parentFolder, name) {
  var existing = parentFolder.getFoldersByName(name);
  if (existing.hasNext()) return existing.next();
  return parentFolder.createFolder(name);
}

/**
 * Jalankan MANUAL, SEKALI, setelah initializeDatabase(). Contoh pemakaian: ubah
 * ketiga argumen di bawah lalu klik Run pada fungsi ini di editor Apps Script.
 *   createFirstAdmin('Nama Anda', 'admin', 'PasswordAwalYangKuat123');
 * SEGERA login dan ganti password lewat menu setelah ini (menu "Ganti Password").
 */
function createFirstAdmin(nama, username, password) {
  if (!nama || !username || !password) {
    Logger.log('Isi nama, username, password sebagai argumen fungsi ini sebelum menjalankan.');
    return;
  }
  if (password.length < 8) {
    Logger.log('Password minimal 8 karakter.');
    return;
  }
  var existing = findRowByField_('USERS', 'username', username);
  if (existing) {
    Logger.log('User dengan username "' + username + '" sudah ada — tidak membuat admin baru.');
    return;
  }

  var salt = generateSalt_();
  var iterations = DEFAULTS.PASSWORD_ITERATIONS;
  var hash = hashPassword_(password, salt, iterations);
  var now = new Date().toISOString();
  var userId = nextId_('USR');

  appendRow_('USERS', {
    user_id: userId, nama: nama, nip: '', email: '', username: username,
    password_hash: hash, password_salt: salt, password_iterations: iterations,
    role: 'ADMIN', status: 'AKTIF', last_login: '', failed_login_count: 0, locked_until: '',
    created_at: now, updated_at: now
  });
  Logger.log('Admin pertama dibuat dengan user_id: ' + userId + '. Silakan login lalu segera ganti password.');
}

/**
 * Ringkasan: jalankan initializeDatabase() lalu initializeDriveStructure().
 * Tetap SEKALI jalan manual — bukan dipanggil otomatis tiap request Web App.
 */
function setupSystem() {
  initializeDatabase();
  initializeDriveStructure();
  Logger.log('setupSystem() selesai. Langkah selanjutnya: jalankan createFirstAdmin(nama, username, password) secara manual.');
}
