/**
   * Logger aplikasi -- dipakai di seluruh file js/* LAIN (bukan console.log
   * langsung), supaya bisa dimatikan semua sekaligus dari satu saklar
   * ENABLE_LOGGING di config.js, tanpa mengubah file satu-satu.
   */
  function appLog() {
    if (typeof ENABLE_LOGGING !== 'undefined' && !ENABLE_LOGGING) return;
    console.log.apply(console, ['[SI Pengadaan]'].concat(Array.prototype.slice.call(arguments)));
  }
  function appWarn() {
    if (typeof ENABLE_LOGGING !== 'undefined' && !ENABLE_LOGGING) return;
    console.warn.apply(console, ['[SI Pengadaan]'].concat(Array.prototype.slice.call(arguments)));
  }
  function appError() {
    if (typeof ENABLE_LOGGING !== 'undefined' && !ENABLE_LOGGING) return;
    console.error.apply(console, ['[SI Pengadaan]'].concat(Array.prototype.slice.call(arguments)));
  }

  function showToast(message, isError) {
    var el = document.getElementById('toast');
    el.textContent = message;
    el.className = 'toast' + (isError ? ' toast-error' : '');
    el.style.display = 'block';
    clearTimeout(window.__toastTimer);
    window.__toastTimer = setTimeout(function () { el.style.display = 'none'; }, 3500);
  }

  // Selalu escape teks yang berasal dari data (Sheet/user) sebelum disisipkan lewat
  // innerHTML — mencegah stored-XSS lewat field seperti nama/catatan.
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Token sesi disimpan di sessionStorage (bukan localStorage) — hilang saat tab
  // ditutup, tidak dikirim otomatis oleh browser seperti cookie. Lihat Bagian F
  // dokumen desain untuk trade-off lengkapnya.
  function getSessionToken() {
    return sessionStorage.getItem('sessionToken') || '';
  }
  function setSessionToken(token) {
    if (token) sessionStorage.setItem('sessionToken', token);
    else sessionStorage.removeItem('sessionToken');
  }

  /**
   * Menandai tombol submit sedang bekerja: nonaktifkan, ganti teks, dan
   * tampilkan spinner kecil (lewat class CSS .btn-busy di css/main.css) --
   * dipakai di SEMUA form submit di aplikasi ini supaya user tahu aksinya
   * sedang diproses, bukan diam tanpa respons. Mengembalikan fungsi untuk
   * memulihkan tombol ke kondisi semula (dipanggil setelah sukses/gagal,
   * kecuali kalau tampilannya sudah keburu diganti render ulang).
   */
  function setButtonBusy(button, busyText) {
    var originalText = button.textContent;
    var originalDisabled = button.disabled;
    button.disabled = true;
    button.classList.add('btn-busy');
    button.textContent = busyText || 'Memproses...';
    return function restoreButton() {
      button.disabled = originalDisabled;
      button.classList.remove('btn-busy');
      button.textContent = originalText;
    };
  }