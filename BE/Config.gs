/**
 * Config.gs
 * Akses ke rahasia (Script Properties) dan pengaturan non-rahasia (sheet CONFIG).
 * Rahasia (SPREADSHEET_ID, ROOT_DRIVE_FOLDER_ID, dst.) TIDAK PERNAH ditulis di kode
 * atau di Spreadsheet — hanya di Script Properties, diisi manual sekali di awal.
 */

var SCRIPT_PROPS = PropertiesService.getScriptProperties();

// Nilai default sistem — dipakai jika sheet CONFIG belum berisi key terkait.
var DEFAULTS = {
  SESSION_TIMEOUT_MINUTES: 30,   // sliding: tidak aktif selama ini -> logout otomatis
  SESSION_ABSOLUTE_HOURS: 12,    // batas absolut umur sebuah sesi walau terus aktif
  PASSWORD_ITERATIONS: 3000,     // jumlah iterasi hashing PBKDF2-manual (lihat Utils.gs)
  MAX_FAILED_LOGIN: 5,           // percobaan gagal sebelum akun dikunci sementara
  LOCKOUT_MINUTES: 15,           // lama penguncian akun
  CAPTCHA_TTL_SECONDS: 300,      // umur satu challenge CAPTCHA (5 menit)
  MAX_FILE_SIZE_MB: 15           // dipakai mulai Tahap 5 (Document Management)
};

function getSpreadsheetId_() {
  var id = SCRIPT_PROPS.getProperty('SPREADSHEET_ID');
  if (!id) {
    throw new Error('SPREADSHEET_ID belum diset di Script Properties. Lihat README.md bagian setup.');
  }
  return id;
}

function getRootDriveFolderId_() {
  var id = SCRIPT_PROPS.getProperty('ROOT_DRIVE_FOLDER_ID');
  if (!id) {
    throw new Error('ROOT_DRIVE_FOLDER_ID belum diset di Script Properties. Lihat README.md bagian setup.');
  }
  return id;
}

/**
 * Membaca satu nilai dari sheet CONFIG, dengan cache (6 jam) supaya tidak
 * membaca Spreadsheet berulang kali untuk nilai yang jarang berubah.
 */
function getConfig_(key, defaultValue) {
  var cache = CacheService.getScriptCache();
  var cacheKey = 'config_' + key;
  var cached = cache.get(cacheKey);
  if (cached !== null) return cached;

  var row = findRowByField_('CONFIG', 'key', key);
  var value = row ? row.value : defaultValue;
  cache.put(cacheKey, String(value), 21600); // 6 jam
  return value;
}

function getConfigNumber_(key, defaultValue) {
  var v = getConfig_(key, defaultValue);
  var n = Number(v);
  return isNaN(n) ? defaultValue : n;
}
