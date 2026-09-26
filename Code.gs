/**
 * SIPADU - Sistem Informasi Pengadaan Terpadu
 * Backend Google Apps Script (Spreadsheet + Drive).
 *
 * Langkah pasang:
 *  1. Buat Spreadsheet baru, buka Extensions > Apps Script, tempel berkas ini.
 *  2. Jalankan fungsi setup() satu kali, izinkan aksesnya.
 *  3. Deploy > New deployment > Web app:
 *        Execute as        : Me
 *        Who has access    : Anyone
 *     Salin URL yang berakhiran /exec ke aplikasi.
 *  4. Setiap kali kode diubah: Deploy > Manage deployments > pensil >
 *     Version: New version > Deploy. JANGAN membuat deployment baru,
 *     karena URL akan berganti dan aplikasi akan menerima 404.
 */

var TTL_JAM = 12;              // masa berlaku sesi
var CACHE_DETIK = 45;          // umur cache tabel di server
var BAGIKAN_TAUTAN = true;     // berkas Drive dapat dibuka lewat tautan

var SKEMA = {
  Config:    ['key', 'value'],
  Users:     ['id', 'nama', 'nip', 'username', 'email', 'role', 'pass', 'salt', 'aktif', 'created_at', 'last_login'],
  Pejabat:   ['id', 'nama', 'nip', 'pangkat', 'jabatan', 'satker_id', 'aktif'],
  Satker:    ['id', 'kode_satker', 'nama', 'singkatan', 'jenis', 'alamat', 'kecamatan', 'kode_pos',
              'telp', 'email', 'website', 'kepala', 'nip_kepala', 'jabatan_kpa', 'folder_id', 'aktif'],
  Penugasan: ['id', 'tahun', 'satker_id', 'user_id', 'sp_dipa', 'tgl_dipa', 'ada_pengadaan',
              'kpa_id', 'ppk_id', 'pp_id', 'catatan'],
  Paket:     ['id', 'tahun', 'satker_id', 'jenis', 'nama', 'pagu', 'nilai', 'penyedia_id', 'metode',
              'jenis_kontrak', 'jangka_waktu', 'sumber_dana', 'lokasi', 'ada_pph', 'status',
              'kpa_id', 'ppk_id', 'pp_id', 'meta', 'folder_id', 'created_at', 'updated_at'],
  Penyedia:  ['id', 'nama', 'bentuk', 'direktur', 'jabatan_direktur', 'alamat', 'npwp', 'telp',
              'email', 'cp_file_id', 'cp_url', 'aktif'],
  Dokumen:   ['id', 'paket_id', 'kode', 'sub', 'nama_file', 'file_id', 'url', 'mime', 'size',
              'keterangan', 'uploaded_by', 'uploaded_at'],
  HPS:       ['id', 'paket_id', 'part', 'payload', 'total', 'updated_at'],
  Monev:     ['id', 'paket_id', 'payload', 'updated_at'],
  Log:       ['ts', 'user', 'aksi', 'detail']
};

/* ============================ PEMASANGAN ============================ */
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(SKEMA).forEach(function (nama) {
    var sh = ss.getSheetByName(nama) || ss.insertSheet(nama);
    if (sh.getLastRow() === 0) {
      sh.getRange(1, 1, 1, SKEMA[nama].length).setValues([SKEMA[nama]]).setFontWeight('bold');
      sh.setFrozenRows(1);
    }
  });
  var kosong = ss.getSheetByName('Sheet1') || ss.getSheetByName('Sheet 1');
  if (kosong && ss.getSheets().length > 1) ss.deleteSheet(kosong);

  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('SECRET')) props.setProperty('SECRET', Utilities.getUuid() + Utilities.getUuid());

  var root = props.getProperty('ROOT_FOLDER');
  if (!root) {
    var f = DriveApp.createFolder('SIPADU - Berkas Pengadaan');
    root = f.getId();
    props.setProperty('ROOT_FOLDER', root);
  }
  setConfig('folder_root', root);
  if (!getConfig('instansi')) setConfig('instansi', 'Kantor Kementerian Agama Kabupaten Indramayu');
  if (!getConfig('kota')) setConfig('kota', 'Indramayu');

  if (!bacaTabel('Users').length) {
    var salt = Utilities.getUuid();
    tulisBaris('Users', {
      id: idBaru('U'), nama: 'Administrator', username: 'admin', role: 'admin',
      pass: sandiHash('admin12345', salt), salt: salt, aktif: true, created_at: new Date()
    });
    Logger.log('Akun awal dibuat -> username: admin, sandi: admin12345 (segera ganti).');
  }
  Logger.log('Setup selesai. Folder Drive: ' + root);
  return 'OK';
}

