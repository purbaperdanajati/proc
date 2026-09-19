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

  // ===================== FORMAT INPUT OTOMATIS =====================
  // Delegated di document supaya berlaku juga untuk field yang baru disuntikkan
  // app.js lewat innerHTML (tidak perlu di-attach satu-satu tiap render ulang).
  // Tiga jenis, ditandai lewat atribut data- pada elemen <input>:
  //   data-uppercase -> semua field nama (Satker/PPK/KPA/Penyedia/User/dst)
  //   data-nip       -> angka saja, maksimal 18 digit (field NIP)
  //   data-rupiah    -> tampilan otomatis pakai pemisah ribuan "."; nilai
  //                      angka mentahnya diambil lewat parseRupiahFieldValue()
  //                      di bawah saat form disubmit (JANGAN pakai .value
  //                      langsung untuk field ini, karena berisi titik pemisah).
  document.addEventListener('input', function (e) {
    var el = e.target;
    if (!el || el.tagName !== 'INPUT') return;

    if (el.hasAttribute('data-uppercase')) {
      var pos = el.selectionStart;
      el.value = el.value.toUpperCase();
      if (pos !== null && el.setSelectionRange) el.setSelectionRange(pos, pos);
      return;
    }

    if (el.hasAttribute('data-nip')) {
      var batas = el.maxLength && el.maxLength > 0 ? el.maxLength : 18;
      el.value = el.value.replace(/\D/g, '').slice(0, batas);
      return;
    }

    if (el.hasAttribute('data-rupiah')) {
      var raw = el.value.replace(/\D/g, '');
      var posDariKanan = el.value.length - (el.selectionEnd || el.value.length);
      el.value = raw ? Number(raw).toLocaleString('id-ID') : '';
      var newPos = el.value.length - posDariKanan;
      if (el.setSelectionRange) el.setSelectionRange(newPos, newPos);
    }
  });

  // Isi awal (mis. saat form edit dibuka dengan value dari data tersimpan) juga
  // perlu diformat -- dipanggil sekali setelah innerHTML berisi field
  // data-rupiah disuntikkan (lihat pemanggilannya di app.js: initRupiahFields(root)).
  function initRupiahFields(root) {
    (root || document).querySelectorAll('input[data-rupiah]').forEach(function (el) {
      var raw = String(el.value || '').replace(/\D/g, '');
      el.value = raw ? Number(raw).toLocaleString('id-ID') : '';
    });
  }

  // Ambil nilai angka mentah (tanpa pemisah ribuan) dari field data-rupiah,
  // dipakai saat submit form -- pengganti document.getElementById(id).value biasa.
  function parseRupiahFieldValue(id) {
    var el = document.getElementById(id);
    if (!el) return 0;
    var raw = String(el.value || '').replace(/\D/g, '');
    return raw ? Number(raw) : 0;
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