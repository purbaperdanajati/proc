/**
 * Assignments.gs
 * CRUD USER_ASSIGNMENTS — backbone otorisasi: menentukan satker mana yang jadi
 * tanggung jawab user mana, pada tahun anggaran mana (Bagian C & E dokumen desain).
 */

var AssignmentsService = {
  handle: function (action, payload, token) {
    switch (action) {
      case 'list': return this.list(payload, token);
      case 'myAssignedSatkers': return this.myAssignedSatkers(payload, token);
      case 'create': return this.create(payload, token);
      case 'update': return this.update(payload, token);
      case 'end': return this.end(payload, token);
      default: throw AppError_('UNKNOWN_ACTION', 'Aksi assignments tidak dikenal: ' + action);
    }
  },

  list: function (payload, token) {
    requireAccess_(token, { allowRoles: ['ADMIN'] });
    var all = readAllRows_('USER_ASSIGNMENTS').rows;
    if (payload && payload.tahunAnggaranId) {
      return all.filter(function (a) { return a.tahun_anggaran_id === payload.tahunAnggaranId; });
    }
    return all;
  },

  myAssignedSatkers: function (payload, token) {
    var session = requireSession_(token);
    var ids = getMyAssignedSatkerIds_(session.userId, payload && payload.tahunAnggaranId);
    var satkers = readAllRows_('SATKER').rows;
    return satkers.filter(function (s) { return ids.indexOf(s.satker_id) !== -1; });
  },

  create: function (payload, token) {
    var session = requireAccess_(token, { allowRoles: ['ADMIN'] }).session;
    payload = payload || {};
    var userId = String(payload.userId || '');
    var satkerId = String(payload.satkerId || '');
    var tahunAnggaranId = String(payload.tahunAnggaranId || '');
    if (!userId || !satkerId || !tahunAnggaranId) {
      throw AppError_('BAD_REQUEST', 'userId, satkerId, dan tahunAnggaranId wajib diisi.');
    }

    if (!findRowByField_('USERS', 'user_id', userId)) throw AppError_('NOT_FOUND', 'User tidak ditemukan.');
    if (!findRowByField_('SATKER', 'satker_id', satkerId)) throw AppError_('NOT_FOUND', 'Satker tidak ditemukan.');
    if (!findRowByField_('YEARS', 'tahun_anggaran_id', tahunAnggaranId)) throw AppError_('NOT_FOUND', 'Tahun anggaran tidak ditemukan.');

    var rows = readAllRows_('USER_ASSIGNMENTS').rows;
    var dup = rows.some(function (a) {
      return a.user_id === userId && a.satker_id === satkerId &&
        a.tahun_anggaran_id === tahunAnggaranId && a.status === 'AKTIF';
    });
    if (dup) throw AppError_('DUPLICATE', 'Assignment ini sudah ada dan masih aktif.');

    var id = nextId_('ASG');
    var now = new Date().toISOString();
    appendRow_('USER_ASSIGNMENTS', {
      assignment_id: id, tahun_anggaran_id: tahunAnggaranId, user_id: userId, satker_id: satkerId,
      tanggal_mulai: payload.tanggalMulai || now, tanggal_selesai: payload.tanggalSelesai || '',
      status: 'AKTIF', created_at: now, created_by: session.userId
    });
    logAudit_(session.userId, 'CREATE_ASSIGNMENT', 'USER_ASSIGNMENTS', id,
      'Assign user ' + userId + ' ke satker ' + satkerId + ' TA ' + tahunAnggaranId);
    return { assignmentId: id };
  },

  update: function (payload, token) {
    var session = requireAccess_(token, { allowRoles: ['ADMIN'] }).session;
    payload = payload || {};
    var id = String(payload.assignmentId || '');
    if (!id) throw AppError_('BAD_REQUEST', 'assignmentId wajib diisi.');

    var updates = {};
    if (payload.tanggalSelesai !== undefined) updates.tanggal_selesai = payload.tanggalSelesai;
    if (payload.status !== undefined) updates.status = payload.status;

    var success = updateRowByField_('USER_ASSIGNMENTS', 'assignment_id', id, updates);
    if (!success) throw AppError_('NOT_FOUND', 'Assignment tidak ditemukan.');
    logAudit_(session.userId, 'UPDATE_ASSIGNMENT', 'USER_ASSIGNMENTS', id, 'Update assignment');
    return {};
  },

  end: function (payload, token) {
    var session = requireAccess_(token, { allowRoles: ['ADMIN'] }).session;
    payload = payload || {};
    var id = String(payload.assignmentId || '');
    if (!id) throw AppError_('BAD_REQUEST', 'assignmentId wajib diisi.');

    var success = updateRowByField_('USER_ASSIGNMENTS', 'assignment_id', id, {
      status: 'BERAKHIR', tanggal_selesai: new Date().toISOString()
    });
    if (!success) throw AppError_('NOT_FOUND', 'Assignment tidak ditemukan.');
    logAudit_(session.userId, 'END_ASSIGNMENT', 'USER_ASSIGNMENTS', id, 'Mengakhiri assignment');
    return {};
  }
};
