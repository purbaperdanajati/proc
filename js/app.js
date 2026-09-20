/**
 * app.js
 * Shell aplikasi setelah login: routing hash sederhana, cache data per-menu
 * (supaya pindah menu tidak selalu reload -- ada tombol "Perbarui Data" di
 * tiap halaman untuk memaksa ambil data terbaru), dan seluruh view Tahap 1-3.
 */

var currentUser = null;
var METODE_PENGADAAN_OPTIONS = ['Penunjukan Langsung', 'E-Purchasing', 'Tender', 'Tender Cepat', 'Pengadaan Langsung', 'Swakelola', 'Lainnya'];
var VALID_BENTUK_USAHA_OPTIONS = ['PT', 'CV', 'Firma', 'Koperasi', 'Perorangan', 'UD', 'Lainnya'];

// ===================== HELPER BERSAMA: TAHUN ANGGARAN, STATUS, PROGRES =====================
var selectedTahunAnggaranId = null;

function ensureYearsLoaded(forceRefresh) {
  return callApiCached('years', 'years', 'list', {}, forceRefresh).then(function (years) {
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

// BARU: dropdown "Pilih dari daftar pejabat" -- ditempatkan lewat markup
// pejabatPickerHtml(namaFieldId, nipFieldId) di form manapun yang punya field
// nama+NIP KPA/PPK/Pejabat Pengadaan (SATKER_TAHUN & Edit Paket), lalu
// attachPejabatPickers(content) memuat daftar PEJABAT AKTIF sekali dan mengisi
// otomatis field nama+NIP saat salah satu dipilih -- user tidak perlu ketik
// ulang orang yang sama berkali-kali. Field nama/NIP tetap bisa diedit manual
// sesudahnya (dropdown cuma kemudahan pengisian awal, bukan referensi terkunci).
function pejabatPickerHtml(namaFieldId, nipFieldId) {
  return '<select class="pejabat-picker" data-target-nama="' + namaFieldId + '" data-target-nip="' + nipFieldId + '" style="width:100%;margin-bottom:4px;">' +
    '<option value="">-- pilih dari daftar pejabat (opsional) --</option></select>';
}
function attachPejabatPickers(content) {
  var pickers = content.querySelectorAll('.pejabat-picker');
  if (pickers.length === 0) return;
  callApiCached('pejabat', 'pejabat', 'list', { status: 'AKTIF' }, false).then(function (list) {
    var options = '<option value="">-- pilih dari daftar pejabat (opsional) --</option>' +
      list.map(function (p) {
        return '<option value="' + escapeHtml(p.pejabat_id) + '" data-nama="' + escapeHtml(p.nama) + '" data-nip="' + escapeHtml(p.nip || '') + '">' +
          escapeHtml(p.nama) + (p.jabatan ? ' (' + escapeHtml(p.jabatan) + ')' : '') + '</option>';
      }).join('');
    pickers.forEach(function (sel) {
      sel.innerHTML = options;
      sel.addEventListener('change', function () {
        var opt = sel.options[sel.selectedIndex];
        var namaEl = document.getElementById(sel.getAttribute('data-target-nama'));
        var nipEl = document.getElementById(sel.getAttribute('data-target-nip'));
        if (namaEl) { namaEl.value = opt.getAttribute('data-nama') || ''; namaEl.dispatchEvent(new Event('input')); }
        if (nipEl) { nipEl.value = opt.getAttribute('data-nip') || ''; nipEl.dispatchEvent(new Event('input')); }
      });
    });
  }).catch(function (err) { appWarn('attachPejabatPickers: gagal memuat daftar pejabat ->', err); });
}

// BARU (Tahap 3): tombol "Perbarui Data" dipasang di semua halaman -- klik
// untuk memaksa ambil data terbaru dari server, lewati cache.
function refreshButtonHtml() {
  return '<button type="button" class="btn-secondary btn-refresh-data" title="Ambil data terbaru dari server">&#8635; Perbarui Data</button>';
}
function attachRefreshButtonHandler(content, renderFn) {
  var btn = content.querySelector('.btn-refresh-data');
  if (btn) btn.addEventListener('click', function () {
    setButtonBusy(btn, 'Memuat...');
    renderFn(content, true);
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
  if (persentase === null || persentase === undefined || persentase === '') {
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

// BARU (Tahap 3): field password dengan tombol mask/unmask, dipakai di Ganti
// Password dan Reset Password (admin) supaya konsisten.
function passwordFieldHtml(id, label) {
  return '<label>' + escapeHtml(label) + '</label><br>' +
    '<div class="pw-wrap"><input type="password" id="' + id + '" required style="width:100%;">' +
    '<button type="button" class="btn-toggle-pw" data-target="' + id + '" aria-label="Tampilkan/sembunyikan password">&#128065;</button>' +
    '</div><br><br>';
}
function attachPasswordToggles(root) {
  root.querySelectorAll('.btn-toggle-pw').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var input = document.getElementById(btn.getAttribute('data-target'));
      input.type = input.type === 'password' ? 'text' : 'password';
    });
  });
}

function paketStatusLabel(status) {
  switch (status) {
    case 'DRAFT': return 'Draft';
    case 'DATA_LENGKAP': return 'Data Lengkap';
    case 'DIBATALKAN': return 'Dibatalkan';
    case 'COMPLETE': return 'Complete';
    default: return status || '-';
  }
}
function paketStatusBadgeClass(status) {
  switch (status) {
    case 'COMPLETE': return 'badge-complete';
    case 'DATA_LENGKAP': return 'badge-berjalan';
    case 'DIBATALKAN': return 'badge-netral';
    default: return 'badge-belum';
  }
}
function paketStatusBadge(status) {
  return '<span class="badge ' + paketStatusBadgeClass(status) + '">' + paketStatusLabel(status) + '</span>';
}

// ===================== APP SHELL =====================
function startApp(user) {
  currentUser = user;
  appLog('startApp: aplikasi dimulai untuk ->', user.nama, '(' + user.role + ')');
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
  setupGlobalSearch();
  renderRoute();
  prefetchCommonData();
}

// BARU: ambil data menu-menu yang paling sering dibuka SEKALI di depan (segera
// setelah login/refresh), supaya berpindah tab menu berikutnya tidak perlu
// nunggu get data lagi -- data yang sudah di-cache langsung dipakai. "Perbarui
// Data" di tiap halaman tetap tersedia untuk memaksa ambil ulang dari server.
// Dijalankan setelah renderRoute() supaya menu yang sedang dibuka user tidak
// harus antre di belakang prefetch ini.
function prefetchCommonData() {
  ensureYearsLoaded(false).then(function (yearInfo) {
    var y = yearInfo.selectedId;
    if (!y) return;
    var action = currentUser.role === 'ADMIN' ? 'getGlobal' : 'getMine';
    callApiCached('dashboard:' + action + ':' + y, 'dashboard', action, { tahunAnggaranId: y }, false);
    callApiCached('satkers:' + y, 'satkers', 'list', { tahunAnggaranId: y }, false);
    callApiCached('satkers:none', 'satkers', 'list', {}, false);
    callApiCached('jenisPengadaan', 'jenisPengadaan', 'list', {}, false);
    callApiCached('providers', 'providers', 'list', {}, false);
    callApiCached('pagu:' + y, 'pagu', 'list', { tahunAnggaranId: y }, false);
    callApiCached('paket:' + y, 'paket', 'list', { tahunAnggaranId: y }, false);
  }).catch(function (err) {
    appWarn('prefetchCommonData: gagal (tidak fatal -- tiap menu tetap fetch sendiri kalau belum ke-cache):', err);
  });
}

function renderRoute() {
  var hash = location.hash || '#/dashboard';
  var parts = hash.replace('#/', '').split('/');
  var viewName = parts[0] || 'dashboard';
  appLog('renderRoute: navigasi ->', viewName, parts[1] || '');

  document.querySelectorAll('.sidebar nav a').forEach(function (a) {
    a.classList.toggle('active', a.getAttribute('data-view') === viewName);
  });

  var content = document.getElementById('content-area');
  // Setiap navigasi (klik menu, ganti hash) menaikkan "generasi" route ini.
  // render*View menyimpan generasi saat itu di variabel __gen; kalau hasil
  // fetch-nya baru selesai SETELAH user sudah pindah ke menu lain (generasi
  // sudah naik lagi), penulisan ke content.innerHTML dibatalkan -- ini yang
  // mencegah konten menu lama "menimpa" menu baru saat klik cepat berpindah menu.
  content.dataset.gen = String((Number(content.dataset.gen) || 0) + 1);
  content.innerHTML = '<p>Memuat...</p>';

  switch (viewName) {
    case 'satker':
      if (parts[1]) return renderSatkerDetailView(content, parts[1]);
      return renderSatkerView(content);
    case 'pagu': return renderPaguView(content);
    case 'penyedia':
      if (parts[1]) return renderPenyediaDetailView(content, parts[1]);
      return renderPenyediaView(content);
    case 'paket':
      if (parts[1]) return renderPaketDetailView(content, parts[1]);
      return renderPaketListView(content);
    case 'laporan': return renderLaporanView(content);
    case 'years': return renderYearsView(content);
    case 'pejabat': return renderPejabatView(content);
    case 'assignments': return renderAssignmentsView(content);
    case 'users': return renderUsersView(content);
    case 'audit': return renderAuditView(content);
    case 'profile': return renderProfileView(content);
    default: return renderDashboardView(content);
  }
}

// BARU: retryFn opsional -- kalau diisi, tombol "Coba Lagi" ditampilkan supaya
// error (termasuk "Respons server tidak dapat dibaca") tidak membuat user
// mentok tanpa bisa berbuat apa-apa selain refresh browser penuh.
function renderError(content, err, retryFn) {
  appError('renderError:', err);
  content.innerHTML = '<p class="error-text">' + escapeHtml(err.message || 'Terjadi kesalahan.') + '</p>' +
    (retryFn ? '<button type="button" class="btn-secondary" id="btn-error-retry">&#8635; Coba Lagi</button>' : '');
  var retryBtn = document.getElementById('btn-error-retry');
  if (retryBtn) retryBtn.addEventListener('click', function () {
    setButtonBusy(retryBtn, 'Memuat...');
    retryFn();
  });
}

// ===================== DASHBOARD =====================
function renderDashboardView(content, forceRefresh) {
  var __gen = content.dataset.gen;
  ensureYearsLoaded(forceRefresh).then(function (yearInfo) {
    if (yearInfo.years.length === 0) {
      if (content.dataset.gen !== __gen) return;
      content.innerHTML = '<h2>Dashboard</h2><p>Belum ada Tahun Anggaran. Buat dulu lewat menu <a href="#/years">Tahun Anggaran</a>.</p>';
      return;
    }
    var action = currentUser.role === 'ADMIN' ? 'getGlobal' : 'getMine';
    var cacheKey = 'dashboard:' + action + ':' + yearInfo.selectedId;
    callApiCached(cacheKey, 'dashboard', action, { tahunAnggaranId: yearInfo.selectedId }, forceRefresh).then(function (data) {
      if (content.dataset.gen !== __gen) return;
      content.innerHTML = buildDashboardHtml(data, yearInfo);
      attachYearSelectorHandler(content, renderDashboardView);
      attachRefreshButtonHandler(content, renderDashboardView);
      attachSatkerLinkHandlers(content);
    }).catch(function (err) { if (content.dataset.gen === __gen) renderError(content, err, function () { renderDashboardView(content, true); }); });
  }).catch(function (err) { if (content.dataset.gen === __gen) renderError(content, err, function () { renderDashboardView(content, true); }); });
}

function buildDashboardHtml(data, yearInfo) {
  var yearSelectorHtml = renderYearSelectorHtml(yearInfo.years, yearInfo.selectedId);

  if (!data.tahunAnggaranId) {
    return '<h2>Dashboard</h2><p>' + escapeHtml(data.message) + '</p>';
  }

  if (currentUser.role === 'ADMIN') {
    return '<h2>Dashboard</h2>' +
      '<p>Tahun Anggaran: ' + yearSelectorHtml + ' ' + refreshButtonHtml() + '</p>' +
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
      '<h3>Daftar Satker</h3>' +
      buildSatkerListHtml(data.satkerList);
  }

  return '<h2>Dashboard</h2>' +
    '<p>Tahun Anggaran: ' + yearSelectorHtml + ' ' + refreshButtonHtml() + '</p>' +
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

// ===================== SATKER =====================
function renderSatkerView(content, forceRefresh) {
  var __gen = content.dataset.gen;
  ensureYearsLoaded(forceRefresh).then(function (yearInfo) {
    var payload = yearInfo.selectedId ? { tahunAnggaranId: yearInfo.selectedId } : {};
    var cacheKey = 'satkers:' + (yearInfo.selectedId || 'none');
    callApiCached(cacheKey, 'satkers', 'list', payload, forceRefresh).then(function (satkers) {
      var yearSelectorHtml = renderYearSelectorHtml(yearInfo.years, yearInfo.selectedId);
      var html = '<h2>Satker</h2>';
      html += '<p>' + (yearSelectorHtml ? 'Tahun Anggaran: ' + yearSelectorHtml + ' ' : '') + refreshButtonHtml() + '</p>';

      if (currentUser.role === 'ADMIN') {
        html += '<form id="form-add-satker" class="inline-form">' +
          '<input id="input-kode" placeholder="Kode Satker" required>' +
          '<input id="input-nama" data-uppercase placeholder="Nama Satker" required>' +
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
      if (content.dataset.gen !== __gen) return;
      content.innerHTML = html;

      attachYearSelectorHandler(content, renderSatkerView);
      attachRefreshButtonHandler(content, renderSatkerView);
      attachSatkerLinkHandlers(content);

      var form = document.getElementById('form-add-satker');
      if (form) form.addEventListener('submit', function (e) {
        e.preventDefault();
        var btn = form.querySelector('button[type="submit"]');
        var restore = setButtonBusy(btn, 'Menyimpan...');
        callApi('satkers', 'create', {
          kodeSatker: document.getElementById('input-kode').value,
          namaSatker: document.getElementById('input-nama').value,
          jenisSatker: document.getElementById('input-jenis').value
        }).then(function () {
          showToast('Satker ditambahkan.');
          clearAllCache();
          renderSatkerView(content, true);
        }).catch(function (err) { showToast(err.message, true); restore(); });
      });
    }).catch(function (err) { if (content.dataset.gen === __gen) renderError(content, err, function () { renderSatkerView(content, true); }); });
  }).catch(function (err) { if (content.dataset.gen === __gen) renderError(content, err, function () { renderSatkerView(content, true); }); });
}

// ===================== DETAIL SATKER =====================
function renderSatkerDetailView(content, satkerId, forceRefresh) {
  var __gen = content.dataset.gen;
  ensureYearsLoaded(forceRefresh).then(function (yearInfo) {
    var payload = { satkerId: satkerId };
    if (yearInfo.selectedId) payload.tahunAnggaranId = yearInfo.selectedId;
    var cacheKey = 'satkerDetail:' + satkerId + ':' + (yearInfo.selectedId || 'none');

    callApiCached(cacheKey, 'satkers', 'detail', payload, forceRefresh).then(function (s) {
      var yearSelectorHtml = renderYearSelectorHtml(yearInfo.years, yearInfo.selectedId);
      var st = s.satkerTahun || {};

      var html = '<p><a href="#/satker">&larr; Kembali ke Daftar Satker</a></p>' +
        '<h2>' + escapeHtml(s.nama_satker) + '</h2>';
      html += '<p>' + (yearSelectorHtml ? 'Tahun Anggaran: ' + yearSelectorHtml + ' ' : '') + refreshButtonHtml() + '</p>';
      if (yearInfo.selectedId) {
        html += '<p>Status: <span class="badge ' + statusBadgeClass(s.status_tahun_ini) + '">' + statusLabel(s.status_tahun_ini) + '</span> ' + progressBarHtml(s.persentase_kelengkapan) + '</p>';
      }

      html += '<table class="data-table"><tbody>' +
        '<tr><th>Kode Satker</th><td>' + escapeHtml(s.kode_satker) + '</td></tr>' +
        '<tr><th>Jenis</th><td>' + escapeHtml(s.jenis_satker) + '</td></tr>' +
        '<tr><th>Wilayah</th><td>' + escapeHtml(s.wilayah || '-') + '</td></tr>' +
        '<tr><th>Alamat</th><td>' + escapeHtml(s.alamat || '-') + (s.kodepos ? ' ' + escapeHtml(s.kodepos) : '') + '</td></tr>' +
        '<tr><th>Website</th><td>' + escapeHtml(s.website || '-') + '</td></tr>' +
        '<tr><th>Email</th><td>' + escapeHtml(s.email || '-') + '</td></tr>' +
        '<tr><th>Telepon</th><td>' + escapeHtml(s.telepon || '-') + '</td></tr>' +
        '<tr><th>SP DIPA</th><td>' + escapeHtml(st.sp_dipa || '-') + '</td></tr>' +
        '<tr><th>Tanggal DIPA</th><td>' + escapeHtml(st.tanggal_dipa || '-') + '</td></tr>' +
        '<tr><th>KPA</th><td>' + escapeHtml(st.kpa_nama || '-') + (st.kpa_nip ? ' (NIP. ' + escapeHtml(st.kpa_nip) + ')' : '') + '</td></tr>' +
        '<tr><th>PPK</th><td>' + escapeHtml(st.ppk_nama || '-') + (st.ppk_nip ? ' (NIP. ' + escapeHtml(st.ppk_nip) + ')' : '') + '</td></tr>' +
        '<tr><th>Pejabat Pengadaan</th><td>' + escapeHtml(st.pejabat_pengadaan_nama || '-') + (st.pejabat_pengadaan_nip ? ' (NIP. ' + escapeHtml(st.pejabat_pengadaan_nip) + ')' : '') + '</td></tr>' +
        '</tbody></table>' +
        '<p class="hint-text">Lihat rincian pagu &amp; paket satker ini lewat menu <a href="#/pagu">Pagu</a> dan <a href="#/paket">Paket</a>.</p>';

      if (currentUser.role === 'ADMIN') {
        // BARU: sebelumnya alamat/website/email/telepon/kodepos hanya bisa dilihat,
        // tidak ada form untuk mengisinya -- padahal ini dipakai untuk kop surat
        // KAK/HPS/SK/BAST/Monev. Ditambahkan di sini.
        html += '<h3>Edit Profil Satker</h3>' +
          '<form id="form-edit-satker" class="inline-form" style="max-width:420px;">' +
          '<label>Nama Satker</label><br><input id="es-nama" data-uppercase value="' + escapeHtml(s.nama_satker) + '" style="width:100%;" required><br><br>' +
          '<label>Wilayah</label><br><input id="es-wilayah" value="' + escapeHtml(s.wilayah || '') + '" style="width:100%;"><br><br>' +
          '<label>Alamat</label><br><input id="es-alamat" value="' + escapeHtml(s.alamat || '') + '" style="width:100%;"><br><br>' +
          '<label>Kode Pos</label><br><input id="es-kodepos" data-nip maxlength="5" inputmode="numeric" value="' + escapeHtml(s.kodepos || '') + '" style="width:100%;"><br><br>' +
          '<label>Telepon</label><br><input id="es-telepon" placeholder="0234-..." value="' + escapeHtml(s.telepon || '') + '" style="width:100%;"><br><br>' +
          '<label>Email</label><br><input type="email" id="es-email" value="' + escapeHtml(s.email || '') + '" style="width:100%;"><br><br>' +
          '<label>Website</label><br><input id="es-website" value="' + escapeHtml(s.website || '') + '" style="width:100%;"><br><br>' +
          '<button type="submit">Simpan Profil Satker</button></form>';
      }

      if (currentUser.role === 'ADMIN' && yearInfo.selectedId) {
        html += '<h3>Konfigurasi Tahun Ini</h3>' +
          '<form id="form-satker-tahun" class="inline-form" style="max-width:420px;">' +
          '<label>SP DIPA</label><br><input id="st-spdipa" value="' + escapeHtml(st.sp_dipa || '') + '" style="width:100%;"><br><br>' +
          '<label>Tanggal DIPA</label><br><input type="date" id="st-tgldipa" value="' + escapeHtml(st.tanggal_dipa || '') + '"><br><br>' +
          pejabatPickerHtml('st-kpanama', 'st-kpanip') +
          '<label>KPA (Nama)</label><br><input id="st-kpanama" data-uppercase value="' + escapeHtml(st.kpa_nama || '') + '" style="width:100%;"><br>' +
          '<label>KPA (NIP)</label><br><input id="st-kpanip" data-nip inputmode="numeric" maxlength="18" value="' + escapeHtml(st.kpa_nip || '') + '" style="width:100%;"><br><br>' +
          pejabatPickerHtml('st-ppknama', 'st-ppknip') +
          '<label>PPK (Nama)</label><br><input id="st-ppknama" data-uppercase value="' + escapeHtml(st.ppk_nama || '') + '" style="width:100%;"><br>' +
          '<label>PPK (NIP)</label><br><input id="st-ppknip" data-nip inputmode="numeric" maxlength="18" value="' + escapeHtml(st.ppk_nip || '') + '" style="width:100%;"><br><br>' +
          pejabatPickerHtml('st-ppnama', 'st-ppnip') +
          '<label>Pejabat Pengadaan (Nama)</label><br><input id="st-ppnama" data-uppercase value="' + escapeHtml(st.pejabat_pengadaan_nama || '') + '" style="width:100%;"><br>' +
          '<label>Pejabat Pengadaan (NIP)</label><br><input id="st-ppnip" data-nip inputmode="numeric" maxlength="18" value="' + escapeHtml(st.pejabat_pengadaan_nip || '') + '" style="width:100%;"><br><br>' +
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

      if (yearInfo.selectedId) {
        html += '<h3>SK PPK &amp; SK Pejabat Pengadaan</h3>' +
          '<p class="hint-text">Ditandatangani KPA, berlaku untuk SEMUA paket satker ini pada tahun anggaran terpilih -- setelah di-generate, otomatis melengkapi checklist dokumen SK PPK/SK Pejabat Pengadaan di setiap paket, tidak perlu upload manual satu-satu.</p>' +
          '<div id="sk-area"><p class="hint-text">Memuat...</p></div>';
      }

      if (content.dataset.gen !== __gen) return;
      content.innerHTML = html;
      attachYearSelectorHandler(content, function (c) { renderSatkerDetailView(c, satkerId); });
      attachRefreshButtonHandler(content, function (c) { renderSatkerDetailView(c, satkerId, true); });
      attachPejabatPickers(content);
      if (yearInfo.selectedId) renderSkSection(satkerId, yearInfo.selectedId, currentUser.role !== 'VIEWER', forceRefresh, content);

      var formProfil = document.getElementById('form-edit-satker');
      if (formProfil) formProfil.addEventListener('submit', function (e) {
        e.preventDefault();
        var btn = formProfil.querySelector('button[type="submit"]');
        var restore = setButtonBusy(btn, 'Menyimpan...');
        callApi('satkers', 'update', {
          satkerId: satkerId,
          namaSatker: document.getElementById('es-nama').value,
          wilayah: document.getElementById('es-wilayah').value,
          alamat: document.getElementById('es-alamat').value,
          kodepos: document.getElementById('es-kodepos').value,
          telepon: document.getElementById('es-telepon').value,
          email: document.getElementById('es-email').value,
          website: document.getElementById('es-website').value
        }).then(function () {
          showToast('Profil satker disimpan.');
          clearAllCache();
          renderSatkerDetailView(content, satkerId, true);
        }).catch(function (err) { showToast(err.message, true); restore(); });
      });

      var form = document.getElementById('form-satker-tahun');
      if (form) form.addEventListener('submit', function (e) {
        e.preventDefault();
        var btn = form.querySelector('button[type="submit"]');
        var restore = setButtonBusy(btn, 'Menyimpan...');
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
          clearAllCache();
          renderSatkerDetailView(content, satkerId, true);
        }).catch(function (err) { showToast(err.message, true); restore(); });
      });
    }).catch(function (err) { if (content.dataset.gen === __gen) renderError(content, err, function () { renderSatkerDetailView(content, satkerId, true); }); });
  }).catch(function (err) { if (content.dataset.gen === __gen) renderError(content, err, function () { renderSatkerDetailView(content, satkerId, true); }); });
}

// ===================== PAGU & JENIS PENGADAAN (Tahap 3) =====================
// ===================== SK PPK & SK PEJABAT PENGADAAN =====================
function renderSkSection(satkerId, tahunAnggaranId, bisaEdit, forceRefresh, content) {
  var area = document.getElementById('sk-area');
  if (!area) return;

  Promise.all([
    callApiCached('skHistory:PPK:' + satkerId + ':' + tahunAnggaranId, 'sk', 'history', { satkerId: satkerId, tahunAnggaranId: tahunAnggaranId, jenis: 'SK-PPK' }, forceRefresh),
    callApiCached('skHistory:PP:' + satkerId + ':' + tahunAnggaranId, 'sk', 'history', { satkerId: satkerId, tahunAnggaranId: tahunAnggaranId, jenis: 'SK-PP' }, forceRefresh)
  ]).then(function (results) {
    var html = skBlokHtml_('PPK', 'SK-PPK', 'SK PPK', results[0], bisaEdit) +
      skBlokHtml_('PP', 'SK-PP', 'SK Pejabat Pengadaan', results[1], bisaEdit);
    area.innerHTML = html;
    wireSkBlok_('PPK', 'SK-PPK', satkerId, tahunAnggaranId, content);
    wireSkBlok_('PP', 'SK-PP', satkerId, tahunAnggaranId, content);
  }).catch(function (err) {
    appError('renderSkSection:', err);
    area.innerHTML = '<p class="error-text">' + escapeHtml(err.message || 'Gagal memuat data SK.') + '</p>';
  });
}

function skBlokHtml_(suf, jenis, label, history, bisaEdit) {
  var html = '<h4>' + escapeHtml(label) + '</h4><p>';
  if (history.length > 0) {
    html += 'Versi terakhir: v' + escapeHtml(history[0].version) + ' (' + escapeHtml(formatTanggalSingkat(history[0].generated_at)) + '), nomor ' + escapeHtml(history[0].nomor_surat || '-') + '. ';
  } else {
    html += '<span class="hint-text">Belum pernah di-generate. </span>';
  }
  html += '</p>';
  if (bisaEdit) {
    html += '<label>Nomor SK</label><br><input id="sk-' + suf + '-nomor" placeholder="mis. 0079" style="width:100%;max-width:220px;"><br><br>' +
      '<label>Tahun SK</label><br><input id="sk-' + suf + '-tahun" placeholder="' + new Date().getFullYear() + '" style="width:100%;max-width:120px;"><br><br>';
  }
  html += '<p><button type="button" id="btn-sk-' + suf + '-preview" class="btn-secondary">Lihat Pratinjau</button> ';
  if (bisaEdit) html += '<button type="button" id="btn-sk-' + suf + '-finalize" class="btn-secondary">Generate &amp; Simpan PDF</button>';
  html += '</p>';
  if (history.length > 0) {
    html += '<table class="data-table"><thead><tr><th>Versi</th><th>Dibuat</th><th>Nomor</th><th>Catatan</th><th></th></tr></thead><tbody>';
    history.forEach(function (h) {
      html += '<tr><td>v' + escapeHtml(h.version) + '</td><td>' + escapeHtml(formatTanggalSingkat(h.generated_at)) + '</td>' +
        '<td>' + escapeHtml(h.nomor_surat || '-') + '</td><td>' + escapeHtml(h.change_note || '-') + '</td>' +
        '<td><a href="#" data-sk-download="' + escapeHtml(h.generated_document_id) + '">Unduh PDF</a></td></tr>';
    });
    html += '</tbody></table>';
  }
  html += '<div id="sk-' + suf + '-preview-box" style="display:none;"></div><br>';
  return html;
}

function wireSkBlok_(suf, jenis, satkerId, tahunAnggaranId, content) {
  var area = document.getElementById('sk-area');
  function payload_() {
    return {
      satkerId: satkerId, tahunAnggaranId: tahunAnggaranId, jenis: jenis,
      nomorSurat: (document.getElementById('sk-' + suf + '-nomor') || {}).value || '',
      tahunSk: (document.getElementById('sk-' + suf + '-tahun') || {}).value || ''
    };
  }
  var previewBtn = document.getElementById('btn-sk-' + suf + '-preview');
  if (previewBtn) previewBtn.addEventListener('click', function () {
    var box = document.getElementById('sk-' + suf + '-preview-box');
    box.style.display = '';
    box.innerHTML = '<p class="hint-text">Memuat pratinjau...</p>';
    callApi('sk', 'preview', payload_(), { retryable: true }).then(function (fresh) {
      box.innerHTML = '<p class="hint-text">Pratinjau di bawah bisa langsung dicetak lewat browser (Ctrl+P) kalau tidak ingin membuat PDF versi baru.</p>' +
        '<iframe id="sk-' + suf + '-frame" sandbox="" style="width:100%;height:650px;border:1px solid #E1E6E3;border-radius:8px;background:#fff;"></iframe>';
      document.getElementById('sk-' + suf + '-frame').srcdoc = fresh.html;
    }).catch(function (err) { box.innerHTML = '<p class="error-text">' + escapeHtml(err.message) + '</p>'; });
  });
  var finalizeBtn = document.getElementById('btn-sk-' + suf + '-finalize');
  if (finalizeBtn) finalizeBtn.addEventListener('click', function () {
    var p = payload_();
    if (!p.nomorSurat) { showToast('Nomor SK wajib diisi.', true); return; }
    if (!confirm('Generate ' + jenis + ' versi baru? Ini akan otomatis melengkapi checklist di SEMUA paket aktif satker ini pada tahun terpilih. Versi lama tetap tersimpan.')) return;
    var catatan = prompt('Catatan perubahan (opsional):', '') || '';
    var restore = setButtonBusy(finalizeBtn, 'Membuat PDF...');
    p.changeNote = catatan;
    callApi('sk', 'finalize', p).then(function (res) {
      showToast(jenis + ' v' + res.version + ' berhasil dibuat (' + res.jumlahPaketTerdampak + ' paket ikut ter-update).');
      clearAllCache();
      renderSatkerDetailView(content, satkerId, true);
    }).catch(function (err) { showToast(err.message, true); restore(); });
  });
  area.querySelectorAll('[data-sk-download]').forEach(function (el) {
    el.addEventListener('click', function (e) {
      e.preventDefault();
      callApi('sk', 'download', { generatedDocumentId: el.getAttribute('data-sk-download') }).then(function (file) {
        var link = document.createElement('a');
        link.href = 'data:' + file.mimeType + ';base64,' + file.fileBase64;
        link.download = file.fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }).catch(function (err) { showToast(err.message, true); });
    });
  });
}

function renderPaguView(content, forceRefresh) {
  var __gen = content.dataset.gen;
  ensureYearsLoaded(forceRefresh).then(function (yearInfo) {
    if (yearInfo.years.length === 0) {
      if (content.dataset.gen !== __gen) return;
      content.innerHTML = '<h2>Pagu</h2><p>Belum ada Tahun Anggaran. Buat dulu lewat menu <a href="#/years">Tahun Anggaran</a>.</p>';
      return;
    }
    Promise.all([
      callApiCached('jenisPengadaan', 'jenisPengadaan', 'list', {}, forceRefresh),
      callApiCached('pagu:' + yearInfo.selectedId, 'pagu', 'list', { tahunAnggaranId: yearInfo.selectedId }, forceRefresh),
      callApiCached('satkers:none', 'satkers', 'list', {}, forceRefresh)
    ]).then(function (results) {
      var jenisList = results[0], paguList = results[1], satkerList = results[2];
      var yearSelectorHtml = renderYearSelectorHtml(yearInfo.years, yearInfo.selectedId);

      var html = '<h2>Pagu &amp; Jenis Pengadaan</h2>' +
        '<p>Tahun Anggaran: ' + yearSelectorHtml + ' ' + refreshButtonHtml() + '</p>';

      html += '<h3>Jenis Pengadaan</h3>';
      if (currentUser.role === 'ADMIN') {
        html += '<form id="form-add-jenis" class="inline-form">' +
          '<input id="input-jp-kode" placeholder="Kode (mis. PERALATAN-MESIN)" required>' +
          '<input id="input-jp-nama" data-uppercase placeholder="Nama Jenis Pengadaan" required>' +
          '<button type="submit">Tambah</button></form>';
      }
      html += '<table class="data-table"><thead><tr><th>Kode</th><th>Nama</th><th>Status</th></tr></thead><tbody>';
      jenisList.forEach(function (jp) {
        html += '<tr><td>' + escapeHtml(jp.kode) + '</td><td>' + escapeHtml(jp.nama_jenis) + '</td><td><span class="badge">' + escapeHtml(jp.status) + '</span></td></tr>';
      });
      html += '</tbody></table>';

      html += '<h3>Pagu</h3>';
      if (currentUser.role === 'ADMIN') {
        html += '<form id="form-add-pagu" class="inline-form">' +
          '<select id="input-pg-satker">' + satkerList.map(function (s) { return '<option value="' + escapeHtml(s.satker_id) + '">' + escapeHtml(s.nama_satker) + '</option>'; }).join('') + '</select> ' +
          '<select id="input-pg-jenis">' + jenisList.map(function (j) { return '<option value="' + escapeHtml(j.jenis_pengadaan_id) + '">' + escapeHtml(j.nama_jenis) + '</option>'; }).join('') + '</select><br>' +
          '<input id="input-pg-sumberdana" placeholder="Sumber Dana (mis. DIPA/BOS)"> ' +
          '<input id="input-pg-kodeanggaran" placeholder="Kode Anggaran"> ' +
          '<input id="input-pg-nominal" type="text" inputmode="numeric" data-rupiah placeholder="Nominal Pagu (Rp)" required> ' +
          '<button type="submit">Tambah Pagu</button></form>';
      }
      html += '<table class="data-table"><thead><tr><th>Satker</th><th>Jenis Pengadaan</th><th>Pagu</th><th>Terpakai</th><th>Sisa</th><th>Jml Paket</th></tr></thead><tbody>';
      if (paguList.length === 0) html += '<tr><td colspan="6">Belum ada pagu untuk tahun ini.</td></tr>';
      paguList.forEach(function (p) {
        var satker = satkerList.filter(function (s) { return s.satker_id === p.satker_id; })[0];
        var jenis = jenisList.filter(function (j) { return j.jenis_pengadaan_id === p.jenis_pengadaan_id; })[0];
        html += '<tr><td>' + escapeHtml(satker ? satker.nama_satker : p.satker_id) + '</td>' +
          '<td>' + escapeHtml(jenis ? jenis.nama_jenis : p.jenis_pengadaan_id) + '</td>' +
          '<td>' + formatRupiah(p.pagu) + '</td>' +
          '<td>' + formatRupiah(p.terpakai) + '</td>' +
          '<td>' + formatRupiah(p.sisa) + '</td>' +
          '<td>' + escapeHtml(p.jumlah_paket) + '</td></tr>';
      });
      html += '</tbody></table>';

      if (content.dataset.gen !== __gen) return;
      content.innerHTML = html;
      attachYearSelectorHandler(content, renderPaguView);
      attachRefreshButtonHandler(content, renderPaguView);

      var formJenis = document.getElementById('form-add-jenis');
      if (formJenis) formJenis.addEventListener('submit', function (e) {
        e.preventDefault();
        var btn = formJenis.querySelector('button[type="submit"]');
        var restore = setButtonBusy(btn, 'Menyimpan...');
        callApi('jenisPengadaan', 'create', {
          kode: document.getElementById('input-jp-kode').value,
          namaJenis: document.getElementById('input-jp-nama').value
        }).then(function () {
          showToast('Jenis pengadaan ditambahkan.');
          clearAllCache();
          renderPaguView(content, true);
        }).catch(function (err) { showToast(err.message, true); restore(); });
      });

      var formPagu = document.getElementById('form-add-pagu');
      if (formPagu) formPagu.addEventListener('submit', function (e) {
        e.preventDefault();
        var btn = formPagu.querySelector('button[type="submit"]');
        var restore = setButtonBusy(btn, 'Menyimpan...');
        callApi('pagu', 'create', {
          tahunAnggaranId: yearInfo.selectedId,
          satkerId: document.getElementById('input-pg-satker').value,
          jenisPengadaanId: document.getElementById('input-pg-jenis').value,
          sumberDana: document.getElementById('input-pg-sumberdana').value,
          kodeAnggaran: document.getElementById('input-pg-kodeanggaran').value,
          pagu: parseRupiahFieldValue('input-pg-nominal')
        }).then(function () {
          showToast('Pagu ditambahkan.');
          clearAllCache();
          renderPaguView(content, true);
        }).catch(function (err) { showToast(err.message, true); restore(); });
      });
    }).catch(function (err) { if (content.dataset.gen === __gen) renderError(content, err, function () { renderPaguView(content, true); }); });
  }).catch(function (err) { if (content.dataset.gen === __gen) renderError(content, err, function () { renderPaguView(content, true); }); });
}

// ===================== PAKET (Tahap 3) =====================
function renderPaketListView(content, forceRefresh) {
  var __gen = content.dataset.gen;
  ensureYearsLoaded(forceRefresh).then(function (yearInfo) {
    if (yearInfo.years.length === 0) {
      if (content.dataset.gen !== __gen) return;
      content.innerHTML = '<h2>Paket</h2><p>Belum ada Tahun Anggaran.</p>';
      return;
    }
    Promise.all([
      callApiCached('paket:' + yearInfo.selectedId, 'paket', 'list', { tahunAnggaranId: yearInfo.selectedId }, forceRefresh),
      callApiCached('satkers:none', 'satkers', 'list', {}, forceRefresh),
      callApiCached('pagu:' + yearInfo.selectedId, 'pagu', 'list', { tahunAnggaranId: yearInfo.selectedId }, forceRefresh),
      callApiCached('jenisPengadaan', 'jenisPengadaan', 'list', {}, forceRefresh),
      callApiCached('providers', 'providers', 'list', {}, forceRefresh)
    ]).then(function (results) {
      var paketList = results[0], satkerList = results[1], paguList = results[2], jenisList = results[3], providerList = results[4];
      var yearSelectorHtml = renderYearSelectorHtml(yearInfo.years, yearInfo.selectedId);

      var html = '<h2>Paket</h2>' +
        '<p>Tahun Anggaran: ' + yearSelectorHtml + ' ' + refreshButtonHtml() + '</p>';

      if (currentUser.role === 'ADMIN' || currentUser.role === 'PENGELOLA') {
        html += '<h3>Buat Paket Baru</h3>' +
          '<form id="form-add-paket" class="inline-form">' +
          '<select id="input-pkt-satker">' + satkerList.map(function (s) { return '<option value="' + escapeHtml(s.satker_id) + '">' + escapeHtml(s.nama_satker) + '</option>'; }).join('') + '</select> ' +
          '<select id="input-pkt-pagu"></select><br>' +
          '<input id="input-pkt-nama" data-uppercase placeholder="Nama Paket" required style="min-width:260px;"><br>' +
          '<select id="input-pkt-metode">' + METODE_PENGADAAN_OPTIONS.map(function (m) { return '<option>' + escapeHtml(m) + '</option>'; }).join('') + '</select> ' +
          '<input id="input-pkt-jeniskontrak" placeholder="Jenis Kontrak (mis. Harga Satuan)"><br>' +
          '<label>Mulai <input type="date" id="input-pkt-mulai"></label> ' +
          '<label>Selesai <input type="date" id="input-pkt-selesai"></label><br>' +
          '<label>Nilai HPS <input type="text" inputmode="numeric" data-rupiah id="input-pkt-hps"></label> ' +
          '<label>Nilai Kontrak <input type="text" inputmode="numeric" data-rupiah id="input-pkt-kontrak"></label><br>' +
          '<label><input type="checkbox" id="input-pkt-pph"> Ada PPh</label> ' +
          '<label><input type="checkbox" id="input-pkt-penyedia" checked> Perlu Penyedia</label><br>' +
          '<label>Penyedia <select id="input-pkt-penyedia-pilih"><option value="">(belum dipilih)</option>' +
            providerList.filter(function (p) { return p.status === 'AKTIF'; }).map(function (p) { return '<option value="' + escapeHtml(p.penyedia_id) + '">' + escapeHtml(p.nama_perusahaan) + '</option>'; }).join('') +
          '</select></label> ' +
          '<a href="#/penyedia" style="font-size:12px;">+ Tambah penyedia baru</a><br>' +
          '<button type="submit">Buat Paket</button>' +
          '</form>';
      }

      html += '<table class="data-table"><thead><tr><th>Satker</th><th>Nama Paket</th><th>Jenis</th><th>Penyedia</th><th>Pagu</th><th>Status</th></tr></thead><tbody>';
      if (paketList.length === 0) html += '<tr><td colspan="6">Belum ada paket.</td></tr>';
      paketList.forEach(function (p) {
        var satker = satkerList.filter(function (s) { return s.satker_id === p.satker_id; })[0];
        var jenis = jenisList.filter(function (j) { return j.jenis_pengadaan_id === p.jenis_pengadaan_id; })[0];
        var provider = providerList.filter(function (pv) { return pv.penyedia_id === p.penyedia_id; })[0];
        html += '<tr>' +
          '<td>' + escapeHtml(satker ? satker.nama_satker : p.satker_id) + '</td>' +
          '<td><a href="#" data-paket-link="' + escapeHtml(p.paket_id) + '">' + escapeHtml(p.nama_paket) + '</a></td>' +
          '<td>' + escapeHtml(jenis ? jenis.nama_jenis : '-') + '</td>' +
          '<td>' + escapeHtml(provider ? provider.nama_perusahaan : '-') + '</td>' +
          '<td>' + formatRupiah(p.pagu_snapshot) + '</td>' +
          '<td>' + paketStatusBadge(p.status_paket) + '</td>' +
          '</tr>';
      });
      html += '</tbody></table>';

      if (content.dataset.gen !== __gen) return;
      content.innerHTML = html;
      attachYearSelectorHandler(content, renderPaketListView);
      attachRefreshButtonHandler(content, renderPaketListView);
      content.querySelectorAll('[data-paket-link]').forEach(function (el) {
        el.addEventListener('click', function (e) {
          e.preventDefault();
          location.hash = '#/paket/' + el.getAttribute('data-paket-link');
        });
      });

      var satkerSelect = document.getElementById('input-pkt-satker');
      var paguSelect = document.getElementById('input-pkt-pagu');
      function refreshPaguOptions() {
        if (!satkerSelect || !paguSelect) return;
        var chosenSatker = satkerSelect.value;
        var options = paguList.filter(function (p) { return p.satker_id === chosenSatker; });
        if (options.length === 0) {
          paguSelect.innerHTML = '<option value="">(satker ini belum punya pagu)</option>';
          return;
        }
        paguSelect.innerHTML = options.map(function (p) {
          var jenis = jenisList.filter(function (j) { return j.jenis_pengadaan_id === p.jenis_pengadaan_id; })[0];
          var label = (jenis ? jenis.nama_jenis : p.jenis_pengadaan_id) + ' - Sisa ' + formatRupiah(p.sisa);
          return '<option value="' + escapeHtml(p.pagu_id) + '">' + escapeHtml(label) + '</option>';
        }).join('');
      }
      if (satkerSelect) {
        refreshPaguOptions();
        satkerSelect.addEventListener('change', refreshPaguOptions);
      }

      var form = document.getElementById('form-add-paket');
      if (form) form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!paguSelect.value) { showToast('Satker ini belum punya pagu -- buat pagu dulu di menu Pagu.', true); return; }
        var btn = form.querySelector('button[type="submit"]');
        var restore = setButtonBusy(btn, 'Membuat...');
        callApi('paket', 'create', {
          satkerId: satkerSelect.value,
          tahunAnggaranId: yearInfo.selectedId,
          paguId: paguSelect.value,
          namaPaket: document.getElementById('input-pkt-nama').value,
          metodePengadaan: document.getElementById('input-pkt-metode').value,
          jenisKontrak: document.getElementById('input-pkt-jeniskontrak').value,
          tanggalMulai: document.getElementById('input-pkt-mulai').value,
          tanggalSelesai: document.getElementById('input-pkt-selesai').value,
          nilaiHps: parseRupiahFieldValue('input-pkt-hps'),
          nilaiKontrak: parseRupiahFieldValue('input-pkt-kontrak'),
          adaPph: document.getElementById('input-pkt-pph').checked,
          memerlukanPenyedia: document.getElementById('input-pkt-penyedia').checked,
          penyediaId: document.getElementById('input-pkt-penyedia-pilih').value
        }).then(function (result) {
          showToast('Paket dibuat.' + (result.hpsMelebihiPagu ? ' Peringatan: nilai HPS melebihi pagu.' : ''), !!result.hpsMelebihiPagu);
          clearAllCache();
          renderPaketListView(content, true);
        }).catch(function (err) { showToast(err.message, true); restore(); });
      });
    }).catch(function (err) { if (content.dataset.gen === __gen) renderError(content, err, function () { renderPaketListView(content, true); }); });
  }).catch(function (err) { if (content.dataset.gen === __gen) renderError(content, err, function () { renderPaketListView(content, true); }); });
}

function renderPaketDetailView(content, paketId, forceRefresh) {
  var __gen = content.dataset.gen;
  Promise.all([
    callApiCached('paketDetail:' + paketId, 'paket', 'detail', { paketId: paketId }, forceRefresh),
    callApiCached('satkers:none', 'satkers', 'list', {}, forceRefresh),
    callApiCached('jenisPengadaan', 'jenisPengadaan', 'list', {}, forceRefresh),
    callApiCached('providers', 'providers', 'list', {}, forceRefresh),
    callApiCached('checklist:' + paketId, 'documents', 'getChecklist', { paketId: paketId }, forceRefresh)
  ]).then(function (results) {
    var p = results[0], satkerList = results[1], jenisList = results[2], providerList = results[3], checklist = results[4];
    var satker = satkerList.filter(function (s) { return s.satker_id === p.satker_id; })[0];
    var jenis = jenisList.filter(function (j) { return j.jenis_pengadaan_id === p.jenis_pengadaan_id; })[0];
    var provider = providerList.filter(function (pv) { return pv.penyedia_id === p.penyedia_id; })[0];
    var bisaEdit = (currentUser.role === 'ADMIN' || currentUser.role === 'PENGELOLA') && p.status_paket !== 'DIBATALKAN';

    var html = '<p><a href="#/paket">&larr; Kembali ke Daftar Paket</a></p>' +
      '<h2>' + escapeHtml(p.nama_paket) + '</h2>' +
      '<p>' + paketStatusBadge(p.status_paket) + (p.persentase_kelengkapan !== '' && p.persentase_kelengkapan !== undefined ? ' ' + progressBarHtml(p.persentase_kelengkapan) : '') + ' ' + refreshButtonHtml() + '</p>';

    if (Number(p.nilai_hps) > 0 && Number(p.nilai_hps) > Number(p.pagu_snapshot)) {
      html += '<p class="warning-banner">Peringatan administratif: nilai HPS melebihi pagu. Ini bukan keputusan hukum -- mohon dikonfirmasi ke PPK/Pejabat Pengadaan.</p>';
    }
    if (p.memerlukan_penyedia && !p.penyedia_id) {
      html += '<p class="warning-banner">Paket ini memerlukan penyedia tapi belum dipilih -- lengkapi lewat form edit di bawah.</p>';
    }

    html += '<table class="data-table"><tbody>' +
      '<tr><th>Satker</th><td>' + escapeHtml(satker ? satker.nama_satker : p.satker_id) + '</td></tr>' +
      '<tr><th>Jenis Pengadaan</th><td>' + escapeHtml(jenis ? jenis.nama_jenis : p.jenis_pengadaan_id) + '</td></tr>' +
      '<tr><th>Penyedia</th><td>' + (provider ? '<a href="#/penyedia/' + escapeHtml(provider.penyedia_id) + '">' + escapeHtml(provider.nama_perusahaan) + '</a>' : '<span class="hint-text">Belum dipilih</span>') + '</td></tr>' +
      '<tr><th>Pagu</th><td>' + formatRupiah(p.pagu_snapshot) + '</td></tr>' +
      '<tr><th>Nilai HPS</th><td>' + formatRupiah(p.nilai_hps) + '</td></tr>' +
      '<tr><th>Nilai Kontrak</th><td>' + formatRupiah(p.nilai_kontrak) + '</td></tr>' +
      '<tr><th>Metode Pengadaan</th><td>' + escapeHtml(p.metode_pengadaan || '-') + '</td></tr>' +
      '<tr><th>PPK</th><td>' + escapeHtml(p.ppk_nama || '-') + '</td></tr>' +
      '<tr><th>Pejabat Pengadaan</th><td>' + escapeHtml(p.pp_nama || '-') + '</td></tr>' +
      '<tr><th>KPA</th><td>' + escapeHtml(p.kpa_nama || '-') + '</td></tr>' +
      '</tbody></table>';

    html += '<h3>KAK (Kerangka Acuan Kerja)</h3>' +
      '<div id="kak-area"><p class="hint-text">Memuat data KAK...</p></div>' +
      '<h3>HPS (Harga Perkiraan Sendiri)</h3>' +
      '<div id="hps-area"><p class="hint-text">Memuat data HPS...</p></div>' +
      '<h3>BAST Manual</h3>' +
      '<div id="bast-area"><p class="hint-text">Memuat data BAST...</p></div>' +
      '<h3>Hasil Monev</h3>' +
      '<div id="monev-area"><p class="hint-text">Memuat data monev...</p></div>';

    var totalWajib = checklist.filter(function (c) { return c.wajibSekarang; }).length;
    var totalTerpenuhi = checklist.filter(function (c) { return c.wajibSekarang && c.terpenuhi; }).length;
    html += '<h3>Checklist Dokumen</h3>' +
      '<p>' + totalTerpenuhi + ' / ' + totalWajib + ' dokumen wajib lengkap' +
      (totalWajib > 0 ? ' (' + Math.round(totalTerpenuhi / totalWajib * 100) + '%)' : '') + '</p>' +
      '<table class="data-table"><thead><tr><th></th><th>Dokumen</th><th>File</th>' + (bisaEdit ? '<th>Unggah</th>' : '') + '</tr></thead><tbody>';
    // Jenis dokumen yang punya nomor surat manual dari satker (bug fix #8) --
    // KAK sudah punya field Nomor Surat sendiri di renderKakSection.
    var DOC_KODE_PUNYA_NOMOR_SURAT = ['SK-PPK', 'SK-PP', 'BAST-MANUAL', 'HASIL-MONEV'];

    checklist.forEach(function (item) {
      var icon = item.terpenuhi ? '<span class="badge badge-complete">&#10003;</span>' :
        (item.wajibSekarang ? '<span class="badge badge-belum">&#9675;</span>' : '<span class="badge badge-netral">-</span>');
      var namaBaris = escapeHtml(item.namaDokumen) + (item.wajib === 'KONDISIONAL' ? ' <span class="hint-text">(kondisional)</span>' : '');
      var punyaNomorSurat = DOC_KODE_PUNYA_NOMOR_SURAT.indexOf(item.kodeDokumen) !== -1;
      var fileInfo;
      if (item.kodeDokumen === 'COMPANY-PROFILE') {
        fileInfo = item.terpenuhi ? '<span class="hint-text">Diambil dari data Penyedia</span>' : '<span class="hint-text">Penyedia belum punya company profile</span>';
      } else if (item.documents.length > 0) {
        fileInfo = item.documents.map(function (d) {
          var baris = '<a href="#" data-download-doc="' + escapeHtml(d.document_id) + '">' + escapeHtml(d.file_name) + '</a> (v' + escapeHtml(d.version) + ')' +
            (bisaEdit ? ' <button type="button" class="btn-danger-text" data-delete-doc="' + escapeHtml(d.document_id) + '">Hapus</button>' : '');
          if (punyaNomorSurat) {
            baris += '<br><span class="hint-text">Nomor Surat: ' + escapeHtml(d.nomor_surat || '-') + '</span>' +
              (bisaEdit ? ' <button type="button" class="btn-danger-text" data-edit-nomor-surat="' + escapeHtml(d.document_id) + '" data-current-nomor="' + escapeHtml(d.nomor_surat || '') + '">Ubah</button>' : '');
          }
          return baris;
        }).join('<br>');
      } else {
        fileInfo = '<span class="hint-text">Belum ada</span>';
      }
      var uploadCell = '';
      if (bisaEdit && item.kodeDokumen !== 'COMPANY-PROFILE') {
        uploadCell = '<td><input type="file" class="doc-upload-input" data-requirement-id="' + escapeHtml(item.documentRequirementId) + '" style="max-width:160px;">' +
          (punyaNomorSurat ? '<br><input type="text" class="doc-nomor-surat-input" data-requirement-id="' + escapeHtml(item.documentRequirementId) + '" placeholder="Nomor Surat" style="max-width:160px;margin-top:4px;">' : '') +
          '</td>';
      } else if (bisaEdit) {
        uploadCell = '<td></td>';
      }
      html += '<tr><td>' + icon + '</td><td>' + namaBaris + '</td><td>' + fileInfo + '</td>' + uploadCell + '</tr>';
    });
    html += '</tbody></table>';

    if (bisaEdit) {
      html += '<h3>Edit Data Paket</h3>' +
        '<form id="form-edit-paket" class="inline-form" style="max-width:480px;">' +
        '<label>Nama Paket</label><br><input id="ep-nama" data-uppercase value="' + escapeHtml(p.nama_paket) + '" style="width:100%;" required><br><br>' +
        '<label>Metode Pengadaan</label><br><select id="ep-metode">' +
        METODE_PENGADAAN_OPTIONS.map(function (m) { return '<option' + (m === p.metode_pengadaan ? ' selected' : '') + '>' + escapeHtml(m) + '</option>'; }).join('') +
        '</select><br><br>' +
        '<label>Jenis Kontrak</label><br><input id="ep-jeniskontrak" value="' + escapeHtml(p.jenis_kontrak || '') + '" style="width:100%;"><br><br>' +
        '<label>Tanggal Mulai</label><br><input type="date" id="ep-mulai" value="' + escapeHtml(p.tanggal_mulai || '') + '"><br><br>' +
        '<label>Tanggal Selesai</label><br><input type="date" id="ep-selesai" value="' + escapeHtml(p.tanggal_selesai || '') + '"><br><br>' +
        '<label>Nilai HPS</label><br><input type="text" inputmode="numeric" data-rupiah id="ep-hps" value="' + escapeHtml(p.nilai_hps || 0) + '"><br><br>' +
        '<label>Nilai Kontrak</label><br><input type="text" inputmode="numeric" data-rupiah id="ep-kontrak" value="' + escapeHtml(p.nilai_kontrak || 0) + '"><br><br>' +
        '<p class="hint-text">PPK/Pejabat Pengadaan/KPA khusus untuk paket ini -- bisa berbeda dari paket lain di satker yang sama.</p>' +
        pejabatPickerHtml('ep-ppknama', 'ep-ppknip') +
        '<label>PPK (Nama)</label><br><input id="ep-ppknama" data-uppercase value="' + escapeHtml(p.ppk_nama || '') + '" style="width:100%;"><br>' +
        '<label>PPK (NIP)</label><br><input id="ep-ppknip" data-nip inputmode="numeric" maxlength="18" value="' + escapeHtml(p.ppk_nip || '') + '" style="width:100%;"><br><br>' +
        pejabatPickerHtml('ep-ppnama', 'ep-ppnip') +
        '<label>Pejabat Pengadaan (Nama)</label><br><input id="ep-ppnama" data-uppercase value="' + escapeHtml(p.pp_nama || '') + '" style="width:100%;"><br>' +
        '<label>Pejabat Pengadaan (NIP)</label><br><input id="ep-ppnip" data-nip inputmode="numeric" maxlength="18" value="' + escapeHtml(p.pp_nip || '') + '" style="width:100%;"><br><br>' +
        pejabatPickerHtml('ep-kpanama', 'ep-kpanip') +
        '<label>KPA (Nama)</label><br><input id="ep-kpanama" data-uppercase value="' + escapeHtml(p.kpa_nama || '') + '" style="width:100%;"><br>' +
        '<label>KPA (NIP)</label><br><input id="ep-kpanip" data-nip inputmode="numeric" maxlength="18" value="' + escapeHtml(p.kpa_nip || '') + '" style="width:100%;"><br><br>' +
        '<label><input type="checkbox" id="ep-pph"' + (p.ada_pph ? ' checked' : '') + '> Ada PPh</label><br><br>' +
        '<label>Penyedia</label><br><select id="ep-penyedia"><option value="">(belum dipilih)</option>' +
          providerList.filter(function (pv) { return pv.status === 'AKTIF'; }).map(function (pv) { return '<option value="' + escapeHtml(pv.penyedia_id) + '"' + (pv.penyedia_id === p.penyedia_id ? ' selected' : '') + '>' + escapeHtml(pv.nama_perusahaan) + '</option>'; }).join('') +
        '</select><br><br>' +
        '<button type="submit">Simpan Perubahan</button> ' +
        '<button type="button" id="btn-cancel-paket" class="btn-danger-text">Batalkan Paket</button>' +
        '</form>';
    }

    if (content.dataset.gen !== __gen) return;
    content.innerHTML = html;
    initRupiahFields(content);
    attachPejabatPickers(content);
    attachRefreshButtonHandler(content, function (c) { renderPaketDetailView(c, paketId, true); });
    renderKakSection(paketId, bisaEdit, forceRefresh, content);
    renderHpsSection(paketId, bisaEdit, forceRefresh, content);
    renderBastSection(paketId, bisaEdit, forceRefresh, content);
    renderMonevSection(paketId, bisaEdit, forceRefresh, content);

    content.querySelectorAll('.doc-upload-input').forEach(function (input) {
      input.addEventListener('change', function () {
        var file = input.files[0];
        if (!file) return;
        var requirementId = input.getAttribute('data-requirement-id');
        var nomorSuratInput = content.querySelector('.doc-nomor-surat-input[data-requirement-id="' + requirementId + '"]');
        input.disabled = true;
        showToast('Mengunggah ' + file.name + '...');
        var reader = new FileReader();
        reader.onload = function () {
          var base64 = reader.result.split(',')[1];
          callApi('documents', 'upload', {
            paketId: paketId, documentRequirementId: requirementId,
            fileName: file.name, mimeType: file.type, fileBase64: base64,
            nomorSurat: nomorSuratInput ? nomorSuratInput.value : undefined
          }).then(function () {
            showToast('Dokumen diunggah.');
            clearAllCache();
            renderPaketDetailView(content, paketId, true);
          }).catch(function (err) { showToast(err.message, true); input.disabled = false; });
        };
        reader.onerror = function () { showToast('Gagal membaca file.', true); input.disabled = false; };
        reader.readAsDataURL(file);
      });
    });

    content.querySelectorAll('[data-edit-nomor-surat]').forEach(function (el) {
      el.addEventListener('click', function () {
        var current = el.getAttribute('data-current-nomor') || '';
        var baru = prompt('Nomor surat:', current);
        if (baru === null) return;
        callApi('documents', 'setNomorSurat', { documentId: el.getAttribute('data-edit-nomor-surat'), nomorSurat: baru }).then(function () {
          showToast('Nomor surat disimpan.');
          clearAllCache();
          renderPaketDetailView(content, paketId, true);
        }).catch(function (err) { showToast(err.message, true); });
      });
    });

    content.querySelectorAll('[data-download-doc]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.preventDefault();
        callApi('documents', 'download', { documentId: el.getAttribute('data-download-doc') }).then(function (file) {
          var link = document.createElement('a');
          link.href = 'data:' + file.mimeType + ';base64,' + file.fileBase64;
          link.download = file.fileName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }).catch(function (err) { showToast(err.message, true); });
      });
    });

    content.querySelectorAll('[data-delete-doc]').forEach(function (el) {
      el.addEventListener('click', function () {
        if (!confirm('Apakah Anda yakin ingin menghapus dokumen ini?')) return;
        callApi('documents', 'delete', { documentId: el.getAttribute('data-delete-doc') }).then(function () {
          showToast('Dokumen dihapus.');
          clearAllCache();
          renderPaketDetailView(content, paketId, true);
        }).catch(function (err) { showToast(err.message, true); });
      });
    });

    var form = document.getElementById('form-edit-paket');
    if (form) form.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = form.querySelector('button[type="submit"]');
      var restore = setButtonBusy(btn, 'Menyimpan...');
      callApi('paket', 'update', {
        paketId: paketId,
        namaPaket: document.getElementById('ep-nama').value,
        metodePengadaan: document.getElementById('ep-metode').value,
        jenisKontrak: document.getElementById('ep-jeniskontrak').value,
        tanggalMulai: document.getElementById('ep-mulai').value,
        tanggalSelesai: document.getElementById('ep-selesai').value,
        nilaiHps: parseRupiahFieldValue('ep-hps'),
        nilaiKontrak: parseRupiahFieldValue('ep-kontrak'),
        ppkNama: document.getElementById('ep-ppknama').value,
        ppkNip: document.getElementById('ep-ppknip').value,
        ppNama: document.getElementById('ep-ppnama').value,
        ppNip: document.getElementById('ep-ppnip').value,
        kpaNama: document.getElementById('ep-kpanama').value,
        kpaNip: document.getElementById('ep-kpanip').value,
        adaPph: document.getElementById('ep-pph').checked,
        penyediaId: document.getElementById('ep-penyedia').value
      }).then(function (result) {
        showToast('Perubahan disimpan.' + (result.hpsMelebihiPagu ? ' Peringatan: HPS melebihi pagu.' : ''), !!result.hpsMelebihiPagu);
        clearAllCache();
        renderPaketDetailView(content, paketId, true);
      }).catch(function (err) { showToast(err.message, true); restore(); });
    });

    var cancelBtn = document.getElementById('btn-cancel-paket');
    if (cancelBtn) cancelBtn.addEventListener('click', function () {
      if (!confirm('Apakah Anda yakin ingin membatalkan paket ini?')) return;
      callApi('paket', 'cancel', { paketId: paketId }).then(function () {
        showToast('Paket dibatalkan.');
        clearAllCache();
        renderPaketDetailView(content, paketId, true);
      }).catch(function (err) { showToast(err.message, true); });
    });
  }).catch(function (err) { if (content.dataset.gen === __gen) renderError(content, err, function () { renderPaketDetailView(content, paketId, true); }); });
}

