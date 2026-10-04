/* SIPADU - konfigurasi aplikasi.
   Satu-satunya berkas yang perlu diubah saat deploy. */
window.CONFIG = {
  APP_NAME: 'PROCIMY',
  APP_LONG: 'Procurement Indramayu',
  INSTANSI: 'Kantor Kementerian Agama Kabupaten Indramayu',
  VERSION: '1.0.0',

  /* Tempel URL Web App Apps Script (.../exec) di sini.
     Boleh dibiarkan kosong: saat pertama dibuka, aplikasi meminta URL
     dan menyimpannya di localStorage perangkat. */
  API_URL: 'https://script.google.com/macros/s/AKfycbzf2BqXM-p1Xj3C6tqY21QSKaW37j91g1XrqL-8gseaSUfrnpuOQCUR_MJiu2C4i_5o/exec',

  CACHE_TTL: 5 * 60 * 1000,   // umur cache data master di perangkat
  MAX_UPLOAD_MB: 15,
  CHUNK_SIZE: 512 * 1024,     // besar potongan unggahan (byte mentah)
  SESSION_KEY: 'sipadu.session',
  API_KEY: 'sipadu.api',
  LOGO: 'assets/img/logo-kemenag.png', // ganti dengan logo resmi, .png transparan
  LOGO_CM: 2.3,                        // sisi terpanjang logo pada kop dokumen (cm), rentang 1-5. Resolusi berkas bebas:
                                       // logo diperkecil otomatis dan proporsi aslinya dijaga (pratinjau, cetak, .pdf, .doc)

  JENIS_SATKER: ['MAN', 'MIN', 'MTsN', 'KUA', 'PENDIS', 'SEKJEN'],

  /* rab   : true  = format HPS pemeliharaan (uraian pekerjaan); false = format HPS barang
     ppn   : false = tanpa PPN (kolom PPN tidak ada, BA Pembayaran tanpa rincian PPN)
     sumber: isian awal "Sumber dana" (boleh diubah/diketik bebas di tab Data paket)
     uraian: frasa jenis pekerjaan pada dokumen "Uraian Singkat Pekerjaan" (Pengadaan Langsung):
             "...paket pekerjaan <nama paket> ini berupa <uraian>, yang bersumber dari dana APBN" 
     id adalah ID tetap yang tersimpan di data paket — jangan diubah, cukup ubah "nama". */
  JENIS_PENGADAAN: [
    { id: 'gedung_rm',       nama: 'Pemeliharaan Gedung dan Bangunan (Perkantoran)', rab: true,  ppn: true,  sumber: 'DIPA Operasional Perkantoran',
      uraian: 'pekerjaan konstruksi/rehabilitasi ruang layanan, penataan interior dan sistem pendukung pelayanan' },
    { id: 'gedung_bos',      nama: 'Pemeliharaan Gedung dan Bangunan (BOS)',          rab: true,  ppn: true,  sumber: 'DIPA (BOS)',
      uraian: 'pekerjaan konstruksi/rehabilitasi ruang layanan, penataan interior dan sistem pendukung pelayanan' },
    { id: 'peralatan',       nama: 'Peralatan dan Mesin',                              rab: false, ppn: true,  sumber: 'DIPA Satker',
      uraian: 'pengadaan peralatan dan mesin pendukung pelayanan' },
    { id: 'ekstra',          nama: 'Ekstrakomptabel',                                  rab: false, ppn: true,  sumber: 'DIPA Satker',
      uraian: 'pengadaan barang ekstrakomptabel pendukung pelayanan' },
    { id: 'belanja_lainnya', nama: 'Belanja Lainnya',                                  rab: false, ppn: true,  sumber: 'DIPA Satker',
      uraian: 'pengadaan barang/jasa pendukung pelayanan' },
    { id: 'buku',            nama: 'Belanja Lainnya (Buku)',                           rab: false, ppn: false, sumber: 'DIPA (BOS)',
      uraian: 'pengadaan buku' }
  ],

  /* opsi combobox "Sumber dana" pada tab Data paket — boleh juga diketik bebas. Teks yang dipilih/diketik
     dicetak di KAK butir 6 (kata "Satker" + nama satker ditambahkan otomatis bila belum ada). */
  SUMBER_DANA: ['DIPA (BOS)', 'DIPA Satker', 'DIPA Operasional Perkantoran'],

  /* opsi dropdown "Metode pengadaan" pada tab Data paket. Sesuaikan daftar ini bila
     satker Anda memakai istilah/metode lain — pilihan "Lainnya" tetap tersedia otomatis
     untuk metode di luar daftar (termasuk data lama yang sudah tersimpan). */
  METODE_PENGADAAN: ['Pengadaan Langsung', 'Penunjukan Langsung', 'E-Purchasing', 'Tender Cepat', 'Tender', 'Swakelola'],

  /* opsi combobox "Jenis kontrak" (berdasarkan cara pembayaran). Nilai yang tersimpan = teks
     opsinya, dan dicetak apa adanya di KAK. Nilai lama di luar daftar tetap dipertahankan. */
  JENIS_KONTRAK: ['Kontrak Harga Satuan', 'Kontrak Lumsum', 'Kontrak Gabungan Lumsum dan Harga Satuan',
    'Kontrak Putar Kunci (Turnkey)', 'Kontrak Persentase'],

  /* Syarat dokumen. generate = template cetak lokal yang tersedia. multi = boleh banyak berkas.
     Syarat berlaku-tidaknya sebuah dokumen untuk satu paket (lihat window.dokPerlu):
       bersyarat  : hanya wajib bila field paket bernilai benar (mis. ada_pph)
       kecuali    : tidak diperlukan untuk jenis pengadaan yang tercantum
       hanyaJenis : hanya diperlukan untuk jenis pengadaan yang tercantum
       hanyaMetode: hanya diperlukan untuk metode pengadaan yang tercantum
     Khusus dokumen bertahap (subs): subsKecuali menyembunyikan satu tahap pada jenis tertentu,
     namaUntuk mengganti nama dokumen pada jenis tertentu. */
  DOKUMEN: [
    { kode: 1,  nama: 'SK PPK',                          generate: 'sk_ppk' },
    { kode: 2,  nama: 'SK PP',                            generate: 'sk_pp' },
    { kode: 3,  nama: 'RUP' },
    { kode: 4,  nama: 'KAK, HPS + RAB',                   generate: 'kak_hps' },
    { kode: 5,  nama: 'Surat Pesanan' },
    { kode: 6,  nama: 'Dokumentasi dan surat jalan', multi: true,
      subs: ['Sebelum pengerjaan', 'Proses pengerjaan', 'Setelah pengerjaan', 'Surat jalan'],
      subsKecuali: { 'Surat jalan': ['gedung_rm', 'gedung_bos'] },            // pemeliharaan gedung tidak memakai surat jalan
      namaUntuk: { gedung_rm: 'Dokumentasi', gedung_bos: 'Dokumentasi' } },
    { kode: 7,  nama: 'BAST Inaproc', kecuali: ['gedung_rm', 'gedung_bos'] },   // tidak diperlukan pada pemeliharaan gedung
    { kode: 14, nama: 'BA Pemeriksaan Barang',            generate: 'bap' },
    { kode: 8,  nama: 'BAST Manual',                      generate: 'bast' },
    { kode: 15, nama: 'BA Pembayaran',                    generate: 'bayar' },
    { kode: 9,  nama: 'SPM' },
    { kode: 10, nama: 'SP2D' },
    { kode: 11, nama: 'Faktur dan Bupot', bersyarat: 'ada_pph', multi: true },
    { kode: 12, nama: 'Company profile', dari: 'penyedia' },
    { kode: 13, nama: 'Hasil monev dan dokumentasi', multi: true, generate: 'monev' },
    /* khusus Pengadaan Langsung — dapat dibuat otomatis (docgen.js: T.uraian, T.sppbj, T.notadinas) */
    { kode: 16, nama: 'Uraian pekerjaan singkat', hanyaMetode: ['Pengadaan Langsung'], generate: 'uraian' },
    { kode: 17, nama: 'SPPBJ',                    hanyaMetode: ['Pengadaan Langsung'], generate: 'sppbj' },
    { kode: 18, nama: 'Nota Dinas',               hanyaMetode: ['Pengadaan Langsung'], generate: 'notadinas' },
    /* khusus pemeliharaan gedung */
    { kode: 19, nama: 'Siteplan',                 hanyaJenis: ['gedung_rm', 'gedung_bos'] }
  ],
  /* CATATAN: urutan larik = urutan tampil. "kode" adalah ID tetap yang tersimpan di server
     (kolom Dokumen.kode) — jangan diubah untuk dokumen yang sudah punya berkas. Nomor yang
     tampil di layar dihitung dari posisi larik lewat window.dokNo(); memindahkan baris di sini
     hanya mengubah urutan/nomor tampil, bukan data yang sudah tersimpan. */

  GENERATOR: [
    /* KAK dan HPS tidak memakai nomor surat (tanpaNomor): hanya tanggalnya yang diisi di tab Data paket.
       Field no_* di sini tinggal untuk menurunkan kunci tgl_kak / tgl_hps. */
    { id: 'kak_hps', nama: 'KAK, HPS & RAB (gabungan)',  field: 'no_kak',    kode: 4, tanpaNomor: true },
    { id: 'kak',    nama: 'KAK / Spesifikasi Teknis', field: 'no_kak',    kode: 4, tanpaNomor: true },
    { id: 'hps',    nama: 'HPS dan RAB',              field: 'no_hps',    kode: 4, tanpaNomor: true },
    { id: 'sk_ppk', nama: 'SK PPK',                   field: 'no_sk_ppk', kode: 1 },
    { id: 'sk_pp',  nama: 'SK PP',                    field: 'no_sk_pp',  kode: 2 },
    { id: 'bast',   nama: 'BAST Manual',              field: 'no_bast',   kode: 8 },
    { id: 'monev',  nama: 'Laporan Monev',            field: 'no_monev',  kode: 13 },
    { id: 'bap',    nama: 'BA Pemeriksaan Barang',    field: 'no_bap',    kode: 14 },
    { id: 'bayar',  nama: 'BA Pembayaran',            field: 'no_bayar',  kode: 15 },
    /* khusus Pengadaan Langsung. Uraian Singkat tidak bernomor/bertanggal; SPPBJ dan Nota Dinas punya nomor & tanggal sendiri */
    { id: 'uraian',    nama: 'Uraian Singkat Pekerjaan', field: 'no_uraian',    kode: 16, tanpaNomor: true },
    { id: 'sppbj',     nama: 'SPPBJ',                    field: 'no_sppbj',     kode: 17 },
    { id: 'notadinas', nama: 'Nota Dinas',               field: 'no_notadinas', kode: 18 }
  ]
};

