/* SIPADU - paket pengadaan: daftar, detail, berkas, dan cetak dokumen. */
(function (w) {
  'use strict';
  var C = w.CONFIG, B = w.Bantu;

  function jenisOpsi() {
    return C.JENIS_PENGADAAN.map(function (j) { return { value: j.id, label: j.nama }; });
  }
  function metaPaket(p) {
    if (!p) return {};
    if (typeof p.meta === 'string') { try { return JSON.parse(p.meta || '{}'); } catch (e) { return {}; } }
    return p.meta || {};
  }

  var Paket = {};

  /* ================= DAFTAR ================= */
  Paket.daftar = function (host, ctx) {
    App.setJudul('Paket pengadaan', 'TA ' + App.state.tahun);
    App.alat([
      w.pilihTahun(),
      el('button.btn.primary.kecil', { onclick: function () { baru(); } }, 'Paket baru')
    ]);

    var f = { q: '', satker: (ctx.params && ctx.params.satker) || '', jenis: '', status: '' };
    var isi = el('div');

    function baru() {
      var satker = App.satkerSaya();
      if (!satker.length) return UI.toast('Belum ada satker yang ditugaskan kepada Anda', 'bad');
      B.formModal('Paket pengadaan baru', [
        { name: 'satker_id', label: 'Satuan kerja', type: 'select', required: true, options: B.opsiDari(satker) },
        { name: 'jenis', label: 'Jenis pengadaan', type: 'select', required: true, options: [{ value: '', label: '— pilih —' }].concat(jenisOpsi()) },
        { name: 'nama', label: 'Nama paket', required: true, wide: true, placeholder: 'Pemeliharaan Gedung dan Bangunan' },
        { name: 'pagu', label: 'Pagu (Rp)', format: 'rp', required: true },
        { name: 'metode', label: 'Metode', type: 'select', options: C.METODE_PENGADAAN.map(function (x) { return { value: x, label: x }; }) }
      ], { metode: 'Pengadaan Langsung' }, function (data) {
        data.tahun = App.state.tahun;
        data.status = 'persiapan';
        return API.call('savePaket', { row: data }, { jsonp: false }).then(function (r) {
          Store.drop('paket.' + App.state.tahun);
          UI.toast('Paket dibuat', 'ok');
          Router.go('/paket/' + r.id);
        });
      });
    }

    return w.muatPaket().then(function (semua) {
      var ids = {}; App.satkerSaya().forEach(function (s) { ids[s.id] = 1; });
      var milik = semua.filter(function (p) { return ids[p.satker_id]; });

      function gambar() {
        var list = milik.filter(function (p) {
          if (f.satker && p.satker_id !== f.satker) return false;
          if (f.jenis && p.jenis !== f.jenis) return false;
          var h = w.hitungLengkap(p);
          if (f.status === 'lengkap' && h.persen < 100) return false;
          if (f.status === 'kurang' && h.persen === 100) return false;
          if (!f.q) return true;
          return (p.nama + ' ' + App.namaSatker(p.satker_id)).toLowerCase().indexOf(f.q) > -1;
        });
        clear(isi).appendChild(list.length ? UI.table([
          { label: 'Paket', render: function (p) {
            return el('div', null, [el('span.tegas', { text: p.nama }),
              el('span.sub', { text: App.namaSatker(p.satker_id) + ' · ' + App.jenis(p.jenis).nama })]);
          } },
          { label: 'Pagu', num: true, render: function (p) { return Fmt.rpShort(p.pagu); } },
          { label: 'Nilai', num: true, render: function (p) { return p.nilai ? Fmt.rpShort(p.nilai) : '—'; } },
          { label: 'Penyedia', render: function (p) {
            var v = App.penyedia(p.penyedia_id);
            return v ? v.nama : el('span.diam', { text: 'belum diisi' });
          } },
          { label: 'Berkas', w: '170px', render: function (p) { return UI.pita(p.dok || {}, p); } },
          { label: '', num: true, render: function (p) {
            var h = w.hitungLengkap(p);
            return h.persen === 100 ? UI.badge('lengkap', 'ok') : el('span.mini', { text: h.ada + '/' + h.perlu });
          } }
        ], list, { onrow: function (p) { Router.go('/paket/' + p.id); } })
          : UI.empty('Tidak ada paket', 'Ubah penyaring, atau buat paket baru untuk satker Anda.',
            el('button.btn.primary', { onclick: baru }, 'Paket baru')));
      }

      clear(host).appendChild(el('div', null, [
        el('div.filter', null, [
          B.cariBox('Cari nama paket atau satker…', function (v) { f.q = v; gambar(); }),
          UI.field({ label: 'Satker', type: 'select', options: [{ value: '', label: 'Semua' }].concat(App.satkerSaya().map(function (s) { return { value: s.id, label: s.nama }; })), value: f.satker, onchange: function (e) { f.satker = e.target.value; gambar(); } }),
          UI.field({ label: 'Jenis', type: 'select', options: [{ value: '', label: 'Semua' }].concat(jenisOpsi()), onchange: function (e) { f.jenis = e.target.value; gambar(); } }),
          UI.field({ label: 'Kelengkapan', type: 'select', options: [{ value: '', label: 'Semua' }, { value: 'kurang', label: 'Belum lengkap' }, { value: 'lengkap', label: 'Lengkap' }], onchange: function (e) { f.status = e.target.value; gambar(); } })
        ]),
        el('div.kartu', null, [isi])
      ]));
      gambar();
    });
  };

  /* ================= DETAIL ================= */
  Paket.detail = function (host, ctx) {
    return API.call('paketDetail', { id: ctx.id }).then(function (d) {
      var p = d.paket, meta = metaPaket(p), dok = d.dokumen || [];
      var hpsModel = d.hps && d.hps.rows ? d.hps : null;
      var monevData = d.monev || null;
      var s = App.satker(p.satker_id) || {};
      var tugas = App.tugas(p.satker_id, p.tahun) || {};

      App.setJudul(p.nama, s.nama + ' · TA ' + p.tahun);
      App.alat([
        el('button.btn.kecil', { onclick: function () { Router.go('/paket'); } }, 'Kembali'),
        el('button.btn.kecil.danger', { onclick: function () {
          UI.confirm('Hapus paket ini beserta catatan berkasnya? Berkas di Drive tidak ikut terhapus.', function () {
            API.call('removePaket', { id: p.id }, { jsonp: false }).then(function () {
              Store.drop('paket.' + App.state.tahun); UI.toast('Paket dihapus', 'ok'); Router.go('/paket');
            }).catch(UI.err);
          }, { yes: 'Hapus paket', kind: 'danger' });
        } }, 'Hapus')
      ]);

      /* peta dokumen per kode */
      function petaDok() {
        var m = {};
        dok.forEach(function (x) { (m[x.kode] = m[x.kode] || []).push(x); });
        var v = App.penyedia(p.penyedia_id);
        if (v && v.cp_url && !m[12]) m[12] = [{ kode: 12, nama_file: 'Company profile ' + v.nama, url: v.cp_url, dari_penyedia: true }];
        return m;
      }

      var ringkas = el('div.kartu', { style: 'margin-bottom:18px' });
      function gambarRingkas() {
        var m = petaDok(), adaMap = {};
        Object.keys(m).forEach(function (k) { adaMap[k] = m[k].length; });
        var h = w.hitungLengkap({ dok: adaMap, ada_pph: p.ada_pph });
        clear(ringkas).appendChild(el('div.badan', null, [
          el('div.baris', null, [
            el('div', null, [
              el('div.mini', { text: App.jenis(p.jenis).nama }),
              el('div', { style: 'font-size:15px;font-weight:600;margin-top:2px', text: Fmt.rp(p.pagu) + ' pagu' +
                (p.nilai ? ' · ' + Fmt.rp(p.nilai) + ' nilai kontrak' : '') })
            ]),
            el('div.kanan.baris', null, [
              UI.pita(adaMap, p),
              el('span.tegas', { text: h.ada + ' / ' + h.perlu + ' dokumen' }),
              h.persen === 100 ? UI.badge('pengadaan lengkap', 'ok') : UI.badge(h.persen + '%', 'warn')
            ])
          ])
        ]));
      }

      var tabBar = el('div.tab'), panel = el('div');
      var tabs = [
        { id: 'umum', label: 'Data paket', render: tabUmum },
        { id: 'hps', label: 'HPS / RAB', render: tabHPS },
        { id: 'dok', label: 'Berkas (13)', render: tabDok },
        { id: 'monev', label: 'Menilai (Monev)', render: tabMonev }
      ];
      var aktif = (ctx.params && ctx.params.tab) || 'umum';
      tabs.forEach(function (t) {
        tabBar.appendChild(el('button', {
          class: t.id === aktif ? 'aktif' : '',
          onclick: function () {
            aktif = t.id;
            $$('button', tabBar).forEach(function (b, i) { b.classList.toggle('aktif', tabs[i].id === aktif); });
            clear(panel); t.render(panel);
          }
        }, t.label));
      });

      /* ---------- data paket ---------- */
      function tabUmum(host2) {
        var pejabat = App.state.master.pejabat || [];
        var lbl = function (x) { return x.nama + (x.jabatan ? ' — ' + x.jabatan : ''); };

        /* metode pengadaan: dropdown dari C.METODE_PENGADAAN, dengan opsi "Lainnya" yang
           membuka kotak isian bebas — supaya metode di luar daftar (termasuk data lama
           yang sudah tersimpan) tetap bisa dipakai tanpa kehilangan nilainya. */
        var metodeKustom = !!p.metode && C.METODE_PENGADAAN.indexOf(p.metode) < 0;
        var kotakMetodeLain = el('div', { hidden: !metodeKustom });
        kotakMetodeLain.appendChild(UI.field({
          name: 'metode_lainnya', label: 'Sebutkan metode', value: metodeKustom ? p.metode : '',
          placeholder: 'mis. Kerja Sama Antar Instansi Pemerintah'
        }));
        var fMetode = UI.field({
          name: 'metode', label: 'Metode pengadaan', type: 'select',
          value: metodeKustom ? 'Lainnya' : (p.metode || ''),
          options: [{ value: '', label: '— Pilih metode —' }]
            .concat(C.METODE_PENGADAAN.map(function (x) { return { value: x, label: x }; }))
            .concat([{ value: 'Lainnya', label: 'Lainnya' }]),
          onchange: function () { kotakMetodeLain.hidden = this.value !== 'Lainnya'; }
        });

        var form = el('form.grid2', { onsubmit: function (e) { e.preventDefault(); } });
        [
          { name: 'nama', label: 'Nama paket', value: p.nama, wide: true, required: true },
          { name: 'jenis', label: 'Jenis pengadaan', type: 'select', value: p.jenis, options: jenisOpsi() },
          { name: 'status', label: 'Status', type: 'select', value: p.status, options: ['persiapan', 'proses', 'selesai'].map(function (x) { return { value: x, label: Fmt.kapital(x) }; }) },
          { name: 'pagu', label: 'Pagu (Rp)', format: 'rp', value: p.pagu },
          { name: 'nilai', label: 'Nilai kontrak (Rp)', format: 'rp', value: p.nilai },
          { name: 'penyedia_id', label: 'Penyedia', type: 'select', value: p.penyedia_id, options: B.opsiDari(App.state.master.penyedia) },
          { name: 'ada_pph', label: 'Ada PPh (faktur & bupot)?', type: 'select', value: p.ada_pph ? 'ya' : 'tidak', options: [{ value: 'tidak', label: 'Tidak' }, { value: 'ya', label: 'Ya' }] }
        ].forEach(function (x) { form.appendChild(UI.field(x)); });
        form.appendChild(fMetode);
        form.appendChild(kotakMetodeLain);
        [
          { name: 'jenis_kontrak', label: 'Jenis kontrak', value: p.jenis_kontrak || 'Kontrak Harga Satuan' },
          { name: 'jangka_waktu', label: 'Jangka waktu (hari kalender)', type: 'number', value: p.jangka_waktu || 14 },
          { name: 'sumber_dana', label: 'Sumber dana', value: p.sumber_dana || App.jenis(p.jenis).sumber },
          { name: 'lokasi', label: 'Lokasi pekerjaan', value: p.lokasi || s.nama, wide: true },
          { name: 'kpa_id', label: 'KPA', type: 'select', value: p.kpa_id || tugas.kpa_id, options: B.opsiDari(pejabat, lbl) },
          { name: 'ppk_id', label: 'PPK', type: 'select', value: p.ppk_id || tugas.ppk_id, options: B.opsiDari(pejabat, lbl) },
          { name: 'pp_id', label: 'Pejabat Pengadaan', type: 'select', value: p.pp_id || tugas.pp_id, options: B.opsiDari(pejabat, lbl) }
        ].forEach(function (x) { form.appendChild(UI.field(x)); });

        var formNo = el('form.rapi', { onsubmit: function (e) { e.preventDefault(); } });
        [
          { k: 'sk_ppk', l: 'SK PPK', gen: 'sk_ppk' }, { k: 'sk_pp', l: 'SK PP', gen: 'sk_pp' },
          { k: 'kak', l: 'KAK', gen: 'kak' }, { k: 'hps', l: 'HPS', gen: 'hps' },
          { k: 'sp', l: 'Surat Pesanan / SPK' }, { k: 'bast', l: 'BAST', gen: 'bast' },
          { k: 'bap', l: 'BAP' }, { k: 'monev', l: 'Laporan Monev', gen: 'monev' }
        ].forEach(function (x) {
          formNo.appendChild(el('div', null, [
            el('div.baris', { style: 'justify-content:space-between;margin-bottom:8px' }, [
              el('b', { style: 'font-size:13.5px', text: x.l }),
              x.gen ? el('button.btn.kecil', { type: 'button', onclick: function () { cetakDok(x.gen); } }, 'Pratinjau') : null
            ]),
            el('div.grid2', null, [
              UI.field({ name: 'no_' + x.k, label: 'Nomor', value: meta['no_' + x.k] || '' }),
              UI.field({ name: 'tgl_' + x.k, label: 'Tanggal', type: 'date', value: Fmt.iso(meta['tgl_' + x.k]) })
            ])
          ]));
        });

        function simpan(evt) {
          var btn = evt && evt.target ? evt.target.closest('button') : null;
          var selesai = UI.busy(btn);
          var data = UI.formData(form);
          data.id = p.id;
          data.ada_pph = data.ada_pph === 'ya';
          if (data.metode === 'Lainnya') data.metode = String(data.metode_lainnya || '').trim();
          delete data.metode_lainnya;
          var m = UI.formData(formNo);
          data.meta = JSON.stringify(m);
          return API.call('savePaket', { row: data }, { jsonp: false }).then(function () {
            Store.drop('paket.' + App.state.tahun);
            for (var k in data) p[k] = data[k];
            meta = m;
            UI.toast('Perubahan tersimpan', 'ok');
            gambarRingkas();
          }).catch(function (e) { selesai(); UI.err(e); }).then(selesai);
        }

        host2.appendChild(el('div.rapi', null, [
          el('div.kartu', null, [
            el('header', null, [el('h2', { text: 'Data paket' })]),
            el('div.badan', null, [form])
          ]),
          el('div.kartu', null, [
            el('header', null, [el('h2', { text: 'Nomor dan tanggal surat' }),
              el('span.kanan.mini', { text: 'Simpan dulu, baru klik Pratinjau agar nomor terbaru ikut tercetak' })]),
            el('div.badan', null, [formNo])
          ]),
          el('div.baris', null, [el('button.btn.primary', { onclick: function (e) { simpan(e); } }, 'Simpan perubahan')])
        ]));
      }

      /* ---------- HPS ---------- */
      function tabHPS(host2) {
        var box = el('div'), editorRef = null, berubah = false;
        var info = el('p.mini', {
          text: hpsModel ? 'Terakhir disimpan di server.' :
            'Belum ada rincian — kolom disiapkan mengikuti format ' + (App.jenis(p.jenis).rab ? 'pemeliharaan gedung' : 'barang/buku/ekstrakomptabel') +
            '. Tempel dari Excel, impor .xlsx, atau ganti lewat tombol "Format baku".'
        });
        /* hpsModel di-update live agar pratinjau & dokumen memakai rincian terkini */
        editorRef = HPS.editor(box, hpsModel || HPS.contoh(p.jenis), function (m) { berubah = true; hpsModel = m; }, p.jenis, p.pagu);

        function simpan(evt) {
          var btn = evt && evt.target ? evt.target.closest('button') : null;
          var selesai = UI.busy(btn);
          var m = editorRef.model();
          var total = HPS.totalAkhir(m);
          API.call('saveHPS', { paket_id: p.id, payload: JSON.stringify(m), total: total }, { jsonp: false })
            .then(function () {
              hpsModel = m; berubah = false;
              UI.toast('Rincian HPS tersimpan (' + Fmt.rp(total) + ')', 'ok');
              info.textContent = 'Tersimpan ' + Fmt.tanggal(new Date()) + '.';
            }).catch(function (e) { selesai(); UI.err(e); }).then(selesai);
        }
        w.onbeforeunload = function () { return berubah ? 'Rincian HPS belum disimpan.' : undefined; };

        host2.appendChild(el('div.kartu', null, [
          el('header', null, [
            el('h2', { text: 'Rincian HPS / RAB' }),
            el('div.kanan.baris', null, [
              el('button.btn.kecil', { onclick: function () { cetakDok('hps'); } }, 'Pratinjau HPS'),
              el('button.btn.primary.kecil', { onclick: function (e) { simpan(e); } }, 'Simpan rincian')
            ])
          ]),
          el('div.badan', null, [info, box])
        ]));
      }

      /* ---------- berkas ---------- */
      function tabDok(host2) {
        var daftar = el('div.dok');
        function gambar() {
          var m = petaDok();
          clear(daftar);
          C.DOKUMEN.forEach(function (d) {
            var perlu = !d.bersyarat || p[d.bersyarat];
            var berkas = m[d.kode] || [];
            var item = el('div.dok-item' + (berkas.length ? '.ada' : '') + (!perlu ? '.na' : ''), null, [
              el('div.dok-no', { text: String(d.kode) }),
              el('div', null, [
                el('div.dok-nama', { text: d.nama }),
                !perlu ? el('div.dok-file', null, [el('span.diam', { text: 'Tidak diperlukan untuk paket ini' })]) :
                  berkas.length ? el('div', null, berkas.map(function (b) {
                    return el('div.dok-file', null, [
                      el('a', { href: b.url, target: '_blank', rel: 'noopener', text: b.nama_file }),
                      b.sub ? UI.badge(b.sub) : null,
                      b.dari_penyedia ? UI.badge('dari data penyedia', 'info') : null,
                      b.size ? el('span.diam', { text: Fmt.bytes(b.size) }) : null,
                      b.file_id ? el('button.btn.kecil', {
                        title: 'Lihat pratinjau berkas (berkas harus dibagikan "Anyone with link")',
                        onclick: function () { UI.drivePreview(b); }
                      }, 'Pratinjau') : null,
                      b.id ? el('button.btn.kecil.danger', { onclick: function () {
                        UI.confirm('Hapus berkas "' + b.nama_file + '"?', function () {
                          API.call('removeDok', { id: b.id }, { jsonp: false }).then(function () {
                            dok = dok.filter(function (x) { return x.id !== b.id; });
                            Store.drop('paket.' + App.state.tahun);
                            gambar(); gambarRingkas(); UI.toast('Berkas dihapus', 'ok');
                          }).catch(UI.err);
                        }, { yes: 'Hapus', kind: 'danger' });
                      } }, 'Hapus') : null
                    ]);
                  })) : el('div.dok-file', null, [el('span.diam', { text: 'Belum diunggah' })])
              ]),
              el('div.dok-aksi', null, [
                d.generate ? el('button.btn.kecil', { onclick: function () { cetakDok(d.generate); } }, 'Buat') : null,
                d.dari === 'penyedia' && !p.penyedia_id
                  ? el('span.mini', { text: 'pilih penyedia dulu' })
                  : perlu ? el('button.btn.kecil' + (berkas.length && !d.multi ? '' : '.primary'), {
                    onclick: function () {
                      Unggah.dialog('Unggah ' + d.nama, { paket_id: p.id, kode: d.kode }, function (row) {
                        if (!d.multi) dok = dok.filter(function (x) { return String(x.kode) !== String(d.kode); });
                        dok.push(row);
                        Store.drop('paket.' + App.state.tahun);
                        gambar(); gambarRingkas();
                      }, { subs: d.subs });
                    }
                  }, berkas.length && !d.multi ? 'Ganti' : 'Unggah') : null
              ])
            ]);
            daftar.appendChild(item);
          });
        }
        gambar();
        host2.appendChild(el('div.kartu', null, [
          el('header', null, [el('h2', { text: 'Kelengkapan 13 dokumen' }),
            el('span.kanan.mini', { text: 'Berkas tersimpan di folder Drive satker' })]),
          el('div.badan', null, [daftar])
        ]));
      }

      /* ---------- menilai (monev) ---------- */
      function tabMonev(host2) {
        var items = HPS.daftarItem ? HPS.daftarItem(hpsModel) : [];
        if (!items.length) {
          host2.appendChild(el('div.kartu', null, [
            el('div.badan', null, [UI.empty(
              'Belum ada item untuk dinilai',
              'Isi rincian HPS/RAB pada tab "HPS / RAB" terlebih dahulu — setiap baris uraian di situ akan muncul di sini untuk dinilai realisasinya.'
            )])
          ]));
          return;
        }
        var simpanAda = (monevData && monevData.items) || [];
        var berubah = false;
        function tandai() { berubah = true; }

        var daftar = el('div.rapi');
        var penyegar = [];
        items.forEach(function (it, i) {
          var lama = simpanAda[i] || {};
          var badge = UI.badge('—');
          function segarkanBadge() {
            var rv = form.elements['r' + i] ? String(form.elements['r' + i].value).trim() : '';
            var sama = rv !== '' && rv === String(it.volume || '').trim();
            badge.textContent = rv === '' ? 'Belum diisi' : (sama ? 'Sesuai rencana' : 'Berbeda dari rencana');
            badge.className = 'badge' + (rv === '' ? '' : sama ? ' ok' : ' warn');
          }
          penyegar.push(segarkanBadge);
          var fR = UI.field({
            label: 'Realisasi', name: 'r' + i,
            value: lama.realisasi != null && lama.realisasi !== '' ? lama.realisasi : it.volume,
            oninput: function () { tandai(); segarkanBadge(); }
          });
          var fK = UI.field({
            label: 'Keterangan (opsional)', name: 'k' + i, placeholder: 'mis. 1 unit belum dikirim, menyusul',
            value: lama.keterangan || '', oninput: tandai
          });
          daftar.appendChild(el('div.monev-item', null, [
            el('div.baris', { style: 'justify-content:space-between;align-items:flex-start;margin-bottom:10px' }, [
              el('div', null, [
                el('div.judul-item', { text: (i + 1) + '. ' + it.uraian }),
                el('div.rencana-item', { text: 'Rencana: ' + (it.volume || '-') + (it.satuan ? ' ' + it.satuan : '') })
              ]),
              badge
            ]),
            el('div', { style: 'display:grid;gap:10px' }, [fR, fK])
          ]));
        });

        var fCatatan = UI.field({
          label: 'Kesimpulan / catatan monev', name: 'catatan', type: 'textarea', rows: 5,
          value: (monevData && monevData.catatan) || '',
          placeholder: 'Ringkasan hasil monitoring dan evaluasi. Bisa diisi manual, atau klik "Buat draf otomatis" lalu sunting seperlunya.',
          oninput: tandai
        });

        var form = el('form.rapi', { onsubmit: function (e) { e.preventDefault(); } }, [
          el('div.kartu', null, [
            el('header', null, [
              el('h2', { text: 'Penilaian realisasi per item' }),
              el('span.kanan.mini', { text: items.length + ' item dari HPS/RAB' })
            ]),
            el('div.badan', null, [daftar])
          ]),
          el('div.kartu', null, [
            el('header', null, [
              el('h2', { text: 'Kesimpulan' }),
              el('button.btn.kecil.kanan', { type: 'button', onclick: draf }, 'Buat draf otomatis')
            ]),
            el('div.badan', null, [fCatatan])
          ])
        ]);
        penyegar.forEach(function (f) { f(); });

        function draf() {
          var beda = [];
          items.forEach(function (it, i) {
            var rv = String(form.elements['r' + i].value || '').trim();
            var kv = String(form.elements['k' + i].value || '').trim();
            if (rv !== String(it.volume || '').trim()) {
              beda.push(it.uraian + ' direncanakan ' + (it.volume || '-') + (it.satuan ? ' ' + it.satuan : '') +
                ', terealisasi ' + (rv || '-') + (it.satuan ? ' ' + it.satuan : '') + (kv ? ' (' + kv + ')' : ''));
            }
          });
          form.elements.catatan.value = !beda.length
            ? 'Pelaksanaan pekerjaan telah terealisasi 100% (seratus persen) sesuai Surat Pesanan. Seluruh pekerjaan sudah memenuhi spesifikasi yang ditetapkan dan berada dalam kondisi baik serta siap dimanfaatkan sesuai peruntukannya.'
            : 'Pelaksanaan pekerjaan belum terealisasi sepenuhnya sesuai Surat Pesanan, dengan rincian sebagai berikut: ' +
              beda.join('; ') + '. Selain hal tersebut, pekerjaan telah memenuhi spesifikasi yang ditetapkan dan berada dalam kondisi baik.';
          tandai();
        }

        /* ---------- foto dokumentasi (tersimpan sebagai berkas dokumen #13) ---------- */
        var fotoWrap = el('div.foto-grid');
        function gambarFoto() {
          clear(fotoWrap);
          dok.filter(function (x) { return String(x.kode) === '13' && /^image\//i.test(x.mime || ''); })
            .forEach(function (b) {
              fotoWrap.appendChild(el('div.foto-mini', null, [
                el('img', {
                  src: 'https://drive.google.com/thumbnail?id=' + b.file_id + '&sz=w300',
                  alt: b.nama_file || 'foto dokumentasi', title: 'Lihat pratinjau',
                  onclick: function () { UI.drivePreview(b); }
                }),
                el('button.hapus', {
                  type: 'button', title: 'Hapus foto', html: '&times;',
                  onclick: function () {
                    UI.confirm('Hapus foto ini?', function () {
                      API.call('removeDok', { id: b.id }, { jsonp: false }).then(function () {
                        dok = dok.filter(function (x) { return x.id !== b.id; });
                        Store.drop('paket.' + App.state.tahun);
                        gambarFoto(); gambarRingkas();
                        UI.toast('Foto dihapus', 'ok');
                      }).catch(UI.err);
                    }, { yes: 'Hapus', kind: 'danger' });
                  }
                })
              ]));
            });
          fotoWrap.appendChild(el('div.foto-tambah', {
            onclick: function () {
              Unggah.dialog('Tambah foto dokumentasi monev', { paket_id: p.id, kode: 13 }, function (row) {
                dok.push(row);
                Store.drop('paket.' + App.state.tahun);
                gambarFoto(); gambarRingkas();
              }, { accept: 'image/*', multiple: true });
            }
          }, '+ Tambah foto'));
        }
        gambarFoto();

        function simpan(evt) {
          var btn = evt && evt.target ? evt.target.closest('button') : null;
          var selesai = UI.busy(btn);
          var fd = UI.formData(form);
          var out = {
            items: items.map(function (it, i) {
              return { realisasi: String(fd['r' + i] || '').trim(), keterangan: String(fd['k' + i] || '').trim() };
            }),
            catatan: String(fd.catatan || '').trim()
          };
          API.call('saveMonev', { paket_id: p.id, payload: JSON.stringify(out) }, { jsonp: false })
            .then(function () {
              monevData = out; berubah = false;
              UI.toast('Penilaian monev tersimpan', 'ok');
            }).catch(function (e) { selesai(); UI.err(e); }).then(selesai);
        }
        w.onbeforeunload = function () { return berubah ? 'Penilaian monev belum disimpan.' : undefined; };

        host2.appendChild(el('div.rapi', null, [
          form,
          el('div.kartu', null, [
            el('header', null, [el('h2', { text: 'Dokumentasi foto' }),
              el('span.kanan.mini', { text: 'Tersimpan di folder Drive satker, sebagai berkas dokumen #13' })]),
            el('div.badan', null, [fotoWrap])
          ]),
          el('div.baris', null, [el('button.btn.primary', { onclick: function (e) { simpan(e); } }, 'Simpan penilaian')])
        ]));
      }

      /* ---------- cetak ---------- */
      function konteks(gen) {
        var m = metaPaket(p);
        var kunci = gen.field ? gen.field.replace('no_', '') : '';
        var pk = {};
        for (var k in p) pk[k] = p[k];
        pk.meta = m;
        /* selaraskan pagu HPS dengan Pagu paket terkini (tab Data paket, f_pagu) —
           hpsModel bisa membawa pagu lama bila tab HPS/RAB belum dibuka ulang
           setelah Pagu diubah, sehingga mode "Sesuaikan dengan pagu" jadi memakai nilai basi. */
        if (hpsModel) hpsModel.pagu = Number(p.pagu) || 0;
        return {
          satker: s, paket: pk, tahun: p.tahun, jenis: App.jenis(p.jenis),
          kpa: App.pejabat(p.kpa_id || tugas.kpa_id), ppk: App.pejabat(p.ppk_id || tugas.ppk_id),
          pp: App.pejabat(p.pp_id || tugas.pp_id), penyedia: App.penyedia(p.penyedia_id),
          sp_dipa: tugas.sp_dipa, hps: hpsModel, monev: monevData, dokumen: dok,
          kota: (App.state.master.config && App.state.master.config.kota) || 'Indramayu',
          jabatan_kpa: s.jabatan_kpa || 'Kepala Satuan Kerja',
          nomor: m['no_' + kunci] || '', tanggal: m['tgl_' + kunci] || new Date(),
          no_sp: m.no_sp, tgl_sp: m.tgl_sp, no_sk_ppk: m.no_sk_ppk, tgl_sk_ppk: m.tgl_sk_ppk
        };
      }
      function cetakDok(id) {
        var gen = C.GENERATOR.filter(function (g) { return g.id === id; })[0] || { id: id, field: 'no_' + id };
        Doc.pratinjau(id, konteks(gen), {
          simpanKeBerkas: gen.kode ? function () { simpanKeBerkas(gen); } : null
        }).catch(UI.err);
      }

      function simpanKeBerkas(g) {
        Doc.berkas(g.id, konteks(g)).then(function (r) {
          var file = new File([r.blob], r.nama, { type: 'application/msword' });
          UI.toast('Mengunggah ' + r.nama + '…');
          return Unggah.kirim(file, { paket_id: p.id, kode: g.kode, keterangan: 'dibuat otomatis' });
        }).then(function (row) {
          dok = dok.filter(function (x) { return String(x.kode) !== String(g.kode) || C.DOKUMEN[g.kode - 1].multi; });
          dok.push(row);
          Store.drop('paket.' + App.state.tahun);
          gambarRingkas();
          UI.toast('Dokumen tersimpan sebagai berkas nomor ' + g.kode, 'ok');
        }).catch(UI.err);
      }

      clear(host).appendChild(el('div', null, [ringkas, tabBar, panel]));
      gambarRingkas();
      (tabs.filter(function (t) { return t.id === aktif; })[0] || tabs[0]).render(panel);
    });
  };

  w.PaketPage = Paket;
})(window);