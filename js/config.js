/**
 * config.js
 * Satu-satunya tempat yang perlu diubah setelah backend Apps Script dideploy.
 *
 * Cara mendapatkan URL-nya: di proyek Apps Script -> Deploy -> Manage deployments
 * -> salin "Web app URL" (formatnya https://script.google.com/macros/s/XXXX/exec).
 *
 * PENTING: URL ini TETAP SAMA setiap kali Anda memperbarui kode lewat
 * "Manage deployments -> Edit -> New version". URL hanya berubah kalau Anda
 * membuat deployment BARU dari awal (bukan versi baru dari deployment yang sama).
 * Jadi setelah diisi sekali, umumnya tidak perlu diubah lagi untuk update rutin.
 */
const API_URL = 'https://script.google.com/macros/s/AKfycbw6-tbf3Y1LerdWTFF66haJ2vJ5wRE21iAdQ9vGUjl7kf3b0hT4OxHtZXXdhvrGEvlrUA/exec';

/**
 * Nyalakan/matikan log aplikasi di console browser (F12 -> tab Console) dari
 * SATU saklar ini saja. Set ke false kalau sistem sudah stabil dan tidak
 * sedang didebug -- semua pemanggilan appLog/appWarn/appError di file lain
 * (lihat utils.js) otomatis ikut diam, tidak perlu diubah satu-satu.
 */
const ENABLE_LOGGING = true;