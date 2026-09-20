/**
 * api.js
 * Menggantikan google.script.run (yang HANYA bisa dipakai kalau HTML disajikan
 * oleh Apps Script sendiri) dengan fetch() biasa, karena frontend ini sekarang
 * di-host terpisah di GitHub Pages — origin yang berbeda dari backend Apps Script.
 *
 * SENGAJA memakai Content-Type: text/plain (bukan application/json) supaya
 * browser memperlakukan ini sebagai "simple request" dan TIDAK mengirim
 * preflight OPTIONS — Apps Script Web App tidak bisa menjawab preflight
 * (tidak ada dukungan doOptions()), jadi permintaan berformat application/json
 * akan selalu gagal kena CORS di sini. Body-nya tetap JSON biasa; hanya
 * header Content-Type-nya yang disamarkan jadi text/plain. Lihat README.md
 * bagian "Kenapa CORS-nya begini" untuk penjelasan lengkap.
 */
async function callApiOnce_(module, action, payload) {
  var actionPath = module + '.' + action;

  if (!API_URL || API_URL.indexOf('PASTE_URL') !== -1) {
    appError(actionPath + ': API_URL belum diisi di js/config.js. Isi dulu dengan URL Web App Apps Script Anda.');
    throw { errorCode: 'CONFIG_ERROR', message: 'API_URL belum diisi di js/config.js.' };
  }

  appLog(actionPath + ': mengirim permintaan ->', API_URL, payload || {});

  var response;
  try {
    response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        module: module,
        action: action,
        payload: payload || {},
        sessionToken: getSessionToken()
      })
      // Sengaja TIDAK menyertakan credentials:'include' — sistem ini tidak
      // memakai cookie sama sekali (token dikirim eksplisit di body), dan
      // menyertakan credentials justru mempersulit CORS tanpa manfaat apa pun.
    });
  } catch (networkErr) {
    // Kalau ini muncul di console: hampir selalu berarti CORS diblokir browser,
    // API_URL salah/typo, atau Web App belum ter-deploy. Cek tab Network di
    // DevTools untuk lihat request-nya persis gagal di mana.
    appError(actionPath + ': GAGAL fetch (kemungkinan CORS/jaringan/API_URL salah) ->', networkErr);
    throw { errorCode: 'NETWORK_ERROR', message: 'Gagal terhubung ke server. Periksa koneksi internet atau API_URL di config.js.' };
  }

  var res;
  var mentahUntukDebug = '';
  try {
    // Baca sebagai teks dulu (bukan langsung response.json()) supaya kalau
    // parse-nya gagal, potongan respons mentahnya masih bisa dicatat ke console
    // untuk membantu diagnosis. PENYEBAB PALING SERING: Apps Script Web App
    // meng-redirect respons doPost() lewat URL sementara
    // script.googleusercontent.com/macros/echo?... (mekanisme internal Google,
    // bukan sesuatu yang bisa kita ubah) -- URL sementara itu KADANG 404 secara
    // acak, biasanya kalau eksekusi backend-nya agak lama. Kalau ini muncul,
    // responsnya akan berupa halaman HTML (<!DOCTYPE ...>), bukan JSON.
    mentahUntukDebug = await response.text();
    res = JSON.parse(mentahUntukDebug);
  } catch (parseErr) {
    appError(actionPath + ': respons server bukan JSON valid (status ' + response.status + ') ->', parseErr,
      'potongan respons:', mentahUntukDebug.slice(0, 300));
    throw { errorCode: 'BAD_RESPONSE', message: 'Respons server tidak dapat dibaca (bukan JSON valid).' };
  }

  if (res && res.success) {
    // BUG FIX: pernah terjadi res.success === true tapi res.data hilang/undefined
    // sama sekali (bukan {} kosong -- ok_() di backend SELALU membungkus data
    // jadi {} minimal, jadi undefined/null di sini tidak mungkin datang dari
    // eksekusi backend yang benar). Kemungkinan besar ini bentuk lain dari
    // respons googleusercontent.com yang tidak lengkap/terpotong (lihat catatan
    // BAD_RESPONSE lain di atas) -- daripada diam-diam mengembalikan undefined
    // ke pemanggil (yang berakhir jadi TypeError membingungkan jauh di
    // auth.js/app.js), diperlakukan tegas sebagai respons tidak valid di sini.
    if (res.data === undefined || res.data === null) {
      appError(actionPath + ': respons "sukses" tapi field data kosong/hilang (kemungkinan respons terpotong) ->', res);
      throw { errorCode: 'BAD_RESPONSE', message: 'Respons server tidak lengkap. Coba lagi.' };
    }
    appLog(actionPath + ': sukses ->', res.data);
    return res.data;
  }
  appWarn(actionPath + ': server menjawab gagal ->', res);
  throw res || { errorCode: 'UNKNOWN', message: 'Terjadi kesalahan tidak diketahui.' };
}

