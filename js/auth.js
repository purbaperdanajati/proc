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

  function loadCaptcha() {
    callApi('auth', 'getCaptcha', {}).then(function (data) {
      currentCaptchaChallengeId = data.challengeId;
      drawCaptcha(document.getElementById('captcha-canvas'), data.text);
      document.getElementById('input-captcha').value = '';
    }).catch(function (err) {
      showToast('Gagal memuat kode keamanan: ' + err.message, true);
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
    btn.disabled = true;
    btn.textContent = 'Memproses...';

    callApi('auth', 'login', {
      username: document.getElementById('input-username').value,
      password: document.getElementById('input-password').value,
      captchaChallengeId: currentCaptchaChallengeId,
      captchaAnswer: document.getElementById('input-captcha').value
    }).then(function (data) {
      setSessionToken(data.sessionToken);
      startApp(data.user);
    }).catch(function (err) {
      errEl.textContent = err.message || 'Login gagal.';
      loadCaptcha(); // CAPTCHA sekali pakai — selalu muat ulang setelah percobaan apa pun
      document.getElementById('input-password').value = '';
      btn.disabled = false;
      btn.textContent = 'MASUK';
    });
  });

  document.getElementById('btn-logout').addEventListener('click', function () {
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
    if (!token) { showLoginView(); return; }
    callApi('auth', 'getCurrentUser', {}).then(function (user) {
      startApp(user);
    }).catch(function () {
      setSessionToken(null);
      showLoginView();
    });
  }
