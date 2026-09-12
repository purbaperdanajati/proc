  var currentUser = null;

  function startApp(user) {
    currentUser = user;
    document.getElementById('view-login').style.display = 'none';
    document.getElementById('view-app').style.display = '';
    document.getElementById('topbar-user').textContent = user.nama + ' (' + user.role + ')';

    if (user.role !== 'ADMIN') {
      document.querySelectorAll('.admin-only').forEach(function (el) { el.style.display = 'none'; });
    }

    document.querySelectorAll('.sidebar nav a').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        location.hash = a.getAttribute('href');
      });
    });

    window.addEventListener('hashchange', renderRoute);
    renderRoute();
  }

  function renderRoute() {
    var hash = location.hash || '#/dashboard';
    var parts = hash.replace('#/', '').split('/');
    var viewName = parts[0] || 'dashboard';

    document.querySelectorAll('.sidebar nav a').forEach(function (a) {
      a.classList.toggle('active', a.getAttribute('data-view') === viewName);
    });

    var content = document.getElementById('content-area');
    content.innerHTML = '<p>Memuat...</p>';

    switch (viewName) {
      case 'satker':
        if (parts[1]) return renderSatkerDetailView(content, parts[1]);
        return renderSatkerView(content);
      case 'years': return renderYearsView(content);
      case 'assignments': return renderAssignmentsView(content);
      case 'users': return renderUsersView(content);
      case 'audit': return renderAuditView(content);
      case 'profile': return renderProfileView(content);
      default: return renderDashboardView(content);
    }
  }

  function renderError(content, err) {
    content.innerHTML = '<p class="error-text">' + escapeHtml(err.message || 'Terjadi kesalahan.') + '</p>';
  }

  // ===================== HELPER BERSAMA: TAHUN ANGGARAN, STATUS, PROGRES =====================
  var selectedTahunAnggaranId = null;

  function ensureYearsLoaded() {
    return callApi('years', 'list', {}).then(function (years) {
      if (!selectedTahunAnggaranId && years.length > 0) {
        var aktif = years.filter(function (y) { return y.status === 'AKTIF'; });
        var pool = aktif.length > 0 ? aktif : years;
        pool.sort(function (a, b) { return Number(b.tahun) - Number(a.tahun); });
        selectedTahunAnggaranId = pool[0].tahun_anggaran_id;
      }
      return { years: years, selectedId: selectedTahunAnggaranId };
    });
  }

  function renderYearSelectorHtml(years, selectedId) {
    if (years.length === 0) return '';
    var options = years.map(function (y) {
      var sel = (y.tahun_anggaran_id === selectedId) ? ' selected' : '';
      return '<option value="' + escapeHtml(y.tahun_anggaran_id) + '"' + sel + '>' + escapeHtml(y.tahun) + '</option>';
    }).join('');
    return '<select id="year-selector">' + options + '</select>';
  }

  function attachYearSelectorHandler(content, rerenderFn) {
    var sel = document.getElementById('year-selector');
    if (sel) sel.addEventListener('change', function () {
      selectedTahunAnggaranId = sel.value;
      rerenderFn(content);
    });
  }

  function attachSatkerLinkHandlers(content) {
    content.querySelectorAll('[data-satker-link]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.preventDefault();
        location.hash = '#/satker/' + el.getAttribute('data-satker-link');
      });
    });
  }

  function statusLabel(status) {
    switch (status) {
      case 'BELUM_DIINPUT': return 'Belum Diinput';
      case 'TIDAK_ADA_PENGADAAN': return 'Tidak Ada Pengadaan';
      case 'BERJALAN': return 'Berjalan';
      case 'COMPLETE': return 'Complete';
      default: return status || '-';
    }
  }

  function statusBadgeClass(status) {
    switch (status) {
      case 'COMPLETE': return 'badge-complete';
      case 'BERJALAN': return 'badge-berjalan';
      case 'TIDAK_ADA_PENGADAAN': return 'badge-netral';
      default: return 'badge-belum';
    }
  }

  function progressBarHtml(persentase) {
    if (persentase === null || persentase === undefined) {
      return '<span class="progress-empty">Belum ada paket</span>';
    }
    return '<span class="progress-track"><span class="progress-fill" style="width:' + persentase + '%"></span></span>' +
      '<span class="progress-label">' + persentase + '%</span>';
  }

  function formatRupiah(n) {
    n = Number(n) || 0;
    return 'Rp' + n.toLocaleString('id-ID');
  }

  function statCard(label, value) {
    return '<div class="stat-card"><div class="stat-value">' + escapeHtml(value) + '</div><div class="stat-label">' + escapeHtml(label) + '</div></div>';
  }

  function buildSatkerListHtml(satkerList) {
    if (satkerList.length === 0) return '<p>Belum ada satker.</p>';
    var html = '<table class="data-table"><thead><tr><th>Satker</th><th>Jenis</th><th>Status</th><th>Progres</th></tr></thead><tbody>';
    satkerList.forEach(function (s) {
      html += '<tr>' +
        '<td><a href="#" data-satker-link="' + escapeHtml(s.satkerId) + '">' + escapeHtml(s.namaSatker) + '</a></td>' +
        '<td>' + escapeHtml(s.jenisSatker) + '</td>' +
        '<td><span class="badge ' + statusBadgeClass(s.status) + '">' + statusLabel(s.status) + '</span></td>' +
        '<td>' + progressBarHtml(s.persentaseKelengkapan) + '</td>' +
        '</tr>';
    });
    html += '</tbody></table>';
    return html;
  }

  // ===================== DASHBOARD =====================
  function renderDashboardView(content) {
    ensureYearsLoaded().then(function (yearInfo) {
      if (yearInfo.years.length === 0) {
        content.innerHTML = '<h2>Dashboard</h2><p>Belum ada Tahun Anggaran. Buat dulu lewat menu <a href="#/years">Tahun Anggaran</a>.</p>';
        return;
      }
      var action = currentUser.role === 'ADMIN' ? 'getGlobal' : 'getMine';
      callApi('dashboard', action, { tahunAnggaranId: yearInfo.selectedId }).then(function (data) {
        content.innerHTML = buildDashboardHtml(data, yearInfo);
        attachYearSelectorHandler(content, renderDashboardView);
        attachSatkerLinkHandlers(content);
      }).catch(function (err) { renderError(content, err); });
    }).catch(function (err) { renderError(content, err); });
  }

  function buildDashboardHtml(data, yearInfo) {
    var yearSelectorHtml = renderYearSelectorHtml(yearInfo.years, yearInfo.selectedId);

    if (!data.tahunAnggaranId) {
      return '<h2>Dashboard</h2><p>' + escapeHtml(data.message) + '</p>';
    }

    if (currentUser.role === 'ADMIN') {
      return '<h2>Dashboard</h2>' +
        '<p>Tahun Anggaran: ' + yearSelectorHtml + '</p>' +
        '<div class="stat-grid">' +
          statCard('Total Satker', data.totalSatker) +
          statCard('Ada Pengadaan', data.satkerAdaPengadaan) +
          statCard('Tidak Ada Pengadaan', data.satkerTidakAdaPengadaan) +
          statCard('Belum Diinput', data.satkerBelumDiinput) +
          statCard('Total Paket', data.totalPaket) +
          statCard('Paket Complete', data.paketComplete) +
          statCard('Belum Complete', data.paketBelumComplete) +
          statCard('Total Pagu', formatRupiah(data.totalPagu)) +
          statCard('Total HPS', formatRupiah(data.totalHps)) +
          statCard('Total Kontrak', formatRupiah(data.totalKontrak)) +
        '</div>' +
        (data.totalPaket === 0 ? '<p class="hint-text">Total Paket/Pagu/HPS/Kontrak masih 0 karena modul Pagu &amp; Paket baru dibangun di Tahap 3.</p>' : '') +
        '<h3>Daftar Satker</h3>' +
        buildSatkerListHtml(data.satkerList);
    }

    return '<h2>Dashboard</h2>' +
      '<p>Tahun Anggaran: ' + yearSelectorHtml + '</p>' +
      '<p>Halo, ' + escapeHtml(data.namaUser) + '. Tanggung jawab Anda:</p>' +
      '<div class="stat-grid">' +
        statCard('Satker', data.totalSatkerSaya) +
        statCard('Paket', data.totalPaketSaya) +
        statCard('Complete', data.paketCompleteSaya) +
        statCard('Belum Complete', data.paketBelumCompleteSaya) +
      '</div>' +
      '<h3>Satker Saya</h3>' +
      buildSatkerListHtml(data.satkerList);
  }

  // ===================== TAHUN ANGGARAN =====================
  function renderYearsView(content) {
    callApi('years', 'list', {}).then(function (years) {
      var html = '<h2>Tahun Anggaran</h2>';
      if (currentUser.role === 'ADMIN') {
        html += '<form id="form-add-year" class="inline-form">' +
          '<input type="number" id="input-tahun" placeholder="Tahun, mis. 2027" required>' +
          '<button type="submit">Tambah</button></form>';
      }
      html += '<table class="data-table"><thead><tr><th>Tahun</th><th>Status</th><th>Catatan</th></tr></thead><tbody>';
      years.forEach(function (y) {
        html += '<tr><td>' + escapeHtml(y.tahun) + '</td><td><span class="badge">' + escapeHtml(y.status) + '</span></td><td>' + escapeHtml(y.catatan) + '</td></tr>';
      });
      html += '</tbody></table>';
      content.innerHTML = html;

      var form = document.getElementById('form-add-year');
      if (form) form.addEventListener('submit', function (e) {
        e.preventDefault();
        callApi('years', 'create', { tahun: document.getElementById('input-tahun').value }).then(function () {
          showToast('Tahun anggaran ditambahkan.');
          renderYearsView(content);
        }).catch(function (err) { showToast(err.message, true); });
      });
    }).catch(function (err) { renderError(content, err); });
  }

  // ===================== SATKER =====================
  function renderSatkerView(content) {
    ensureYearsLoaded().then(function (yearInfo) {
      var payload = yearInfo.selectedId ? { tahunAnggaranId: yearInfo.selectedId } : {};
      callApi('satkers', 'list', payload).then(function (satkers) {
        var yearSelectorHtml = renderYearSelectorHtml(yearInfo.years, yearInfo.selectedId);
        var html = '<h2>Satker</h2>';
        if (yearSelectorHtml) html += '<p>Tahun Anggaran: ' + yearSelectorHtml + '</p>';

        if (currentUser.role === 'ADMIN') {
          html += '<form id="form-add-satker" class="inline-form">' +
            '<input id="input-kode" placeholder="Kode Satker" required>' +
            '<input id="input-nama" placeholder="Nama Satker" required>' +
            '<select id="input-jenis">' +
              '<option>MAN</option><option>MIN</option><option>MTsN</option>' +
              '<option>KUA</option><option>PENDIS</option><option>SEKJEN</option><option>LAINNYA</option>' +
            '</select>' +
            '<button type="submit">Tambah</button></form>';
        }

        html += '<table class="data-table"><thead><tr><th>Kode</th><th>Nama</th><th>Jenis</th>' +
          (yearInfo.selectedId ? '<th>Status</th><th>Progres</th>' : '<th>Status Aktif</th>') + '</tr></thead><tbody>';
        satkers.forEach(function (s) {
          html += '<tr>' +
            '<td>' + escapeHtml(s.kode_satker) + '</td>' +
            '<td><a href="#" data-satker-link="' + escapeHtml(s.satker_id) + '">' + escapeHtml(s.nama_satker) + '</a></td>' +
            '<td>' + escapeHtml(s.jenis_satker) + '</td>';
          if (yearInfo.selectedId) {
            html += '<td><span class="badge ' + statusBadgeClass(s.status_tahun_ini) + '">' + statusLabel(s.status_tahun_ini) + '</span></td>' +
              '<td>' + progressBarHtml(s.persentase_kelengkapan) + '</td>';
          } else {
            html += '<td><span class="badge">' + escapeHtml(s.status) + '</span></td>';
          }
          html += '</tr>';
        });
        html += '</tbody></table>';
        if (satkers.length === 0) {
          html += '<p>' + (currentUser.role === 'ADMIN' ? 'Belum ada satker. Tambahkan lewat form di atas.' : 'Belum ada satker yang menjadi tanggung jawab Anda.') + '</p>';
        }
        content.innerHTML = html;

        attachYearSelectorHandler(content, renderSatkerView);
        attachSatkerLinkHandlers(content);

        var form = document.getElementById('form-add-satker');
        if (form) form.addEventListener('submit', function (e) {
          e.preventDefault();
          callApi('satkers', 'create', {
            kodeSatker: document.getElementById('input-kode').value,
            namaSatker: document.getElementById('input-nama').value,
            jenisSatker: document.getElementById('input-jenis').value
          }).then(function () {
            showToast('Satker ditambahkan.');
            renderSatkerView(content);
          }).catch(function (err) { showToast(err.message, true); });
        });
      }).catch(function (err) { renderError(content, err); });
    }).catch(function (err) { renderError(content, err); });
  }

  // ===================== DETAIL SATKER (klik dari Dashboard/daftar Satker) =====================
  function renderSatkerDetailView(content, satkerId) {
    ensureYearsLoaded().then(function (yearInfo) {
      var payload = { satkerId: satkerId };
      if (yearInfo.selectedId) payload.tahunAnggaranId = yearInfo.selectedId;

      callApi('satkers', 'detail', payload).then(function (s) {
        var yearSelectorHtml = renderYearSelectorHtml(yearInfo.years, yearInfo.selectedId);
        var st = s.satkerTahun || {};

        var html = '<p><a href="#/satker">&larr; Kembali ke Daftar Satker</a></p>' +
          '<h2>' + escapeHtml(s.nama_satker) + '</h2>';
        if (yearSelectorHtml) html += '<p>Tahun Anggaran: ' + yearSelectorHtml + '</p>';
        if (yearInfo.selectedId) {
          html += '<p>Status: <span class="badge ' + statusBadgeClass(s.status_tahun_ini) + '">' + statusLabel(s.status_tahun_ini) + '</span> ' + progressBarHtml(s.persentase_kelengkapan) + '</p>';
        }

        html += '<table class="data-table"><tbody>' +
          '<tr><th>Kode Satker</th><td>' + escapeHtml(s.kode_satker) + '</td></tr>' +
          '<tr><th>Jenis</th><td>' + escapeHtml(s.jenis_satker) + '</td></tr>' +
          '<tr><th>Wilayah</th><td>' + escapeHtml(s.wilayah || '-') + '</td></tr>' +
          '<tr><th>Alamat</th><td>' + escapeHtml(s.alamat || '-') + '</td></tr>' +
          '<tr><th>SP DIPA</th><td>' + escapeHtml(st.sp_dipa || '-') + '</td></tr>' +
          '<tr><th>Tanggal DIPA</th><td>' + escapeHtml(st.tanggal_dipa || '-') + '</td></tr>' +
          '<tr><th>KPA</th><td>' + escapeHtml(st.kpa_nama || '-') + (st.kpa_nip ? ' (NIP. ' + escapeHtml(st.kpa_nip) + ')' : '') + '</td></tr>' +
          '<tr><th>PPK</th><td>' + escapeHtml(st.ppk_nama || '-') + (st.ppk_nip ? ' (NIP. ' + escapeHtml(st.ppk_nip) + ')' : '') + '</td></tr>' +
          '<tr><th>Pejabat Pengadaan</th><td>' + escapeHtml(st.pejabat_pengadaan_nama || '-') + (st.pejabat_pengadaan_nip ? ' (NIP. ' + escapeHtml(st.pejabat_pengadaan_nip) + ')' : '') + '</td></tr>' +
          '</tbody></table>' +
          '<p class="hint-text">Rincian pagu per jenis pengadaan akan tersedia setelah Tahap 3 (Pagu, Jenis Pengadaan, Paket).</p>';

        if (currentUser.role === 'ADMIN' && yearInfo.selectedId) {
          html += '<h3>Konfigurasi Tahun Ini</h3>' +
            '<form id="form-satker-tahun" class="inline-form" style="max-width:420px;">' +
            '<label>SP DIPA</label><br><input id="st-spdipa" value="' + escapeHtml(st.sp_dipa || '') + '" style="width:100%;"><br><br>' +
            '<label>Tanggal DIPA</label><br><input type="date" id="st-tgldipa" value="' + escapeHtml(st.tanggal_dipa || '') + '"><br><br>' +
            '<label>KPA (Nama)</label><br><input id="st-kpanama" value="' + escapeHtml(st.kpa_nama || '') + '" style="width:100%;"><br>' +
            '<label>KPA (NIP)</label><br><input id="st-kpanip" value="' + escapeHtml(st.kpa_nip || '') + '" style="width:100%;"><br><br>' +
            '<label>PPK (Nama)</label><br><input id="st-ppknama" value="' + escapeHtml(st.ppk_nama || '') + '" style="width:100%;"><br>' +
            '<label>PPK (NIP)</label><br><input id="st-ppknip" value="' + escapeHtml(st.ppk_nip || '') + '" style="width:100%;"><br><br>' +
            '<label>Pejabat Pengadaan (Nama)</label><br><input id="st-ppnama" value="' + escapeHtml(st.pejabat_pengadaan_nama || '') + '" style="width:100%;"><br>' +
            '<label>Pejabat Pengadaan (NIP)</label><br><input id="st-ppnip" value="' + escapeHtml(st.pejabat_pengadaan_nip || '') + '" style="width:100%;"><br><br>' +
            '<label>Status Pengadaan Tahun Ini</label><br>' +
            '<select id="st-ada">' +
              '<option value="BELUM_DITENTUKAN"' + ((!st.ada_pengadaan || st.ada_pengadaan === 'BELUM_DITENTUKAN') ? ' selected' : '') + '>Belum Ditentukan</option>' +
              '<option value="ADA"' + (st.ada_pengadaan === 'ADA' ? ' selected' : '') + '>Ada Pengadaan</option>' +
              '<option value="TIDAK_ADA"' + (st.ada_pengadaan === 'TIDAK_ADA' ? ' selected' : '') + '>Tidak Ada Pengadaan</option>' +
            '</select><br><br>' +
            '<label>Catatan</label><br><input id="st-catatan" value="' + escapeHtml(st.catatan || '') + '" style="width:100%;"><br><br>' +
            '<button type="submit">Simpan</button>' +
            '</form>';
        }

        content.innerHTML = html;
        attachYearSelectorHandler(content, function (c) { renderSatkerDetailView(c, satkerId); });

        var form = document.getElementById('form-satker-tahun');
        if (form) form.addEventListener('submit', function (e) {
          e.preventDefault();
          callApi('satkers', 'saveSatkerTahun', {
            satkerId: satkerId,
            tahunAnggaranId: yearInfo.selectedId,
            spDipa: document.getElementById('st-spdipa').value,
            tanggalDipa: document.getElementById('st-tgldipa').value,
            kpaNama: document.getElementById('st-kpanama').value,
            kpaNip: document.getElementById('st-kpanip').value,
            ppkNama: document.getElementById('st-ppknama').value,
            ppkNip: document.getElementById('st-ppknip').value,
            pejabatPengadaanNama: document.getElementById('st-ppnama').value,
            pejabatPengadaanNip: document.getElementById('st-ppnip').value,
            adaPengadaan: document.getElementById('st-ada').value,
            catatan: document.getElementById('st-catatan').value
          }).then(function () {
            showToast('Konfigurasi satker-tahun disimpan.');
            renderSatkerDetailView(content, satkerId);
          }).catch(function (err) { showToast(err.message, true); });
        });
      }).catch(function (err) { renderError(content, err); });
    }).catch(function (err) { renderError(content, err); });
  }

  // ===================== PENGGUNA (ADMIN) =====================
  function renderUsersView(content) {
    callApi('users', 'list', {}).then(function (users) {
      var html = '<h2>Pengguna</h2>' +
        '<form id="form-add-user" class="inline-form">' +
        '<input id="input-u-nama" placeholder="Nama" required>' +
        '<input id="input-u-username" placeholder="Username" required>' +
        '<input id="input-u-password" type="password" placeholder="Password awal (min. 8 karakter)" required>' +
        '<select id="input-u-role"><option value="PENGELOLA">Pengelola</option><option value="VIEWER">Viewer</option><option value="ADMIN">Admin</option></select>' +
        '<button type="submit">Tambah</button></form>' +
        '<table class="data-table"><thead><tr><th>Nama</th><th>Username</th><th>Role</th><th>Status</th><th>Login Terakhir</th></tr></thead><tbody>';
      users.forEach(function (u) {
        html += '<tr><td>' + escapeHtml(u.nama) + '</td><td>' + escapeHtml(u.username) + '</td>' +
          '<td>' + escapeHtml(u.role) + '</td><td><span class="badge">' + escapeHtml(u.status || 'AKTIF') + '</span></td>' +
          '<td>' + escapeHtml(u.lastLogin || '-') + '</td></tr>';
      });
      html += '</tbody></table>';
      content.innerHTML = html;

      document.getElementById('form-add-user').addEventListener('submit', function (e) {
        e.preventDefault();
        callApi('users', 'create', {
          nama: document.getElementById('input-u-nama').value,
          username: document.getElementById('input-u-username').value,
          password: document.getElementById('input-u-password').value,
          role: document.getElementById('input-u-role').value
        }).then(function () {
          showToast('Pengguna ditambahkan.');
          renderUsersView(content);
        }).catch(function (err) { showToast(err.message, true); });
      });
    }).catch(function (err) { renderError(content, err); });
  }

  // ===================== ASSIGNMENT (ADMIN) =====================
  function renderAssignmentsView(content) {
    Promise.all([
      callApi('users', 'list', {}),
      callApi('satkers', 'list', {}),
      callApi('years', 'list', {}),
      callApi('assignments', 'list', {})
    ]).then(function (results) {
      var users = results[0], satkers = results[1], years = results[2], assignments = results[3];

      if (users.length === 0 || satkers.length === 0 || years.length === 0) {
        content.innerHTML = '<h2>Assignment Satker</h2><p>Buat dulu minimal satu Pengguna, satu Satker, dan satu Tahun Anggaran sebelum membuat assignment.</p>';
        return;
      }

      var opt = function (list, valueKey, labelKey) {
        return list.map(function (item) {
          return '<option value="' + escapeHtml(item[valueKey]) + '">' + escapeHtml(item[labelKey]) + '</option>';
        }).join('');
      };

      var html = '<h2>Assignment Satker</h2>' +
        '<form id="form-add-assignment" class="inline-form">' +
        '<select id="input-a-user">' + opt(users, 'userId', 'nama') + '</select>' +
        '<select id="input-a-satker">' + opt(satkers, 'satker_id', 'nama_satker') + '</select>' +
        '<select id="input-a-tahun">' + opt(years, 'tahun_anggaran_id', 'tahun') + '</select>' +
        '<button type="submit">Assign</button></form>' +
        '<table class="data-table"><thead><tr><th>Pengguna</th><th>Satker</th><th>Tahun</th><th>Status</th></tr></thead><tbody>';

      assignments.forEach(function (a) {
        var u = users.filter(function (x) { return x.userId === a.user_id; })[0];
        var s = satkers.filter(function (x) { return x.satker_id === a.satker_id; })[0];
        html += '<tr><td>' + escapeHtml(u ? u.nama : a.user_id) + '</td>' +
          '<td>' + escapeHtml(s ? s.nama_satker : a.satker_id) + '</td>' +
          '<td>' + escapeHtml(a.tahun_anggaran_id) + '</td>' +
          '<td><span class="badge">' + escapeHtml(a.status) + '</span></td></tr>';
      });
      html += '</tbody></table>';
      content.innerHTML = html;

      document.getElementById('form-add-assignment').addEventListener('submit', function (e) {
        e.preventDefault();
        callApi('assignments', 'create', {
          userId: document.getElementById('input-a-user').value,
          satkerId: document.getElementById('input-a-satker').value,
          tahunAnggaranId: document.getElementById('input-a-tahun').value
        }).then(function () {
          showToast('Assignment dibuat.');
          renderAssignmentsView(content);
        }).catch(function (err) { showToast(err.message, true); });
      });
    }).catch(function (err) { renderError(content, err); });
  }

  // ===================== AUDIT LOG (ADMIN) =====================
  function renderAuditView(content) {
    callApi('audit', 'list', {}).then(function (logs) {
      var html = '<h2>Audit Log</h2><p>Menampilkan hingga 200 aktivitas terbaru.</p>' +
        '<table class="data-table"><thead><tr><th>Waktu</th><th>Aksi</th><th>Modul</th><th>Keterangan</th></tr></thead><tbody>';
      logs.forEach(function (l) {
        html += '<tr><td>' + escapeHtml(l.timestamp) + '</td><td>' + escapeHtml(l.action) + '</td>' +
          '<td>' + escapeHtml(l.module) + '</td><td>' + escapeHtml(l.description) + '</td></tr>';
      });
      html += '</tbody></table>';
      content.innerHTML = html;
    }).catch(function (err) { renderError(content, err); });
  }

  // ===================== GANTI PASSWORD (SEMUA ROLE) =====================
  function renderProfileView(content) {
    content.innerHTML =
      '<h2>Ganti Password</h2>' +
      '<form id="form-change-password" class="inline-form" style="max-width:320px;">' +
      '<label>Password Lama</label><br><input type="password" id="input-old-password" required style="width:100%;"><br><br>' +
      '<label>Password Baru (min. 8 karakter)</label><br><input type="password" id="input-new-password" required style="width:100%;"><br><br>' +
      '<div id="profile-error" class="error-text"></div>' +
      '<button type="submit">Simpan Password Baru</button>' +
      '</form>';

    document.getElementById('form-change-password').addEventListener('submit', function (e) {
      e.preventDefault();
      var errEl = document.getElementById('profile-error');
      errEl.textContent = '';
      callApi('auth', 'changePassword', {
        oldPassword: document.getElementById('input-old-password').value,
        newPassword: document.getElementById('input-new-password').value
      }).then(function () {
        showToast('Password berhasil diganti.');
        document.getElementById('form-change-password').reset();
      }).catch(function (err) { errEl.textContent = err.message; });
    });
  }

  checkExistingSession();