// ===================== KAK (Tahap 6) =====================
function renderKakSection(paketId, bisaEdit, forceRefresh, content) {
  var area = document.getElementById('kak-area');
  if (!area) return;

  Promise.all([
    callApiCached('kakPreview:' + paketId, 'kak', 'preview', { paketId: paketId }, forceRefresh),
    callApiCached('kakHistory:' + paketId, 'kak', 'history', { paketId: paketId }, forceRefresh)
  ]).then(function (results) {
    var preview = results[0], history = results[1];
    var stale = preview.perluRegenerasi || {};
    var html = '';

    if (stale.perlu) {
      html += '<p class="warning-banner">Peringatan administratif: data paket berubah sejak KAK v' + escapeHtml(stale.versiTerakhir) +
        ' dibuat (' + escapeHtml(stale.alasan.join(', ')) + '). Pertimbangkan generate ulang. ' +
        'Ini bukan keputusan hukum -- keputusan tetap di tangan PPK/Pejabat Pengadaan.</p>';
    }

    html += '<p>';
    if (history.length > 0) {
      html += 'Versi terakhir: v' + escapeHtml(history[0].version) + ' (' + escapeHtml(formatTanggalSingkat(history[0].generated_at)) + '). ';
    } else {
      html += '<span class="hint-text">Belum pernah di-generate. </span>';
    }
    html += '</p>';
    if (bisaEdit) {
      html += '<label>Nomor Surat</label><br>' +
        '<input id="kak-nomor-surat" value="' + escapeHtml(preview.nomorSurat || '') + '" placeholder="mis. 123/KAK/PP.00/2026" style="width:100%;max-width:320px;"><br><br>';
    }
    html += '<p>';
    html += '<button type="button" id="btn-kak-preview" class="btn-secondary">Lihat Pratinjau</button> ';
    if (bisaEdit) html += '<button type="button" id="btn-kak-finalize" class="btn-secondary">Generate &amp; Simpan PDF</button>';
    html += '</p>';

    if (history.length > 0) {
      html += '<table class="data-table"><thead><tr><th>Versi</th><th>Dibuat</th><th>Nomor Surat</th><th>Catatan</th><th></th></tr></thead><tbody>';
      history.forEach(function (h) {
        html += '<tr><td>v' + escapeHtml(h.version) + '</td><td>' + escapeHtml(formatTanggalSingkat(h.generated_at)) + '</td>' +
          '<td>' + escapeHtml(h.nomor_surat || '-') + '</td>' +
          '<td>' + escapeHtml(h.change_note || '-') + '</td>' +
          '<td><a href="#" data-kak-download="' + escapeHtml(h.generated_document_id) + '">Unduh PDF</a></td></tr>';
      });
      html += '</tbody></table>';
    }

    html += '<div id="kak-preview-box" style="display:none;"></div>';
    area.innerHTML = html;

    document.getElementById('btn-kak-preview').addEventListener('click', function () {
      var box = document.getElementById('kak-preview-box');
      if (box.style.display === '' && box.dataset.nomor === currentKakNomorSurat_()) { box.style.display = 'none'; return; }
      box.style.display = '';
      box.dataset.nomor = currentKakNomorSurat_();
      box.innerHTML = '<p class="hint-text">Memuat pratinjau...</p>';
      // Pratinjau diambil ULANG (tidak pakai cache) supaya Nomor Surat yang baru
      // diketik ikut terlihat di judul/kop -- bukan cuma preview.html lama.
      callApi('kak', 'preview', { paketId: paketId, nomorSurat: currentKakNomorSurat_() }, { retryable: true }).then(function (fresh) {
        // Pratinjau dirender di dalam iframe sandbox: HTML template berasal dari
        // data (bisa disunting admin), jadi jangan pernah disuntikkan langsung
        // ke halaman aplikasi lewat innerHTML.
        box.innerHTML = '<p class="hint-text">Pratinjau di bawah bisa langsung Anda cetak lewat browser (Ctrl+P) kalau tidak ingin membuat PDF versi baru.</p>' +
          '<iframe id="kak-preview-frame" sandbox="" style="width:100%;height:600px;border:1px solid #E1E6E3;border-radius:8px;background:#fff;"></iframe>';
        document.getElementById('kak-preview-frame').srcdoc = fresh.html;
      }).catch(function (err) { box.innerHTML = '<p class="error-text">' + escapeHtml(err.message) + '</p>'; });
    });

    function currentKakNomorSurat_() {
      var el = document.getElementById('kak-nomor-surat');
      return el ? el.value : (preview.nomorSurat || '');
    }

    var finalizeBtn = document.getElementById('btn-kak-finalize');
    if (finalizeBtn) finalizeBtn.addEventListener('click', function () {
      if (!confirm('Generate KAK versi baru dan simpan sebagai PDF? Versi lama tetap tersimpan.')) return;
      var catatan = prompt('Catatan perubahan (opsional):', '') || '';
      var restore = setButtonBusy(finalizeBtn, 'Membuat PDF...');
      callApi('kak', 'finalize', { paketId: paketId, changeNote: catatan, nomorSurat: currentKakNomorSurat_() }).then(function (res) {
        showToast('KAK v' + res.version + ' berhasil dibuat.');
        clearAllCache();
        renderPaketDetailView(content, paketId, true);
      }).catch(function (err) { showToast(err.message, true); restore(); });
    });

    area.querySelectorAll('[data-kak-download]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.preventDefault();
        callApi('kak', 'download', { generatedDocumentId: el.getAttribute('data-kak-download') }).then(function (file) {
          var link = document.createElement('a');
          link.href = 'data:' + file.mimeType + ';base64,' + file.fileBase64;
          link.download = file.fileName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }).catch(function (err) { showToast(err.message, true); });
      });
    });
  }).catch(function (err) {
    appError('renderKakSection:', err);
    area.innerHTML = '<p class="error-text">' + escapeHtml(err.message || 'Gagal memuat data KAK.') + '</p>';
  });
}