/**
 * opts.retryable: true -> kalau gagal karena error TEKNIS/sesaat (BAD_RESPONSE
 * dari kasus googleusercontent.com 404 di atas, atau NETWORK_ERROR), dicoba
 * ulang otomatis sampai 2x dengan jeda singkat sebelum akhirnya melempar error
 * ke pemanggil. TIDAK pernah retry untuk error yang berasal dari server
 * (res.success === false dengan errorCode dari AppError_, mis. validasi/akses
 * ditolak) -- itu bukan masalah "sesaat", mengulang tidak akan mengubah hasil.
 *
 * PENTING (keamanan data): opts.retryable HANYA dipasang true untuk aksi BACA
 * (list/detail/history/preview/dsb) lewat callApiCached() atau secara eksplisit
 * di app.js -- SENGAJA TIDAK PERNAH default true untuk aksi TULIS
 * (create/update/upload/finalize/delete/login/dst). Kalau permintaan tulis
 * sempat sampai ke server dan sukses dieksekusi TAPI responsnya yang gagal
 * kebaca (persis skenario 404 googleusercontent.com ini), mengulang otomatis
 * bisa membuat data TERDUPLIKASI (mis. dua paket, dua PDF ter-generate, dst).
 * Untuk aksi tulis, error tetap ditampilkan ke user apa adanya -- lebih aman
 * user menekan tombol lagi secara sadar (dan bisa melihat kalau ternyata datanya
 * sudah masuk) daripada sistem mengulang sendiri tanpa sepengetahuan user.
 */
async function callApi(module, action, payload, opts) {
  opts = opts || {};
  var maxRetries = opts.retryable ? 2 : 0;
  var percobaan = 0;
  for (;;) {
    try {
      return await callApiOnce_(module, action, payload);
    } catch (err) {
      var errorCodeTeknis = !err || !err.errorCode || err.errorCode === 'BAD_RESPONSE' || err.errorCode === 'NETWORK_ERROR';
      if (errorCodeTeknis && percobaan < maxRetries) {
        percobaan++;
        appWarn(module + '.' + action + ': error teknis, coba lagi (' + percobaan + '/' + maxRetries + ')... ->', err);
        await new Promise(function (resolve) { setTimeout(resolve, 700 * percobaan); });
        continue;
      }
      throw err;
    }
  }
}

/**
 * Cache data sederhana di memori (hilang saat halaman di-reload penuh, tapi
 * BERTAHAN selama pindah-pindah menu dalam satu sesi) -- inilah yang membuat
 * navigasi antar menu tidak selalu memanggil server ulang. Tiap halaman tetap
 * punya tombol "Perbarui Data" (lihat app.js: refreshButtonHtml()) yang
 * memanggil ulang dengan forceRefresh=true untuk melewati cache.
 */
var dataCache = {};

function callApiCached(cacheKey, module, action, payload, forceRefresh) {
  if (!forceRefresh && dataCache.hasOwnProperty(cacheKey)) {
    appLog('cache: pakai data tersimpan untuk ->', cacheKey);
    return Promise.resolve(dataCache[cacheKey]);
  }
  return callApi(module, action, payload, { retryable: true }).then(function (data) {
    dataCache[cacheKey] = data;
    return data;
  });
}

// Dipanggil setelah operasi tulis (create/update/cancel) supaya menu lain
// yang datanya ikut berubah tidak menampilkan data basi dari cache. Lebih
// aman membersihkan semuanya sekaligus daripada melacak dependensi
// antar-cache satu-satu (mis. paket baru mengubah pagu terpakai DAN status
// satker DAN dashboard sekaligus).
function clearAllCache() {
  dataCache = {};
  appLog('cache: dibersihkan seluruhnya setelah ada perubahan data.');
}