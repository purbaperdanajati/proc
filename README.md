# SI Pengadaan Barang/Jasa — Kemenag Kabupaten Indramayu
## Tahap 1–10 (LENGKAP) — Backend Apps Script + Frontend GitHub Pages

Seluruh 10 tahap roadmap sudah terbangun: autentikasi, master data, dashboard,
pagu & paket, penyedia, dokumen & checklist, generator KAK, HPS
spreadsheet-like, laporan & monitoring, security hardening, dan checklist uji.

```
backend-appscript/        <- disalin ke proyek Apps Script (Extensions > Apps Script)
frontend-github-pages/    <- di-push ke repo GitHub, diaktifkan sebagai GitHub Pages
```

**Kalau Anda sudah pernah setup sebelumnya:** jangan ulangi dari nol. Cukup:
1. Salin file backend yang baru/berubah ke proyek Apps Script.
2. **Jalankan `initializeDatabase()` sekali lagi** (mengisi checklist dokumen
   & template KAK default; aman diulang, tidak menduplikasi data lama).
3. Deploy → Manage deployments → Edit → New version (URL tetap sama).
4. Timpa file frontend yang berubah di repo GitHub Pages Anda.
## A. Kenapa CORS-nya Begini (baca ini sebelum menuduh ada bug)

Begitu HTML pindah ke domain lain (`*.github.io`), browser menganggap
panggilan ke Apps Script sebagai **cross-origin**, dan di sinilah bagian yang
sering menjebak orang:

- Apps Script Web App **tidak bisa** menjawab *preflight* (permintaan
  `OPTIONS` yang otomatis dikirim browser sebelum request "rumit"). Tidak ada
  `doOptions()` yang benar-benar berfungsi di Apps Script — ini keterbatasan
  platform, bukan sesuatu yang bisa ditambal dengan menambahkan header di
  `doPost()`. (Beberapa artikel di internet mengklaim bisa menambahkan header
  CORS manual lewat `ContentService` — ini **tidak benar**, `ContentService`
  tidak punya method untuk itu.)
- Solusinya: **hindari preflight-nya sama sekali**, bukan mencoba menjawabnya.
  Preflight hanya dipicu oleh request "tidak sederhana" — salah satu
  pemicunya adalah header `Content-Type: application/json`.
- Karena itu, `js/api.js` di paket ini mengirim body POST dengan
  `Content-Type: text/plain` (isinya tetap teks JSON biasa) — ini membuat
  browser menganggapnya "simple request" dan **tidak** mengirim preflight
  sama sekali. Apps Script menerimanya di `e.postData.contents` dan
  mem-parsing JSON-nya secara manual di `Code.gs`.
- Ini adalah pola yang sudah umum dipakai untuk kasus persis seperti punya
  Anda (frontend eksternal + backend Apps Script), tapi **bukan sesuatu yang
  didokumentasikan resmi oleh Google** sebagai kontrak API — jadi kalau suatu
  saat Google mengubah perilaku internalnya, ini bisa saja berhenti bekerja.
  Kalau Anda mengalami error CORS meski sudah mengikuti pola ini, langkah
  diagnosis pertama: buka tab **Network** di DevTools browser, lihat apakah
  yang gagal itu request `OPTIONS` (berarti ada sesuatu yang masih memicu
  preflight — cek lagi `Content-Type`-nya) atau request `POST`-nya sendiri
  (berarti masalah lain, mis. `API_URL` salah atau Web App belum di-deploy
  ulang).
- Token sesi dikirim eksplisit di body (bukan cookie), jadi kita **tidak**
  perlu `credentials: 'include'` di fetch — sengaja dihindari karena
  kombinasi `credentials: 'include'` + `Access-Control-Allow-Origin: *`
  ditolak browser (butuh origin spesifik, bukan wildcard). Karena desain
  autentikasi kita dari awal sudah token-di-body (bukan cookie, ini juga
  alasannya di dokumen desain Bagian F), kita otomatis lolos dari masalah ini.

---

## B. Setup Backend (Apps Script)

