# SI Pengadaan Barang/Jasa — Kemenag Kabupaten Indramayu
## Tahap 1 — Arsitektur Terpisah: Backend Apps Script + Frontend GitHub Pages

Paket ini adalah **hasil pemisahan** dari `pengadaan-tahap1.zip` sebelumnya, sesuai
permintaan: HTML/CSS/JS sekarang berdiri sendiri untuk di-deploy ke **GitHub
Pages**, dan Apps Script **hanya** berperan sebagai backend/API.

```
backend-appscript/        <- disalin ke proyek Apps Script (Extensions > Apps Script)
frontend-github-pages/    <- di-push ke repo GitHub, diaktifkan sebagai GitHub Pages
```

Logika bisnis (Auth, Authorization, Users, Satkers, Assignments, Years, Audit,
Setup) **sama sekali tidak berubah** dari versi sebelumnya — hanya `Code.gs`
yang berubah (dulu menyajikan HTML lewat `HtmlService`, sekarang murni
menjawab JSON lewat `ContentService`), dan cara frontend memanggilnya (dulu
`google.script.run`, sekarang `fetch()` biasa).

---

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

## D. Checklist Uji (sekarang benar-benar lintas domain)

Sama seperti sebelumnya, tapi jalankan dari URL **GitHub Pages**-nya (bukan
lagi dari domain script.google.com):

- [ ] Buka DevTools → Network sebelum login pertama kali — pastikan tidak ada
      request `OPTIONS` yang gagal ke `API_URL` (kalau ada, cek ulang bagian A).
- [ ] LOGIN-001 s.d. LOGIN-004, AUTH-001, AUTH-002 — sama seperti checklist
      Tahap 1 sebelumnya.
- [ ] Ganti Password, lihat Audit Log, dsb. — pastikan semuanya tetap
      berfungsi lewat `fetch()` seperti sebelumnya lewat `google.script.run`.
- [ ] Coba isi `API_URL` yang salah di `config.js` sengaja, pastikan pesan
      errornya jelas ("Gagal terhubung ke server...") bukan layar putih kosong.

## E. Yang Sama Persis dengan Sebelumnya (tidak berubah)

Semua isi `Config.gs`, `Utils.gs`, `Auth.gs`, `Authorization.gs`, `Users.gs`,
`Satkers.gs`, `Assignments.gs`, `Years.gs`, `Audit.gs`, `Setup.gs`, dan
`appsscript.json` **identik** dengan `pengadaan-tahap1.zip` sebelumnya — tidak
ada perubahan logika bisnis, keamanan, atau skema data sama sekali. Yang
sengaja belum ada di Tahap 1 juga masih sama seperti dicatat di README versi
sebelumnya (Pagu/Paket/Penyedia/Dokumen/KAK/HPS mulai Tahap 3–7, dst.).