function formatTanggalSingkat(iso) {
  if (!iso) return '-';
  var d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ===================== BAST MANUAL =====================
function renderBastSection(paketId, bisaEdit, forceRefresh, content) {
  var area = document.getElementById('bast-area');
  if (!area) return;

  callApiCached('bastHistory:' + paketId, 'bast', 'history', { paketId: paketId }, forceRefresh).then(function (history) {
    var html = '<p class="hint-text">Tabel uraian pekerjaan diambil otomatis dari item HPS paket ini. Terdiri dari 3 bagian dalam satu PDF: Berita Acara Pemeriksaan Barang, Berita Acara Serah Terima Pekerjaan, dan Berita Acara Pembayaran.</p>';
    html += '<p>';
    if (history.length > 0) {
      html += 'Versi terakhir: v' + escapeHtml(history[0].version) + ' (' + escapeHtml(formatTanggalSingkat(history[0].generated_at)) + '). ';
    } else {
      html += '<span class="hint-text">Belum pernah di-generate. </span>';
    }
    html += '</p>';
    if (bisaEdit) {
      html += '<label>Nomor Surat (dasar -- akan otomatis jadi .a/.b/.c untuk BAP/BAST/Pembayaran)</label><br>' +
        '<input id="bast-nomor-surat" placeholder="mis. 82/Mts.10.105/PP.00.5/3/2026" style="width:100%;max-width:360px;"><br><br>' +
        '<label>Nomor Surat Pesanan (opsional)</label><br>' +
        '<input id="bast-nomor-sp" placeholder="mis. EP-01KFWT9AGZB4ECJYM4X2FAX89H" style="width:100%;max-width:360px;"><br><br>' +
        '<label>Tanggal Surat Pesanan (opsional)</label><br>' +
        '<input type="date" id="bast-tanggal-sp" style="width:100%;max-width:200px;"><br><br>' +
        '<label>Persentase Kemajuan Pekerjaan</label><br>' +
        '<input id="bast-persentase" value="100" style="width:100%;max-width:100px;"> %<br><br>';
    }
    html += '<p>';
    html += '<button type="button" id="btn-bast-preview" class="btn-secondary">Lihat Pratinjau</button> ';
    if (bisaEdit) html += '<button type="button" id="btn-bast-finalize" class="btn-secondary">Generate &amp; Simpan PDF</button>';
    html += '</p>';

    if (history.length > 0) {
      html += '<table class="data-table"><thead><tr><th>Versi</th><th>Dibuat</th><th>Nomor Surat</th><th>Catatan</th><th></th></tr></thead><tbody>';
      history.forEach(function (h) {
        html += '<tr><td>v' + escapeHtml(h.version) + '</td><td>' + escapeHtml(formatTanggalSingkat(h.generated_at)) + '</td>' +
          '<td>' + escapeHtml(h.nomor_surat || '-') + '</td><td>' + escapeHtml(h.change_note || '-') + '</td>' +
          '<td><a href="#" data-bast-download="' + escapeHtml(h.generated_document_id) + '">Unduh PDF</a></td></tr>';
      });
      html += '</tbody></table>';
    }
    html += '<div id="bast-preview-box" style="display:none;"></div>';
    area.innerHTML = html;

    function bastPayload_() {
      return {
        paketId: paketId,
        nomorSurat: (document.getElementById('bast-nomor-surat') || {}).value || '',
        nomorSuratPesanan: (document.getElementById('bast-nomor-sp') || {}).value || '',
        tanggalSuratPesanan: (document.getElementById('bast-tanggal-sp') || {}).value || '',
        persentaseKemajuan: (document.getElementById('bast-persentase') || {}).value || '100'
      };
    }

    document.getElementById('btn-bast-preview').addEventListener('click', function () {
      var box = document.getElementById('bast-preview-box');
      box.style.display = '';
      box.innerHTML = '<p class="hint-text">Memuat pratinjau...</p>';
      callApi('bast', 'preview', bastPayload_(), { retryable: true }).then(function (fresh) {
        box.innerHTML = '<p class="hint-text">Pratinjau di bawah bisa langsung Anda cetak lewat browser (Ctrl+P) kalau tidak ingin membuat PDF versi baru.</p>' +
          '<iframe id="bast-preview-frame" sandbox="" style="width:100%;height:700px;border:1px solid #E1E6E3;border-radius:8px;background:#fff;"></iframe>';
        document.getElementById('bast-preview-frame').srcdoc = fresh.html;
      }).catch(function (err) { box.innerHTML = '<p class="error-text">' + escapeHtml(err.message) + '</p>'; });
    });

    var finalizeBtn = document.getElementById('btn-bast-finalize');
    if (finalizeBtn) finalizeBtn.addEventListener('click', function () {
      if (!bastPayload_().nomorSurat) { showToast('Nomor surat wajib diisi.', true); return; }
      if (!confirm('Generate BAST Manual versi baru dan simpan sebagai PDF? Versi lama tetap tersimpan.')) return;
      var catatan = prompt('Catatan perubahan (opsional):', '') || '';
      var restore = setButtonBusy(finalizeBtn, 'Membuat PDF...');
      var payload = bastPayload_();
      payload.changeNote = catatan;
      callApi('bast', 'finalize', payload).then(function (res) {
        showToast('BAST Manual v' + res.version + ' berhasil dibuat.');
        clearAllCache();
        renderPaketDetailView(content, paketId, true);
      }).catch(function (err) { showToast(err.message, true); restore(); });
    });

    area.querySelectorAll('[data-bast-download]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.preventDefault();
        callApi('bast', 'download', { generatedDocumentId: el.getAttribute('data-bast-download') }).then(function (file) {
          var link = document.createElement('a');
          link.href = 'data:' + file.mimeType + ';base64,' + file.fileBase64;
          link.download = file.fileName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }).catch(function (err) { showToast(err.message, true); });
      });
    });
  }).catch(function (err) {
    appError('renderBastSection:', err);
    area.innerHTML = '<p class="error-text">' + escapeHtml(err.message || 'Gagal memuat data BAST.') + '</p>';
  });
}