/* ============================ ROUTING ============================ */
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (!p.action) {
    return HtmlService.createHtmlOutput(
      '<h3>SIPADU API aktif</h3><p>Versi ' + (getConfig('versi') || '1.0.0') +
      '. Gunakan aplikasi SIPADU untuk mengakses data.</p>');
  }
  var data = {};
  try { data = p.data ? JSON.parse(p.data) : {}; } catch (err) { }
  var hasil = jalankan({ action: p.action, token: p.token, data: data });
  if (p.callback) {
    return ContentService.createTextOutput(p.callback + '(' + JSON.stringify(hasil) + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return balas(hasil);
}

function doPost(e) {
  var req = {};
  try { req = JSON.parse(e.postData.contents); } catch (err) {
    return balas({ ok: false, error: 'Permintaan tidak dikenali.' });
  }
  return balas(jalankan(req));
}

function balas(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function jalankan(req) {
  try {
    var aksi = String(req.action || '');
    var data = req.data || {};
    if (aksi === 'ping') return { ok: true, data: { versi: getConfig('versi') || '1.0.0', waktu: new Date() } };
    if (aksi === 'login') return { ok: true, data: login(data) };

    var u = periksaToken(req.token);
    if (!u) return { ok: false, code: 'AUTH', error: 'Sesi tidak berlaku. Silakan masuk kembali.' };

    var fn = AKSI[aksi];
    if (!fn) return { ok: false, error: 'Aksi "' + aksi + '" tidak dikenal.' };
    return { ok: true, data: fn(data, u) };
  } catch (err) {
    return { ok: false, error: (err && err.message) ? err.message : String(err) };
  }
}

/* ============================ AUTENTIKASI ============================ */
function rahasia() {
  var s = PropertiesService.getScriptProperties().getProperty('SECRET');
  if (!s) { s = Utilities.getUuid() + Utilities.getUuid(); PropertiesService.getScriptProperties().setProperty('SECRET', s); }
  return s;
}
function sandiHash(sandi, salt) {
  var b = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + '|' + sandi, Utilities.Charset.UTF_8);
  return b.map(function (x) { return ((x & 0xff) + 0x100).toString(16).slice(1); }).join('');
}
function buatToken(u) {
  var isi = Utilities.base64EncodeWebSafe(JSON.stringify({ u: u.id, r: u.role, e: Date.now() + TTL_JAM * 3600000 }));
  var tanda = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(isi, rahasia()));
  return isi + '.' + tanda;
}
function periksaToken(t) {
  if (!t || t.indexOf('.') < 0) return null;
  var bagian = String(t).split('.');
  var tanda = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(bagian[0], rahasia()));
  if (tanda !== bagian[1]) return null;
  var isi;
  try { isi = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(bagian[0])).getDataAsString()); }
  catch (e) { return null; }
  if (!isi.e || Date.now() > isi.e) return null;
  var u = cariBaris('Users', isi.u);
  if (!u || u.aktif === false) return null;
  return u;
}
function login(d) {
  var user = String(d.username || '').trim().toLowerCase();
  var baris = bacaTabel('Users').filter(function (r) {
    return String(r.username || '').toLowerCase() === user;
  })[0];
  if (!baris || baris.aktif === false) throw new Error('Nama pengguna atau kata sandi salah.');
  if (sandiHash(String(d.password || ''), baris.salt) !== baris.pass) throw new Error('Nama pengguna atau kata sandi salah.');
  perbaruiBaris('Users', baris.id, { last_login: new Date() });
  catat(baris.id, 'login', '');
  return {
    token: buatToken(baris),
    exp: Date.now() + TTL_JAM * 3600000,
    user: { id: baris.id, nama: baris.nama, username: baris.username, role: baris.role, email: baris.email, nip: baris.nip }
  };
}