Sama seperti sebelumnya, dengan satu perbedaan di langkah deploy:

1. Buat Google Spreadsheet baru, salin **Spreadsheet ID**-nya.
2. Buat folder Google Drive baru sebagai root, salin **Folder ID**-nya.
3. Buka Spreadsheet itu → **Extensions → Apps Script**.
4. Salin isi tiap file di folder `backend-appscript/` ke proyek Apps Script
   (nama file harus sama persis, termasuk `appsscript.json` — aktifkan dulu
   **"Show appsscript.json manifest file"** di Project Settings).
5. **Project Settings → Script Properties**, tambahkan:
   - `SPREADSHEET_ID` = ID dari langkah 1
   - `ROOT_DRIVE_FOLDER_ID` = ID dari langkah 2
6. Jalankan `setupSystem()` sekali dari dropdown toolbar → Run (setujui izin
   yang diminta). Cek Execution log sampai muncul `setupSystem() selesai...`.
7. Jalankan `createFirstAdmin('Nama Anda', 'admin', 'PasswordAwalYangKuat123')`
   sekali secara manual (isi argumennya langsung di kode, jalankan fungsi itu
   dari dropdown, lalu boleh dihapus lagi pemanggilannya).
8. **Deploy → New deployment** → Type: **Web app** → Execute as: **Me** → Who
   has access: **Anyone** → Deploy. **Salin URL Web App-nya** (format
   `https://script.google.com/macros/s/XXXX/exec`).

> Setiap kali mengubah kode backend nanti, cukup **Manage deployments → Edit
> (ikon pensil) → New version → Deploy** — URL-nya TETAP SAMA, tidak perlu
> update `config.js` lagi. URL hanya berubah kalau Anda sengaja membuat
> **New deployment** dari awal (bukan versi baru dari yang sudah ada).

---

## C. Setup Frontend (GitHub Pages)

1. Buka `frontend-github-pages/js/config.js`, ganti `API_URL` dengan URL Web
   App dari langkah B.8.
2. Buat repository baru di GitHub (boleh publik atau privat — GitHub Pages
   tetap bisa diaktifkan untuk repo privat kalau akun Anda mendukungnya).
3. Push **seluruh isi** folder `frontend-github-pages/` (termasuk file
   tersembunyi `.nojekyll`) ke repo tersebut — paling sederhana taruh di
   root repo atau branch `gh-pages`.
4. Di repo GitHub → **Settings → Pages** → pilih branch & folder yang berisi
   `index.html` tadi → Save.
5. Tunggu beberapa menit, GitHub akan memberi URL seperti
   `https://namauser.github.io/nama-repo/`. Buka URL itu untuk login.

> `.nojekyll` sengaja disertakan supaya GitHub Pages menyajikan file apa
> adanya tanpa diproses lewat Jekyll (default GitHub Pages) — untuk situs
> statis murni seperti ini, Jekyll tidak diperlukan dan kadang menimbulkan
> perilaku tak terduga pada nama file/folder tertentu.

---


---

## D. Struktur File Lengkap

### Backend (`backend-appscript/`, semua masuk satu proyek Apps Script)