// ===================== HASIL MONEV =====================
function renderMonevSection(paketId, bisaEdit, forceRefresh, content) {
  var area = document.getElementById('monev-area');
  if (!area) return;

  Promise.all([
    callApiCached('monevItems:' + paketId, 'monev', 'getItems', { paketId: paketId }, forceRefresh),
    callApiCached('monevHistory:' + paketId, 'monev', 'history', { paketId: paketId }, forceRefresh)
  ]).then(function (results) {
    var itemsData = results[0], history = results[1];
    var items = itemsData.items || [];

    var html = '<p class="hint-text">Daftar barang diambil otomatis dari item HPS -- lengkapi kolom Volume Diterima, Kondisi, dan Tindak Lanjut, lalu Simpan Item sebelum generate.</p>';
    html += '<p>';
    if (history.length > 0) {
      html += 'Versi terakhir: v' + escapeHtml(history[0].version) + ' (' + escapeHtml(formatTanggalSingkat(history[0].generated_at)) + '). ';
    } else {
      html += '<span class="hint-text">Belum pernah di-generate. </span>';
    }
    html += '</p>';

    if (bisaEdit) {
      html += '<div id="monev-grid" style="overflow-x:auto;"><table class="data-table"><thead><tr>' +
        '<th>Uraian Barang</th><th>Spesifikasi</th><th>Satuan</th><th>Vol. Dipesan</th><th>Vol. Diterima</th><th>Kondisi</th><th>Tindak Lanjut</th></tr></thead><tbody>';
      items.forEach(function (i, idx) {
        html += '<tr data-row="' + idx + '">' +
          '<td><input class="mv-nama" data-uppercase value="' + escapeHtml(i.nama_barang) + '" style="width:160px;"></td>' +
          '<td><input class="mv-spek" value="' + escapeHtml(i.spesifikasi || '') + '" style="width:180px;"></td>' +
          '<td><input class="mv-satuan" value="' + escapeHtml(i.satuan || '') + '" style="width:80px;"></td>' +
          '<td><input class="mv-vp" value="' + escapeHtml(i.volume_pesan || '') + '" style="width:70px;"></td>' +
          '<td><input class="mv-vt" value="' + escapeHtml(i.volume_terima || '') + '" style="width:70px;"></td>' +
          '<td><input class="mv-kondisi" value="' + escapeHtml(i.kondisi || '') + '" style="width:160px;"></td>' +
          '<td><input class="mv-tl" value="' + escapeHtml(i.tindak_lanjut || '') + '" style="width:120px;"></td></tr>';
      });
      html += '</tbody></table></div><br>' +
        '<button type="button" id="btn-monev-save-items" class="btn-secondary">Simpan Item</button><br><br>' +
        '<label>Nomor Surat</label><br><input id="monev-nomor-surat" placeholder="mis. B.018/Mts.10.101/KU.00/02/2026" style="width:100%;max-width:360px;"><br><br>' +
        '<label>Kesimpulan (satu baris = satu poin)</label><br>' +
        '<textarea id="monev-kesimpulan" rows="3" style="width:100%;max-width:520px;">' + DEFAULT_KESIMPULAN_MONEV_TEXT + '</textarea><br><br>';
    } else if (items.length > 0) {
      html += '<table class="data-table"><thead><tr><th>Uraian Barang</th><th>Vol. Diterima</th><th>Kondisi</th></tr></thead><tbody>';
      items.forEach(function (i) {
        html += '<tr><td>' + escapeHtml(i.nama_barang) + '</td><td>' + escapeHtml(i.volume_terima) + '</td><td>' + escapeHtml(i.kondisi) + '</td></tr>';
      });
      html += '</tbody></table><br>';
    }

    html += '<p>';
    html += '<button type="button" id="btn-monev-preview" class="btn-secondary">Lihat Pratinjau</button> ';
    if (bisaEdit) html += '<button type="button" id="btn-monev-finalize" class="btn-secondary">Generate &amp; Simpan PDF</button>';
    html += '</p>';

    if (history.length > 0) {
      html += '<table class="data-table"><thead><tr><th>Versi</th><th>Dibuat</th><th>Nomor Surat</th><th>Catatan</th><th></th></tr></thead><tbody>';
      history.forEach(function (h) {
        html += '<tr><td>v' + escapeHtml(h.version) + '</td><td>' + escapeHtml(formatTanggalSingkat(h.generated_at)) + '</td>' +
          '<td>' + escapeHtml(h.nomor_surat || '-') + '</td><td>' + escapeHtml(h.change_note || '-') + '</td>' +
          '<td><a href="#" data-monev-download="' + escapeHtml(h.generated_document_id) + '">Unduh PDF</a></td></tr>';
      });
      html += '</tbody></table>';
    }
    html += '<div id="monev-preview-box" style="display:none;"></div>';
    area.innerHTML = html;

    function readGridItems_() {
      var rows = area.querySelectorAll('#monev-grid tbody tr');
      var out = [];
      rows.forEach(function (tr) {
        out.push({
          namaBarang: tr.querySelector('.mv-nama').value,
          spesifikasi: tr.querySelector('.mv-spek').value,
          satuan: tr.querySelector('.mv-satuan').value,
          volumePesan: tr.querySelector('.mv-vp').value,
          volumeTerima: tr.querySelector('.mv-vt').value,
          kondisi: tr.querySelector('.mv-kondisi').value,
          tindakLanjut: tr.querySelector('.mv-tl').value
        });
      });
      return out;
    }
    function monevPayload_() {
      var kesimpulanEl = document.getElementById('monev-kesimpulan');
      var kesimpulan = kesimpulanEl ? kesimpulanEl.value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean) : [];
      return {
        paketId: paketId,
        nomorSurat: (document.getElementById('monev-nomor-surat') || {}).value || '',
        kesimpulan: kesimpulan
      };
    }

    var saveBtn = document.getElementById('btn-monev-save-items');
    if (saveBtn) saveBtn.addEventListener('click', function () {
      var restore = setButtonBusy(saveBtn, 'Menyimpan...');
      callApi('monev', 'saveItems', { paketId: paketId, items: readGridItems_() }).then(function () {
        showToast('Item monev disimpan.');
        clearAllCache();
        renderPaketDetailView(content, paketId, true);
      }).catch(function (err) { showToast(err.message, true); restore(); });
    });

    document.getElementById('btn-monev-preview').addEventListener('click', function () {
      var box = document.getElementById('monev-preview-box');
      box.style.display = '';
      box.innerHTML = '<p class="hint-text">Memuat pratinjau...</p>';
      callApi('monev', 'preview', monevPayload_(), { retryable: true }).then(function (fresh) {
        box.innerHTML = '<p class="hint-text">Pastikan item monev sudah Disimpan dulu supaya tabelnya ikut tampil di pratinjau.</p>' +
          '<iframe id="monev-preview-frame" sandbox="" style="width:100%;height:700px;border:1px solid #E1E6E3;border-radius:8px;background:#fff;"></iframe>';
        document.getElementById('monev-preview-frame').srcdoc = fresh.html;
      }).catch(function (err) { box.innerHTML = '<p class="error-text">' + escapeHtml(err.message) + '</p>'; });
    });

    var finalizeBtn = document.getElementById('btn-monev-finalize');
    if (finalizeBtn) finalizeBtn.addEventListener('click', function () {
      if (!monevPayload_().nomorSurat) { showToast('Nomor surat wajib diisi.', true); return; }
      if (!confirm('Generate Hasil Monev versi baru dan simpan sebagai PDF? Pastikan item monev sudah disimpan. Versi lama tetap tersimpan.')) return;
      var catatan = prompt('Catatan perubahan (opsional):', '') || '';
      var restore = setButtonBusy(finalizeBtn, 'Membuat PDF...');
      var payload = monevPayload_();
      payload.changeNote = catatan;
      callApi('monev', 'finalize', payload).then(function (res) {
        showToast('Hasil Monev v' + res.version + ' berhasil dibuat.');
        clearAllCache();
        renderPaketDetailView(content, paketId, true);
      }).catch(function (err) { showToast(err.message, true); restore(); });
    });

    area.querySelectorAll('[data-monev-download]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.preventDefault();
        callApi('monev', 'download', { generatedDocumentId: el.getAttribute('data-monev-download') }).then(function (file) {
          var link = document.createElement('a');
          link.href = 'data:' + file.mimeType + ';base64,' + file.fileBase64;
          link.download = file.fileName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }).catch(function (err) { showToast(err.message, true); });
      });
    });
  }).catch(function (err) {
    appError('renderMonevSection:', err);
    area.innerHTML = '<p class="error-text">' + escapeHtml(err.message || 'Gagal memuat data monev.') + '</p>';
  });
}
var DEFAULT_KESIMPULAN_MONEV_TEXT = 'Pelaksanaan pengadaan telah terealisasi 100% (seratus persen) sesuai Surat Pesanan.\nSeluruh barang/pekerjaan diterima sesuai jumlah dan spesifikasi.';

