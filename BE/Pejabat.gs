/**
 * Pejabat.gs
 * Master data PEJABAT (Tahap lanjutan): daftar nama+NIP orang yang berulang kali
 * jadi KPA/PPK/Pejabat Pengadaan di satker/paket berbeda -- BUKAN akun USERS
 * (pejabat ini tidak login ke sistem, hanya data untuk diisi ke KAK/HPS/SK/dst).
 * Dipakai sebagai sumber dropdown di form SATKER_TAHUN (Satkers.gs) dan form
 * edit Paket (Paket.gs) supaya user tidak perlu ketik ulang nama & NIP yang
 * sama berkali-kali -- lihat instruksi "orangnya sebenarnya banyak yang sama".
 * Memilih dari dropdown ini hanya MENGISI nama+NIP secara otomatis di form;
 * SATKER_TAHUN dan PAKET tetap menyimpan nama+NIP-nya sendiri (snapshot),
 * bukan referensi ID ke sini -- supaya riwayat dokumen lama tetap benar
 * meski data pejabat ini nanti diubah/dinonaktifkan.
 */

var PejabatService = {
  handle: function (action, payload, token) {
    switch (action) {
      case 'list': return this.list(payload, token);
      case 'create': return this.create(payload, token);
      case 'update': return this.update(payload, token);
      case 'setStatus': return this.setStatus(payload, token);
      default: throw AppError_('UNKNOWN_ACTION', 'Aksi pejabat tidak dikenal: ' + action);
    }
  },

  // Semua role yang login boleh lihat (dipakai untuk mengisi dropdown di form
  // yang bisa diakses Pengelola juga, mis. Edit Paket).
  list: function (payload, token) {
    requireSession_(token);
    var rows = readAllRows_('PEJABAT').rows;
    if (payload && payload.status) {
      rows = rows.filter(function (p) { return p.status === payload.status; });
    }
    return rows.sort(function (a, b) { return String(a.nama).localeCompare(String(b.nama)); });
  },

  create: function (payload, token) {
    var session = requireAccess_(token, { allowRoles: ['ADMIN'] }).session;
    payload = payload || {};
    var nama = String(payload.nama || '').trim();
    var nip = String(payload.nip || '').replace(/\D/g, '');
    if (!nama) throw AppError_('BAD_REQUEST', 'Nama pejabat wajib diisi.');
    if (nip && nip.length !== 18) throw AppError_('BAD_REQUEST', 'NIP harus 18 digit angka (kosongkan kalau belum ada).');

    var id = nextId_('PJB');
    var now = new Date().toISOString();
    appendRow_('PEJABAT', {
      pejabat_id: id, nama: nama, nip: nip, jabatan: payload.jabatan || '',
      pangkat_golongan: payload.pangkatGolongan || '',
      status: 'AKTIF', created_at: now, updated_at: now, created_by: session.userId
    });
    logAudit_(session.userId, 'CREATE_PEJABAT', 'PEJABAT', id, 'Membuat data pejabat: ' + nama);
    return { pejabatId: id };
  },

  update: function (payload, token) {
    var session = requireAccess_(token, { allowRoles: ['ADMIN'] }).session;
    payload = payload || {};
    var id = String(payload.pejabatId || '');
    if (!id) throw AppError_('BAD_REQUEST', 'pejabatId wajib diisi.');

    var updates = { updated_at: new Date().toISOString() };
    if (payload.nama !== undefined) {
      var nama = String(payload.nama || '').trim();
      if (!nama) throw AppError_('BAD_REQUEST', 'Nama pejabat tidak boleh kosong.');
      updates.nama = nama;
    }
    if (payload.nip !== undefined) {
      var nip = String(payload.nip || '').replace(/\D/g, '');
      if (nip && nip.length !== 18) throw AppError_('BAD_REQUEST', 'NIP harus 18 digit angka (kosongkan kalau belum ada).');
      updates.nip = nip;
    }
    if (payload.jabatan !== undefined) updates.jabatan = payload.jabatan;
    if (payload.pangkatGolongan !== undefined) updates.pangkat_golongan = payload.pangkatGolongan;

    var success = updateRowByField_('PEJABAT', 'pejabat_id', id, updates);
    if (!success) throw AppError_('NOT_FOUND', 'Data pejabat tidak ditemukan.');
    logAudit_(session.userId, 'UPDATE_PEJABAT', 'PEJABAT', id, 'Update data pejabat');
    return {};
  },

  // Nonaktifkan (bukan hapus) -- pejabat yang sudah pensiun/pindah tetap ada
  // riwayatnya di dokumen lama, cuma tidak muncul lagi di dropdown pilihan baru.
  setStatus: function (payload, token) {
    var session = requireAccess_(token, { allowRoles: ['ADMIN'] }).session;
    payload = payload || {};
    var id = String(payload.pejabatId || '');
    var status = String(payload.status || '');
    if (['AKTIF', 'NONAKTIF'].indexOf(status) === -1) throw AppError_('BAD_REQUEST', 'Status tidak valid.');

    var success = updateRowByField_('PEJABAT', 'pejabat_id', id, { status: status, updated_at: new Date().toISOString() });
    if (!success) throw AppError_('NOT_FOUND', 'Data pejabat tidak ditemukan.');
    logAudit_(session.userId, 'SET_PEJABAT_STATUS', 'PEJABAT', id, 'Status pejabat diubah ke ' + status);
    return {};
  }
};