/* Apakah dokumen d diperlukan untuk paket ini? Dipakai pita, tab Berkas, dan hitungan kelengkapan.
   Objek paket harus memuat jenis, metode, dan field bersyarat (mis. ada_pph).
   - bersyarat  : hanya bila field paket bernilai benar (mis. ada_pph)
   - kecuali    : tidak diperlukan untuk jenis pengadaan yang tercantum
   - hanyaJenis : hanya diperlukan untuk jenis pengadaan yang tercantum
   - hanyaMetode: hanya diperlukan untuk metode pengadaan yang tercantum (huruf besar/kecil diabaikan) */
window.dokPerlu = function (d, paket) {
  if (d.kecuali && paket && d.kecuali.indexOf(paket.jenis) >= 0) return false;
  if (d.hanyaJenis && !(paket && d.hanyaJenis.indexOf(paket.jenis) >= 0)) return false;
  if (d.hanyaMetode) {
    var m = String(paket && paket.metode || '').trim().toLowerCase();
    if (!d.hanyaMetode.some(function (x) { return String(x).toLowerCase() === m; })) return false;
  }
  if (d.bersyarat && !(paket && paket[d.bersyarat])) return false;
  return true;
};
/* nama dokumen yang ditampilkan untuk paket ini (mis. "Dokumentasi" tanpa "surat jalan" pada pemeliharaan gedung) */
window.dokNama = function (d, paket) {
  var u = d.namaUntuk;
  return (u && paket && u[paket.jenis]) || d.nama;
};
/* pilihan tahap/bagian untuk paket ini; null bila dokumen tidak bertahap */
window.dokSubs = function (d, paket) {
  if (!d.subs) return null;
  var k = d.subsKecuali || {};
  return d.subs.filter(function (s) { return !(k[s] && paket && k[s].indexOf(paket.jenis) >= 0); });
};
/* berapa dokumen yang diperlukan untuk paket ini */
window.dokJumlah = function (paket) {
  return window.CONFIG.DOKUMEN.filter(function (d) { return window.dokPerlu(d, paket); }).length;
};
/* apakah jenis pengadaan ini dikenai PPN (JENIS_PENGADAAN[].ppn; baku: ya) */
window.jenisKenaPpn = function (id) {
  var j = window.CONFIG.JENIS_PENGADAAN.filter(function (x) { return x.id === id; })[0];
  return !(j && j.ppn === false);
};
/* nomor tampil (1..n) = posisi dokumen dalam daftar, bukan nilai kode */
window.dokNo = function (kode) {
  var l = window.CONFIG.DOKUMEN;
  for (var i = 0; i < l.length; i++) if (String(l[i].kode) === String(kode)) return i + 1;
  return kode;
};
/* cari definisi dokumen berdasarkan kode (jangan memakai indeks larik) */
window.dokByKode = function (kode) {
  return window.CONFIG.DOKUMEN.filter(function (d) { return String(d.kode) === String(kode); })[0] || null;
};