// ===================== HPS (Tahap 7) =====================
var hpsGridInstance = null;

function renderHpsSection(paketId, bisaEdit, forceRefresh, content) {
  var area = document.getElementById('hps-area');
  if (!area) return;

  // Cek library dulu: kalau CDN gagal dimuat, beri pesan jelas -- jangan
  // biarkan bagian ini kosong tanpa penjelasan (pelajaran dari masalah CDN
  // jsPDF di proyek sebelumnya).
  if (typeof jspreadsheet === 'undefined') {
    area.innerHTML = '<p class="error-text">Komponen tabel HPS (jspreadsheet) gagal dimuat dari CDN. ' +
      'Periksa koneksi internet, lalu muat ulang halaman. Data HPS yang sudah tersimpan tidak terpengaruh.</p>';
    appError('renderHpsSection: jspreadsheet tidak terdefinisi -- CDN gagal dimuat.');
    return;
  }

  Promise.all([
    callApiCached('hps:' + paketId, 'hps', 'get', { paketId: paketId }, forceRefresh),
    callApiCached('hpsHistory:' + paketId, 'hps', 'history', { paketId: paketId }, forceRefresh)
  ]).then(function (results) {
    var hpsData = results[0], history = results[1];
    var html = '';

    if (hpsData.total > hpsData.paguPaket && hpsData.paguPaket > 0) {
      html += '<p class="warning-banner">Peringatan administratif: total HPS (' + formatRupiah(hpsData.total) +
        ') melebihi pagu (' + formatRupiah(hpsData.paguPaket) + '). Ini bukan keputusan hukum -- mohon dikonfirmasi ke PPK.</p>';
    }

    html += '<p>Total HPS tersimpan: <b>' + formatRupiah(hpsData.total) + '</b> (' + hpsData.items.length + ' item). ';
    if (history.length > 0) html += 'Dokumen HPS versi terakhir: v' + escapeHtml(history[0].version) + '. ';
    html += '</p>';

    if (bisaEdit) {
      html += '<p class="hint-text">Anda bisa mengetik langsung, atau salin tabel dari Excel lalu tempel (Ctrl+V) ke dalam grid. ' +
        'Kolom JUMLAH dihitung otomatis oleh server (volume x harga satuan), jadi tidak perlu diisi.</p>' +
        '<p><label class="btn-secondary" style="display:inline-block;">Import Excel/CSV' +
        '<input type="file" id="hps-import-file" accept=".xlsx,.xls,.csv" style="display:none;"></label> ' +
        '<button type="button" id="btn-hps-add-row" class="btn-secondary">+ Tambah Baris</button></p>';
    }

    html += '<div id="hps-grid"></div>';
    html += '<p style="margin-top:10px;">';
    if (bisaEdit) html += '<button type="button" id="btn-hps-save" class="btn-secondary">Simpan Item HPS</button> ';
    html += '<button type="button" id="btn-hps-preview" class="btn-secondary">Lihat Pratinjau Dokumen</button> ';
    if (bisaEdit) html += '<button type="button" id="btn-hps-finalize" class="btn-secondary">Generate &amp; Simpan PDF</button>';
    html += '</p>';

    if (history.length > 0) {
      html += '<table class="data-table"><thead><tr><th>Versi</th><th>Dibuat</th><th>Catatan</th><th></th></tr></thead><tbody>';
      history.forEach(function (h) {
        html += '<tr><td>v' + escapeHtml(h.version) + '</td><td>' + escapeHtml(formatTanggalSingkat(h.generated_at)) + '</td>' +
          '<td>' + escapeHtml(h.change_note || '-') + '</td>' +
          '<td><a href="#" data-hps-download="' + escapeHtml(h.generated_document_id) + '">Unduh PDF</a></td></tr>';
      });
      html += '</tbody></table>';
    }
    html += '<div id="hps-preview-box" style="display:none;"></div>';
    area.innerHTML = html;

    // Data awal grid: minimal 5 baris kosong supaya langsung bisa diisi/di-paste.
    var dataGrid = hpsData.items.map(function (i) {
      return [i.nama, i.spesifikasi, i.volume, i.satuan, i.harga_satuan];
    });
    while (dataGrid.length < 5) dataGrid.push(['', '', '', '', '']);

    hpsGridInstance = jspreadsheet(document.getElementById('hps-grid'), {
      data: dataGrid,
      columns: [
        { type: 'text', title: 'Nama', width: 160 },
        { type: 'text', title: 'Spesifikasi', width: 320 },
        { type: 'numeric', title: 'Volume', width: 80 },
        { type: 'text', title: 'Satuan', width: 90 },
        { type: 'numeric', title: 'Harga Satuan', width: 130 }
      ],
      minDimensions: [5, 5],
      allowInsertRow: bisaEdit,
      allowDeleteRow: bisaEdit,
      editable: bisaEdit,
      tableOverflow: true,
      tableWidth: '100%'
    });

    var addRowBtn = document.getElementById('btn-hps-add-row');
    if (addRowBtn) addRowBtn.addEventListener('click', function () { hpsGridInstance.insertRow(); });

    var importInput = document.getElementById('hps-import-file');
    if (importInput) importInput.addEventListener('change', function () {
      var file = importInput.files[0];
      if (!file) return;
      if (typeof XLSX === 'undefined') {
        showToast('Komponen pembaca Excel (SheetJS) gagal dimuat dari CDN. Muat ulang halaman.', true);
        return;
      }
      var reader = new FileReader();
      reader.onload = function (e) {
        try {
          var wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
          var sheet = wb.Sheets[wb.SheetNames[0]];
          var rows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false });
          var baris = rows.map(function (r) {
            return [r[0] || '', r[1] || '', r[2] || '', r[3] || '', r[4] || ''];
          }).filter(function (r) { return String(r[0]).trim() || String(r[1]).trim(); });

          if (baris.length === 0) { showToast('File tidak berisi baris yang bisa dibaca.', true); return; }
          // Pratinjau + konfirmasi dulu sebelum mengganti isi grid, sesuai
          // instruksi awal: "import -> preview -> user konfirmasi -> baru simpan".
          if (!confirm('Ditemukan ' + baris.length + ' baris. Kolom dibaca berurutan: Nama, Spesifikasi, Volume, Satuan, Harga Satuan. ' +
              'Baris pertama ikut terbaca -- hapus manual kalau itu header.\n\nGanti isi grid dengan data ini?')) return;
          hpsGridInstance.setData(baris);
          showToast(baris.length + ' baris dimuat ke grid. Periksa dulu, lalu klik "Simpan Item HPS".');
        } catch (err) {
          appError('Import Excel gagal:', err);
          showToast('Gagal membaca file Excel: ' + err.message, true);
        }
      };
      reader.readAsArrayBuffer(file);
    });

    var saveBtn = document.getElementById('btn-hps-save');
    if (saveBtn) saveBtn.addEventListener('click', function () {
      var restore = setButtonBusy(saveBtn, 'Menyimpan...');
      var items = hpsGridInstance.getData().map(function (r) {
        return { nama: r[0], spesifikasi: r[1], volume: r[2], satuan: r[3], hargaSatuan: r[4] };
      });
      callApi('hps', 'save', { paketId: paketId, items: items }).then(function (res) {
        showToast('Tersimpan: ' + res.jumlahItem + ' item, total ' + formatRupiah(res.total) +
          (res.melebihiPagu ? ' (melebihi pagu!)' : ''), !!res.melebihiPagu);
        clearAllCache();
        renderPaketDetailView(content, paketId, true);
      }).catch(function (err) { showToast(err.message, true); restore(); });
    });

    document.getElementById('btn-hps-preview').addEventListener('click', function () {
      var box = document.getElementById('hps-preview-box');
      if (box.style.display === '') { box.style.display = 'none'; return; }
      box.style.display = '';
      box.innerHTML = '<p class="hint-text">Memuat pratinjau...</p>';
      callApi('hps', 'preview', { paketId: paketId }).then(function (res) {
        box.innerHTML = '<p class="hint-text">Pratinjau ini bisa langsung dicetak lewat browser (Ctrl+P).</p>' +
          '<iframe id="hps-preview-frame" sandbox="" style="width:100%;height:600px;border:1px solid #E1E6E3;border-radius:8px;background:#fff;"></iframe>';
        document.getElementById('hps-preview-frame').srcdoc = res.html;
      }).catch(function (err) { box.innerHTML = '<p class="error-text">' + escapeHtml(err.message) + '</p>'; });
    });

    var finalizeBtn = document.getElementById('btn-hps-finalize');
    if (finalizeBtn) finalizeBtn.addEventListener('click', function () {
      if (!confirm('Generate dokumen HPS versi baru? Pastikan item HPS sudah disimpan lebih dulu.')) return;
      var catatan = prompt('Catatan perubahan (opsional):', '') || '';
      var restore = setButtonBusy(finalizeBtn, 'Membuat PDF...');
      callApi('hps', 'finalize', { paketId: paketId, changeNote: catatan }).then(function (res) {
        showToast('HPS v' + res.version + ' berhasil dibuat.');
        clearAllCache();
        renderPaketDetailView(content, paketId, true);
      }).catch(function (err) { showToast(err.message, true); restore(); });
    });

    area.querySelectorAll('[data-hps-download]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.preventDefault();
        callApi('hps', 'download', { generatedDocumentId: el.getAttribute('data-hps-download') }).then(unduhFileBase64)
          .catch(function (err) { showToast(err.message, true); });
      });
    });
  }).catch(function (err) {
    appError('renderHpsSection:', err);
    area.innerHTML = '<p class="error-text">' + escapeHtml(err.message || 'Gagal memuat data HPS.') + '</p>';
  });
}