/* ============================ TABEL ============================ */
function ss() { return SpreadsheetApp.getActiveSpreadsheet(); }
function lembar(nama) {
  var sh = ss().getSheetByName(nama);
  if (!sh) throw new Error('Lembar "' + nama + '" belum dibuat. Jalankan setup().');
  return sh;
}
function bacaTabel(nama) {
  var c = CacheService.getScriptCache(), kunci = 'tbl_' + nama;
  var tunai = c.get(kunci);
  if (tunai) { try { return JSON.parse(tunai); } catch (e) { } }
  var sh = lembar(nama), nilai = sh.getDataRange().getValues();
  if (nilai.length < 2) return [];
  var head = nilai[0], out = [];
  for (var r = 1; r < nilai.length; r++) {
    if (!nilai[r][0] && !nilai[r][1]) continue;
    var o = {};
    for (var k = 0; k < head.length; k++) {
      var v = nilai[r][k];
      o[head[k]] = (v instanceof Date) ? v.toISOString() : v;
    }
    o.__row = r + 1;
    out.push(o);
  }
  try { c.put(kunci, JSON.stringify(out), CACHE_DETIK); } catch (e) { }
  return out;
}
function buangCache(nama) { CacheService.getScriptCache().remove('tbl_' + nama); }
function cariBaris(nama, id) {
  if (!id) return null;
  var r = bacaTabel(nama).filter(function (x) { return String(x.id) === String(id); });
  return r.length ? r[0] : null;
}
function idBaru(pre) {
  return (pre || 'X') + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
function tulisBaris(nama, obj) {
  var sh = lembar(nama), head = SKEMA[nama];
  if (!obj.id && head[0] === 'id') obj.id = idBaru(nama.charAt(0));
  sh.appendRow(head.map(function (h) { return obj[h] === undefined ? '' : obj[h]; }));
  buangCache(nama);
  return obj;
}
function perbaruiBaris(nama, id, patch) {
  var sh = lembar(nama), head = SKEMA[nama];
  var baris = cariBaris(nama, id);
  if (!baris) throw new Error('Data tidak ditemukan.');
  var nilai = head.map(function (h) {
    return patch[h] !== undefined ? patch[h] : (baris[h] === undefined ? '' : baris[h]);
  });
  sh.getRange(baris.__row, 1, 1, head.length).setValues([nilai]);
  buangCache(nama);
  var out = {};
  head.forEach(function (h, i) { out[h] = nilai[i]; });
  return out;
}
function hapusBaris(nama, id) {
  var baris = cariBaris(nama, id);
  if (!baris) return false;
  lembar(nama).deleteRow(baris.__row);
  buangCache(nama);
  return true;
}
function getConfig(k) {
  var r = bacaTabel('Config').filter(function (x) { return x.key === k; });
  return r.length ? r[0].value : '';
}
function setConfig(k, v) {
  var r = bacaTabel('Config').filter(function (x) { return x.key === k; });
  if (r.length) lembar('Config').getRange(r[0].__row, 2).setValue(v);
  else lembar('Config').appendRow([k, v]);
  buangCache('Config');
}
function catat(userId, aksi, detail) {
  try { lembar('Log').appendRow([new Date(), userId, aksi, detail]); } catch (e) { }
}
function bool(v) {
  if (v === true || v === false) return v;
  var s = String(v).toLowerCase();
  return s === 'true' || s === 'ya' || s === '1';
}

/* ============================ HAK AKSES ============================ */
function adminSaja(u) { if (u.role !== 'admin') throw new Error('Hanya admin yang dapat melakukan ini.'); }
function bolehSatker(u, satkerId, tahun) {
  if (u.role === 'admin') return true;
  var ada = bacaTabel('Penugasan').filter(function (t) {
    return String(t.satker_id) === String(satkerId) && String(t.user_id) === String(u.id) &&
      (!tahun || String(t.tahun) === String(tahun));
  });
  if (!ada.length) throw new Error('Anda tidak ditugaskan pada satker ini.');
  return true;
}

/* ============================ FOLDER DRIVE ============================ */
function folderRoot() {
  var id = PropertiesService.getScriptProperties().getProperty('ROOT_FOLDER') || getConfig('folder_root');
  if (!id) throw new Error('Folder induk belum dibuat. Jalankan setup().');
  return DriveApp.getFolderById(id);
}
function subFolder(induk, nama) {
  var it = induk.getFoldersByName(nama);
  return it.hasNext() ? it.next() : induk.createFolder(nama);
}
function folderPaket(paket) {
  if (paket.folder_id) {
    try { return DriveApp.getFolderById(paket.folder_id); } catch (e) { }
  }
  var s = cariBaris('Satker', paket.satker_id) || { nama: 'Tanpa satker' };
  var f = subFolder(subFolder(subFolder(folderRoot(), 'TA ' + paket.tahun),
    ((s.kode_satker ? s.kode_satker + ' ' : '') + s.nama).substring(0, 100)),
    (paket.nama || 'Paket').substring(0, 100));
  perbaruiBaris('Paket', paket.id, { folder_id: f.getId() });
  return f;
}
function simpanBlob(folder, blob, namaFile) {
  var f = folder.createFile(blob.setName(namaFile));
  if (BAGIKAN_TAUTAN) {
    try { f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) { }
  }
  return f;
}

/* ============================ AKSI ============================ */
var AKSI = {

  logout: function (d, u) { catat(u.id, 'logout', ''); return true; },

  bootstrap: function (d, u) {
    var tahun = String(d.tahun || new Date().getFullYear());
    var cfg = {};
    bacaTabel('Config').forEach(function (r) { cfg[r.key] = r.value; });
    var users = bacaTabel('Users').map(function (r) {
      return { id: r.id, nama: r.nama, nip: r.nip, username: r.username, email: r.email, role: r.role, aktif: r.aktif !== false };
    });
    var daftarTahun = {};
    bacaTabel('Penugasan').forEach(function (t) { if (t.tahun) daftarTahun[t.tahun] = 1; });
    bacaTabel('Paket').forEach(function (t) { if (t.tahun) daftarTahun[t.tahun] = 1; });
    daftarTahun[tahun] = 1;
    return {
      config: cfg,
      tahun: Object.keys(daftarTahun).sort().reverse().map(function (t) { return { id: t }; }),
      satker: bersih(bacaTabel('Satker')),
      pejabat: bersih(bacaTabel('Pejabat')),
      penyedia: bersih(bacaTabel('Penyedia')),
      users: users,
      penugasan: bersih(bacaTabel('Penugasan')).map(function (t) {
        t.ada_pengadaan = t.ada_pengadaan === '' ? true : bool(t.ada_pengadaan);
        return t;
      })
    };
  },

  save: function (d, u) {
    var entity = d.entity, row = d.row || {};
    if (!SKEMA[entity]) throw new Error('Entitas tidak dikenal.');
    if (entity === 'Users' || entity === 'Penugasan') adminSaja(u);
    if (entity === 'Satker' && u.role !== 'admin') bolehSatker(u, row.id);

    if (entity === 'Users') {
      if (row.id) {
        delete row.pass; delete row.salt;
        return perbaruiBaris('Users', row.id, row);
      }
      var salt = Utilities.getUuid();
      row.salt = salt;
      row.pass = sandiHash(String(row.password || 'sipadu1234'), salt);
      delete row.password;
      row.created_at = new Date();
      return tulisBaris('Users', row);
    }
    if (entity === 'Penugasan') {
      row.ada_pengadaan = row.ada_pengadaan !== false;
      if (!row.id) {
        var lama = bacaTabel('Penugasan').filter(function (t) {
          return String(t.satker_id) === String(row.satker_id) && String(t.tahun) === String(row.tahun);
        })[0];
        if (lama) row.id = lama.id;
      }
    }
    return row.id ? perbaruiBaris(entity, row.id, row) : tulisBaris(entity, row);
  },

  remove: function (d, u) {
    adminSaja(u);
    if (!SKEMA[d.entity]) throw new Error('Entitas tidak dikenal.');
    catat(u.id, 'hapus', d.entity + ' ' + d.id);
    return hapusBaris(d.entity, d.id);
  },

  resetPassword: function (d, u) {
    adminSaja(u);
    var salt = Utilities.getUuid();
    perbaruiBaris('Users', d.id, { salt: salt, pass: sandiHash(String(d.password), salt) });
    catat(u.id, 'reset-sandi', d.id);
    return true;
  },

  saveConfig: function (d, u) {
    adminSaja(u);
    Object.keys(d).forEach(function (k) { setConfig(k, d[k]); });
    return true;
  },

  /* ---------- paket ---------- */
  paketList: function (d, u) {
    var tahun = String(d.tahun || new Date().getFullYear());
    var paket = bacaTabel('Paket').filter(function (p) { return String(p.tahun) === tahun; });
    var hitung = {};
    bacaTabel('Dokumen').forEach(function (x) {
      var m = hitung[x.paket_id] || (hitung[x.paket_id] = {});
      m[x.kode] = (m[x.kode] || 0) + 1;
    });
    var penyedia = {};
    bacaTabel('Penyedia').forEach(function (v) { penyedia[v.id] = v; });
    return paket.map(function (p) {
      var o = bersihBaris(p);
      o.ada_pph = bool(p.ada_pph);
      o.dok = hitung[p.id] || {};
      var v = penyedia[p.penyedia_id];
      if (v && v.cp_url) o.dok[12] = o.dok[12] || 1;   // company profile ikut dari data penyedia
      return o;
    });
  },

  paketDetail: function (d, u) {
    var p = cariBaris('Paket', d.id);
    if (!p) throw new Error('Paket tidak ditemukan.');
    bolehSatker(u, p.satker_id, p.tahun);
    var dok = bacaTabel('Dokumen').filter(function (x) { return String(x.paket_id) === String(p.id); });
    var hps = bacaHPS(p.id);
    var monev = bacaMonev(p.id);
    var out = bersihBaris(p);
    out.ada_pph = bool(p.ada_pph);
    return { paket: out, dokumen: bersih(dok), hps: hps, monev: monev };
  },

  savePaket: function (d, u) {
    var row = d.row || {};
    bolehSatker(u, row.satker_id || (cariBaris('Paket', row.id) || {}).satker_id, row.tahun);
    row.ada_pph = bool(row.ada_pph);
    row.updated_at = new Date();
    if (row.id) return bersihBaris(perbaruiBaris('Paket', row.id, row));
    row.created_at = new Date();
    return bersihBaris(tulisBaris('Paket', row));
  },

  removePaket: function (d, u) {
    var p = cariBaris('Paket', d.id);
    if (!p) return true;
    bolehSatker(u, p.satker_id, p.tahun);
    bacaTabel('Dokumen').filter(function (x) { return String(x.paket_id) === String(p.id); })
      .forEach(function (x) { hapusBaris('Dokumen', x.id); });
    bacaTabel('HPS').filter(function (x) { return String(x.paket_id) === String(p.id); })
      .forEach(function (x) { hapusBaris('HPS', x.id); });
    /* try/catch: lembar "Monev" mungkin belum ada bila admin belum menjalankan ulang
       setup() setelah pembaruan — jangan sampai penghapusan paket lama ikut gagal. */
    try {
      bacaTabel('Monev').filter(function (x) { return String(x.paket_id) === String(p.id); })
        .forEach(function (x) { hapusBaris('Monev', x.id); });
    } catch (e) { }
    hapusBaris('Paket', p.id);
    catat(u.id, 'hapus-paket', p.nama);
    return true;
  },

  /* ---------- HPS ---------- */
  saveHPS: function (d, u) {
    var p = cariBaris('Paket', d.paket_id);
    if (!p) throw new Error('Paket tidak ditemukan.');
    bolehSatker(u, p.satker_id, p.tahun);
    bacaTabel('HPS').filter(function (x) { return String(x.paket_id) === String(d.paket_id); })
      .forEach(function (x) { hapusBaris('HPS', x.id); });
    var teks = String(d.payload || ''), maks = 40000, bagian = 0;
    for (var i = 0; i < teks.length; i += maks) {
      tulisBaris('HPS', {
        id: idBaru('H'), paket_id: d.paket_id, part: bagian++,
        payload: teks.substr(i, maks), total: d.total || 0, updated_at: new Date()
      });
    }
    return true;
  },

  /* ---------- monev (penilaian realisasi per item + kesimpulan) ---------- */
  saveMonev: function (d, u) {
    var p = cariBaris('Paket', d.paket_id);
    if (!p) throw new Error('Paket tidak ditemukan.');
    bolehSatker(u, p.satker_id, p.tahun);
    bacaTabel('Monev').filter(function (x) { return String(x.paket_id) === String(d.paket_id); })
      .forEach(function (x) { hapusBaris('Monev', x.id); });
    tulisBaris('Monev', {
      id: idBaru('M'), paket_id: d.paket_id, payload: String(d.payload || ''), updated_at: new Date()
    });
    return true;
  },

  /* ---------- berkas ---------- */
  uploadOne: function (d, u) {
    var blob = Utilities.newBlob(Utilities.base64Decode(d.data), d.mime || 'application/octet-stream', d.nama_file);
    return simpanDokumen(d, blob, u);
  },

  uploadInit: function (d, u) {
    var uid = idBaru('T');
    var tmp = subFolder(subFolder(folderRoot(), '_sementara'), uid);
    var meta = {};
    Object.keys(d).forEach(function (k) { meta[k] = d[k]; });
    meta.folder_tmp = tmp.getId();
    meta.user = u.id;
    CacheService.getScriptCache().put('up_' + uid, JSON.stringify(meta), 21600);
    return { uid: uid };
  },

  uploadChunk: function (d, u) {
    var meta = ambilUpload(d.uid);
    var tmp = DriveApp.getFolderById(meta.folder_tmp);
    var nama = ('00000' + d.i).slice(-5);
    var lama = tmp.getFilesByName(nama);
    while (lama.hasNext()) lama.next().setTrashed(true);
    tmp.createFile(Utilities.newBlob(Utilities.base64Decode(d.data), 'application/octet-stream', nama));
    return { i: d.i };
  },

  uploadFinish: function (d, u) {
    var meta = ambilUpload(d.uid);
    var tmp = DriveApp.getFolderById(meta.folder_tmp);
    var potongan = [];
    var it = tmp.getFiles();
    while (it.hasNext()) { var f = it.next(); potongan.push({ nama: f.getName(), file: f }); }
    potongan.sort(function (a, b) { return a.nama < b.nama ? -1 : 1; });
    if (!potongan.length) throw new Error('Tidak ada potongan berkas yang tersimpan.');
    var semua = [];
    potongan.forEach(function (p) {
      var b = p.file.getBlob().getBytes();
      for (var i = 0; i < b.length; i += 30000) Array.prototype.push.apply(semua, b.slice(i, i + 30000));
    });
    var blob = Utilities.newBlob(semua, meta.mime || 'application/octet-stream', meta.nama_file);
    var hasil = simpanDokumen(meta, blob, { id: meta.user });
    tmp.setTrashed(true);
    CacheService.getScriptCache().remove('up_' + d.uid);
    return hasil;
  },

  removeDok: function (d, u) {
    var row = cariBaris('Dokumen', d.id);
    if (!row) return true;
    var p = cariBaris('Paket', row.paket_id);
    if (p) bolehSatker(u, p.satker_id, p.tahun);
    if (row.file_id) { try { DriveApp.getFileById(row.file_id).setTrashed(true); } catch (e) { } }
    hapusBaris('Dokumen', d.id);
    catat(u.id, 'hapus-berkas', row.nama_file);
    return true;
  }
};

function ambilUpload(uid) {
  var raw = CacheService.getScriptCache().get('up_' + uid);
  if (!raw) throw new Error('Sesi unggah kedaluwarsa. Ulangi pengiriman berkas.');
  return JSON.parse(raw);
}

function simpanDokumen(meta, blob, u) {
  var stempel = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyyMMdd-HHmmss');

  /* company profile penyedia */
  if (meta.penyedia_id) {
    var v = cariBaris('Penyedia', meta.penyedia_id);
    if (!v) throw new Error('Penyedia tidak ditemukan.');
    var fv = simpanBlob(subFolder(folderRoot(), 'Penyedia'),
      blob, 'CompanyProfile-' + (v.nama || '').replace(/[\\/:*?"<>|]/g, '') + '-' + stempel + ext(meta.nama_file));
    perbaruiBaris('Penyedia', v.id, { cp_file_id: fv.getId(), cp_url: fv.getUrl() });
    return { kode: 12, nama_file: fv.getName(), url: fv.getUrl(), file_id: fv.getId() };
  }

  var p = cariBaris('Paket', meta.paket_id);
  if (!p) throw new Error('Paket tidak ditemukan.');
  var folder = folderPaket(p);
  var namaFile = ('0' + meta.kode).slice(-2) + '-' +
    String(meta.sub || '').replace(/[\\/:*?"<>|]/g, '') + (meta.sub ? '-' : '') +
    stempel + ext(meta.nama_file);
  var file = simpanBlob(folder, blob, namaFile);
  var row = tulisBaris('Dokumen', {
    id: idBaru('D'), paket_id: p.id, kode: meta.kode, sub: meta.sub || '',
    nama_file: file.getName(), file_id: file.getId(), url: file.getUrl(),
    mime: meta.mime || '', size: meta.size || file.getSize(),
    keterangan: meta.keterangan || '', uploaded_by: (u && u.id) || '', uploaded_at: new Date()
  });
  return bersihBaris(row);
}
function ext(nama) {
  var m = String(nama || '').match(/\.[A-Za-z0-9]{1,6}$/);
  return m ? m[0] : '';
}

function bacaHPS(paketId) {
  var bagian = bacaTabel('HPS').filter(function (x) { return String(x.paket_id) === String(paketId); })
    .sort(function (a, b) { return Number(a.part) - Number(b.part); });
  if (!bagian.length) return null;
  var teks = bagian.map(function (x) { return x.payload; }).join('');
  try { return JSON.parse(teks); } catch (e) { return null; }
}

function bacaMonev(paketId) {
  /* Bila admin belum menjalankan ulang setup() setelah pembaruan (lembar "Monev" belum
     ada), jangan sampai seluruh halaman detail paket ikut gagal dimuat — anggap saja
     belum ada penilaian tersimpan. Aksi saveMonev tetap akan memberi pesan error yang
     jelas ("Jalankan setup()") saat admin benar-benar mencoba menyimpan penilaian. */
  var baris;
  try { baris = bacaTabel('Monev').filter(function (x) { return String(x.paket_id) === String(paketId); })[0]; }
  catch (e) { return null; }
  if (!baris) return null;
  try { return JSON.parse(baris.payload); } catch (e) { return null; }
}

function bersih(rows) { return rows.map(bersihBaris); }
function bersihBaris(r) {
  var o = {};
  Object.keys(r).forEach(function (k) { if (k !== '__row' && k !== 'pass' && k !== 'salt') o[k] = r[k]; });
  return o;
}

/* ============================ PERAWATAN ============================ */
/** Hapus sisa potongan unggahan yang gagal (jalankan sesekali, atau pasang trigger harian). */
function bersihkanSementara() {
  var it = folderRoot().getFoldersByName('_sementara');
  if (!it.hasNext()) return;
  var tmp = it.next(), sub = tmp.getFolders(), batas = Date.now() - 86400000, n = 0;
  while (sub.hasNext()) {
    var f = sub.next();
    if (f.getDateCreated().getTime() < batas) { f.setTrashed(true); n++; }
  }
  Logger.log('Folder sementara dibersihkan: ' + n);
}

/** Buat satker contoh sesuai lingkup Kankemenag Indramayu (opsional, jalankan sekali). */
function isiContohSatker() {
  var daftar = [];
  for (var i = 1; i <= 3; i++) daftar.push({ nama: 'MAN ' + i + ' Indramayu', jenis: 'MAN' });
  for (var j = 1; j <= 5; j++) daftar.push({ nama: 'MIN ' + j + ' Indramayu', jenis: 'MIN' });
  for (var k = 1; k <= 13; k++) daftar.push({ nama: 'MTsN ' + k + ' Indramayu', jenis: 'MTsN' });
  daftar.push({ nama: 'Bidang Pendidikan Islam', jenis: 'PENDIS' });
  daftar.push({ nama: 'Bagian Sekretariat Jenderal', jenis: 'SEKJEN' });
  var ada = {};
  bacaTabel('Satker').forEach(function (s) { ada[s.nama] = 1; });
  daftar.forEach(function (s) {
    if (ada[s.nama]) return;
    tulisBaris('Satker', { id: idBaru('S'), nama: s.nama, jenis: s.jenis, aktif: true });
  });
  Logger.log('Satker contoh ditambahkan. Lengkapi alamat, telepon, email, dan kode satker lewat aplikasi.');
}