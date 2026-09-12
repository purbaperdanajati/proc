/**
 * Auth.gs
 * Login/logout, CAPTCHA custom (Keputusan 4: dibuat sendiri, tanpa site key Google),
 * hashing+lockout, dan manajemen sesi (Keputusan 1: login custom / Opsi B).
 */

var AuthService = {
  handle: function (action, payload, token) {
    switch (action) {
      case 'getCaptcha': return this.getCaptcha();
      case 'login': return this.login(payload);
      case 'logout': return this.logout(token);
      case 'getCurrentUser': return this.getCurrentUser(token);
      case 'changePassword': return this.changePassword(payload, token);
      default: throw AppError_('UNKNOWN_ACTION', 'Aksi auth tidak dikenal: ' + action);
    }
  },

  /**
   * Membuat challenge CAPTCHA baru. Teks dikirim apa adanya ke klien supaya bisa
   * digambar ke <canvas> dengan distorsi — batasan pendekatan ini (dibanding
   * reCAPTCHA) sudah dicatat di dokumen desain, Keputusan 4.
   */
  getCaptcha: function () {
    var charset = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // tanpa 0/O/1/I yang mudah tertukar
    var text = '';
    for (var i = 0; i < 5; i++) {
      text += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    var challengeId = Utilities.getUuid();
    var ttl = getConfigNumber_('CAPTCHA_TTL_SECONDS', DEFAULTS.CAPTCHA_TTL_SECONDS);
    CacheService.getScriptCache().put('captcha_' + challengeId, text, ttl);
    return { challengeId: challengeId, text: text };
  },

  login: function (payload) {
    payload = payload || {};
    var username = String(payload.username || '').trim();
    var password = String(payload.password || '');
    var challengeId = String(payload.captchaChallengeId || '');
    var captchaAnswer = String(payload.captchaAnswer || '').trim().toUpperCase();

    if (!username || !password) {
      throw AppError_('BAD_REQUEST', 'Username dan password wajib diisi.');
    }

    // 1) Verifikasi CAPTCHA dulu, sebelum menyentuh apa pun soal user.
    //    Sekali pakai: langsung dihapus dari cache begitu diperiksa, berhasil atau gagal,
    //    supaya challenge yang sama tidak bisa dicoba berulang kali.
    var cache = CacheService.getScriptCache();
    var cacheKey = 'captcha_' + challengeId;
    var expected = cache.get(cacheKey);
    cache.remove(cacheKey);
    if (!expected) {
      throw AppError_('CAPTCHA_EXPIRED', 'Kode keamanan sudah kedaluwarsa. Silakan muat ulang.');
    }
    if (expected !== captchaAnswer) {
      logAudit_(null, 'LOGIN_FAILED', 'AUTH', username, 'Kode keamanan salah untuk username: ' + username);
      throw AppError_('CAPTCHA_INVALID', 'Kode keamanan yang Anda masukkan salah.');
    }

    // 2) Cari user
    var user = findRowByField_('USERS', 'username', username);
    if (!user) {
      logAudit_(null, 'LOGIN_FAILED', 'AUTH', username, 'Username tidak ditemukan');
      throw AppError_('INVALID_CREDENTIALS', 'Username atau password salah.');
    }

    // 3) Cek lockout & status akun
    var now = new Date();
    if (user.locked_until && String(user.locked_until) !== '' && new Date(user.locked_until) > now) {
      logAudit_(user.user_id, 'LOGIN_FAILED', 'AUTH', user.user_id, 'Login ditolak: akun sedang terkunci sementara');
      throw AppError_('ACCOUNT_LOCKED', 'Akun terkunci sementara karena terlalu banyak percobaan gagal. Coba lagi nanti.');
    }
    if (user.status !== 'AKTIF') {
      logAudit_(user.user_id, 'LOGIN_FAILED', 'AUTH', user.user_id, 'Login ditolak: akun tidak aktif');
      throw AppError_('ACCOUNT_INACTIVE', 'Akun tidak aktif. Hubungi admin.');
    }

    // 4) Verifikasi password
    var iterations = Number(user.password_iterations) || DEFAULTS.PASSWORD_ITERATIONS;
    var validPassword = verifyPassword_(password, user.password_salt, iterations, user.password_hash);

    if (!validPassword) {
      var newFailedCount = (Number(user.failed_login_count) || 0) + 1;
      var maxAttempts = getConfigNumber_('MAX_FAILED_LOGIN', DEFAULTS.MAX_FAILED_LOGIN);
      var updates = { failed_login_count: newFailedCount };
      if (newFailedCount >= maxAttempts) {
        var lockoutMinutes = getConfigNumber_('LOCKOUT_MINUTES', DEFAULTS.LOCKOUT_MINUTES);
        updates.locked_until = new Date(now.getTime() + lockoutMinutes * 60000).toISOString();
      }
      updateRowByField_('USERS', 'user_id', user.user_id, updates);
      logAudit_(user.user_id, 'LOGIN_FAILED', 'AUTH', user.user_id, 'Password salah (percobaan ke-' + newFailedCount + ')');
      throw AppError_('INVALID_CREDENTIALS', 'Username atau password salah.');
    }

    // 5) Sukses: reset counter lockout, catat last_login, buat sesi baru
    updateRowByField_('USERS', 'user_id', user.user_id, {
      failed_login_count: 0,
      locked_until: '',
      last_login: now.toISOString()
    });

    var session = createSession_(user.user_id);
    logAudit_(user.user_id, 'LOGIN_SUCCESS', 'AUTH', user.user_id, 'Login berhasil');

    return { sessionToken: session.token, user: publicUserView_(user) };
  },

  logout: function (token) {
    if (token) {
      var session = validateSession_(token);
      destroySession_(token);
      if (session) logAudit_(session.userId, 'LOGOUT', 'AUTH', session.userId, 'Logout');
    }
    return {};
  },

  getCurrentUser: function (token) {
    var session = requireSession_(token);
    var user = findRowByField_('USERS', 'user_id', session.userId);
    if (!user) throw AppError_('UNAUTHENTICATED', 'Sesi tidak valid.');
    return publicUserView_(user);
  },

  changePassword: function (payload, token) {
    var session = requireSession_(token);
    var user = findRowByField_('USERS', 'user_id', session.userId);
    if (!user) throw AppError_('UNAUTHENTICATED', 'Sesi tidak valid.');

    var oldPassword = String((payload && payload.oldPassword) || '');
    var newPassword = String((payload && payload.newPassword) || '');
    if (newPassword.length < 8) {
      throw AppError_('BAD_REQUEST', 'Password baru minimal 8 karakter.');
    }
    var iterations = Number(user.password_iterations) || DEFAULTS.PASSWORD_ITERATIONS;
    if (!verifyPassword_(oldPassword, user.password_salt, iterations, user.password_hash)) {
      throw AppError_('INVALID_CREDENTIALS', 'Password lama salah.');
    }

    var salt = generateSalt_();
    var newIterations = DEFAULTS.PASSWORD_ITERATIONS;
    var hash = hashPassword_(newPassword, salt, newIterations);
    updateRowByField_('USERS', 'user_id', user.user_id, {
      password_hash: hash,
      password_salt: salt,
      password_iterations: newIterations,
      updated_at: new Date().toISOString()
    });
    logAudit_(user.user_id, 'CHANGE_PASSWORD', 'AUTH', user.user_id, 'User mengganti password sendiri');
    return {};
  }
};

function publicUserView_(user) {
  // Sengaja TIDAK menyertakan password_hash/salt/iterations ke klien.
  return {
    userId: user.user_id,
    nama: user.nama,
    email: user.email,
    username: user.username,
    role: user.role
  };
}

// ===================== SESI =====================

function createSession_(userId) {
  var token = generateSessionToken_();
  var tokenHash = hashToken_(token);
  var now = new Date();
  var absoluteHours = getConfigNumber_('SESSION_ABSOLUTE_HOURS', DEFAULTS.SESSION_ABSOLUTE_HOURS);
  var expiresAt = new Date(now.getTime() + absoluteHours * 3600000);

  appendRow_('SESSIONS', {
    session_id: timeBasedId_('SES'),
    user_id: userId,
    token_hash: tokenHash,
    created_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    last_activity: now.toISOString(),
    status: 'ACTIVE'
  });
  return { token: token, expiresAt: expiresAt };
}

/**
 * Mengembalikan {userId, sessionId} jika token valid & belum kedaluwarsa (absolut
 * maupun sliding-timeout), atau null. Memperbarui last_activity di setiap panggilan valid.
 * Catatan skala: memindai seluruh sheet SESSIONS — cukup untuk ~8 pengguna; jika
 * nanti tumbuh besar, tambahkan job pembersihan sesi EXPIRED/REVOKED lama (belum
 * dibuat di Tahap 1 ini, dicatat sebagai follow-up).
 */
function validateSession_(token) {
  if (!token) return null;
  var tokenHash = hashToken_(token);
  var session = findRowByField_('SESSIONS', 'token_hash', tokenHash);
  if (!session || session.status !== 'ACTIVE') return null;

  var now = new Date();
  if (new Date(session.expires_at) < now) {
    updateRowByField_('SESSIONS', 'token_hash', tokenHash, { status: 'EXPIRED' });
    return null;
  }

  var timeoutMinutes = getConfigNumber_('SESSION_TIMEOUT_MINUTES', DEFAULTS.SESSION_TIMEOUT_MINUTES);
  var lastActivity = new Date(session.last_activity);
  var inactiveMinutes = (now.getTime() - lastActivity.getTime()) / 60000;
  if (inactiveMinutes > timeoutMinutes) {
    updateRowByField_('SESSIONS', 'token_hash', tokenHash, { status: 'EXPIRED' });
    return null;
  }

  updateRowByField_('SESSIONS', 'token_hash', tokenHash, { last_activity: now.toISOString() });
  return { userId: session.user_id, sessionId: session.session_id };
}

function destroySession_(token) {
  var tokenHash = hashToken_(token);
  updateRowByField_('SESSIONS', 'token_hash', tokenHash, { status: 'REVOKED' });
}
