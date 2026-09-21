# SIPADU — Sistem Informasi Pengadaan Terpadu

Aplikasi internal pengadaan barang/jasa untuk **Kantor Kementerian Agama Kabupaten Indramayu**.
HTML, CSS, JavaScript murni (tanpa framework) di sisi tampilan; Google Apps Script + Google
Spreadsheet + Google Drive sebagai server, basis data, dan penyimpanan berkas.

---

## Ringkasan cepat

1. Buat Google Spreadsheet baru → **Extensions > Apps Script** → tempel isi `apps-script/Code.gs`.
2. Jalankan fungsi `setup()` sekali, izinkan aksesnya.
3. **Deploy > New deployment** → Web app → *Execute as: Me*, *Who has access: Anyone* → salin URL yang berakhir `/exec`.
4. Buka `index.html`, klik **Ubah alamat server**, tempel URL tadi.
5. Masuk dengan `admin` / `admin12345`, lalu **segera ganti sandi**.

Detail tiap langkah, dan cara menghindari galat 404 yang dialami versi sebelumnya, ada di bawah.

---

## 1. Struktur proyek

```
sipadu/
├── index.html              halaman masuk (captcha lokal)
├── app.html                kerangka aplikasi setelah masuk
├── assets/
│   ├── css/app.css         seluruh gaya tampilan
│   ├── img/                letakkan logo-kemenag.png di sini
│   └── js/
│       ├── config.js       satu-satunya berkas pengaturan/daftar tetap
│       ├── core.js         helper DOM, transport API, cache, sesi, router, komponen UI
│       ├── hps.js          kisi HPS/RAB (tempel Excel, impor .xlsx, hitung)
│       ├── docgen.js       perakit dokumen KAK/HPS/SK/BAST/Monev di peramban
│       ├── pages.js        halaman beranda, satker, penugasan, penyedia, pejabat, pengguna, pengaturan
│       ├── paket.js        halaman daftar & detail paket pengadaan
│       └── app.js          boot aplikasi, navigasi, rute
├── apps-script/
│   └── Code.gs             backend: API, autentikasi, Spreadsheet, Drive
└── README.md
```

Tidak ada langkah *build*. Berkas-berkas ini bisa langsung disajikan apa adanya oleh peladen web statis mana pun.

---

## 2. Memasang backend (Google Apps Script)