// Helper unduh dipakai bersama oleh KAK, HPS, dokumen, dan company profile.
function unduhFileBase64(file) {
  var link = document.createElement('a');
  link.href = 'data:' + file.mimeType + ';base64,' + file.fileBase64;
  link.download = file.fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ===================== LAPORAN (Tahap 8) =====================
function renderLaporanView(content, forceRefresh) {
  var __gen = content.dataset.gen;
  ensureYearsLoaded(forceRefresh).then(function (yearInfo) {
    if (yearInfo.years.length === 0) {
      if (content.dataset.gen !== __gen) return;
      content.innerHTML = '<h2>Laporan</h2><p>Belum ada Tahun Anggaran.</p>';
      return;
    }
    var tahun = { tahunAnggaranId: yearInfo.selectedId };
    var permintaan = [
      callApiCached('rekapSatker:' + yearInfo.selectedId, 'reports', 'rekapSatker', tahun, forceRefresh),
      callApiCached('rekapJenis:' + yearInfo.selectedId, 'reports', 'rekapJenisPengadaan', tahun, forceRefresh),
      callApiCached('belumLengkap:' + yearInfo.selectedId, 'reports', 'paketBelumLengkap', tahun, forceRefresh)
    ];
    if (currentUser.role === 'ADMIN') {
      permintaan.push(callApiCached('rekapUser:' + yearInfo.selectedId, 'reports', 'rekapUser', tahun, forceRefresh));
    }

    Promise.all(permintaan).then(function (r) {
      var rekapSatker = r[0], rekapJenis = r[1], belumLengkap = r[2], rekapUser = r[3];
      var html = '<h2>Laporan</h2>' +
        '<p>Tahun Anggaran: ' + renderYearSelectorHtml(yearInfo.years, yearInfo.selectedId) + ' ' + refreshButtonHtml() +
        ' <button type="button" id="btn-export-csv" class="btn-secondary">Export Rekap Satker (CSV)</button></p>';

      html += '<h3>Rekap per Satker</h3><table class="data-table"><thead><tr>' +
        '<th>Satker</th><th>Jenis</th><th>Pagu</th><th>HPS</th><th>Kontrak</th><th>Paket</th><th>Complete</th><th>Status</th>' +
        '</tr></thead><tbody>';
      rekapSatker.forEach(function (s) {
        html += '<tr><td>' + escapeHtml(s.namaSatker) + '</td><td>' + escapeHtml(s.jenisSatker) + '</td>' +
          '<td>' + formatRupiah(s.totalPagu) + '</td><td>' + formatRupiah(s.totalHps) + '</td>' +
          '<td>' + formatRupiah(s.totalKontrak) + '</td><td>' + escapeHtml(s.jumlahPaket) + '</td>' +
          '<td>' + escapeHtml(s.paketComplete) + '</td>' +
          '<td><span class="badge ' + statusBadgeClass(s.status) + '">' + statusLabel(s.status) + '</span></td></tr>';
      });
      html += '</tbody></table>';

      html += '<h3>Rekap per Jenis Pengadaan</h3><table class="data-table"><thead><tr>' +
        '<th>Jenis Pengadaan</th><th>Pagu</th><th>HPS</th><th>Paket</th><th>Complete</th></tr></thead><tbody>';
      rekapJenis.forEach(function (j) {
        html += '<tr><td>' + escapeHtml(j.namaJenis) + '</td><td>' + formatRupiah(j.totalPagu) + '</td>' +
          '<td>' + formatRupiah(j.totalHps) + '</td><td>' + escapeHtml(j.jumlahPaket) + '</td>' +
          '<td>' + escapeHtml(j.paketComplete) + '</td></tr>';
      });
      html += '</tbody></table>';

      if (rekapUser) {
        html += '<h3>Rekap per Pengelola</h3><table class="data-table"><thead><tr>' +
          '<th>Nama</th><th>Role</th><th>Satker</th><th>Paket</th><th>Complete</th><th>Total HPS</th></tr></thead><tbody>';
        rekapUser.forEach(function (u) {
          html += '<tr><td>' + escapeHtml(u.nama) + '</td><td>' + escapeHtml(u.role) + '</td>' +
            '<td>' + escapeHtml(u.jumlahSatker) + '</td><td>' + escapeHtml(u.jumlahPaket) + '</td>' +
            '<td>' + escapeHtml(u.paketComplete) + '</td><td>' + formatRupiah(u.totalHps) + '</td></tr>';
        });
        html += '</tbody></table>';
      }

      html += '<h3>Paket Belum Lengkap (' + belumLengkap.length + ')</h3>';
      if (belumLengkap.length === 0) {
        html += '<p class="hint-text">Tidak ada paket yang belum lengkap.</p>';
      } else {
        html += '<table class="data-table"><thead><tr><th>Paket</th><th>Satker</th><th>Status</th><th>Dokumen yang Kurang</th></tr></thead><tbody>';
        belumLengkap.forEach(function (p) {
          html += '<tr><td><a href="#/paket/' + escapeHtml(p.paketId) + '">' + escapeHtml(p.namaPaket) + '</a></td>' +
            '<td>' + escapeHtml(p.namaSatker) + '</td><td>' + paketStatusBadge(p.status) + '</td>' +
            '<td class="hint-text">' + escapeHtml(p.dokumenKurang.join(', ') || '-') + '</td></tr>';
        });
        html += '</tbody></table>';
      }

      if (content.dataset.gen !== __gen) return;
      content.innerHTML = html;
      attachYearSelectorHandler(content, renderLaporanView);
      attachRefreshButtonHandler(content, renderLaporanView);

      document.getElementById('btn-export-csv').addEventListener('click', function () {
        var baris = [['Satker', 'Jenis', 'Pagu', 'HPS', 'Kontrak', 'Jumlah Paket', 'Paket Complete', 'Status']];
        rekapSatker.forEach(function (s) {
          baris.push([s.namaSatker, s.jenisSatker, s.totalPagu, s.totalHps, s.totalKontrak, s.jumlahPaket, s.paketComplete, statusLabel(s.status)]);
        });
        unduhCsv(baris, 'Rekap Satker.csv');
      });
    }).catch(function (err) { if (content.dataset.gen === __gen) renderError(content, err, function () { renderLaporanView(content, true); }); });
  }).catch(function (err) { if (content.dataset.gen === __gen) renderError(content, err, function () { renderLaporanView(content, true); }); });
}

function unduhCsv(baris, namaFile) {
  var csv = baris.map(function (r) {
    return r.map(function (sel) {
      var teks = String(sel === null || sel === undefined ? '' : sel);
      // Bungkus tanda kutip kalau ada koma/kutip/baris baru, dan gandakan
      // kutip di dalamnya -- aturan CSV standar.
      return /[",\n]/.test(teks) ? '"' + teks.replace(/"/g, '""') + '"' : teks;
    }).join(',');
  }).join('\n');
  // BOM di depan supaya Excel membaca UTF-8 dengan benar (nama satker bisa
  // mengandung karakter non-ASCII).
  var blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  var link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = namaFile;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

// ===================== PENCARIAN GLOBAL (Tahap 8) =====================
function setupGlobalSearch() {
  var input = document.getElementById('global-search');
  var box = document.getElementById('search-results');
  if (!input || !box) return;
  var timer = null;

  input.addEventListener('input', function () {
    clearTimeout(timer);
    var q = input.value.trim();
    if (q.length < 2) { box.style.display = 'none'; return; }
    // Ditunda 400ms setelah user berhenti mengetik, supaya tidak memanggil
    // server tiap ketukan tombol.
    timer = setTimeout(function () {
      callApi('reports', 'search', { query: q }).then(function (hasil) {
        if (hasil.length === 0) {
          box.innerHTML = '<p class="hint-text" style="padding:10px;">Tidak ada hasil untuk "' + escapeHtml(q) + '".</p>';
        } else {
          box.innerHTML = hasil.map(function (h) {
            var href = h.tipe === 'Satker' ? '#/satker/' + h.id : (h.tipe === 'Paket' ? '#/paket/' + h.id : '#/penyedia/' + h.id);
            return '<a class="search-item" href="' + href + '"><b>' + escapeHtml(h.label) + '</b> ' +
              '<span class="hint-text">' + escapeHtml(h.tipe) + (h.keterangan ? ' - ' + escapeHtml(h.keterangan) : '') + '</span></a>';
          }).join('');
        }
        box.style.display = '';
      }).catch(function (err) { appError('Pencarian gagal:', err); });
    }, 400);
  });

  document.addEventListener('click', function (e) {
    if (e.target !== input && !box.contains(e.target)) box.style.display = 'none';
  });
  box.addEventListener('click', function () {
    box.style.display = 'none';
    input.value = '';
  });
}

// ===================== PENYEDIA (Tahap 4) =====================
function renderPenyediaView(content, forceRefresh) {
  var __gen = content.dataset.gen;
  callApiCached('providers', 'providers', 'list', {}, forceRefresh).then(function (providers) {
    var html = '<h2>Penyedia</h2><p>' + refreshButtonHtml() + '</p>';

    if (currentUser.role === 'ADMIN' || currentUser.role === 'PENGELOLA') {
      html += '<h3>Tambah Penyedia</h3>' +
        '<form id="form-add-provider" class="inline-form">' +
        '<input id="input-pv-nama" data-uppercase placeholder="Nama Perusahaan" required style="min-width:220px;"> ' +
        '<select id="input-pv-bentuk"><option value="">Bentuk Usaha</option>' +
          VALID_BENTUK_USAHA_OPTIONS.map(function (b) { return '<option>' + escapeHtml(b) + '</option>'; }).join('') +
        '</select><br>' +
        '<input id="input-pv-npwp" placeholder="NPWP"> ' +
        '<input id="input-pv-nib" placeholder="NIB"><br>' +
        '<input id="input-pv-alamat" placeholder="Alamat" style="min-width:320px;"><br>' +
        '<input id="input-pv-email" placeholder="Email" type="email"> ' +
        '<input id="input-pv-telepon" placeholder="Telepon"><br>' +
        '<input id="input-pv-direktur" data-uppercase placeholder="Nama Direktur"> ' +
        '<input id="input-pv-pic" data-uppercase placeholder="Nama PIC"> ' +
        '<input id="input-pv-nomorpic" placeholder="Nomor PIC"><br>' +
        '<input id="input-pv-rekening" placeholder="Nomor Rekening"> ' +
        '<input id="input-pv-bank" placeholder="Bank"><br>' +
        '<button type="submit">Tambah</button></form>';
    }

    html += '<table class="data-table"><thead><tr><th>Nama Perusahaan</th><th>Bentuk</th><th>Kontak</th><th>Company Profile</th><th>Status</th></tr></thead><tbody>';
    if (providers.length === 0) html += '<tr><td colspan="5">Belum ada penyedia.</td></tr>';
    providers.forEach(function (p) {
      html += '<tr>' +
        '<td><a href="#" data-provider-link="' + escapeHtml(p.penyedia_id) + '">' + escapeHtml(p.nama_perusahaan) + '</a></td>' +
        '<td>' + escapeHtml(p.bentuk_usaha || '-') + '</td>' +
        '<td>' + escapeHtml(p.nama_pic || '-') + (p.nomor_pic ? ' (' + escapeHtml(p.nomor_pic) + ')' : '') + '</td>' +
        '<td>' + (p.company_profile_file_id ? 'Ada (v' + escapeHtml(p.company_profile_version) + ')' : '<span class="hint-text">Belum ada</span>') + '</td>' +
        '<td><span class="badge">' + escapeHtml(p.status) + '</span></td>' +
        '</tr>';
    });
    html += '</tbody></table>';

    if (content.dataset.gen !== __gen) return;
    content.innerHTML = html;
    attachRefreshButtonHandler(content, renderPenyediaView);
    content.querySelectorAll('[data-provider-link]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.preventDefault();
        location.hash = '#/penyedia/' + el.getAttribute('data-provider-link');
      });
    });

    var form = document.getElementById('form-add-provider');
    if (form) form.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = form.querySelector('button[type="submit"]');
      var restore = setButtonBusy(btn, 'Menyimpan...');
      callApi('providers', 'create', {
        namaPerusahaan: document.getElementById('input-pv-nama').value,
        bentukUsaha: document.getElementById('input-pv-bentuk').value,
        npwp: document.getElementById('input-pv-npwp').value,
        nib: document.getElementById('input-pv-nib').value,
        alamat: document.getElementById('input-pv-alamat').value,
        email: document.getElementById('input-pv-email').value,
        telepon: document.getElementById('input-pv-telepon').value,
        namaDirektur: document.getElementById('input-pv-direktur').value,
        namaPic: document.getElementById('input-pv-pic').value,
        nomorPic: document.getElementById('input-pv-nomorpic').value,
        rekening: document.getElementById('input-pv-rekening').value,
        bank: document.getElementById('input-pv-bank').value
      }).then(function () {
        showToast('Penyedia ditambahkan.');
        clearAllCache();
        renderPenyediaView(content, true);
      }).catch(function (err) { showToast(err.message, true); restore(); });
    });
  }).catch(function (err) { if (content.dataset.gen === __gen) renderError(content, err, function () { renderPenyediaView(content, true); }); });
}

