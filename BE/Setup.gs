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
  SATKER: ['satker_id', 'kode_satker', 'nama_satker', 'jenis_satker', 'wilayah', 'alamat', 'website', 'email', 'telepon', 'kodepos', 'status', 'catatan', 'created_at', 'updated_at', 'created_by', 'updated_by'],
  SATKER_TAHUN: ['satker_tahun_id', 'satker_id', 'tahun_anggaran_id', 'sp_dipa', 'tanggal_dipa', 'kpa_nama', 'kpa_nip', 'ppk_nama', 'ppk_nip', 'pejabat_pengadaan_nama', 'pejabat_pengadaan_nip', 'ada_pengadaan', 'status', 'catatan', 'created_at', 'updated_at'],
  USERS: ['user_id', 'nama', 'nip', 'email', 'username', 'password_hash', 'password_salt', 'password_iterations', 'role', 'status', 'last_login', 'failed_login_count', 'locked_until', 'created_at', 'updated_at'],
  USER_ASSIGNMENTS: ['assignment_id', 'tahun_anggaran_id', 'user_id', 'satker_id', 'tanggal_mulai', 'tanggal_selesai', 'status', 'created_at', 'created_by'],
  JENIS_PENGADAAN: ['jenis_pengadaan_id', 'nama_jenis', 'kode', 'deskripsi', 'status', 'created_at', 'updated_at'],
  PAGU: ['pagu_id', 'tahun_anggaran_id', 'satker_id', 'jenis_pengadaan_id', 'sumber_dana', 'kode_anggaran', 'pagu', 'status', 'catatan', 'created_at', 'updated_at', 'created_by'],
  PAKET: ['paket_id', 'tahun_anggaran_id', 'satker_id', 'jenis_pengadaan_id', 'pagu_id', 'kode_paket', 'nama_paket', 'sumber_dana', 'pagu_snapshot', 'nilai_hps', 'nilai_kontrak', 'metode_pengadaan', 'jenis_kontrak', 'tanggal_mulai', 'tanggal_selesai', 'penyedia_id', 'ppk_nama', 'ppk_nip', 'pp_nama', 'pp_nip', 'kpa_nama', 'kpa_nip', 'ada_pph', 'memerlukan_penyedia', 'status_paket', 'persentase_kelengkapan', 'drive_folder_id', 'created_at', 'updated_at', 'created_by', 'updated_by'],
  PROVIDERS: ['penyedia_id', 'nama_perusahaan', 'bentuk_usaha', 'npwp', 'nib', 'alamat', 'email', 'telepon', 'nama_direktur', 'nama_pic', 'nomor_pic', 'rekening', 'bank', 'status', 'catatan', 'company_profile_file_id', 'company_profile_version', 'created_at', 'updated_at'],
  MASTER_DOCUMENT_REQUIREMENTS: ['document_requirement_id', 'jenis_pengadaan_id', 'nama_dokumen', 'kode_dokumen', 'wajib', 'kondisi', 'multiple_file', 'urutan', 'status'],
  DOCUMENTS: ['document_id', 'paket_id', 'document_requirement_id', 'file_name', 'drive_file_id', 'drive_url', 'mime_type', 'file_size', 'nomor_surat', 'uploaded_by', 'uploaded_at', 'version', 'previous_version_document_id', 'status'],
  HPS_ITEMS: ['hps_item_id', 'paket_id', 'row_index', 'col_index', 'value', 'rowspan', 'colspan', 'no_urut', 'nama', 'spesifikasi', 'volume', 'satuan', 'harga_satuan', 'jumlah', 'created_at', 'updated_at'],
  GENERATED_DOCUMENTS: ['generated_document_id', 'paket_id', 'doc_type', 'version', 'nomor_surat', 'generated_by', 'generated_at', 'file_id', 'drive_url', 'snapshot_json', 'change_note', 'status'],
  TEMPLATES: ['template_id', 'jenis_pengadaan_id', 'doc_type', 'nama_template', 'html_template', 'status'],
  PEJABAT: ['pejabat_id', 'nama', 'nip', 'jabatan', 'status', 'created_at', 'updated_at', 'created_by'],
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

