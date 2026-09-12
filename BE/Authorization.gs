/**
 * Authorization.gs
 * Semua pemeriksaan hak akses disentralkan di sini (Bagian E dokumen desain),
 * dipanggil oleh SETIAP fungsi modul yang menyentuh data — bukan diperiksa
 * dengan gaya berbeda-beda di tiap file, dan tidak pernah hanya "disembunyikan
 * di menu" pada frontend.
 */

function requireSession_(token) {
  var session = validateSession_(token);
  if (!session) {
    throw AppError_('UNAUTHENTICATED', 'Sesi tidak valid atau sudah berakhir. Silakan login kembali.');
  }
  return session;
}

/**
 * opts:
 *   allowRoles   : array role yang boleh (mis. ['ADMIN']) — Admin selalu lolos otomatis
 *   satkerId     : jika diisi, user non-Admin harus punya assignment aktif ke satker ini
 *   tahunAnggaranId : opsional, mempersempit pengecekan assignment ke tahun tertentu
 */
function requireAccess_(token, opts) {
  opts = opts || {};
  var session = requireSession_(token);
  var user = findRowByField_('USERS', 'user_id', session.userId);
  if (!user || user.status !== 'AKTIF') {
    throw AppError_('ACCESS_DENIED', 'Akun tidak aktif.');
  }

  if (user.role === 'ADMIN') {
    return { session: session, user: user };
  }

  if (opts.allowRoles && opts.allowRoles.indexOf(user.role) === -1) {
    throw AppError_('ACCESS_DENIED', 'Peran Anda tidak memiliki izin untuk aksi ini.');
  }

  if (opts.satkerId) {
    var hasAccess = userHasSatkerAccess_(user.user_id, opts.satkerId, opts.tahunAnggaranId);
    if (!hasAccess) {
      throw AppError_('ACCESS_DENIED', 'Anda tidak memiliki akses ke satker ini.');
    }
  }

  return { session: session, user: user };
}

function userHasSatkerAccess_(userId, satkerId, tahunAnggaranId) {
  var data = readAllRows_('USER_ASSIGNMENTS');
  for (var i = 0; i < data.rows.length; i++) {
    var a = data.rows[i];
    if (a.user_id !== userId || a.satker_id !== satkerId) continue;
    if (a.status !== 'AKTIF') continue;
    if (tahunAnggaranId && a.tahun_anggaran_id !== tahunAnggaranId) continue;
    return true;
  }
  return false;
}

function getMyAssignedSatkerIds_(userId, tahunAnggaranId) {
  var data = readAllRows_('USER_ASSIGNMENTS');
  var ids = [];
  for (var i = 0; i < data.rows.length; i++) {
    var a = data.rows[i];
    if (a.user_id !== userId || a.status !== 'AKTIF') continue;
    if (tahunAnggaranId && a.tahun_anggaran_id !== tahunAnggaranId) continue;
    ids.push(a.satker_id);
  }
  return ids;
}
