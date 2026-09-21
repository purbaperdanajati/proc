/* SIPADU - boot aplikasi. */
(function (w) {
  'use strict';
  if (!Auth.guard()) return;
  var C = w.CONFIG;

  var ICON = {
    beranda: 'M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5',
    satker: 'M3 21h18M5 21V7l7-4 7 4v14M9 21v-5h6v5',
    penugasan: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
    paket: 'M4 7h16v13H4zM4 7l2-3h12l2 3M9 12h6',
    penyedia: 'M3 20h18M6 20V9l6-4 6 4v11M10 20v-4h4v4',
    pejabat: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1',
    pengguna: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.87',
    pengaturan: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7.5 19l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 7.5l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 2.7-1.1V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z'
  };
  function ikon(n) {
    return el('span', {
      html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" ' +
        'stroke-linecap="round" stroke-linejoin="round"><path d="' + (ICON[n] || '') + '"/></svg>'
    });
  }

  var MENU = [
    { grup: 'Pekerjaan' },
    { id: 'beranda', label: 'Beranda' },
    { id: 'paket', label: 'Paket pengadaan' },
    { id: 'satker', label: 'Satuan kerja' },
    { id: 'penugasan', label: 'Penugasan & pagu' },
    { grup: 'Basis data' },
    { id: 'penyedia', label: 'Penyedia' },
    { id: 'pejabat', label: 'Pejabat' },
    { id: 'pengguna', label: 'Pengguna', admin: true },
    { id: 'pengaturan', label: 'Pengaturan', admin: true }
  ];

  var App = {
    state: { user: Auth.user(), tahun: localStorage.getItem('sipadu.tahun') || String(new Date().getFullYear()), master: null },

    /* pencarian cepat berbasis peta id */
    peta: { satker: {}, pejabat: {}, penyedia: {}, users: {} },
    satker: function (id) { return App.peta.satker[id] || null; },
    pejabat: function (id) { return App.peta.pejabat[id] || null; },
    penyedia: function (id) { return App.peta.penyedia[id] || null; },
    pengguna: function (id) { return App.peta.users[id] || null; },
    namaSatker: function (id) { var s = App.satker(id); return s ? s.nama : '—'; },

    jenis: function (id) {
      var j = C.JENIS_PENGADAAN.filter(function (x) { return x.id === id; })[0];
      return j || { id: id, nama: id || '—', rab: false };
    },

    setJudul: function (t, sub) {
      clear($('#judul'));
      $('#judul').appendChild(document.createTextNode(t));
      if (sub) $('#judul').appendChild(el('span.sub', { text: sub }));
      document.title = t + ' — SIPADU';
    },
    alat: function (nodes) {
      var box = clear($('#alat-atas'));
      (nodes || []).forEach(function (n) { if (n) box.appendChild(n); });
    },

    /* data master sekali muat, dipakai seluruh halaman */
    muat: function (paksa) {
      if (App.state.master && !paksa) return Promise.resolve(App.state.master);
      var cache = paksa ? null : Store.get('master.' + App.state.tahun, C.CACHE_TTL);
      var p = cache ? Promise.resolve(cache) : API.call('bootstrap', { tahun: App.state.tahun });
      return p.then(function (m) {
        Store.set('master.' + App.state.tahun, m);
        App.state.master = m;
        App.peta = { satker: {}, pejabat: {}, penyedia: {}, users: {} };
        ['satker', 'pejabat', 'penyedia', 'users'].forEach(function (k) {
          (m[k] || []).forEach(function (r) { App.peta[k === 'users' ? 'users' : k][r.id] = r; });
        });
        return m;
      });
    },
    segarkan: function () {
      Store.dropAll();
      return App.muat(true).then(function () {
        w.dispatchEvent(new Event('hashchange'));
      });
    },
    gantiTahun: function (t) {
      App.state.tahun = String(t);
      localStorage.setItem('sipadu.tahun', App.state.tahun);
      App.state.master = null;
      App.muat(true).then(function () { w.dispatchEvent(new Event('hashchange')); });
    },

    /* satker yang boleh diakses pengguna pada tahun aktif */
    satkerSaya: function () {
      var m = App.state.master || {}, u = App.state.user;
      var tugas = (m.penugasan || []).filter(function (p) { return String(p.tahun) === App.state.tahun; });
      if (Auth.isAdmin()) return m.satker || [];
      var ids = {};
      tugas.forEach(function (p) { if (p.user_id === u.id) ids[p.satker_id] = 1; });
      return (m.satker || []).filter(function (s) { return ids[s.id]; });
    },
    tugas: function (satkerId, tahun) {
      var m = App.state.master || {};
      return (m.penugasan || []).filter(function (p) {
        return p.satker_id === satkerId && String(p.tahun) === String(tahun || App.state.tahun);
      })[0] || null;
    }
  };
  w.App = App;

  /* ---------- kerangka ---------- */
  function railMenu() {
    var nav = clear($('#nav'));
    MENU.forEach(function (m) {
      if (m.grup) return nav.appendChild(el('div.grup', { text: m.grup }));
      if (m.admin && !Auth.isAdmin()) return;
      nav.appendChild(el('a', { href: '#/' + m.id }, [ikon(m.id), m.label]));
    });
    var u = Auth.user();
    $('#who').textContent = u.nama || u.username;
    $('#peran').textContent = (u.role === 'admin' ? 'Admin sistem' : 'Pengelola satker') + ' · TA ' + App.state.tahun;
  }
  $('#burger').addEventListener('click', function () { document.body.classList.toggle('nav-buka'); });
  $('#keluar').addEventListener('click', function () {
    UI.confirm('Keluar dari SIPADU?', function () {
      API.call('logout', {}).catch(function () { }).then(function () { Auth.clear(); location.href = 'index.html'; });
    }, { yes: 'Keluar', kind: 'danger' });
  });

  /* pemilih tahun anggaran, selalu tampil di kanan atas */
  w.pilihTahun = function () {
    var m = App.state.master || {}, tahun = (m.tahun || []).map(function (t) { return String(t.id || t); });
    var kini = String(new Date().getFullYear());
    [kini, String(Number(kini) + 1)].forEach(function (t) { if (tahun.indexOf(t) < 0) tahun.push(t); });
    tahun.sort().reverse();
    var sel = el('select.inp', {
      style: 'width:auto;padding:6px 9px;font-size:13px',
      'aria-label': 'Tahun anggaran',
      onchange: function () { App.gantiTahun(sel.value); }
    }, tahun.map(function (t) {
      return el('option', { value: t, selected: t === App.state.tahun }, 'TA ' + t);
    }));
    return sel;
  };

  /* ---------- rute ---------- */
  function daftarkan() {
    var P = w.Pages, K = w.PaketPage;
    Router.add('beranda', P.beranda)
      .add('satker', P.satker)
      .add('penugasan', P.penugasan)
      .add('penyedia', P.penyedia)
      .add('pejabat', P.pejabat)
      .add('pengguna', P.pengguna)
      .add('pengaturan', P.pengaturan)
      .add('paket', function (host, ctx) { return ctx.id ? K.detail(host, ctx) : K.daftar(host, ctx); });
  }

  railMenu();
  App.muat().then(function () {
    railMenu();
    daftarkan();
    Router.start(w.Pages.beranda);
  }).catch(function (e) {
    clear($('#view')).appendChild(UI.empty(
      'Tidak dapat menghubungi server',
      e.message + ' — periksa alamat Web App dan pastikan deployment terbaru sudah dipublikasikan.',
      el('div.baris', { style: 'justify-content:center' }, [
        el('button.btn.primary', { onclick: function () { location.reload(); } }, 'Muat ulang'),
        el('button.btn', { onclick: function () { Auth.clear(); location.href = 'index.html'; } }, 'Ganti alamat server')
      ])
    ));
  });
})(window);