| File | Isi | Tahap |
|---|---|---|
| `Code.gs` | `doGet`/`doPost`, dispatcher `apiCall()` (16 modul) | 1 |
| `Config.gs` | Script Properties, sheet CONFIG + cache, nilai default | 1 |
| `Utils.gs` | Akses sheet, generator ID, hashing, token, amplop respons | 1 |
| `Auth.gs` | Login/logout, CAPTCHA custom, sesi, lockout, ganti password | 1 |
| `Authorization.gs` | `requireSession_`, `requireAccess_` — dipakai SEMUA modul | 1 |
| `Users.gs` `Years.gs` `Satkers.gs` `Assignments.gs` | Master data + `computeSatkerStatus_` | 1–2 |
| `Dashboard.gs` | Agregasi dashboard global & scoped | 2 |
| `JenisPengadaan.gs` `Pagu.gs` `Paket.gs` | Jenis pengadaan, pagu + pemakaian, paket + `computePaketCompletion_` | 3 |
| `DriveService.gs` | Folder Drive + validasi upload (magic bytes) | 4 |
| `Providers.gs` | Penyedia lintas-satker + Company Profile berversi | 4 |
| `Documents.gs` | Upload/replace/hapus dokumen, checklist, `evaluateKondisi_` | 5 |
| `Templates.gs` `KakService.gs` | Template HTML + generator KAK, snapshot & deteksi kadaluarsa | 6 |
| `HpsService.gs` | Item HPS (total dihitung server) + generator dokumen HPS | 7 |
| `Reports.gs` | Rekap satker/jenis/pengelola, paket belum lengkap, pencarian | 8 |
| `Setup.gs` | `setupSystem`, `initializeDatabase`, seed, `cleanupExpiredSessions`, `securityHealthCheck` | 1, 9 |

### Frontend (`frontend-github-pages/`)

`index.html` · `css/main.css` · `css/login.css` · `js/config.js` (API_URL +
ENABLE_LOGGING) · `js/utils.js` · `js/api.js` (fetch + cache) · `js/auth.js` ·
`js/app.js` (semua tampilan).

Library pihak ketiga (versi dipin, lihat komentar di `index.html`):
jspreadsheet CE v4 + jsuites v4 (grid HPS, MIT), SheetJS v0.18.5 (import Excel, Apache-2.0).

---

## E. Perawatan Rutin (Tahap 9)

Dua fungsi di `Setup.gs` dijalankan manual dari editor Apps Script:

- **`cleanupExpiredSessions()`** — menghapus baris SESSIONS yang sudah
  kedaluwarsa/dicabut. **Disarankan dipasang sebagai trigger harian**: ikon jam
  (Triggers) → Add Trigger → pilih fungsi ini → Time-driven → Day timer.
  Tanpa ini sheet SESSIONS tumbuh terus dan login makin lambat, karena
  validasi sesi memindai seluruh sheet tiap request.
- **`securityHealthCheck()`** — memeriksa konfigurasi (Script Properties
  terisi, jumlah admin aktif, password hash, ukuran SESSIONS/AUDIT_LOGS).
  Hanya MELAPORKAN ke Execution log, tidak mengubah apa pun.

---

## F. Checklist Uji Lengkap (Tahap 10)

Jalankan dari URL GitHub Pages, bukan dari file lokal.

**Autentikasi**
- [ ] LOGIN-001 login benar → masuk dashboard
- [ ] LOGIN-002 password salah → ditolak, `failed_login_count` naik
- [ ] LOGIN-003 kode keamanan salah → ditolak, CAPTCHA otomatis dimuat ulang
- [ ] LOGIN-004 salah 5x → akun terkunci sementara walau password benar
- [ ] Ganti password: field konfirmasi tidak cocok → ditolak sebelum kirim
- [ ] Admin reset password user lain → user itu bisa login dgn password baru
- [ ] Diamkan > 30 menit → request berikutnya ditolak, kembali ke login

**Otorisasi**
- [ ] AUTH-001 Pengelola melihat satker miliknya
- [ ] AUTH-002 Pengelola TIDAK bisa membuka satker/paket milik orang lain —
      uji juga lewat console browser dengan ID yang benar, harus `ACCESS_DENIED`
- [ ] Viewer tidak melihat tombol ubah, dan panggilan langsung tetap ditolak

**Master data & dashboard**
- [ ] Buat tahun anggaran, satker, user, assignment
- [ ] Detail Satker → set "Tidak Ada Pengadaan" → badge berubah di dashboard
- [ ] Set "Ada Pengadaan" tanpa paket → status "Berjalan"
- [ ] Ganti dropdown tahun → seluruh angka ikut berubah

**Pagu & paket**
- [ ] PKT-001 buat paket (dropdown pagu menampilkan sisa pagu)
- [ ] PKT-002 edit paket
- [ ] HPS > pagu → muncul peringatan administratif (bukan blokir)
- [ ] Pagu negatif ditolak server