// Checklist dokumen default (Tahap 5), sesuai daftar pada brief awal. Semua
// jenis_pengadaan_id dikosongkan = berlaku untuk SEMUA jenis pengadaan --
// admin bisa mempersempit ke jenis tertentu atau menambah/mengubah lewat UI,
// bukan dikunci permanen di kode. "kondisi" pakai format terbatas field=value
// (lihat evaluateKondisi_ di Documents.gs), bukan eval() bebas.
var SEED_DOCUMENT_REQUIREMENTS = [
  { kode: 'SK-PPK', nama: 'SK PPK', wajib: 'WAJIB', multiple: false, urutan: 1 },
  { kode: 'SK-PP', nama: 'SK Pejabat Pengadaan', wajib: 'WAJIB', multiple: false, urutan: 2 },
  { kode: 'RUP', nama: 'RUP', wajib: 'WAJIB', multiple: false, urutan: 3 },
  { kode: 'KAK', nama: 'KAK', wajib: 'WAJIB', multiple: false, urutan: 4 },
  { kode: 'HPS', nama: 'HPS', wajib: 'WAJIB', multiple: false, urutan: 5 },
  { kode: 'SURAT-PESANAN', nama: 'Surat Pesanan', wajib: 'WAJIB', multiple: false, urutan: 6 },
  { kode: 'DOK-SEBELUM', nama: 'Dokumentasi Sebelum Pengerjaan', wajib: 'WAJIB', multiple: true, urutan: 7 },
  { kode: 'DOK-PROSES', nama: 'Dokumentasi Proses Pengerjaan', wajib: 'WAJIB', multiple: true, urutan: 8 },
  { kode: 'DOK-SETELAH', nama: 'Dokumentasi Setelah Pengerjaan', wajib: 'WAJIB', multiple: true, urutan: 9 },
  { kode: 'BAST-INPROC', nama: 'BAST INPROC', wajib: 'WAJIB', multiple: false, urutan: 10 },
  { kode: 'BAST-MANUAL', nama: 'BAST Manual', wajib: 'WAJIB', multiple: false, urutan: 11 },
  { kode: 'SPM', nama: 'SPM', wajib: 'WAJIB', multiple: false, urutan: 12 },
  { kode: 'SP2D', nama: 'SP2D', wajib: 'WAJIB', multiple: false, urutan: 13 },
  { kode: 'FAKTUR', nama: 'Faktur', wajib: 'KONDISIONAL', kondisi: 'ada_pph=true', multiple: false, urutan: 14 },
  { kode: 'BUPOT', nama: 'Bukti Potong Pajak (Bupot)', wajib: 'KONDISIONAL', kondisi: 'ada_pph=true', multiple: false, urutan: 15 },
  { kode: 'COMPANY-PROFILE', nama: 'Company Profile', wajib: 'WAJIB', multiple: false, urutan: 16 },
  { kode: 'HASIL-MONEV', nama: 'Hasil Monev', wajib: 'WAJIB', multiple: false, urutan: 17 },
  { kode: 'DOK-MONEV', nama: 'Dokumentasi Monev', wajib: 'WAJIB', multiple: true, urutan: 18 }
];

/**
 * Template KAK default (Tahap 6). Strukturnya mengikuti 13 bagian dokumen
 * contoh yang Anda berikan, TAPI seluruh isinya dinamis lewat placeholder
 * {{...}} -- tidak ada nama satker/pejabat/nominal yang di-hardcode. Admin
 * bisa menyunting atau membuat template khusus per jenis pengadaan lewat
 * TemplatesService, jadi ini hanya titik awal, bukan kunci permanen.
 *
 * Catatan: CSS sengaja dibuat sederhana (tabel + font dasar) karena konverter
 * HTML->PDF Apps Script hanya mendukung rendering dasar -- lihat komentar di
 * kepala KakService.gs.
 */
