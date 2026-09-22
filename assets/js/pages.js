/* SIPADU - halaman data master dan ringkasan. */
(function (w) {
  'use strict';
  var C = w.CONFIG;

  /* ---------- unggahan berkas (dipakai dokumen paket & company profile) ---------- */
  function b64(buf) {
    var bytes = new Uint8Array(buf), bin = '', blok = 8192;
    for (var i = 0; i < bytes.length; i += blok) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + blok));
    }
    return btoa(bin);
  }
  function potong(file, a, b) {
    return new Promise(function (res, rej) {
      var fr = new FileReader();
      fr.onload = function () { res(b64(fr.result)); };
      fr.onerror = function () { rej(new Error('Berkas gagal dibaca.')); };
      fr.readAsArrayBuffer(file.slice(a, b));
    });
  }
  var Unggah = {
    kirim: function (file, meta, onProg) {
      if (file.size > C.MAX_UPLOAD_MB * 1048576)
        return Promise.reject(new Error('Ukuran berkas melebihi ' + C.MAX_UPLOAD_MB + ' MB. Perkecil atau pecah berkasnya.'));
      var info = { nama_file: file.name, mime: file.type || 'application/octet-stream', size: file.size };
      for (var k in meta) info[k] = meta[k];
      if (file.size <= C.CHUNK_SIZE) {
        return potong(file, 0, file.size).then(function (data) {
          if (onProg) onProg(0.6);
          info.data = data;
          return API.call('uploadOne', info, { jsonp: false, retry: 1 });
        });
      }
      var total = Math.ceil(file.size / C.CHUNK_SIZE);
      info.chunks = total;
      return API.call('uploadInit', info, { jsonp: false }).then(function (r) {
        var uid = r.uid, i = 0;
        function lanjut() {
          if (i >= total) return API.call('uploadFinish', { uid: uid }, { jsonp: false, retry: 1 });
          var a = i * C.CHUNK_SIZE;
          return potong(file, a, Math.min(file.size, a + C.CHUNK_SIZE)).then(function (data) {
            return API.call('uploadChunk', { uid: uid, i: i, data: data }, { jsonp: false, retry: 1 });
          }).then(function () {
            i++; if (onProg) onProg(i / total);
            return lanjut();
          });
        }
        return lanjut();
      });
    },
    /* dialog pilih berkas + bilah kemajuan */
    dialog: function (judul, meta, selesai, opsi) {
      opsi = opsi || {};
      var input = el('input', { type: 'file', accept: opsi.accept || '.pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.zip' });
      var ket = UI.field({ label: 'Keterangan (opsional)', name: 'ket', placeholder: 'mis. dokumentasi 0%' });
      var subSel = null;
      if (opsi.subs && opsi.subs.length) {
        subSel = UI.field({
          label: 'Tahap / bagian', name: 'sub', type: 'select',
          options: opsi.subs.map(function (s) { return { value: s, label: s }; })
        });
      }
      var bar = el('div.meter', { style: 'display:none' }, [el('i', { style: 'width:0%' })]);
      var isi = el('div.rapi', null, [
        el('div.field', null, [el('span.lbl', { text: 'Berkas' }), input]),
        subSel, ket, bar,
        el('p.mini', { text: 'Maksimal ' + C.MAX_UPLOAD_MB + ' MB. Berkas besar dikirim bertahap agar tidak putus di tengah jalan.' })
      ]);
      UI.modal({
        title: judul, body: isi,
        actions: [{ label: 'Batal' }, {
          label: 'Unggah', kind: 'primary', close: false,
          onclick: function (tutup) {
            var f = input.files[0];
            if (!f) { UI.toast('Pilih berkas lebih dulu', 'bad'); return false; }
            var m = {};
            for (var k in meta) m[k] = meta[k];
            m.keterangan = isi.querySelector('[name="ket"]').value;
            if (subSel) m.sub = isi.querySelector('[name="sub"]').value;
            bar.style.display = 'block';
            Unggah.kirim(f, m, function (p) { bar.firstChild.style.width = Math.round(p * 100) + '%'; })
              .then(function (row) { tutup(); UI.toast('Berkas tersimpan', 'ok'); selesai(row); })
              .catch(function (e) { bar.style.display = 'none'; UI.err(e); });
            return false;
          }
        }]
      });
    }
  };
  w.Unggah = Unggah;

  /* ---------- pembantu tampilan ---------- */
  function cariBox(placeholder, onCari) {
    var i = el('input.inp', { type: 'search', placeholder: placeholder, oninput: function () { onCari(i.value.toLowerCase()); } });
    return el('div.cari', null, [i]);
  }
  function cocok(row, q, kunci) {
    if (!q) return true;
    return kunci.some(function (k) { return String(row[k] || '').toLowerCase().indexOf(q) > -1; });
  }
  function formModal(judul, fields, nilai, simpan, opsi) {
    opsi = opsi || {};
    var form = el('form.' + (opsi.kolom === 1 ? 'rapi' : 'grid2'), { onsubmit: function (e) { e.preventDefault(); } });
    fields.forEach(function (f) {
      var o = {}; for (var k in f) o[k] = f[k];
      o.value = nilai && nilai[f.name] != null ? nilai[f.name] : (f.value || '');
      form.appendChild(UI.field(o));
    });
    UI.modal({
      title: judul, body: form,
      actions: [{ label: 'Batal' }, {
        label: opsi.simpanLabel || 'Simpan', kind: 'primary', close: false,
        onclick: function (tutup) {
          var btn = (form.closest('.modal') || document).querySelector('.modal-foot .btn.primary');
          var data = UI.formData(form);
          var wajib = fields.filter(function (f) { return f.required && !String(data[f.name] || '').trim(); });
          if (wajib.length) { UI.toast('Lengkapi: ' + wajib[0].label, 'bad'); return false; }
          var selesai = UI.busy(btn);
          Promise.resolve(simpan(data, nilai)).then(function () { selesai(); tutup(); }).catch(function (e) { selesai(); UI.err(e); });
          return false;
        }
      }]
    });
    return form;
  }
  function simpanEntitas(entity, row) {
    return API.call('save', { entity: entity, row: row }, { jsonp: false }).then(function () {
      UI.toast('Tersimpan', 'ok');
      return App.segarkan();
    });
  }
  function hapusEntitas(entity, id, nama) {
    UI.confirm('Hapus "' + nama + '"? Data yang sudah dipakai paket sebaiknya dinonaktifkan saja.', function () {
      API.call('remove', { entity: entity, id: id }, { jsonp: false })
        .then(function () { UI.toast('Terhapus', 'ok'); return App.segarkan(); })
        .catch(UI.err);
    }, { yes: 'Hapus', kind: 'danger' });
  }
  function opsiDari(list, label) {
    return [{ value: '', label: '— pilih —' }].concat((list || []).map(function (r) {
      return { value: r.id, label: label ? label(r) : r.nama };
    }));
  }
  w.Bantu = { formModal: formModal, simpanEntitas: simpanEntitas, hapusEntitas: hapusEntitas, opsiDari: opsiDari, cariBox: cariBox, cocok: cocok };

  /* ---------- data paket (dipakai beranda & halaman paket) ---------- */
  function muatPaket(paksa) {
    var kunci = 'paket.' + App.state.tahun;
    var cache = paksa ? null : Store.get(kunci, C.CACHE_TTL);
    if (cache) return Promise.resolve(cache);
    return API.call('paketList', { tahun: App.state.tahun }).then(function (r) { return Store.set(kunci, r); });
  }
  w.muatPaket = muatPaket;

  function hitungLengkap(p) {
    var perlu = 0, ada = 0;
    C.DOKUMEN.forEach(function (d) {
      if (d.bersyarat && !p[d.bersyarat]) return;
      perlu++;
      if (p.dok && p.dok[d.kode]) ada++;
    });
    return { perlu: perlu, ada: ada, persen: perlu ? Math.round(ada / perlu * 100) : 0 };
  }
  w.hitungLengkap = hitungLengkap;

  var PANGKAT_OPSI = [
    '— pilih —',
    'Juru Muda / I/a',
    'Juru / I/b',
    'Juru Tingkat I / I/c',
    'Juru Tingkat I Lanjutan / I/d',
    'Pengatur Muda / II/a',
    'Pengatur / II/b',
    'Pengatur Tingkat I / II/c',
    'Pengatur Tingkat I Lanjutan / II/d',
    'Penata Muda / III/a',
    'Penata / III/b',
    'Penata Tingkat I / III/c',
    'Penata Tingkat I Lanjutan / III/d',
    'Pembina / IV/a',
    'Pembina Tingkat I / IV/b',
    'Pembina Utama Muda / IV/c',
    'Pembina Utama Madya / IV/d',
    'Pembina Utama / IV/e'
  ];

  var Pages = {};

  /* ================= BERANDA ================= */
  Pages.beranda = function (host) {
    App.setJudul('Beranda', 'Tahun anggaran ' + App.state.tahun);
    App.alat([w.pilihTahun(), el('button.btn.kecil', { onclick: function () { App.segarkan(); } }, 'Muat ulang data')]);

    return muatPaket().then(function (paket) {
      var satker = App.satkerSaya();
      var idSaya = {}; satker.forEach(function (s) { idSaya[s.id] = 1; });
      var milik = paket.filter(function (p) { return idSaya[p.satker_id]; });

      var pagu = 0, nilai = 0, lengkap = 0;
      milik.forEach(function (p) {
        pagu += Number(p.pagu) || 0; nilai += Number(p.nilai) || 0;
        if (hitungLengkap(p).persen === 100) lengkap++;
      });

      var kartu = el('div.grid4', { style: 'margin-bottom:22px' }, [
        el('div.stat', null, [el('div.k', { text: 'Satuan kerja' }), el('div.v', { text: satker.length }),
          el('div.n', { text: (App.state.master.penugasan || []).filter(function (t) { return String(t.tahun) === App.state.tahun && t.ada_pengadaan === false; }).length + ' ditandai tanpa pengadaan' })]),
        el('div.stat', null, [el('div.k', { text: 'Paket pengadaan' }), el('div.v', { text: milik.length }),
          el('div.n', { text: lengkap + ' sudah lengkap' })]),
        el('div.stat', null, [el('div.k', { text: 'Total pagu' }), el('div.v', { text: Fmt.rpShort(pagu) }),
          el('div.n', { text: 'Nilai kontrak ' + Fmt.rpShort(nilai) })]),
        el('div.stat', null, [el('div.k', { text: 'Kelengkapan berkas' }),
          el('div.v', { text: (milik.length ? Math.round(lengkap / milik.length * 100) : 0) + '%' }),
          el('div.n', { text: 'paket dengan 13 dokumen terpenuhi' })])
      ]);

      var baris = satker.map(function (s) {
        var ps = milik.filter(function (p) { return p.satker_id === s.id; });
        var t = App.tugas(s.id);
        var ada = {}, perlu = 0, punya = 0;
        ps.forEach(function (p) { var h = hitungLengkap(p); perlu += h.perlu; punya += h.ada; });
        var persen = perlu ? Math.round(punya / perlu * 100) : 0;
        return {
          s: s, t: t, paket: ps.length, persen: persen,
          pagu: ps.reduce(function (a, p) { return a + (Number(p.pagu) || 0); }, 0),
          tanpa: t && t.ada_pengadaan === false
        };
      }).sort(function (a, b) { return a.persen - b.persen || b.paket - a.paket; });

      var tabel = UI.table([
        { label: 'Satuan kerja', render: function (r) {
          return el('div', null, [el('span.tegas', { text: r.s.nama }),
            el('span.sub', { text: (r.s.kode_satker || 'kode belum diisi') + (r.t && r.t.sp_dipa ? ' · ' + r.t.sp_dipa : '') })]);
        } },
        { label: 'Pengelola', render: function (r) {
          var u = r.t && App.pengguna(r.t.user_id);
          return u ? u.nama : el('span.diam', { text: 'belum ditugaskan' });
        } },
        { label: 'Paket', num: true, render: function (r) { return r.tanpa ? UI.badge('tanpa pengadaan') : String(r.paket); } },
        { label: 'Pagu', num: true, render: function (r) { return Fmt.rpShort(r.pagu); } },
        { label: 'Kelengkapan', w: '190px', render: function (r) {
          if (r.tanpa) return el('span.diam', { text: '—' });
          if (!r.paket) return el('span.diam', { text: 'belum ada paket' });
          return el('div.baris', null, [
            el('div.meter' + (r.persen === 100 ? '.penuh' : ''), null, [el('i', { style: 'width:' + r.persen + '%' })]),
            el('span.mini', { text: r.persen + '%' })
          ]);
        } }
      ], baris, { onrow: function (r) { Router.go('/paket?satker=' + r.s.id); } });

      var kurang = milik.filter(function (p) { return hitungLengkap(p).persen < 100; })
        .sort(function (a, b) { return hitungLengkap(a).persen - hitungLengkap(b).persen; }).slice(0, 8);

      clear(host).appendChild(el('div', null, [
        kartu,
        el('div.kartu', { style: 'margin-bottom:22px' }, [
          el('header', null, [el('h2', { text: 'Satuan kerja yang Anda pegang' }),
            el('span.kanan.mini', { text: 'Klik baris untuk melihat paketnya' })]),
          baris.length ? tabel : UI.empty('Belum ada satker', 'Admin belum menugaskan satker untuk Anda pada TA ' + App.state.tahun + '.')
        ]),
        el('div.kartu', null, [
          el('header', null, [el('h2', { text: 'Paket yang berkasnya belum lengkap' })]),
          kurang.length ? UI.table([
            { label: 'Paket', render: function (p) {
              return el('div', null, [el('span.tegas', { text: p.nama }), el('span.sub', { text: App.namaSatker(p.satker_id) })]);
            } },
            { label: 'Kelengkapan', render: function (p) { return UI.pita(p.dok || {}, p); } },
            { label: '', num: true, render: function (p) { var h = hitungLengkap(p); return h.ada + '/' + h.perlu; } }
          ], kurang, { onrow: function (p) { Router.go('/paket/' + p.id); } })
            : el('div.badan', null, [el('p.diam', { text: 'Semua paket sudah lengkap. ' })])
        ])
      ]));
    });
  };

  /* ================= SATKER ================= */
  Pages.satker = function (host) {
    App.setJudul('Satuan kerja', 'Profil dipakai sebagai kop surat dokumen');
    var bolehTambah = Auth.isAdmin();
    App.alat([
      w.pilihTahun(),
      bolehTambah ? el('button.btn.primary.kecil', { onclick: function () { editSatker(null); } }, 'Tambah satker') : null
    ]);

    var q = '', jenis = '';
    var isi = el('div');
    function gambar() {
      var list = (Auth.isAdmin() ? App.state.master.satker : App.satkerSaya())
        .filter(function (s) { return (!jenis || s.jenis === jenis) && cocok(s, q, ['nama', 'kode_satker', 'singkatan', 'kecamatan']); })
        .sort(function (a, b) { return (a.jenis + a.nama).localeCompare(b.jenis + b.nama); });
      clear(isi).appendChild(list.length ? UI.table([
        { label: 'Nama', render: function (s) {
          return el('div', null, [el('span.tegas', { text: s.nama }),
            el('span.sub', { text: [s.alamat, s.kecamatan].filter(Boolean).join(', ') || 'alamat belum diisi' })]);
        } },
        { label: 'Jenis', render: function (s) { return UI.badge(s.jenis || '-'); } },
        { label: 'Kode satker', key: 'kode_satker' },
        { label: 'Kontak', render: function (s) {
          return el('div.tumpuk', null, [el('span', { text: s.telp || '-' }), el('span.sub', { text: s.email || '-' })]);
        } },
        { label: 'Kepala', key: 'kepala' },
        { label: '', render: function (s) {
          return el('div.baris', null, [
            el('button.btn.kecil', { onclick: function (e) { e.stopPropagation(); editSatker(s); } }, 'Ubah profil'),
            Auth.isAdmin() ? el('button.btn.kecil.danger', { onclick: function (e) { e.stopPropagation(); hapusEntitas('Satker', s.id, s.nama); } }, 'Hapus') : null
          ]);
        } }
      ], list) : UI.empty('Belum ada satker', 'Tambahkan satuan kerja, lalu lengkapi alamat dan kontaknya untuk kop surat.'));
    }

    function editSatker(s) {
      formModal(s ? 'Profil ' + s.nama : 'Satker baru', [
        { name: 'nama', label: 'Nama satuan kerja', required: true, wide: true, placeholder: 'MTs Negeri 4 Indramayu' },
        { name: 'kode_satker', label: 'Kode satker', placeholder: '573052' },
        { name: 'jenis', label: 'Jenis', type: 'select', options: C.JENIS_SATKER.map(function (j) { return { value: j, label: j }; }) },
        { name: 'singkatan', label: 'Singkatan', placeholder: 'MTsN 4' },
        { name: 'kepala', label: 'Nama kepala', placeholder: 'untuk penanda tangan SK' },
        { name: 'nip_kepala', label: 'NIP kepala' },
        { name: 'jabatan_kpa', label: 'Sebutan jabatan KPA', placeholder: 'Kepala Madrasah' },
        { name: 'alamat', label: 'Alamat', wide: true, placeholder: 'Jl. Raya Sumber Mas Ilir Kandanghaur' },
        { name: 'kecamatan', label: 'Kecamatan' },
        { name: 'kode_pos', label: 'Kode pos' },
        { name: 'telp', label: 'Telp/Fax' },
        { name: 'email', label: 'Email' },
        { name: 'website', label: 'Situs web', wide: true }
      ], s, function (data) {
        data.id = s ? s.id : '';
        return simpanEntitas('Satker', data).then(gambar);
      });
    }

    clear(host).appendChild(el('div', null, [
      el('div.filter', null, [
        cariBox('Cari nama, kode satker, kecamatan…', function (v) { q = v; gambar(); }),
        UI.field({ label: 'Jenis', type: 'select', name: 'j', options: [{ value: '', label: 'Semua' }].concat(C.JENIS_SATKER.map(function (j) { return { value: j, label: j }; })), onchange: function (e) { jenis = e.target.value; gambar(); } })
      ]),
      el('div.kartu', null, [isi])
    ]));
    gambar();
  };

  /* ================= PENUGASAN ================= */
  Pages.penugasan = function (host) {
    App.setJudul('Penugasan & pagu', 'Siapa memegang satker mana pada TA ' + App.state.tahun);
    App.alat([w.pilihTahun()]);
    if (!Auth.isAdmin()) {
      clear(host).appendChild(UI.empty('Khusus admin', 'Penugasan satker diatur oleh admin sistem.'));
      return;
    }
    return muatPaket().then(function (paket) {
      var q = '', isi = el('div');
      function gambar() {
        var list = App.state.master.satker.filter(function (s) { return cocok(s, q, ['nama', 'kode_satker']); });
        clear(isi).appendChild(UI.table([
          { label: 'Satuan kerja', render: function (s) {
            var t = App.tugas(s.id);
            return el('div', null, [el('span.tegas', { text: s.nama }),
              el('span.sub', { text: t && t.sp_dipa ? 'SP DIPA ' + t.sp_dipa : 'SP DIPA belum diisi' })]);
          } },
          { label: 'Pengelola', render: function (s) {
            var t = App.tugas(s.id), u = t && App.pengguna(t.user_id);
            return u ? u.nama : el('span.diam', { text: '—' });
          } },
          { label: 'KPA / PPK / PP', render: function (s) {
            var t = App.tugas(s.id) || {};
            var n = function (id) { var p = App.pejabat(id); return p ? p.nama.split(' ')[0] : '—'; };
            return el('span.mini', { text: n(t.kpa_id) + ' / ' + n(t.ppk_id) + ' / ' + n(t.pp_id) });
          } },
          { label: 'Paket', num: true, render: function (s) {
            return String(paket.filter(function (p) { return p.satker_id === s.id; }).length);
          } },
          { label: 'Pagu', num: true, render: function (s) {
            return Fmt.rpShort(paket.filter(function (p) { return p.satker_id === s.id; })
              .reduce(function (a, p) { return a + (Number(p.pagu) || 0); }, 0));
          } },
          { label: 'Status', render: function (s) {
            var t = App.tugas(s.id);
            if (!t) return UI.badge('belum diatur', 'warn');
            return t.ada_pengadaan === false ? UI.badge('tanpa pengadaan') : UI.badge('aktif', 'ok');
          } },
          { label: '', render: function (s) {
            return el('button.btn.kecil', { onclick: function () { atur(s); } }, 'Atur');
          } }
        ], list));
      }

      function atur(s) {
        var t = App.tugas(s.id) || { satker_id: s.id, tahun: App.state.tahun };
        var users = App.state.master.users || [], pejabat = App.state.master.pejabat || [];
        var lbl = function (p) { return p.nama + (p.jabatan ? ' — ' + p.jabatan : ''); };
        formModal('Penugasan ' + s.nama + ' · TA ' + App.state.tahun, [
          { name: 'user_id', label: 'Pengelola (ASN)', type: 'select', options: opsiDari(users, function (u) { return u.nama + ' (' + u.username + ')'; }) },
          { name: 'sp_dipa', label: 'Nomor SP DIPA', placeholder: 'SP DIPA-025.04.2.573052/2026' },
          { name: 'tgl_dipa', label: 'Tanggal DIPA', type: 'date' },
          { name: 'ada_pengadaan', label: 'Ada pengadaan tahun ini?', type: 'select', options: [{ value: 'ya', label: 'Ya' }, { value: 'tidak', label: 'Tidak ada pengadaan' }] },
          { name: 'kpa_id', label: 'KPA', type: 'select', options: opsiDari(pejabat, lbl) },
          { name: 'ppk_id', label: 'PPK', type: 'select', options: opsiDari(pejabat, lbl) },
          { name: 'pp_id', label: 'Pejabat Pengadaan', type: 'select', options: opsiDari(pejabat, lbl) },
          { name: 'catatan', label: 'Catatan', wide: true }
        ], {
          user_id: t.user_id, sp_dipa: t.sp_dipa, tgl_dipa: Fmt.iso(t.tgl_dipa),
          ada_pengadaan: t.ada_pengadaan === false ? 'tidak' : 'ya',
          kpa_id: t.kpa_id, ppk_id: t.ppk_id, pp_id: t.pp_id, catatan: t.catatan
        }, function (data) {
          data.id = t.id || '';
          data.satker_id = s.id;
          data.tahun = App.state.tahun;
          data.ada_pengadaan = data.ada_pengadaan === 'ya';
          return simpanEntitas('Penugasan', data).then(function () { return muatPaket(true); }).then(gambar);
        });
      }

      clear(host).appendChild(el('div', null, [
        el('div.filter', null, [cariBox('Cari satker…', function (v) { q = v; gambar(); })]),
        el('div.kartu', null, [isi])
      ]));
      gambar();
    });
  };

  /* ================= PENYEDIA ================= */
  Pages.penyedia = function (host) {
    App.setJudul('Penyedia', 'Company profile dipakai ulang untuk semua paket penyedia yang sama');
    App.alat([el('button.btn.primary.kecil', { onclick: function () { edit(null); } }, 'Tambah penyedia')]);
    var q = '', isi = el('div');

    function gambar() {
      var list = (App.state.master.penyedia || []).filter(function (p) { return cocok(p, q, ['nama', 'direktur', 'npwp', 'alamat']); });
      clear(isi).appendChild(list.length ? UI.table([
        { label: 'Penyedia', render: function (p) {
          return el('div', null, [el('span.tegas', { text: p.nama }), el('span.sub', { text: p.alamat || '-' })]);
        } },
        { label: 'Direktur', render: function (p) {
          return el('div.tumpuk', null, [el('span', { text: p.direktur || '-' }), el('span.sub', { text: p.jabatan_direktur || 'Direktur' })]);
        } },
        { label: 'NPWP', key: 'npwp' },
        { label: 'Company profile', render: function (p) {
          return p.cp_url
            ? el('a', { href: p.cp_url, target: '_blank', rel: 'noopener' }, 'Lihat berkas')
            : UI.badge('belum ada', 'warn');
        } },
        { label: '', render: function (p) {
          return el('div.baris', null, [
            el('button.btn.kecil', { onclick: function () {
              Unggah.dialog('Company profile ' + p.nama, { penyedia_id: p.id, kode: 12 }, function () { App.segarkan(); });
            } }, p.cp_url ? 'Ganti berkas' : 'Unggah'),
            el('button.btn.kecil', { onclick: function () { edit(p); } }, 'Ubah'),
            Auth.isAdmin() ? el('button.btn.kecil.danger', { onclick: function () { hapusEntitas('Penyedia', p.id, p.nama); } }, 'Hapus') : null
          ]);
        } }
      ], list) : UI.empty('Belum ada penyedia', 'Tambahkan penyedia sekali saja, lalu pakai ulang company profile-nya di paket mana pun.'));
    }

    function edit(p) {
      formModal(p ? 'Ubah ' + p.nama : 'Penyedia baru', [
        { name: 'nama', label: 'Nama badan usaha', required: true, wide: true, placeholder: 'CV. Putri Bestari Investama' },
        { name: 'direktur', label: 'Nama direktur' },
        { name: 'jabatan_direktur', label: 'Jabatan', placeholder: 'Direktur' },
        { name: 'npwp', label: 'NPWP' },
        { name: 'telp', label: 'Telepon' },
        { name: 'email', label: 'Email' },
        { name: 'bentuk', label: 'Bentuk usaha', type: 'select', options: ['CV', 'PT', 'UD', 'Perorangan', 'Koperasi'].map(function (x) { return { value: x, label: x }; }) },
        { name: 'alamat', label: 'Alamat', wide: true, type: 'textarea', rows: 2 }
      ], p, function (data) {
        data.id = p ? p.id : '';
        return simpanEntitas('Penyedia', data).then(gambar);
      });
    }

    clear(host).appendChild(el('div', null, [
      el('div.filter', null, [cariBox('Cari penyedia, direktur, NPWP…', function (v) { q = v; gambar(); })]),
      el('div.kartu', null, [isi])
    ]));
    gambar();
  };

  /* ================= PEJABAT ================= */
  Pages.pejabat = function (host) {
    App.setJudul('Pejabat', 'Dipakai untuk penetapan KPA, PPK, dan Pejabat Pengadaan');
    App.alat([el('button.btn.primary.kecil', { onclick: function () { edit(null); } }, 'Tambah pejabat')]);
    var q = '', isi = el('div');

    function gambar() {
      var list = (App.state.master.pejabat || []).filter(function (p) { return cocok(p, q, ['nama', 'nip', 'jabatan', 'pangkat']); });
      clear(isi).appendChild(list.length ? UI.table([
        { label: 'Nama', render: function (p) {
          return el('div', null, [el('span.tegas', { text: p.nama }), el('span.sub', { text: 'NIP. ' + (p.nip || '-') })]);
        } },
        { label: 'Pangkat / golongan', key: 'pangkat' },
        { label: 'Jabatan', key: 'jabatan' },
        { label: 'Satker', render: function (p) { return p.satker_id ? App.namaSatker(p.satker_id) : el('span.diam', { text: 'semua satker' }); } },
        { label: '', render: function (p) {
          return el('div.baris', null, [
            el('button.btn.kecil', { onclick: function () { edit(p); } }, 'Ubah'),
            Auth.isAdmin() ? el('button.btn.kecil.danger', { onclick: function () { hapusEntitas('Pejabat', p.id, p.nama); } }, 'Hapus') : null
          ]);
        } }
      ], list) : UI.empty('Belum ada pejabat', 'Masukkan nama, NIP, pangkat/golongan, dan jabatan agar bisa dipasang sebagai KPA, PPK, atau PP.'));
    }

    function edit(p) {
      formModal(p ? 'Ubah ' + p.nama : 'Pejabat baru', [
        { name: 'nama', label: 'Nama lengkap dan gelar', required: true, wide: true, placeholder: 'Andi Sugiharta, M.Pd.I' },
        { name: 'nip', label: 'NIP', required: true },
        { name: 'pangkat', label: 'Pangkat / golongan', type: 'select', options: PANGKAT_OPSI.map(function (p) { return { value: p === '— pilih —' ? '' : p, label: p }; }), required: true },
        { name: 'jabatan', label: 'Jabatan', wide: true, placeholder: 'Perencana Ahli Muda' },
        { name: 'satker_id', label: 'Satker (kosongkan bila lintas satker)', type: 'select', wide: true, options: opsiDari(App.state.master.satker) }
      ], p, function (data) {
        data.id = p ? p.id : '';
        return simpanEntitas('Pejabat', data).then(gambar);
      });
    }

    clear(host).appendChild(el('div', null, [
      el('div.filter', null, [cariBox('Cari nama, NIP, jabatan…', function (v) { q = v; gambar(); })]),
      el('div.kartu', null, [isi])
    ]));
    gambar();
  };

  /* ================= PENGGUNA ================= */
  Pages.pengguna = function (host) {
    App.setJudul('Pengguna', '8 ASN pengelola dan admin sistem');
    if (!Auth.isAdmin()) { clear(host).appendChild(UI.empty('Khusus admin', 'Halaman ini hanya untuk admin sistem.')); return; }
    App.alat([el('button.btn.primary.kecil', { onclick: function () { edit(null); } }, 'Tambah pengguna')]);
    var isi = el('div');

    function gambar() {
      var list = App.state.master.users || [];
      clear(isi).appendChild(UI.table([
        { label: 'Nama', render: function (u) {
          return el('div', null, [el('span.tegas', { text: u.nama }), el('span.sub', { text: u.username + ' · ' + (u.email || '-') })]);
        } },
        { label: 'NIP', key: 'nip' },
        { label: 'Peran', render: function (u) { return UI.badge(u.role === 'admin' ? 'Admin' : 'Pengelola', u.role === 'admin' ? 'info' : ''); } },
        { label: 'Satker dipegang', num: true, render: function (u) {
          return String((App.state.master.penugasan || []).filter(function (t) {
            return t.user_id === u.id && String(t.tahun) === App.state.tahun;
          }).length);
        } },
        { label: 'Status', render: function (u) { return u.aktif === false ? UI.badge('nonaktif', 'bad') : UI.badge('aktif', 'ok'); } },
        { label: '', render: function (u) {
          return el('div.baris', null, [
            el('button.btn.kecil', { onclick: function () { edit(u); } }, 'Ubah'),
            el('button.btn.kecil', { onclick: function () { sandi(u); } }, 'Atur sandi')
          ]);
        } }
      ], list));
    }

    function edit(u) {
      formModal(u ? 'Ubah ' + u.nama : 'Pengguna baru', [
        { name: 'nama', label: 'Nama lengkap', required: true, wide: true },
        { name: 'username', label: 'Nama pengguna', required: true, hint: 'dipakai untuk masuk' },
        { name: 'nip', label: 'NIP' },
        { name: 'email', label: 'Email' },
        { name: 'role', label: 'Peran', type: 'select', options: [{ value: 'operator', label: 'Pengelola satker' }, { value: 'admin', label: 'Admin sistem' }] },
        { name: 'aktif', label: 'Status', type: 'select', options: [{ value: 'ya', label: 'Aktif' }, { value: 'tidak', label: 'Nonaktif' }] },
        u ? null : { name: 'password', label: 'Kata sandi awal', required: true, type: 'password', wide: true }
      ].filter(Boolean), u ? { nama: u.nama, username: u.username, nip: u.nip, email: u.email, role: u.role, aktif: u.aktif === false ? 'tidak' : 'ya' } : { role: 'operator', aktif: 'ya' },
        function (data) {
          data.id = u ? u.id : '';
          data.aktif = data.aktif === 'ya';
          return simpanEntitas('Users', data).then(gambar);
        });
    }
    function sandi(u) {
      formModal('Atur ulang sandi ' + u.nama, [
        { name: 'password', label: 'Kata sandi baru', type: 'password', required: true, wide: true, hint: 'Minimal 8 karakter. Sampaikan langsung kepada yang bersangkutan.' }
      ], null, function (data) {
        if (data.password.length < 8) throw new Error('Kata sandi minimal 8 karakter.');
        return API.call('resetPassword', { id: u.id, password: data.password }, { jsonp: false })
          .then(function () { UI.toast('Sandi diperbarui', 'ok'); });
      }, { kolom: 1 });
    }

    clear(host).appendChild(el('div.kartu', null, [isi]));
    gambar();
  };

  /* ================= PENGATURAN ================= */
  Pages.pengaturan = function (host) {
    App.setJudul('Pengaturan', 'Koneksi server dan identitas kantor');
    App.alat([]);
    if (!Auth.isAdmin()) { clear(host).appendChild(UI.empty('Khusus admin', 'Halaman ini hanya untuk admin sistem.')); return; }
    var cfg = (App.state.master && App.state.master.config) || {};

    var form = el('form.grid2', { onsubmit: function (e) { e.preventDefault(); } });
    [
      { name: 'instansi', label: 'Nama kantor', value: cfg.instansi || C.INSTANSI, wide: true },
      { name: 'kota', label: 'Kota penandatanganan', value: cfg.kota || 'Indramayu' },
      { name: 'folder_root', label: 'ID folder Drive induk', value: cfg.folder_root || '', hint: 'Dibuat otomatis saat setup. Ubah hanya bila folder dipindah.' }
    ].forEach(function (f) { form.appendChild(UI.field(f)); });

    var koneksi = el('div.rapi', null, [
      UI.field({ label: 'Alamat Web App', name: 'api', value: API.url(), wide: true, hint: 'Akhiri dengan /exec. Ganti setiap kali Anda membuat deployment baru.' }),
      el('div.baris', null, [
        el('button.btn', { onclick: function () {
          var v = koneksi.querySelector('[name="api"]').value.trim();
          if (!/\/exec$/.test(v)) return UI.toast('Alamat harus berakhiran /exec', 'bad');
          API.setUrl(v); UI.toast('Alamat tersimpan. Memuat ulang…', 'ok');
          setTimeout(function () { location.reload(); }, 800);
        } }, 'Simpan alamat'),
        el('button.btn', { onclick: function () {
          API.call('ping', {}).then(function (r) { UI.toast('Server menjawab. Versi data ' + (r.versi || '-'), 'ok'); }).catch(UI.err);
        } }, 'Tes koneksi'),
        el('button.btn', { onclick: function () { Store.dropAll(); UI.toast('Cache perangkat dibersihkan', 'ok'); setTimeout(function () { location.reload(); }, 600); } }, 'Bersihkan cache')
      ])
    ]);

    clear(host).appendChild(el('div.rapi', null, [
      el('div.kartu', null, [
        el('header', null, [el('h2', { text: 'Identitas kantor' })]),
        el('div.badan', null, [form,
          el('div.baris', { style: 'margin-top:14px' }, [
            el('button.btn.primary', { onclick: function () {
              API.call('saveConfig', UI.formData(form), { jsonp: false })
                .then(function () { UI.toast('Pengaturan tersimpan', 'ok'); return App.segarkan(); }).catch(UI.err);
            } }, 'Simpan pengaturan')
          ])])
      ]),
      el('div.kartu', null, [
        el('header', null, [el('h2', { text: 'Koneksi server' })]),
        el('div.badan', null, [koneksi])
      ]),
      el('div.kartu', null, [
        el('header', null, [el('h2', { text: 'Catatan pemeliharaan' })]),
        el('div.badan', null, [el('div.mini', { html:
          '<p>Setiap kali kode Apps Script diubah, buat <b>versi baru</b> pada deployment yang sama ' +
          '(Deploy → Kelola deployment → ikon pensil → Version: New version). Membuat deployment baru akan ' +
          'mengubah URL dan menyebabkan galat 404 di semua perangkat.</p>' +
          '<p>Data disimpan di Google Spreadsheet, berkas di Google Drive. Cukup salin kedua-duanya untuk membuat cadangan.</p>' }
        )])
      ])
    ]));
  };

  w.Pages = Pages;
})(window);