1. Buka [sheets.google.com](https://sheets.google.com) → buat Spreadsheet baru. Beri nama, misalnya **"SIPADU - Data"**.
2. Menu **Extensions > Apps Script**.
3. Hapus isi bawaan `Code.gs`, tempel seluruh isi berkas `apps-script/Code.gs` dari proyek ini.
4. Di dropdown fungsi (samping ikon ▶) pilih **setup**, lalu klik **Run**.
   - Google akan meminta izin akses Spreadsheet dan Drive. Karena skrip ini milik Anda sendiri dan belum diverifikasi Google, akan muncul peringatan "Google hasn't verified this app" — klik **Advanced > Go to (nama proyek) (unsafe)**, lalu **Allow**. Ini normal untuk skrip pribadi/internal.
5. Buka **Execution log** (Ctrl+Enter atau View > Logs). Akan tertulis akun awal (`admin` / `admin12345`) dan ID folder Drive yang baru dibuat bernama **"SIPADU - Berkas Pengadaan"**.
6. Menu **Deploy > New deployment**:
   - Klik ikon gerigi di samping "Select type" → pilih **Web app**.
   - Description bebas, misalnya "SIPADU v1".
   - **Execute as: Me**
   - **Who has access: Anyone**
   - Klik **Deploy**, izinkan lagi bila diminta.
7. Salin URL yang muncul — harus berakhiran **`/exec`**. Inilah alamat server SIPADU.

> (Opsional) Jalankan juga fungsi **`isiContohSatker`** dari dropdown yang sama untuk mengisi kerangka satker MAN, MIN, MTsN, PENDIS, dan SEKJEN secara otomatis. 31 KUA tetap perlu ditambahkan manual lewat aplikasi karena tidak semua KUA memiliki pengadaan setiap tahun.

---

## 3. Kenapa versi sebelumnya sering 404 — dan cara menghindarinya

**Penyebab:** setiap kali Anda memilih **Deploy > New deployment**, Apps Script menerbitkan URL `/exec`
yang **baru dan berbeda**. URL lama berhenti berfungsi seketika, sehingga semua perangkat yang masih
menyimpan URL lama (di halaman Pengaturan aplikasi) akan menerima 404.

**Cara aman memperbarui kode tanpa mengganti URL:**

1. Menu **Deploy > Manage deployments**.
2. Klik ikon **pensil (edit)** pada deployment aktif — jangan buat baris baru.
3. Pada **Version**, pilih **New version**.
4. Klik **Deploy**.

URL `/exec` tetap sama; kode di baliknya yang diperbarui. Ini yang harus dilakukan setiap kali
`Code.gs` diubah.

Catatan lain:
- **Jangan** membagikan URL yang berakhiran `/dev` (deployment uji-coba) — itu hanya berfungsi untuk sesi login Anda sendiri di Apps Script, bukan untuk 8 pengguna lainnya.
- Aplikasi sudah dirancang tahan gangguan jaringan: permintaan dikirim sebagai `POST` dengan `Content-Type: text/plain` (agar tidak memicu *preflight* CORS yang sering ditolak Apps Script), dicoba ulang bertingkat, lalu otomatis beralih ke JSONP untuk permintaan baca berukuran kecil bila POST tetap gagal.

---

## 4. Menjalankan aplikasi (frontend)

Karena tanpa proses *build*, `index.html` bisa dibuka langsung dari berkas (*double-click*) untuk
uji coba cepat. Untuk pemakaian sehari-hari oleh 8 ASN, sajikan lewat salah satu:

- **GitHub Pages** — unggah folder `sipadu/` ke repositori, aktifkan Pages, bagikan tautannya. Gratis dan cukup untuk kebutuhan internal.
- **Hosting statis kantor / internal** — salin seluruh isi folder `sipadu/` ke direktori web yang sudah ada.
- **Uji coba lokal di jaringan kantor** — jalankan peladen statis sederhana (mis. `python3 -m http.server`) dari dalam folder `sipadu/`, lalu akses lewat alamat IP komputer tersebut.

Setelah aplikasi tersaji, setiap pengguna cukup membuka alamatnya, mengisi alamat server (`/exec`)
sekali di halaman masuk, dan alamat itu akan tersimpan di perangkat masing-masing.

---

## 5. Masuk pertama kali

1. Buka aplikasi, klik **Ubah alamat server**, tempel URL `/exec` dari langkah 2, simpan.
2. Masuk dengan **`admin`** / **`admin12345`**.
3. Buka menu **Pengguna** →
   - **Atur sandi** untuk akun admin ini, ganti dari sandi bawaan.
   - **Tambah pengguna** untuk 8 ASN pengelola pengadaan, masing-masing dengan nama pengguna dan sandi awal sendiri.

---

## 6. Alur kerja yang disarankan

| # | Langkah | Menu |
|---|---|---|
| 1 | Masukkan seluruh pejabat berpotensi jadi KPA/PPK/PP (nama, NIP, pangkat/golongan, jabatan) | **Pejabat** |
| 2 | Lengkapi seluruh satuan kerja beserta profil kop surat (alamat, telp, email, kode satker) | **Satuan kerja** |
| 3 | Tetapkan pengelola tiap satker untuk tahun anggaran berjalan, isi SP DIPA, tandai satker tanpa pengadaan, pasang KPA/PPK/PP default | **Penugasan & pagu** |
| 4 | Masukkan data penyedia sekali di awal — company profile yang diunggah akan dipakai ulang otomatis untuk paket lain dengan penyedia yang sama | **Penyedia** |
| 5 | Buat paket pengadaan per satker: pilih jenis, isi pagu | **Paket pengadaan** |
| 6 | Isi rincian HPS/RAB — tempel dari Excel, impor `.xlsx`, atau ketik manual | Tab **HPS/RAB** pada detail paket |
| 7 | Unggah 13 dokumen wajib satu per satu | Tab **Berkas (13)** |
| 8 | Isi nomor & tanggal surat, lalu cetak KAK/HPS/SK/BAST/Monev | Tab **Data paket** dan **Cetak dokumen** |
| 9 | Pantau pita 13-segmen di Beranda — hijau penuh berarti paket itu *complete* secara dokumen | **Beranda** |

---

## 7. Dokumen dan penomoran

### 13 dokumen wajib per paket
SK PPK · SK PP · RUP · KAK+HPS+RAB · Surat Pesanan · Dokumentasi & surat jalan (sebelum/proses/
setelah, multi-berkas) · BAST Inproc · BAST Manual · SPM · SP2D · Faktur & Bupot (hanya bila paket
ditandai *Ada PPh*) · Company profile (otomatis terisi dari data Penyedia) · Hasil Monev &
dokumentasinya.

### 6 dokumen yang bisa dibuat otomatis (tab Cetak dokumen)
KAK/Spesifikasi Teknis, HPS, SK PPK, SK PP, BAST Manual, Laporan Monev — masing-masing punya field
nomor dan tanggal surat sendiri di tab **Data paket**. Kop surat, nama KPA/PPK/PP, SP DIPA, dan pagu
terisi otomatis dari data Satker, Penugasan, dan Paket.

**Seluruh dokumen dirakit di peramban pengguna** (`docgen.js`) — server Apps Script tidak pernah
menyusun dokumen, hanya menyimpan data dan berkas. Tiga pilihan keluaran tersedia: **Pratinjau**,
**Cetak / Simpan PDF** (lewat dialog cetak peramban), **Unduh .doc** (bisa dibuka dan diedit lagi di
Word), dan **Simpan ke berkas** (langsung mengunggah hasilnya sebagai salah satu dari 13 dokumen
paket).

### Format kolom HPS/RAB
Kolom kisi HPS otomatis mengikuti jenis pengadaan, dan bisa ditukar kapan pun lewat tombol
**"Format baku"** di editor:

| Jenis pengadaan | Susunan kolom |
|---|---|
| Pemeliharaan Gedung (Perkantoran / BOS) | NO. · URAIAN PEKERJAAN · VOLUME · SATUAN · HARGA SATUAN (Rp) · TOTAL (Rp) |
| Peralatan dan Mesin, Buku, Ekstrakomptabel | NO. · NAMA · SPESIFIKASI · VOL · HARGA SATUAN · JUMLAH |

Menempel langsung dari Excel (termasuk sel gabung) atau mengimpor `.xlsx` akan menimpa susunan ini
dengan struktur asli berkas sumbernya; peran tiap kolom (mana yang volume, harga, jumlah) bisa
disesuaikan lewat tombol **"Peran kolom"** bila deteksi otomatisnya kurang tepat.

---

## 8. Logo resmi

Taruh logo Kementerian Agama sebagai:

```
assets/img/logo-kemenag.png
```

PNG dengan latar transparan, minimal 256×256 px. Logo ini otomatis tampil di halaman masuk, rail
navigasi, serta kop seluruh dokumen yang dicetak (termasuk yang diunduh sebagai `.doc`, karena logo
diubah menjadi data URI agar ikut terbawa). Bila belum ada, aplikasi tetap berjalan normal — kotak
logo hanya kosong, tanpa gambar rusak. Lihat juga `assets/img/LETAKKAN_LOGO_DI_SINI.txt`.

---

## 9. Performa dan keandalan koneksi

Poin-poin ini yang membedakan SIPADU dari percobaan sebelumnya yang "berat dan sering 404":

- **Transport POST `text/plain`** — dikenali peramban sebagai *simple request*, sehingga tidak memicu preflight `OPTIONS` yang sering ditolak Apps Script.
- **Percobaan ulang bertingkat**, lalu otomatis beralih ke **JSONP** untuk aksi baca kecil (<1.500 karakter) bila POST tetap gagal.
- **Cache sisi klien** (`sessionStorage`, 5 menit) dan **cache server** (`CacheService`, 45 detik) mengurangi beban baca ke Spreadsheet.
- **Tanpa framework, tanpa webfont eksternal.** Pustaka pembaca Excel (SheetJS) baru dimuat saat tombol "Impor .xlsx" diklik, bukan di awal.
- **Dokumen dirakit di perangkat**, bukan di server — mencegah beban eksekusi Apps Script menumpuk saat banyak paket dicetak bersamaan.
- **Unggahan besar dikirim bertahap** (potongan 512 KB) agar tidak gagal total di koneksi lambat.

---

## 10. Struktur data (Google Spreadsheet)

Backend membuat 10 lembar otomatis lewat `setup()`:

| Lembar | Isi |
|---|---|
| `Config` | pengaturan umum (nama kantor, kota, ID folder Drive induk, dll) |
| `Users` | akun pengguna (sandi disimpan sebagai hash SHA-256 bergaram) |
| `Pejabat` | daftar pejabat untuk KPA/PPK/Pejabat Pengadaan |
| `Satker` | profil satuan kerja + data kop surat |
| `Penugasan` | siapa memegang satker mana per tahun anggaran, SP DIPA, KPA/PPK/PP default |
| `Paket` | paket pengadaan: jenis, pagu, nilai, penyedia, nomor-nomor surat (kolom `meta`) |
| `Penyedia` | basis data penyedia + tautan company profile |
| `Dokumen` | catatan tiap berkas yang diunggah (tertaut ke berkas di Drive) |
| `HPS` | rincian HPS/RAB per paket (disimpan terpecah per 40.000 karakter per baris) |
| `Log` | jejak aktivitas (masuk, keluar, ubah, hapus) |

Berkas yang diunggah disimpan di Google Drive dengan struktur folder:
`SIPADU - Berkas Pengadaan / TA {tahun} / {kode satker} {nama satker} / {nama paket} / …`

---

## 11. Cadangan (backup)

Karena seluruh data ada di Spreadsheet + Drive, cadangan cukup dua langkah:

1. Spreadsheet: **File > Make a copy**, simpan berkala.
2. Folder Drive **"SIPADU - Berkas Pengadaan"**: klik kanan → **Make a copy**, atau unduh sebagai zip.

Simpan juga URL deployment (`/exec`) dan kredensial admin di tempat yang aman.

---

## 12. Pengembangan lanjutan (opsional, belum termasuk dalam versi ini)

- Generator otomatis untuk **Surat Pesanan** dan **BAP** belum dibuat — permintaan awal hanya mencakup 6 dokumen (KAK, HPS, SK PPK, SK PP, BAST Manual, Laporan Monev). Kedua dokumen ini tetap bisa diunggah manual sebagai berkas biasa.
- **31 KUA** perlu ditambahkan satu per satu lewat menu Satuan kerja (tidak semua KUA memiliki pengadaan setiap tahun — tandai lewat Penugasan → "Tidak ada pengadaan" agar tidak ikut dihitung dalam statistik kelengkapan).
- Bila jumlah baris `Log` sangat besar di kemudian hari, pertimbangkan memindahkannya ke Spreadsheet terpisah agar `Config`/`Paket`/`Dokumen` tetap ringan dibaca.

---

## 13. Kebutuhan sistem

- Peramban modern (Chrome, Edge, atau Firefox versi terbaru).
- Akun Google untuk memasang Apps Script (langkah 2), tidak dibutuhkan lagi oleh 8 pengguna sehari-hari.
- Koneksi internet saat menyimpan, mengunggah, atau memuat data; melihat dokumen yang sudah dimuat sebelumnya tetap bisa dari cache selama sesi berjalan.
