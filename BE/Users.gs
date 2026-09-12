/**
 * Users.gs
 * CRUD master USERS. Semua aksi di sini khusus ADMIN (lihat Bagian E: matrix peran)
 * kecuali yang memang untuk diri sendiri (changePassword ada di Auth.gs).
 */

var UsersService = {
  handle: function (action, payload, token) {
    switch (action) {
      case 'list': return this.list(token);
      case 'create': return this.create(payload, token);
      case 'update': return this.update(payload, token);
      case 'resetPassword': return this.resetPassword(payload, token);
      case 'setStatus': return this.setStatus(payload, token);
      default: throw AppError_('UNKNOWN_ACTION', 'Aksi users tidak dikenal: ' + action);
    }
  },

  list: function (token) {
    requireAccess_(token, { allowRoles: ['ADMIN'] });
    var rows = readAllRows_('USERS').rows;
    return rows.map(function (u) {
      var view = publicUserView_(u);
      view.status = u.status;
      view.nip = u.nip;
      view.lastLogin = u.last_login;
      return view;
    });
  },

  create: function (payload, token) {
    var session = requireAccess_(token, { allowRoles: ['ADMIN'] }).session;
    payload = payload || {};
    var nama = String(payload.nama || '').trim();
    var nip = String(payload.nip || '').trim();
    var email = String(payload.email || '').trim();
    var username = String(payload.username || '').trim();
    var password = String(payload.password || '');
    var role = String(payload.role || 'VIEWER');

    if (!nama || !username || !password) {
      throw AppError_('BAD_REQUEST', 'Nama, username, dan password wajib diisi.');
    }
    if (password.length < 8) {
      throw AppError_('BAD_REQUEST', 'Password minimal 8 karakter.');
    }
    if (['ADMIN', 'PENGELOLA', 'VIEWER'].indexOf(role) === -1) {
      throw AppError_('BAD_REQUEST', 'Role tidak valid.');
    }
    if (findRowByField_('USERS', 'username', username)) {
      throw AppError_('DUPLICATE', 'Username sudah dipakai.');
    }

    var salt = generateSalt_();
    var iterations = DEFAULTS.PASSWORD_ITERATIONS;
    var hash = hashPassword_(password, salt, iterations);
    var now = new Date().toISOString();
    var userId = nextId_('USR');

    appendRow_('USERS', {
      user_id: userId, nama: nama, nip: nip, email: email, username: username,
      password_hash: hash, password_salt: salt, password_iterations: iterations,
      role: role, status: 'AKTIF', last_login: '', failed_login_count: 0, locked_until: '',
      created_at: now, updated_at: now
    });

    logAudit_(session.userId, 'CREATE_USER', 'USERS', userId, 'Membuat user baru: ' + username + ' (' + role + ')');
    return { userId: userId };
  },

  update: function (payload, token) {
    var session = requireAccess_(token, { allowRoles: ['ADMIN'] }).session;
    payload = payload || {};
    var userId = String(payload.userId || '');
    if (!userId) throw AppError_('BAD_REQUEST', 'userId wajib diisi.');

    var updates = { updated_at: new Date().toISOString() };
    ['nama', 'nip', 'email', 'role'].forEach(function (f) {
      if (payload[f] !== undefined) updates[f] = payload[f];
    });
    if (updates.role && ['ADMIN', 'PENGELOLA', 'VIEWER'].indexOf(updates.role) === -1) {
      throw AppError_('BAD_REQUEST', 'Role tidak valid.');
    }

    var success = updateRowByField_('USERS', 'user_id', userId, updates);
    if (!success) throw AppError_('NOT_FOUND', 'User tidak ditemukan.');
    logAudit_(session.userId, 'UPDATE_USER', 'USERS', userId, 'Update data user');
    return {};
  },

  resetPassword: function (payload, token) {
    var session = requireAccess_(token, { allowRoles: ['ADMIN'] }).session;
    payload = payload || {};
    var userId = String(payload.userId || '');
    var newPassword = String(payload.newPassword || '');
    if (!userId || !newPassword) throw AppError_('BAD_REQUEST', 'userId dan newPassword wajib diisi.');
    if (newPassword.length < 8) throw AppError_('BAD_REQUEST', 'Password minimal 8 karakter.');

    var salt = generateSalt_();
    var iterations = DEFAULTS.PASSWORD_ITERATIONS;
    var hash = hashPassword_(newPassword, salt, iterations);
    var success = updateRowByField_('USERS', 'user_id', userId, {
      password_hash: hash, password_salt: salt, password_iterations: iterations,
      failed_login_count: 0, locked_until: '', updated_at: new Date().toISOString()
    });
    if (!success) throw AppError_('NOT_FOUND', 'User tidak ditemukan.');
    logAudit_(session.userId, 'RESET_PASSWORD', 'USERS', userId, 'Password direset oleh admin');
    return {};
  },

  setStatus: function (payload, token) {
    var session = requireAccess_(token, { allowRoles: ['ADMIN'] }).session;
    payload = payload || {};
    var userId = String(payload.userId || '');
    var status = String(payload.status || '');
    if (['AKTIF', 'NONAKTIF'].indexOf(status) === -1) throw AppError_('BAD_REQUEST', 'Status tidak valid.');

    var success = updateRowByField_('USERS', 'user_id', userId, { status: status, updated_at: new Date().toISOString() });
    if (!success) throw AppError_('NOT_FOUND', 'User tidak ditemukan.');
    logAudit_(session.userId, 'SET_USER_STATUS', 'USERS', userId, 'Status diubah ke ' + status);
    return {};
  }
};