function renderPenyediaDetailView(content, penyediaId, forceRefresh) {
  var __gen = content.dataset.gen;
  callApiCached('providerDetail:' + penyediaId, 'providers', 'detail', { penyediaId: penyediaId }, forceRefresh).then(function (p) {
    var bisaEdit = currentUser.role === 'ADMIN' || currentUser.role === 'PENGELOLA';
    var html = '<p><a href="#/penyedia">&larr; Kembali ke Daftar Penyedia</a></p>' +
      '<h2>' + escapeHtml(p.nama_perusahaan) + '</h2>' +
      '<p><span class="badge">' + escapeHtml(p.status) + '</span> ' + refreshButtonHtml() + '</p>';

    html += '<table class="data-table"><tbody>' +
      '<tr><th>Bentuk Usaha</th><td>' + escapeHtml(p.bentuk_usaha || '-') + '</td></tr>' +
      '<tr><th>NPWP</th><td>' + escapeHtml(p.npwp || '-') + '</td></tr>' +
      '<tr><th>NIB</th><td>' + escapeHtml(p.nib || '-') + '</td></tr>' +
      '<tr><th>Alamat</th><td>' + escapeHtml(p.alamat || '-') + '</td></tr>' +
      '<tr><th>Email</th><td>' + escapeHtml(p.email || '-') + '</td></tr>' +
      '<tr><th>Telepon</th><td>' + escapeHtml(p.telepon || '-') + '</td></tr>' +
      '<tr><th>Direktur</th><td>' + escapeHtml(p.nama_direktur || '-') + '</td></tr>' +
      '<tr><th>PIC</th><td>' + escapeHtml(p.nama_pic || '-') + (p.nomor_pic ? ' (' + escapeHtml(p.nomor_pic) + ')' : '') + '</td></tr>' +
      '<tr><th>Rekening</th><td>' + escapeHtml(p.rekening || '-') + (p.bank ? ' - ' + escapeHtml(p.bank) : '') + '</td></tr>' +
      '</tbody></table>';

    html += '<h3>Company Profile</h3>';
    if (p.company_profile_file_id) {
      html += '<p>Sudah diunggah (versi ' + escapeHtml(p.company_profile_version) + '). ' +
        '<button type="button" id="btn-download-cp" class="btn-secondary">Unduh</button></p>';
    } else {
      html += '<p class="hint-text">Belum ada company profile diunggah.</p>';
    }
    if (bisaEdit) {
      html += '<form id="form-upload-cp" class="inline-form">' +
        '<input type="file" id="input-cp-file" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png" required> ' +
        '<button type="submit">' + (p.company_profile_file_id ? 'Perbarui Company Profile' : 'Unggah Company Profile') + '</button>' +
        '</form>';
    }

    if (currentUser.role === 'ADMIN') {
      html += '<h3>Status Penyedia</h3>' +
        '<form id="form-provider-status" class="inline-form">' +
        '<select id="input-pv-status"><option value="AKTIF"' + (p.status === 'AKTIF' ? ' selected' : '') + '>Aktif</option>' +
        '<option value="NONAKTIF"' + (p.status === 'NONAKTIF' ? ' selected' : '') + '>Nonaktif</option></select> ' +
        '<button type="submit">Simpan Status</button></form>';
    }

    if (content.dataset.gen !== __gen) return;
    content.innerHTML = html;
    attachRefreshButtonHandler(content, function (c) { renderPenyediaDetailView(c, penyediaId, true); });

    var downloadBtn = document.getElementById('btn-download-cp');
    if (downloadBtn) downloadBtn.addEventListener('click', function () {
      var restore = setButtonBusy(downloadBtn, 'Mengambil...');
      callApi('providers', 'getCompanyProfileFile', { penyediaId: penyediaId }).then(function (file) {
        var link = document.createElement('a');
        link.href = 'data:' + file.mimeType + ';base64,' + file.fileBase64;
        link.download = file.fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        restore();
      }).catch(function (err) { showToast(err.message, true); restore(); });
    });

    var uploadForm = document.getElementById('form-upload-cp');
    if (uploadForm) uploadForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var fileInput = document.getElementById('input-cp-file');
      var file = fileInput.files[0];
      if (!file) { showToast('Pilih file dulu.', true); return; }
      var btn = uploadForm.querySelector('button[type="submit"]');
      var restore = setButtonBusy(btn, 'Mengunggah...');

      var reader = new FileReader();
      reader.onload = function () {
        var base64 = reader.result.split(',')[1]; // buang prefix "data:mime;base64,"
        callApi('providers', 'uploadCompanyProfile', {
          penyediaId: penyediaId,
          fileName: file.name,
          mimeType: file.type,
          fileBase64: base64
        }).then(function () {
          showToast('Company profile berhasil diunggah.');
          clearAllCache();
          renderPenyediaDetailView(content, penyediaId, true);
        }).catch(function (err) { showToast(err.message, true); restore(); });
      };
      reader.onerror = function () {
        showToast('Gagal membaca file.', true);
        restore();
      };
      reader.readAsDataURL(file);
    });

    var statusForm = document.getElementById('form-provider-status');
    if (statusForm) statusForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = statusForm.querySelector('button[type="submit"]');
      var restore = setButtonBusy(btn, 'Menyimpan...');
      callApi('providers', 'setStatus', { penyediaId: penyediaId, status: document.getElementById('input-pv-status').value }).then(function () {
        showToast('Status penyedia diperbarui.');
        clearAllCache();
        renderPenyediaDetailView(content, penyediaId, true);
      }).catch(function (err) { showToast(err.message, true); restore(); });
    });
  }).catch(function (err) { if (content.dataset.gen === __gen) renderError(content, err, function () { renderPenyediaDetailView(content, penyediaId, true); }); });
}

