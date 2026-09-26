/* SIPADU - konfigurasi aplikasi.
   Satu-satunya berkas yang perlu diubah saat deploy. */
window.CONFIG = {
  APP_NAME: 'SIPADU',
  APP_LONG: 'Sistem Informasi Pengadaan Terpadu',
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

  JENIS_SATKER: ['MAN', 'MIN', 'MTsN', 'KUA', 'PENDIS', 'SEKJEN'],

  JENIS_PENGADAAN: [
    { id: 'gedung_rm',   nama: 'Pemeliharaan Gedung dan Bangunan (Perkantoran)', rab: true,  sumber: 'DIPA (RM)' },
    { id: 'gedung_bos',  nama: 'Pemeliharaan Gedung dan Bangunan (BOS)',          rab: true,  sumber: 'DIPA (BOS)' },
    { id: 'peralatan',   nama: 'Peralatan dan Mesin',                              rab: false, sumber: 'DIPA' },
    { id: 'ekstra',      nama: 'Ekstrakomptabel',                                  rab: false, sumber: 'DIPA' },
    { id: 'buku',        nama: 'Buku',                                             rab: false, sumber: 'DIPA (BOS)' }
  ],

  /* opsi dropdown "Metode pengadaan" pada tab Data paket. Sesuaikan daftar ini bila
     satker Anda memakai istilah/metode lain — pilihan "Lainnya" tetap tersedia otomatis
     untuk metode di luar daftar (termasuk data lama yang sudah tersimpan). */
  METODE_PENGADAAN: ['Pengadaan Langsung', 'Penunjukan Langsung', 'E-Purchasing', 'Tender Cepat', 'Tender', 'Swakelola'],

  /* 13 syarat dokumen. generate = template cetak lokal yang tersedia.
     multi = boleh banyak berkas. bersyarat = hanya wajib bila kondisi terpenuhi. */
  DOKUMEN: [
    { kode: 1,  nama: 'SK PPK',                          generate: 'sk_ppk' },
    { kode: 2,  nama: 'SK PP',                            generate: 'sk_pp' },
    { kode: 3,  nama: 'RUP' },
    { kode: 4,  nama: 'KAK, HPS + RAB',                   generate: 'kak' },
    { kode: 5,  nama: 'Surat Pesanan' },
    { kode: 6,  nama: 'Dokumentasi dan surat jalan', multi: true,
      subs: ['Sebelum pengerjaan', 'Proses pengerjaan', 'Setelah pengerjaan', 'Surat jalan'] },
    { kode: 7,  nama: 'BAST Inproc' },
    { kode: 8,  nama: 'BAST Manual',                      generate: 'bast' },
    { kode: 9,  nama: 'SPM' },
    { kode: 10, nama: 'SP2D' },
    { kode: 11, nama: 'Faktur dan Bupot', bersyarat: 'ada_pph', multi: true },
    { kode: 12, nama: 'Company profile', dari: 'penyedia' },
    { kode: 13, nama: 'Hasil monev dan dokumentasi', multi: true, generate: 'monev' }
  ],

  GENERATOR: [
    { id: 'kak',    nama: 'KAK / Spesifikasi Teknis', field: 'no_kak',    kode: 4 },
    { id: 'hps',    nama: 'HPS dan RAB',              field: 'no_hps',    kode: 4 },
    { id: 'sk_ppk', nama: 'SK PPK',                   field: 'no_sk_ppk', kode: 1 },
    { id: 'sk_pp',  nama: 'SK PP',                    field: 'no_sk_pp',  kode: 2 },
    { id: 'bast',   nama: 'BAST Manual',              field: 'no_bast',   kode: 8 },
    { id: 'monev',  nama: 'Laporan Monev',            field: 'no_monev',  kode: 13 }
  ]
};