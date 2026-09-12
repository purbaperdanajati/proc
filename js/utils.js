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