// ===================== TAHUN ANGGARAN =====================
function renderYearsView(content, forceRefresh) {
  var __gen = content.dataset.gen;
  callApiCached('years', 'years', 'list', {}, forceRefresh).then(function (years) {
    var html = '<h2>Tahun Anggaran</h2><p>' + refreshButtonHtml() + '</p>';
    if (currentUser.role === 'ADMIN') {
      html += '<form id="form-add-year" class="inline-form"><input type="number" id="input-tahun" placeholder="Tahun, mis. 2027" required> <button type="submit">Tambah</button></form>';
    }
    html += '<table class="data-table"><thead><tr><th>Tahun</th><th>Status</th><th>Catatan</th></tr></thead><tbody>';
    years.forEach(function (y) {
      html += '<tr><td>' + escapeHtml(y.tahun) + '</td><td><span class="badge">' + escapeHtml(y.status) + '</span></td><td>' + escapeHtml(y.catatan) + '</td></tr>';
    });
    html += '</tbody></table>';
    if (content.dataset.gen !== __gen) return;
    content.innerHTML = html;
    attachRefreshButtonHandler(content, renderYearsView);

    var form = document.getElementById('form-add-year');
    if (form) form.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = form.querySelector('button[type="submit"]');
      var restore = setButtonBusy(btn, 'Menyimpan...');
      callApi('years', 'create', { tahun: document.getElementById('input-tahun').value }).then(function () {
        showToast('Tahun anggaran ditambahkan.');
        clearAllCache();
        renderYearsView(content, true);
      }).catch(function (err) { showToast(err.message, true); restore(); });
    });
  }).catch(function (err) { if (content.dataset.gen === __gen) renderError(content, err, function () { renderYearsView(content, true); }); });
}

// ===================== DATA PEJABAT (ADMIN) =====================
function renderPejabatView(content, forceRefresh) {
  var __gen = content.dataset.gen;
  callApiCached('pejabatAll', 'pejabat', 'list', {}, forceRefresh).then(function (pejabatList) {
    var html = '<h2>Data Pejabat</h2>' +
      '<p class="hint-text">Daftar orang yang berulang kali jadi KPA/PPK/Pejabat Pengadaan -- dipilih lewat dropdown saat mengisi Satker atau Paket, supaya tidak perlu ketik ulang nama &amp; NIP yang sama.</p>' +
      '<p>' + refreshButtonHtml() + '</p>';

    if (currentUser.role === 'ADMIN') {
      html += '<form id="form-add-pejabat" class="inline-form">' +
        '<input id="input-pj-nama" data-uppercase placeholder="Nama" required> ' +
        '<input id="input-pj-nip" data-nip inputmode="numeric" maxlength="18" placeholder="NIP (18 digit, opsional)"> ' +
        '<input id="input-pj-jabatan" placeholder="Jabatan (mis. Kepala Kantor)"> ' +
        '<button type="submit">Tambah</button></form>';
    }

    html += '<table class="data-table"><thead><tr><th>Nama</th><th>NIP</th><th>Jabatan</th><th>Status</th>' +
      (currentUser.role === 'ADMIN' ? '<th></th>' : '') + '</tr></thead><tbody>';
    pejabatList.forEach(function (p) {
      html += '<tr><td>' + escapeHtml(p.nama) + '</td><td>' + escapeHtml(p.nip || '-') + '</td><td>' + escapeHtml(p.jabatan || '-') + '</td>' +
        '<td><span class="badge ' + (p.status === 'AKTIF' ? 'badge-complete' : 'badge-netral') + '">' + escapeHtml(p.status) + '</span></td>';
      if (currentUser.role === 'ADMIN') {
        html += '<td><button type="button" class="btn-danger-text" data-toggle-pejabat="' + escapeHtml(p.pejabat_id) + '" data-current-status="' + escapeHtml(p.status) + '">' +
          (p.status === 'AKTIF' ? 'Nonaktifkan' : 'Aktifkan') + '</button></td>';
      }
      html += '</tr>';
    });
    html += '</tbody></table>';

    if (content.dataset.gen !== __gen) return;
    content.innerHTML = html;
    attachRefreshButtonHandler(content, renderPejabatView);

    var form = document.getElementById('form-add-pejabat');
    if (form) form.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = form.querySelector('button[type="submit"]');
      var restore = setButtonBusy(btn, 'Menyimpan...');
      callApi('pejabat', 'create', {
        nama: document.getElementById('input-pj-nama').value,
        nip: document.getElementById('input-pj-nip').value,
        jabatan: document.getElementById('input-pj-jabatan').value
      }).then(function () {
        showToast('Pejabat ditambahkan.');
        clearAllCache();
        renderPejabatView(content, true);
      }).catch(function (err) { showToast(err.message, true); restore(); });
    });

    content.querySelectorAll('[data-toggle-pejabat]').forEach(function (el) {
      el.addEventListener('click', function () {
        var statusBaru = el.getAttribute('data-current-status') === 'AKTIF' ? 'NONAKTIF' : 'AKTIF';
        callApi('pejabat', 'setStatus', { pejabatId: el.getAttribute('data-toggle-pejabat'), status: statusBaru }).then(function () {
          showToast('Status pejabat diubah.');
          clearAllCache();
          renderPejabatView(content, true);
        }).catch(function (err) { showToast(err.message, true); });
      });
    });
  }).catch(function (err) { if (content.dataset.gen === __gen) renderError(content, err, function () { renderPejabatView(content, true); }); });
}

// ===================== PENGGUNA (ADMIN) =====================
function renderUsersView(content, forceRefresh) {
  var __gen = content.dataset.gen;
  callApiCached('users', 'users', 'list', {}, forceRefresh).then(function (users) {
    var html = '<h2>Pengguna</h2><p>' + refreshButtonHtml() + '</p>' +
      '<form id="form-add-user" class="inline-form">' +
      '<input id="input-u-nama" data-uppercase placeholder="Nama" required>' +
      '<input id="input-u-username" placeholder="Username" required><br>' +
      passwordFieldHtml('input-u-password', 'Password awal (min. 8 karakter)') +
      '<select id="input-u-role"><option value="PENGELOLA">Pengelola</option><option value="VIEWER">Viewer</option><option value="ADMIN">Admin</option></select>' +
      '<button type="submit">Tambah</button></form>' +
      '<table class="data-table"><thead><tr><th>Nama</th><th>Username</th><th>Role</th><th>Status</th><th>Login Terakhir</th><th></th></tr></thead><tbody>';
    users.forEach(function (u) {
      html += '<tr><td>' + escapeHtml(u.nama) + '</td><td>' + escapeHtml(u.username) + '</td>' +
        '<td>' + escapeHtml(u.role) + '</td><td><span class="badge">' + escapeHtml(u.status || 'AKTIF') + '</span></td>' +
        '<td>' + escapeHtml(u.lastLogin || '-') + '</td>' +
        '<td><button type="button" class="btn-secondary btn-reset-pw" data-user-id="' + escapeHtml(u.userId) + '" data-user-nama="' + escapeHtml(u.nama) + '">Reset Password</button></td></tr>';
    });
    html += '</tbody></table>';

    html += '<div id="reset-pw-panel" style="display:none;">' +
      '<h3>Reset Password: <span id="reset-pw-nama"></span></h3>' +
      '<form id="form-reset-pw" class="inline-form" style="max-width:340px;">' +
      passwordFieldHtml('input-reset-new', 'Password Baru (min. 8 karakter)') +
      passwordFieldHtml('input-reset-confirm', 'Ulangi Password Baru') +
      '<div id="reset-pw-error" class="error-text"></div>' +
      '<button type="submit">Simpan</button> ' +
      '<button type="button" id="btn-cancel-reset">Batal</button>' +
      '</form></div>';

    if (content.dataset.gen !== __gen) return;
    content.innerHTML = html;
    attachRefreshButtonHandler(content, renderUsersView);
    attachPasswordToggles(content);

    var targetUserId = null;
    content.querySelectorAll('.btn-reset-pw').forEach(function (btn) {
      btn.addEventListener('click', function () {
        targetUserId = btn.getAttribute('data-user-id');
        document.getElementById('reset-pw-nama').textContent = btn.getAttribute('data-user-nama');
        document.getElementById('reset-pw-panel').style.display = '';
        document.getElementById('reset-pw-panel').scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    });
    document.getElementById('btn-cancel-reset').addEventListener('click', function () {
      document.getElementById('reset-pw-panel').style.display = 'none';
      document.getElementById('form-reset-pw').reset();
    });

    document.getElementById('form-reset-pw').addEventListener('submit', function (e) {
      e.preventDefault();
      var errEl = document.getElementById('reset-pw-error');
      errEl.textContent = '';
      var newPw = document.getElementById('input-reset-new').value;
      var confirmPw = document.getElementById('input-reset-confirm').value;
      if (newPw !== confirmPw) {
        errEl.textContent = 'Ulangi password baru tidak sama dengan password baru.';
        return;
      }
      var btn = e.target.querySelector('button[type="submit"]');
      var restore = setButtonBusy(btn, 'Menyimpan...');
      callApi('users', 'resetPassword', { userId: targetUserId, newPassword: newPw }).then(function () {
        showToast('Password pengguna berhasil direset.');
        document.getElementById('reset-pw-panel').style.display = 'none';
        document.getElementById('form-reset-pw').reset();
        restore();
      }).catch(function (err) { errEl.textContent = err.message; restore(); });
    });

    var formAddUser = document.getElementById('form-add-user');
    formAddUser.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = formAddUser.querySelector('button[type="submit"]');
      var restore = setButtonBusy(btn, 'Menyimpan...');
      callApi('users', 'create', {
        nama: document.getElementById('input-u-nama').value,
        username: document.getElementById('input-u-username').value,
        password: document.getElementById('input-u-password').value,
        role: document.getElementById('input-u-role').value
      }).then(function () {
        showToast('Pengguna ditambahkan.');
        clearAllCache();
        renderUsersView(content, true);
      }).catch(function (err) { showToast(err.message, true); restore(); });
    });
  }).catch(function (err) { if (content.dataset.gen === __gen) renderError(content, err, function () { renderUsersView(content, true); }); });
}

// ===================== ASSIGNMENT (ADMIN) =====================
function renderAssignmentsView(content, forceRefresh) {
  var __gen = content.dataset.gen;
  Promise.all([
    callApiCached('users', 'users', 'list', {}, forceRefresh),
    callApiCached('satkers:none', 'satkers', 'list', {}, forceRefresh),
    callApiCached('years', 'years', 'list', {}, forceRefresh),
    callApiCached('assignments:all', 'assignments', 'list', {}, forceRefresh)
  ]).then(function (results) {
    var users = results[0], satkers = results[1], years = results[2], assignments = results[3];

    if (users.length === 0 || satkers.length === 0 || years.length === 0) {
      if (content.dataset.gen !== __gen) return;
      content.innerHTML = '<h2>Assignment Satker</h2><p>' + refreshButtonHtml() + '</p><p>Buat dulu minimal satu Pengguna, satu Satker, dan satu Tahun Anggaran sebelum membuat assignment.</p>';
      attachRefreshButtonHandler(content, renderAssignmentsView);
      return;
    }

    var opt = function (list, valueKey, labelKey) {
      return list.map(function (item) {
        return '<option value="' + escapeHtml(item[valueKey]) + '">' + escapeHtml(item[labelKey]) + '</option>';
      }).join('');
    };

    var html = '<h2>Assignment Satker</h2><p>' + refreshButtonHtml() + '</p>' +
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
    if (content.dataset.gen !== __gen) return;
    content.innerHTML = html;
    attachRefreshButtonHandler(content, renderAssignmentsView);

    document.getElementById('form-add-assignment').addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = e.target.querySelector('button[type="submit"]');
      var restore = setButtonBusy(btn, 'Menyimpan...');
      callApi('assignments', 'create', {
        userId: document.getElementById('input-a-user').value,
        satkerId: document.getElementById('input-a-satker').value,
        tahunAnggaranId: document.getElementById('input-a-tahun').value
      }).then(function () {
        showToast('Assignment dibuat.');
        clearAllCache();
        renderAssignmentsView(content, true);
      }).catch(function (err) { showToast(err.message, true); restore(); });
    });
  }).catch(function (err) { if (content.dataset.gen === __gen) renderError(content, err, function () { renderAssignmentsView(content, true); }); });
}

// ===================== AUDIT LOG (ADMIN) =====================
function renderAuditView(content, forceRefresh) {
  var __gen = content.dataset.gen;
  callApiCached('audit', 'audit', 'list', {}, forceRefresh).then(function (logs) {
    var html = '<h2>Audit Log</h2><p>' + refreshButtonHtml() + '</p><p>Menampilkan hingga 200 aktivitas terbaru.</p>' +
      '<table class="data-table"><thead><tr><th>Waktu</th><th>Aksi</th><th>Modul</th><th>Keterangan</th></tr></thead><tbody>';
    logs.forEach(function (l) {
      html += '<tr><td>' + escapeHtml(l.timestamp) + '</td><td>' + escapeHtml(l.action) + '</td>' +
        '<td>' + escapeHtml(l.module) + '</td><td>' + escapeHtml(l.description) + '</td></tr>';
    });
    html += '</tbody></table>';
    if (content.dataset.gen !== __gen) return;
    content.innerHTML = html;
    attachRefreshButtonHandler(content, renderAuditView);
  }).catch(function (err) { if (content.dataset.gen === __gen) renderError(content, err, function () { renderAuditView(content, true); }); });
}

// ===================== GANTI PASSWORD (SEMUA ROLE) =====================
function renderProfileView(content) {
  var __gen = content.dataset.gen;
  content.innerHTML =
    '<h2>Ganti Password</h2>' +
    '<form id="form-change-password" class="inline-form" style="max-width:340px;">' +
    passwordFieldHtml('input-old-password', 'Password Lama') +
    passwordFieldHtml('input-new-password', 'Password Baru (min. 8 karakter)') +
    passwordFieldHtml('input-confirm-password', 'Ulangi Password Baru') +
    '<div id="profile-error" class="error-text"></div>' +
    '<button type="submit">Simpan Password Baru</button>' +
    '</form>';

  attachPasswordToggles(content);

  document.getElementById('form-change-password').addEventListener('submit', function (e) {
    e.preventDefault();
    var errEl = document.getElementById('profile-error');
    errEl.textContent = '';
    var newPassword = document.getElementById('input-new-password').value;
    var confirmPassword = document.getElementById('input-confirm-password').value;

    if (newPassword !== confirmPassword) {
      errEl.textContent = 'Ulangi password baru tidak sama dengan password baru.';
      return;
    }

    var btn = e.target.querySelector('button[type="submit"]');
    var restore = setButtonBusy(btn, 'Menyimpan...');
    callApi('auth', 'changePassword', {
      oldPassword: document.getElementById('input-old-password').value,
      newPassword: newPassword
    }).then(function () {
      showToast('Password berhasil diganti.');
      document.getElementById('form-change-password').reset();
      restore();
    }).catch(function (err) {
      errEl.textContent = err.message;
      restore();
    });
  });
}

checkExistingSession();