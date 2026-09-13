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
async function callApi(module, action, payload) {
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
  try {
    res = await response.json();
  } catch (parseErr) {
    appError(actionPath + ': respons server bukan JSON valid ->', parseErr, response.status);
    throw { errorCode: 'BAD_RESPONSE', message: 'Respons server tidak dapat dibaca (bukan JSON valid).' };
  }

  if (res && res.success) {
    appLog(actionPath + ': sukses ->', res.data);
    return res.data;
  }
  appWarn(actionPath + ': server menjawab gagal ->', res);
  throw res || { errorCode: 'UNKNOWN', message: 'Terjadi kesalahan tidak diketahui.' };
}