var SEED_TEMPLATE_KAK = [
  '<div style="font-family:Arial,sans-serif;font-size:11pt;">',
  '{{KOP_SURAT}}',
  '<div style="text-align:center;font-weight:bold;">',
  'KERANGKA ACUAN KERJA (KAK)/SPESIFIKASI TEKNIS<br>',
  'Nomor: {{NOMOR_SURAT}}<br>',
  '{{NAMA_PAKET}}<br>KABUPATEN INDRAMAYU',
  '</div><br>',
  '<table style="width:100%;border-collapse:collapse;" cellpadding="4">',
  '<tr><td style="width:22%;vertical-align:top;">Pekerjaan</td><td style="width:3%;vertical-align:top;">:</td><td>{{NAMA_PAKET}}</td></tr>',
  '<tr><td style="vertical-align:top;">1. LATAR BELAKANG</td><td style="vertical-align:top;">:</td><td style="text-align:justify;">',
  'Peningkatan kualitas pelayanan publik perlu didukung pengelolaan keuangan yang efektif, efisien, transparan, dan akuntabel. ',
  'Untuk meningkatkan efisiensi dan efektivitas penggunaan keuangan negara yang dibelanjakan melalui proses Pengadaan Barang/Jasa Pemerintah, ',
  'diperlukan upaya menciptakan keterbukaan, transparansi, dan akuntabilitas.<br><br>',
  '{{NAMA_SATKER}} Tahun Anggaran {{TAHUN_ANGGARAN}} melaksanakan kegiatan pengadaan {{JENIS_PENGADAAN}} ',
  'dengan arahan kebijakan untuk meningkatkan kualitas layanan melalui pemenuhan sarana dan prasarana pendukung.',
  '</td></tr>',
  '<tr><td style="vertical-align:top;">2. DASAR HUKUM</td><td style="vertical-align:top;">:</td><td>',
  '1. Undang-undang Nomor 17 Tahun 2003 tentang Keuangan Negara;<br>',
  '2. Undang-undang Nomor 1 Tahun 2004 tentang Perbendaharaan Negara;<br>',
  '3. Undang-undang Nomor 15 Tahun 2004 tentang Pemeriksaan Pengelolaan dan Tanggung Jawab Keuangan Negara;<br>',
  '4. Peraturan Presiden Nomor 16 Tahun 2018 tentang Pengadaan Barang/Jasa Pemerintah sebagaimana telah diubah terakhir dengan Peraturan Presiden Nomor 46 Tahun 2025;<br>',
  '5. Peraturan Menteri Agama Nomor 3 Tahun 2022 tentang Unit Kerja Pengadaan Barang/Jasa;<br>',
  '6. DIPA Satker {{NAMA_SATKER}} Tahun Anggaran {{TAHUN_ANGGARAN}} Nomor: {{SP_DIPA}} tanggal {{TANGGAL_DIPA}}.<br>',
  '<i style="font-size:9pt;">(PERINGATAN ADMINISTRATIF: daftar dasar hukum ini template awal -- mohon disesuaikan dan dikonfirmasi ke bagian hukum/UKPBJ sebelum dipakai resmi.)</i>',
  '</td></tr>',
  '<tr><td style="vertical-align:top;">3. MAKSUD DAN TUJUAN</td><td style="vertical-align:top;">:</td><td>',
  'a. Maksud pengadaan ini adalah untuk memenuhi kebutuhan sarana dan prasarana pada {{NAMA_SATKER}}.<br>',
  'b. Tujuannya adalah untuk meningkatkan kualitas pelayanan pada {{NAMA_SATKER}}.</td></tr>',
  '<tr><td style="vertical-align:top;">4. TARGET DAN SASARAN</td><td style="vertical-align:top;">:</td><td style="text-align:justify;">',
  'Terpenuhinya kebutuhan sarana dan prasarana sehingga meningkatkan kualitas pelayanan pada {{NAMA_SATKER}}.</td></tr>',
  '<tr><td style="vertical-align:top;">5. NAMA ORGANISASI PENGADAAN BARANG/JASA</td><td style="vertical-align:top;">:</td><td>',
  'a. K/L/D/I : Kementerian Agama<br>',
  '&nbsp;&nbsp;&nbsp;Satker : {{NAMA_SATKER}}<br>',
  'b. KPA : {{KPA}}<br>',
  '&nbsp;&nbsp;&nbsp;PPK : {{PPK}}<br>',
  '&nbsp;&nbsp;&nbsp;Pejabat Pengadaan : {{PEJABAT_PENGADAAN}}</td></tr>',
  '<tr><td style="vertical-align:top;">6. SUMBER DANA DAN PEMBIAYAAN</td><td style="vertical-align:top;">:</td><td>',
  'a. Sumber Dana : {{SUMBER_DANA}}<br>',
  'b. Total Perkiraan Biaya Pekerjaan : {{PAGU}}<br>',
  '&nbsp;&nbsp;&nbsp;({{PAGU_TERBILANG}})</td></tr>',
  '<tr><td style="vertical-align:top;">7. JENIS KONTRAK</td><td style="vertical-align:top;">:</td><td>{{JENIS_KONTRAK}}</td></tr>',
  '<tr><td style="vertical-align:top;">8. JANGKA WAKTU PELAKSANAAN</td><td style="vertical-align:top;">:</td><td>',
  '{{JANGKA_WAKTU}} sejak ditandatanganinya Surat Pesanan</td></tr>',
  '<tr><td style="vertical-align:top;">9. RUANG LINGKUP, LOKASI PEKERJAAN</td><td style="vertical-align:top;">:</td><td>',
  'a. {{NAMA_PAKET}}<br>b. Lokasi di {{LOKASI}}</td></tr>',
  '<tr><td style="vertical-align:top;">10. KELUARAN/PRODUK YANG DIHASILKAN</td><td style="vertical-align:top;">:</td><td style="text-align:justify;">',
  'Paket pengadaan ini harus memiliki jaminan kualitas. Apabila ditemukan barang yang mengalami kerusakan, harus dapat dilakukan perbaikan atau penggantian dengan spesifikasi barang yang sama.</td></tr>',
  '<tr><td style="vertical-align:top;">11. PERSYARATAN PENYEDIA</td><td style="vertical-align:top;">:</td><td style="text-align:justify;">',
  'a. Memiliki izin usaha sesuai bidang pekerjaan dengan KBLI yang relevan;<br>',
  'b. Memiliki NIB;<br>',
  'c. Akta Pendirian Perusahaan beserta perubahannya;<br>',
  'd. Tidak dalam pengawasan pengadilan, tidak pailit, dan kegiatan usahanya tidak sedang diberhentikan;<br>',
  'e. Tidak masuk Daftar Hitam dan tidak pernah wanprestasi;<br>',
  'f. Memiliki status valid Keterangan Wajib Pajak;<br>',
  'g. Memiliki pengalaman pekerjaan sejenis, kecuali pelaku usaha yang baru berdiri kurang dari 3 (tiga) tahun.</td></tr>',
  '<tr><td style="vertical-align:top;">12. METODE PENGADAAN</td><td style="vertical-align:top;">:</td><td>{{METODE_PENGADAAN}}</td></tr>',
  '<tr><td style="vertical-align:top;">13. SPESIFIKASI TEKNIS</td><td style="vertical-align:top;">:</td><td>Terlampir (lihat dokumen HPS)</td></tr>',
  '</table><br><br>',
  '<table style="width:100%;"><tr><td style="width:60%;"></td><td style="text-align:left;">',
  'Indramayu, {{TANGGAL_CETAK}}<br>Pejabat Pembuat Komitmen,<br><br><br><br>',
  '<b>{{PPK}}</b><br>NIP. {{NIP_PPK}}',
  '</td></tr></table></div>'
].join('\n');

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

  // Seed MASTER_DOCUMENT_REQUIREMENTS (Tahap 5) kalau sheet-nya masih kosong.
  // Aman dijalankan ulang: tidak akan menduplikasi kalau sudah pernah diisi.
  var existingReqs = readAllRows_('MASTER_DOCUMENT_REQUIREMENTS').rows;
  if (existingReqs.length === 0) {
    SEED_DOCUMENT_REQUIREMENTS.forEach(function (r) {
      appendRow_('MASTER_DOCUMENT_REQUIREMENTS', {
        document_requirement_id: nextId_('DR'), jenis_pengadaan_id: '',
        nama_dokumen: r.nama, kode_dokumen: r.kode, wajib: r.wajib,
        kondisi: r.kondisi || '', multiple_file: r.multiple, urutan: r.urutan, status: 'AKTIF'
      });
    });
  }

  // Seed template KAK default (Tahap 6) kalau belum ada template KAK sama sekali.
  var existingTemplates = readAllRows_('TEMPLATES').rows.filter(function (t) { return t.doc_type === 'KAK'; });
  if (existingTemplates.length === 0) {
    appendRow_('TEMPLATES', {
      template_id: nextId_('TPL'), jenis_pengadaan_id: '', doc_type: 'KAK',
      nama_template: 'Template KAK Umum', html_template: SEED_TEMPLATE_KAK, status: 'AKTIF'
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

/**
 * TAHAP 9 (security hardening).
 * Membersihkan baris SESSIONS yang sudah EXPIRED/REVOKED atau lewat masa
 * berlaku. Ini menutup utang teknis yang dicatat sejak Tahap 1 (komentar di
 * Auth.gs): tanpa ini, sheet SESSIONS tumbuh terus dan validateSession_ --
 * yang memindai seluruh sheet tiap request -- makin lama makin lambat.
 *
 * Pasang sebagai trigger harian: di editor Apps Script -> ikon jam (Triggers)
 * -> Add Trigger -> pilih fungsi ini -> Time-driven -> Day timer.
 * Aman dijalankan manual kapan saja; sesi yang masih aktif tidak tersentuh.
 */
function cleanupExpiredSessions() {
  var sheet = getSheet_('SESSIONS');
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) {
    Logger.log('cleanupExpiredSessions(): tidak ada sesi untuk dibersihkan.');
    return;
  }
  var headers = values[0];
  var kolomStatus = headers.indexOf('status');
  var kolomExpires = headers.indexOf('expires_at');
  var sekarang = new Date();
  var dihapus = 0;

  // Dari bawah ke atas supaya nomor baris di atasnya tidak bergeser.
  for (var r = values.length - 1; r >= 1; r--) {
    var status = values[r][kolomStatus];
    var expiresAt = values[r][kolomExpires];
    var sudahLewat = expiresAt && new Date(expiresAt) < sekarang;
    if (status === 'EXPIRED' || status === 'REVOKED' || sudahLewat) {
      sheet.deleteRow(r + 1);
      dihapus++;
    }
  }
  Logger.log('cleanupExpiredSessions(): ' + dihapus + ' baris sesi lama dihapus.');
}

/**
 * TAHAP 9. Pemeriksaan mandiri konfigurasi keamanan -- dijalankan manual dari
 * editor, hasilnya dibaca di Execution log. Sengaja hanya MELAPORKAN, tidak
 * memperbaiki sendiri, supaya tidak ada perubahan diam-diam pada sistem yang
 * sudah berjalan.
 */
function securityHealthCheck() {
  var laporan = [];

  if (!SCRIPT_PROPS.getProperty('SPREADSHEET_ID')) laporan.push('KRITIS: SPREADSHEET_ID belum diset di Script Properties.');
  if (!SCRIPT_PROPS.getProperty('ROOT_DRIVE_FOLDER_ID')) laporan.push('KRITIS: ROOT_DRIVE_FOLDER_ID belum diset di Script Properties.');

  var users = readAllRows_('USERS').rows;
  var adminAktif = users.filter(function (u) { return u.role === 'ADMIN' && u.status === 'AKTIF'; });
  if (adminAktif.length === 0) laporan.push('KRITIS: tidak ada satu pun akun ADMIN yang aktif.');
  if (adminAktif.length > 3) laporan.push('PERHATIAN: ada ' + adminAktif.length + ' akun ADMIN aktif. Prinsip least privilege: batasi seperlunya.');

  users.forEach(function (u) {
    if (!u.password_hash || !u.password_salt) laporan.push('KRITIS: user ' + u.username + ' tidak punya password hash/salt yang benar.');
    if (u.status === 'AKTIF' && !u.last_login) laporan.push('PERHATIAN: user ' + u.username + ' aktif tapi belum pernah login.');
  });

  var sesiAktif = readAllRows_('SESSIONS').rows.filter(function (s) { return s.status === 'ACTIVE'; });
  var totalSesi = readAllRows_('SESSIONS').rows.length;
  if (totalSesi > 200) laporan.push('PERHATIAN: sheet SESSIONS berisi ' + totalSesi + ' baris (' + sesiAktif.length + ' aktif). Jalankan cleanupExpiredSessions() atau pasang trigger hariannya.');

  var auditCount = readAllRows_('AUDIT_LOGS').rows.length;
  if (auditCount > 20000) laporan.push('PERHATIAN: AUDIT_LOGS berisi ' + auditCount + ' baris. Pertimbangkan arsip ke Spreadsheet terpisah (lihat Bagian O: batas 10 juta sel per file).');

  if (laporan.length === 0) {
    Logger.log('securityHealthCheck(): tidak ditemukan masalah.');
  } else {
    Logger.log('securityHealthCheck(): ' + laporan.length + ' temuan:\n- ' + laporan.join('\n- '));
  }
  return laporan;
}