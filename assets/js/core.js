/* SIPADU - inti: DOM, transport, cache, sesi, router, komponen UI.
   Tanpa framework, tanpa dependensi luar. */
(function (w) {
  'use strict';
  var C = w.CONFIG;

  /* ---------- DOM ---------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function el(tag, attrs, kids) {
    var parts = tag.split(/([.#])/), node = document.createElement(parts[0] || 'div');
    for (var i = 1; i < parts.length; i += 2) {
      if (parts[i] === '.') node.classList.add(parts[i + 1]);
      else node.id = parts[i + 1];
    }
    if (attrs) for (var k in attrs) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) continue;
      if (k === 'html') node.innerHTML = v;
      else if (k === 'text') node.textContent = v;
      else if (k === 'class') node.className += (node.className ? ' ' : '') + v;
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else if (k === 'dataset') { for (var d in v) node.dataset[d] = v[d]; }
      else node.setAttribute(k, v);
    }
    (Array.isArray(kids) ? kids : kids != null ? [kids] : []).forEach(function (c) {
      if (c === null || c === undefined || c === false) return;
      node.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c)));
    });
    return node;
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); return node; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }

  /* ---------- format ---------- */
  var BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli',
    'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  var HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

  var Fmt = {
    num: function (n, dec) {
      n = Number(n) || 0;
      return n.toLocaleString('id-ID', { minimumFractionDigits: dec || 0, maximumFractionDigits: dec == null ? 2 : dec });
    },
    rp: function (n) { return 'Rp ' + Fmt.num(Math.round(Number(n) || 0), 0); },
    rpShort: function (n) {
      n = Number(n) || 0;
      if (n >= 1e9) return 'Rp ' + Fmt.num(n / 1e9, 2) + ' M';
      if (n >= 1e6) return 'Rp ' + Fmt.num(n / 1e6, 1) + ' jt';
      return Fmt.rp(n);
    },
    parseNum: function (s) {
      if (typeof s === 'number') return s;
      if (!s && s !== 0) return 0;
      s = String(s).replace(/[^\d,.\-]/g, '');
      if (!s || s === '-' || s === '.' || s === ',') return 0;
      var hasKoma = s.indexOf(',') > -1, hasTitik = s.indexOf('.') > -1;
      if (hasKoma && hasTitik) {
        if (s.lastIndexOf(',') > s.lastIndexOf('.')) { s = s.replace(/\./g, '').replace(/,/g, '.'); }
        else { s = s.replace(/,/g, ''); }
        var ps = s.split('.');
        if (ps.length > 2) s = ps.slice(0, -1).join('') + '.' + ps[ps.length - 1];
      } else if (hasKoma) {
        if (/^-?\d{1,3}(,\d{3})+$/.test(s)) s = s.replace(/,/g, '');
        else {
          s = s.replace(/,/g, '.');
          var ks = s.split('.');
          if (ks.length > 2) s = ks.slice(0, -1).join('') + '.' + ks[ks.length - 1];
        }
      } else if (hasTitik) {
        var nTitik = (s.match(/\./g) || []).length;
        if (nTitik > 1) { s = s.replace(/\./g, ''); }
        else if (/^-?\d{1,3}\.\d{3}$/.test(s)) { s = s.replace(/\./g, ''); }
        else {
          var bel = (s.split('.')[1] || '');
          if (bel.length >= 3) s = s.replace(/\./g, '');
        }
      }
      var n = parseFloat(s);
      return isNaN(n) ? 0 : n;
    },
    tanggal: function (v) {
      var d = Fmt.toDate(v); if (!d) return '-';
      return d.getDate() + ' ' + BULAN[d.getMonth()] + ' ' + d.getFullYear();
    },
    tanggalHari: function (v) {
      var d = Fmt.toDate(v); if (!d) return '-';
      return HARI[d.getDay()] + ', ' + Fmt.tanggal(d);
    },
    iso: function (v) {
      var d = Fmt.toDate(v); if (!d) return '';
      return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    },
    toDate: function (v) {
      if (!v) return null;
      if (v instanceof Date) return isNaN(v) ? null : v;
      var d = new Date(v);
      return isNaN(d) ? null : d;
    },
    bytes: function (n) {
      n = Number(n) || 0;
      if (n > 1048576) return Fmt.num(n / 1048576, 1) + ' MB';
      if (n > 1024) return Fmt.num(n / 1024, 0) + ' KB';
      return n + ' B';
    },
    terbilang: function (n) {
      n = Math.floor(Math.abs(Number(n) || 0));
      var satuan = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas'];
      function rec(x) {
        if (x < 12) return satuan[x];
        if (x < 20) return rec(x - 10) + ' belas';
        if (x < 100) return rec(Math.floor(x / 10)) + ' puluh' + (x % 10 ? ' ' + rec(x % 10) : '');
        if (x < 200) return 'seratus' + (x % 100 ? ' ' + rec(x % 100) : '');
        if (x < 1000) return rec(Math.floor(x / 100)) + ' ratus' + (x % 100 ? ' ' + rec(x % 100) : '');
        if (x < 2000) return 'seribu' + (x % 1000 ? ' ' + rec(x % 1000) : '');
        if (x < 1e6) return rec(Math.floor(x / 1000)) + ' ribu' + (x % 1000 ? ' ' + rec(x % 1000) : '');
        if (x < 1e9) return rec(Math.floor(x / 1e6)) + ' juta' + (x % 1e6 ? ' ' + rec(x % 1e6) : '');
        if (x < 1e12) return rec(Math.floor(x / 1e9)) + ' miliar' + (x % 1e9 ? ' ' + rec(x % 1e9) : '');
        return rec(Math.floor(x / 1e12)) + ' triliun' + (x % 1e12 ? ' ' + rec(x % 1e12) : '');
      }
      if (n === 0) return 'nol';
      return rec(n).replace(/\s+/g, ' ').trim();
    },
    kapital: function (s) {
      return String(s || '').replace(/\b\w/g, function (m) { return m.toUpperCase(); });
    },
    hariText: function (v) { var d = Fmt.toDate(v); return d ? HARI[d.getDay()] : ''; },
    bulanText: function (i) { return BULAN[i]; }
  };
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  /* ---------- transport ----------
     Apps Script tidak menangani preflight OPTIONS. Karena itu permintaan
     dikirim sebagai "simple request": POST + Content-Type text/plain.
     Bila fetch gagal (jaringan menyaring POST lintas domain), aksi baca
     otomatis dicoba ulang lewat JSONP yang tidak pernah kena CORS. */
  var API = {
    url: function () {
      return localStorage.getItem(C.API_KEY) || C.API_URL || '';
    },
    setUrl: function (u) { localStorage.setItem(C.API_KEY, (u || '').trim()); },
    busy: 0,
    _bar: null,
    _tick: function (delta) {
      API.busy = Math.max(0, API.busy + delta);
      if (!API._bar) API._bar = $('#bar');
      if (API._bar) API._bar.classList.toggle('on', API.busy > 0);
    },
    call: function (action, data, opt) {
      opt = opt || {};
      var url = API.url();
      if (!url) return Promise.reject(new Error('URL server belum diisi.'));
      var body = JSON.stringify({ action: action, token: Auth.token(), data: data || {} });
      var tries = opt.retry == null ? 2 : opt.retry;
      API._tick(1);

      function attempt(n) {
        return fetch(url, {
          method: 'POST',
          redirect: 'follow',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: body
        }).then(function (r) {
          if (!r.ok) throw new Error('Server menjawab ' + r.status);
          return r.text();
        }).then(function (t) {
          var j;
          try { j = JSON.parse(t); }
          catch (e) { throw new Error('Balasan server tidak dikenali. Pastikan URL berakhiran /exec.'); }
          if (!j.ok) {
            var err = new Error(j.error || 'Permintaan ditolak');
            err.code = j.code;
            throw err;
          }
          return j.data;
        }).catch(function (e) {
          if (e.code) throw e;                       // error logika, jangan diulang
          if (n < tries) return wait(350 * (n + 1)).then(function () { return attempt(n + 1); });
          if (opt.jsonp !== false && JSON.stringify(data || {}).length < 1500) return API.jsonp(action, data);
          throw e;
        });
      }
      return attempt(0)
        .then(function (r) { API._tick(-1); return r; })
        .catch(function (e) {
          API._tick(-1);
          if (e.code === 'AUTH') Auth.expire();
          throw e;
        });
    },
    jsonp: function (action, data) {
      return new Promise(function (res, rej) {
        var cb = 'sp_' + Math.random().toString(36).slice(2), s = document.createElement('script');
        var t = setTimeout(function () { cleanup(); rej(new Error('Server tidak menjawab.')); }, 25000);
        function cleanup() { clearTimeout(t); delete w[cb]; if (s.parentNode) s.parentNode.removeChild(s); }
        w[cb] = function (j) {
          cleanup();
          if (j && j.ok) res(j.data);
          else { var e = new Error((j && j.error) || 'Permintaan ditolak'); e.code = j && j.code; rej(e); }
        };
        s.onerror = function () { cleanup(); rej(new Error('Server tidak dapat dihubungi.')); };
        s.src = API.url() + '?callback=' + cb + '&action=' + encodeURIComponent(action) +
          '&token=' + encodeURIComponent(Auth.token() || '') +
          '&data=' + encodeURIComponent(JSON.stringify(data || {}));
        document.body.appendChild(s);
      });
    }
  };
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  /* ---------- cache lokal ---------- */
  var Store = {
    get: function (key, maxAge) {
      try {
        var raw = sessionStorage.getItem('sipadu.' + key); if (!raw) return null;
        var o = JSON.parse(raw);
        if (maxAge && Date.now() - o.t > maxAge) return null;
        return o.v;
      } catch (e) { return null; }
    },
    set: function (key, val) {
      try { sessionStorage.setItem('sipadu.' + key, JSON.stringify({ t: Date.now(), v: val })); } catch (e) { }
      return val;
    },
    drop: function (key) { sessionStorage.removeItem('sipadu.' + key); },
    dropAll: function () {
      Object.keys(sessionStorage).forEach(function (k) { if (k.indexOf('sipadu.') === 0) sessionStorage.removeItem(k); });
    },
    /* baca cache dulu, perbarui di belakang layar */
    swr: function (key, loader, onFresh) {
      var cached = Store.get(key, C.CACHE_TTL);
      var p = loader().then(function (v) { Store.set(key, v); if (cached && onFresh) onFresh(v); return v; });
      return cached ? Promise.resolve(cached) : p;
    }
  };

  /* ---------- sesi ---------- */
  var Auth = {
    session: null,
    load: function () {
      if (Auth.session) return Auth.session;
      try { Auth.session = JSON.parse(localStorage.getItem(C.SESSION_KEY) || 'null'); } catch (e) { Auth.session = null; }
      return Auth.session;
    },
    save: function (s) { Auth.session = s; localStorage.setItem(C.SESSION_KEY, JSON.stringify(s)); },
    token: function () { var s = Auth.load(); return s ? s.token : ''; },
    user: function () { var s = Auth.load(); return s ? s.user : null; },
    isAdmin: function () { var u = Auth.user(); return !!u && u.role === 'admin'; },
    clear: function () { Auth.session = null; localStorage.removeItem(C.SESSION_KEY); Store.dropAll(); },
    expire: function () {
      Auth.clear();
      if (location.pathname.indexOf('index.html') < 0) location.href = 'index.html?s=habis';
    },
    guard: function () {
      var s = Auth.load();
      if (!s || !s.token || (s.exp && Date.now() > s.exp)) { Auth.expire(); return false; }
      return true;
    }
  };

  /* ---------- komponen UI ---------- */
  var UI = {
    toast: function (msg, kind) {
      var box = $('#toast') || document.body.appendChild(el('div#toast'));
      var t = el('div.toast' + (kind ? '.' + kind : ''), { text: msg });
      box.appendChild(t);
      setTimeout(function () { t.classList.add('out'); setTimeout(function () { t.remove(); }, 250); }, kind === 'bad' ? 5200 : 3000);
    },
    err: function (e) { UI.toast(e && e.message ? e.message : String(e), 'bad'); },

    modal: function (opt) {
      var body = typeof opt.body === 'string' ? el('div', { html: opt.body }) : opt.body;
      var foot = el('footer.modal-foot');
      var wrap = el('div.modal-bg', { onclick: function (e) { if (e.target === wrap && opt.dismiss !== false) close(); } }, [
        el('div.modal', { role: 'dialog', 'aria-modal': 'true' }, [
          el('header.modal-head', null, [
            el('h2', { text: opt.title || '' }),
            el('button.icon', { type: 'button', title: 'Tutup', onclick: close, html: '&times;' })
          ]),
          el('div.modal-body', null, [body]),
          foot
        ])
      ]);
      (opt.actions || [{ label: 'Tutup' }]).forEach(function (a) {
        foot.appendChild(el('button', {
          type: 'button', class: 'btn ' + (a.kind || 'ghost'),
          onclick: function () { if (!a.onclick || a.onclick(close) !== false) if (a.close !== false) close(); }
        }, a.label));
      });
      function close() { wrap.classList.add('out'); setTimeout(function () { wrap.remove(); }, 160); document.removeEventListener('keydown', key); }
      function key(e) { if (e.key === 'Escape' && opt.dismiss !== false) close(); }
      document.addEventListener('keydown', key);
      document.body.appendChild(wrap);
      var f = wrap.querySelector('input,select,textarea,button.primary'); if (f) f.focus();
      return { close: close, node: wrap };
    },

    confirm: function (msg, onYes, opt) {
      opt = opt || {};
      UI.modal({
        title: opt.title || 'Konfirmasi',
        body: el('p', { text: msg }),
        actions: [
          { label: 'Batal' },
          { label: opt.yes || 'Lanjutkan', kind: opt.kind || 'primary', onclick: function () { onYes(); } }
        ]
      });
    },

    field: function (o) {
      var id = 'f_' + (o.name || Math.random().toString(36).slice(2));
      var input;
      if (o.type === 'select') {
        input = el('select', { id: id, name: o.name, required: o.required });
        (o.options || []).forEach(function (op) {
          input.appendChild(el('option', { value: op.value, selected: String(op.value) === String(o.value) }, op.label));
        });
      } else if (o.type === 'textarea') {
        input = el('textarea', { id: id, name: o.name, rows: o.rows || 3, required: o.required, placeholder: o.placeholder || '' });
        input.value = o.value == null ? '' : o.value;
      } else {
        var t = o.type || 'text';
        /* format ribuan otomatis untuk field nominal (o.format === 'rp') */
        if (o.format === 'rp') t = 'text';
        var at = {
          id: id, name: o.name, type: t, required: o.required,
          placeholder: o.placeholder || '', step: o.step, min: o.min, max: o.max,
          autocomplete: o.autocomplete || 'off', inputmode: o.format === 'rp' ? 'numeric' : (o.inputmode || undefined)
        };
        if (o.attr) for (var a in o.attr) at[a] = o.attr[a];
        input = el('input', at);
        input.value = o.value == null ? '' : (o.format === 'rp' ? Fmt.num(Number(o.value) || 0, 0) : o.value);
        if (o.format === 'rp') {
          (function (input) {
            input.style.textAlign = 'right';
            function sync() { input.dataset.angka = String(Fmt.parseNum(input.value)); }
            sync(); /* penting: isi dataset.angka SEKARANG juga (bukan cuma saat difokus/diketik),
                       supaya UI.formData tetap membaca angka mentah yang benar walau field ini
                       tidak pernah disentuh user sama sekali dalam sesi edit ini — sebelum ini,
                       field 'rp' yang tak tersentuh membuat formData mengirim teks berformat titik
                       ("50.000.000") alih-alih angka, sehingga nilainya salah/hilang saat disimpan. */
            input.addEventListener('input', function () {
              var awal = input.selectionStart, len = input.value.length;
              var baru = Fmt.num(Fmt.parseNum(input.value), 0);
              input.value = baru;
              sync();
              var pos = awal + (baru.length - len);
              try { input.setSelectionRange(pos, pos); } catch (e) { }
            });
            input.addEventListener('focus', sync);
            input.addEventListener('blur', function () {
              sync();
              if (!input.value) input.value = '';
            });
          })(input);
        }
      }
      if (o.readonly) input.setAttribute('readonly', 'readonly');
      if (o.oninput) input.addEventListener('input', o.oninput);
      if (o.onchange) input.addEventListener('change', o.onchange);
      return el('label.field' + (o.wide ? '.wide' : ''), null, [
        el('span.lbl', { text: o.label }),
        input,
        o.hint ? el('small.hint', { text: o.hint }) : null
      ]);
    },
    val: function (form, name) {
      var n = form.elements[name];
      return n ? (n.type === 'checkbox' ? n.checked : n.value.trim()) : '';
    },
    formData: function (form) {
      var o = {};
      Array.prototype.forEach.call(form.elements, function (n) {
        if (!n.name) return;
        var v = n.type === 'checkbox' ? n.checked : n.value;
        /* field berformat ribuan dikembalikan sebagai angka mentah */
        if (n.dataset && n.dataset.angka != null) v = String(n.value).trim() === '' ? '' : Fmt.parseNum(n.dataset.angka);
        o[n.name] = v;
      });
      return o;
    },

    /* ubah tombol jadi "Menyimpan…" + spinner selama proses; kembalikan fungsi pemulih */
    busy: function (btn, teks) {
      if (!btn) return function () { };
      var asli = btn.textContent, disable = btn.disabled;
      btn.disabled = true;
      btn.classList.add('proses');
      btn.innerHTML = '<span class="spin"></span> ' + esc(teks || 'Menyimpan…');
      return function () { btn.disabled = disable; btn.classList.remove('proses'); btn.textContent = asli; };
    },

    empty: function (judul, pesan, aksi) {
      return el('div.empty', null, [
        el('p.empty-t', { text: judul }),
        el('p.empty-p', { text: pesan }),
        aksi || null
      ]);
    },
    loading: function (t) { return el('div.loading', { text: t || 'Memuat…' }); },
    badge: function (text, kind) { return el('span.badge' + (kind ? '.' + kind : ''), { text: text }); },

    /* pita kelengkapan 13 dokumen */
    pita: function (adaMap, paket) {
      var wrap = el('div.pita', { title: 'Kelengkapan 13 dokumen' });
      C.DOKUMEN.forEach(function (d) {
        var perlu = !d.bersyarat || (paket && paket[d.bersyarat]);
        var ada = adaMap[d.kode];
        wrap.appendChild(el('i.seg' + (!perlu ? '.na' : ada ? '.ok' : ''), {
          title: d.kode + '. ' + d.nama + (perlu ? (ada ? ' — ada' : ' — belum') : ' — tidak diperlukan')
        }));
      });
      return wrap;
    },

    /* tabel ringan: render sekali lewat fragment, tanpa re-render per baris */
    table: function (kolom, baris, opt) {
      opt = opt || {};
      var thead = el('thead', null, [el('tr', null, kolom.map(function (k) {
        return el('th' + (k.num ? '.num' : ''), { text: k.label, style: k.w ? 'width:' + k.w : null });
      }))]);
      var tbody = el('tbody'), frag = document.createDocumentFragment();
      baris.forEach(function (row, i) {
        var tr = el('tr', opt.onrow ? { tabindex: '0', class: 'klik', onclick: function () { opt.onrow(row); },
          onkeydown: function (e) { if (e.key === 'Enter') opt.onrow(row); } } : null);
        kolom.forEach(function (k) {
          var v = k.render ? k.render(row, i) : row[k.key];
          tr.appendChild(el('td' + (k.num ? '.num' : ''), typeof v === 'object' && v ? null : { text: v == null ? '' : v },
            typeof v === 'object' && v ? [v] : null));
        });
        frag.appendChild(tr);
      });
      tbody.appendChild(frag);
      return el('div.tabel-wrap', null, [el('table.tabel', null, [thead, tbody])]);
    },

    /* pratinjau berkas Google Drive dalam modal iframe */
    drivePreview: function (file) {
      if (!file) return;
      var fid = file.file_id || file.id;
      if (!fid) return UI.toast('Berkas tidak memiliki ID Drive', 'bad');
      var mime = (file.mime || file.nama_file || '').toLowerCase();
      var src;
      /* gambar langsung tampil; pdf & dokumen lain memakai pratinjau Drive */
      if (/image\/(png|jpe?g|gif|webp)/.test(mime) || /\.(png|jpe?g|gif|webp)$/.test(mime)) {
        src = 'https://drive.google.com/thumbnail?id=' + fid + '&sz=w1200';
      } else {
        src = 'https://drive.google.com/file/d/' + fid + '/preview';
      }
      var box = el('div');
      box.style.cssText = 'position:relative;padding-top:70%;background:#f2f5f0;border-radius:8px;overflow:hidden';
      var ifr = el('iframe', {
        src: src, style: 'position:absolute;inset:0;width:100%;height:100%;border:0',
        allow: 'autoplay', loading: 'lazy'
      });
      box.appendChild(ifr);
      var modal = UI.modal({
        title: 'Pratinjau: ' + (file.nama_file || file.nama || 'berkas'),
        body: box,
        actions: [
          { label: 'Buka di Drive', onclick: function () { window.open('https://drive.google.com/file/d/' + fid + '/view', '_blank'); return false; } },
          { label: 'Tutup', kind: 'primary' }
        ]
      });
      return modal;
    }
  };

  /* ---------- router hash ---------- */
  var Router = {
    routes: {},
    add: function (path, fn) { Router.routes[path] = fn; return Router; },
    go: function (path) { location.hash = '#' + path; },
    current: function () { return (location.hash || '#/').slice(1); },
    start: function (fallback) {
      function run() {
        var raw = Router.current(), q = raw.split('?'), path = q[0] || '/';
        var params = {};
        if (q[1]) q[1].split('&').forEach(function (kv) {
          var p = kv.split('='); params[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || '');
        });
        var seg = path.split('/').filter(Boolean), name = seg[0] || 'beranda';
        var fn = Router.routes[name] || fallback;
        $$('.nav a').forEach(function (a) { a.classList.toggle('aktif', a.getAttribute('href') === '#/' + name); });
        var host = $('#view');
        clear(host).appendChild(UI.loading());
        Promise.resolve()
          .then(function () { return fn(host, { seg: seg, id: seg[1], params: params }); })
          .catch(function (e) {
            clear(host).appendChild(UI.empty('Halaman gagal dimuat', e.message || String(e),
              el('button.btn.primary', { onclick: run }, 'Coba lagi')));
          });
        if (w.innerWidth < 880) document.body.classList.remove('nav-buka');
      }
      w.addEventListener('hashchange', run);
      run();
    }
  };

  w.$ = $; w.$$ = $$; w.el = el; w.clear = clear; w.esc = esc;
  w.Fmt = Fmt; w.API = API; w.Store = Store; w.Auth = Auth; w.UI = UI; w.Router = Router;
  w.wait = wait;
})(window);