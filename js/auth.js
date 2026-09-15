var currentCaptchaChallengeId = null;

  /**
   * Menggambar teks CAPTCHA ke <canvas> dengan distorsi (rotasi acak, warna acak,
   * noise garis/titik) — murni Canvas 2D API bawaan browser, tanpa library atau
   * layanan pihak ketiga. Lihat Keputusan 4 di dokumen desain untuk batasan
   * pendekatan ini dibanding reCAPTCHA.
   */
  function drawCaptcha(canvas, text) {
    var ctx = canvas.getContext('2d');
    var w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#F2F5F3';
    ctx.fillRect(0, 0, w, h);

    for (var i = 0; i < 5; i++) {
      ctx.strokeStyle = 'rgba(15,122,58,' + (0.15 + Math.random() * 0.2) + ')';
      ctx.beginPath();
      ctx.moveTo(Math.random() * w, Math.random() * h);
      ctx.lineTo(Math.random() * w, Math.random() * h);
      ctx.stroke();
    }

    var colors = ['#0F7A3A', '#2C2C2C', '#3E6B57', '#555555'];
    var charWidth = w / (text.length + 1);
    for (var i = 0; i < text.length; i++) {
      ctx.save();
      var x = charWidth * (i + 0.8);
      var y = h / 2 + (Math.random() * 8 - 4);
      ctx.translate(x, y);
      ctx.rotate((Math.random() * 0.5 - 0.25));
      ctx.font = 'bold 26px Arial';
      ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text[i], 0, 0);
      ctx.restore();
    }

    for (var d = 0; d < 30; d++) {
      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      ctx.beginPath();
      ctx.arc(Math.random() * w, Math.random() * h, 1, 0, 2 * Math.PI);
      ctx.fill();
    }
  }

  // BARU: kalau permintaan CAPTCHA ke backend gagal (API_URL belum diisi, CORS,
  // Web App belum ter-deploy, dsb.), gambar pesannya LANGSUNG DI DALAM kanvas
  // itu sendiri -- supaya kotaknya tidak cuma diam kosong tanpa penjelasan.
  function showCaptchaError(canvas) {
    var ctx = canvas.getContext('2d');
    var w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#FBEAEA';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#B3261E';
    ctx.font = '11px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Gagal memuat.', w / 2, h / 2 - 7);
    ctx.fillText('Klik \u21BB untuk coba lagi.', w / 2, h / 2 + 7);
  }

  function loadCaptcha() {
    var canvasEl = document.getElementById('captcha-canvas');
    if (!canvasEl) {
      appError('loadCaptcha: elemen #captcha-canvas tidak ditemukan di halaman.');
      return;
    }
    appLog('loadCaptcha: meminta CAPTCHA baru dari', (typeof API_URL !== 'undefined' ? API_URL : '(API_URL tidak terbaca)'));
    callApi('auth', 'getCaptcha', {}).then(function (data) {
      appLog('loadCaptcha: berhasil, menggambar kode ->', data);
      currentCaptchaChallengeId = data.challengeId;
      drawCaptcha(canvasEl, data.text);
      document.getElementById('input-captcha').value = '';
    }).catch(function (err) {
      appError('loadCaptcha: GAGAL memuat CAPTCHA ->', err);
      showCaptchaError(canvasEl);
      showToast('Gagal memuat kode keamanan: ' + (err && err.message), true);
    });
  }

  document.getElementById('btn-refresh-captcha').addEventListener('click', loadCaptcha);

  document.getElementById('btn-toggle-password').addEventListener('click', function () {
    var input = document.getElementById('input-password');
    input.type = input.type === 'password' ? 'text' : 'password';
  });

  document.getElementById('form-login').addEventListener('submit', function (e) {
    e.preventDefault();
    var btn = document.getElementById('btn-login');
    var errEl = document.getElementById('login-error');
    errEl.textContent = '';
    var restore = setButtonBusy(btn, 'Memproses...');

    appLog('login: mencoba login untuk username ->', document.getElementById('input-username').value);

    callApi('auth', 'login', {
      username: document.getElementById('input-username').value,
      password: document.getElementById('input-password').value,
      captchaChallengeId: currentCaptchaChallengeId,
      captchaAnswer: document.getElementById('input-captcha').value
    }).then(function (data) {
      appLog('login: berhasil, masuk sebagai ->', data.user);
      setSessionToken(data.sessionToken);
      startApp(data.user);
    }).catch(function (err) {
      appError('login: GAGAL ->', err);
      errEl.textContent = err.message || 'Login gagal.';
      loadCaptcha(); // CAPTCHA sekali pakai — selalu muat ulang setelah percobaan apa pun
      document.getElementById('input-password').value = '';
      restore();
    });
  });

  document.getElementById('btn-logout').addEventListener('click', function () {
    appLog('logout: mengakhiri sesi...');
    callApi('auth', 'logout', {}).finally(function () {
      setSessionToken(null);
      location.hash = '';
      location.reload();
    });
  });

  function showLoginView() {
    document.getElementById('view-login').style.display = '';
    document.getElementById('view-app').style.display = 'none';
    loadCaptcha();
  }

  function checkExistingSession() {
    var token = getSessionToken();
    if (!token) {
      appLog('checkExistingSession: tidak ada token tersimpan -> tampilkan halaman login.');
      showLoginView();
      return;
    }
    appLog('checkExistingSession: token ditemukan, memvalidasi ke server...');
    callApi('auth', 'getCurrentUser', {}).then(function (user) {
      appLog('checkExistingSession: sesi valid, lanjut sebagai ->', user);
      startApp(user);
    }).catch(function (err) {
      appWarn('checkExistingSession: sesi tidak valid/kedaluwarsa ->', err);
      setSessionToken(null);
      showLoginView();
    });
  }