**Penyedia**
- [ ] PROV-001 buat penyedia, unggah Company Profile
- [ ] PROV-002 pakai penyedia yang sama di paket kedua → tidak diminta unggah ulang
- [ ] Unggah Company Profile baru → versi naik, file lama ada di `_ARCHIVE` Drive

**Dokumen**
- [ ] DOC-001 unggah PDF → checklist bertambah
- [ ] DOC-002 unggah file tidak diizinkan (mis. .exe) → ditolak server
- [ ] DOC-003 unggah file > batas ukuran → ditolak
- [ ] Ganti dokumen → versi naik, file lama diarsipkan
- [ ] Centang "Ada PPh" → Faktur & Bupot berubah jadi wajib

**KAK & HPS**
- [ ] KAK-001 pratinjau KAK → semua data terisi otomatis, tidak ada `{{...}}` tersisa
- [ ] Generate KAK → PDF tersimpan, checklist KAK otomatis tercentang
- [ ] Ubah PPK di Detail Satker → buka paket → muncul peringatan perlu regenerasi
- [ ] HPS-001 input item manual → total otomatis
- [ ] HPS-002 salin tabel dari Excel → tempel (Ctrl+V) ke grid → data masuk
- [ ] HPS-003 import file .xlsx → muncul konfirmasi jumlah baris → data masuk grid
- [ ] Simpan item HPS → Nilai HPS paket ikut terbarui
- [ ] Generate HPS → PDF sesuai format dokumen contoh (kop, tabel, JUMLAH, ttd PPK)

**Kelengkapan & laporan**
- [ ] COMP-001 lengkapi semua dokumen wajib + penyedia → status jadi COMPLETE
- [ ] Satker yang semua paketnya COMPLETE → status satker jadi Complete
- [ ] Menu Laporan: rekap satker/jenis/pengelola + daftar paket belum lengkap
- [ ] Export CSV terbuka rapi di Excel (termasuk karakter non-ASCII)
- [ ] Pencarian global menemukan satker/paket/penyedia, tetap ter-scope per peran

**Umum**
- [ ] Pindah menu tidak memanggil server ulang (cek Console), tombol "Perbarui Data" memaksa ambil ulang
- [ ] Semua tombol submit menampilkan spinner selagi menunggu
- [ ] Audit Log mencatat seluruh aktivitas di atas
- [ ] Buka di layar ponsel — sidebar & tabel tetap terpakai

---

## G. Batasan yang Diketahui (jujur, bukan bug)

1. **Konversi HTML→PDF** memakai `Utilities.newBlob(...).getAs(PDF)`: rendering
   dasar (CSS kompleks, page-break, header berulang per halaman tidak didukung
   penuh) dan layanan ini pernah mengalami gangguan sisi Google. Kalau gagal,
   pratinjau tetap bisa dicetak dari browser (Ctrl+P).
2. **Merge cell HPS** belum dirender di grid (paste dari Excel dinormalisasi
   jadi sel biasa). Kolom `rowspan`/`colspan` sudah ada di skema `HPS_ITEMS`
   sehingga pengembangan lanjutan tidak terhalang — ini fallback yang memang
   Anda izinkan di brief awal.
3. **Persentase kelengkapan** menghitung dokumen saja, bukan penyedia. Bisa
   muncul 100% sementara status masih "Data Lengkap" kalau penyedia belum
   dipilih — ada banner kuning yang menjelaskan.
4. **IP address di audit log** selalu kosong: Apps Script tidak menyediakan IP
   klien yang andal. Pembatasan brute-force karena itu per-username, bukan per-IP.
5. **Batas 6 menit per eksekusi** Apps Script: hindari menyimpan HPS ratusan
   baris sekaligus (dibatasi 500 baris per paket).
6. **Regulasi di template KAK** adalah titik awal, bukan rujukan hukum final —
   template sendiri memuat peringatan administratif untuk dikonfirmasi ke
   bagian hukum/UKPBJ sebelum dipakai resmi.