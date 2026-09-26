/* SIPADU - kisi HPS/RAB.
   Menerima tempelan langsung dari Excel (lengkap dengan sel gabung),
   impor berkas .xlsx, atau pengetikan manual. */
(function (w) {
  'use strict';

  var KOLOM_PERAN = [
    { k: 'no', label: 'Nomor' },
    { k: 'uraian', label: 'Uraian pekerjaan' },
    { k: 'volume', label: 'Volume' },
    { k: 'satuan', label: 'Satuan' },
    { k: 'harga', label: 'Harga satuan' },
    { k: 'hps', label: 'HPS (harga + PPN)' },
    { k: 'jumlah', label: 'Jumlah' }
  ];

  function sel(v, o) {
    o = o || {};
    return { v: v == null ? '' : String(v), rs: o.rs || 1, cs: o.cs || 1, b: !!o.b, t: o.t || 'text' };
  }

  function kosong(rows, cols) {
    var m = { cols: cols || 6, rows: [], header: 0, ppn: 11, pembulatan: 0, bulatMode: 0, bulatNilai: 0, bulatArah: 'atas', pagu: 0, map: {}, judul: '' };
    for (var r = 0; r < (rows || 8); r++) {
      var baris = [];
      for (var c = 0; c < m.cols; c++) baris.push(sel(''));
      m.rows.push(baris);
    }
    return m;
  }

  /* Dua format baku sesuai contoh dokumen: pemeliharaan gedung memakai
     URAIAN PEKERJAAN + SATUAN; peralatan/buku/ekstrakomptabel memakai
     NAMA + SPESIFIKASI tanpa kolom satuan. */
  function templateGedung() {
    var m = kosong(4, 6);
    var h = ['NO.', 'URAIAN PEKERJAAN', 'VOLUME', 'SATUAN', 'HARGA SATUAN (Rp)', 'TOTAL (Rp)'];
    m.rows[0] = h.map(function (t) { return sel(t, { b: true }); });
    m.header = 0;
    m.map = { no: 0, uraian: 1, volume: 2, satuan: 3, harga: 4, jumlah: 5 };
    m.tipe = 'gedung';
    return m;
  }
  function templateBarang() {
    var m = kosong(4, 6);
    var h = ['NO.', 'NAMA', 'SPESIFIKASI', 'VOL', 'HARGA SATUAN', 'JUMLAH'];
    m.rows[0] = h.map(function (t) { return sel(t, { b: true }); });
    m.header = 0;
    m.map = { no: 0, uraian: 1, volume: 3, harga: 4, jumlah: 5 };
    m.tipe = 'barang';
    return m;
  }
  /* jenis: id dari CONFIG.JENIS_PENGADAAN. Jenis dengan RAB (pemeliharaan gedung)
     memakai templat gedung; sisanya (peralatan, buku, ekstrakomptabel) memakai templat barang. */
  function contoh(jenis) {
    var j = (w.CONFIG.JENIS_PENGADAAN || []).filter(function (x) { return x.id === jenis; })[0];
    return (j && j.rab === false) ? templateBarang() : templateGedung();
  }

  /* ---------- pembacaan tempelan ---------- */
  function dariHTML(html) {
    var doc = new DOMParser().parseFromString(html, 'text/html');
    var tabel = doc.querySelector('table');
    if (!tabel) return null;
    var taruh = [], pakai = {}, maxKol = 0, trs = tabel.rows;
    for (var r = 0; r < trs.length; r++) {
      var c = 0;
      for (var i = 0; i < trs[r].cells.length; i++) {
        while (pakai[r + ':' + c]) c++;
        var td = trs[r].cells[i];
        var rs = Math.max(1, td.rowSpan || 1), cs = Math.max(1, td.colSpan || 1);
        var teks = (td.textContent || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
        var gaya = (td.getAttribute('style') || '').toLowerCase();
        taruh.push({
          r: r, c: c, rs: rs, cs: cs,
          s: sel(teks, { rs: rs, cs: cs, b: !!td.querySelector('b,strong') || /font-weight:\s*(bold|[6-9]00)/.test(gaya) })
        });
        for (var rr = 0; rr < rs; rr++) for (var cc = 0; cc < cs; cc++) pakai[(r + rr) + ':' + (c + cc)] = 1;
        c += cs;
        if (c > maxKol) maxKol = c;
      }
    }
    return rakit(taruh, trs.length, maxKol);
  }

  function dariTSV(teks) {
    var baris = teks.replace(/\r/g, '').split('\n').filter(function (b, i, a) { return b !== '' || i < a.length - 1; });
    var maxKol = 0, taruh = [];
    baris.forEach(function (b, r) {
      var kol = b.split('\t');
      maxKol = Math.max(maxKol, kol.length);
      kol.forEach(function (v, c) { taruh.push({ r: r, c: c, rs: 1, cs: 1, s: sel(v.trim()) }); });
    });
    return rakit(taruh, baris.length, maxKol);
  }

  function rakit(taruh, nBaris, nKol) {
    var m = kosong(nBaris, nKol || 1);
    m.rows = [];
    for (var r = 0; r < nBaris; r++) {
      var b = []; for (var c = 0; c < m.cols; c++) b.push(null);
      m.rows.push(b);
    }
    taruh.forEach(function (t) {
      if (t.r >= nBaris || t.c >= m.cols) return;
      m.rows[t.r][t.c] = t.s;
    });
    // sel yang tidak tertutup gabungan tetapi masih null -> sel kosong
    var tertutup = {};
    for (var rr = 0; rr < nBaris; rr++) for (var cc = 0; cc < m.cols; cc++) {
      var s = m.rows[rr][cc];
      if (!s) continue;
      for (var a = 0; a < s.rs; a++) for (var b2 = 0; b2 < s.cs; b2++) if (a || b2) tertutup[(rr + a) + ':' + (cc + b2)] = 1;
    }
    for (var r2 = 0; r2 < nBaris; r2++) for (var c2 = 0; c2 < m.cols; c2++) {
      if (!m.rows[r2][c2] && !tertutup[r2 + ':' + c2]) m.rows[r2][c2] = sel('');
    }
    tebakTipe(m);
    tebakPeran(m);
    return m;
  }

  function angka(v) {
    if (v === '' || v == null) return null;
    var s = String(v).trim();
    if (!/[\d]/.test(s)) return null;
    if (!/^[\s\-()Rp.,%\d]+$/i.test(s)) return null;
    var n = Fmt.parseNum(s);
    return isNaN(n) ? null : n;
  }

  function tebakTipe(m) {
    m.rows.forEach(function (baris, r) {
      baris.forEach(function (s) {
        if (!s) return;
        if (r === m.header) { s.b = true; return; }
        if (angka(s.v) !== null && /\d/.test(s.v)) s.t = 'num';
      });
    });
  }

  /* menebak kolom mana yang berisi uraian, volume, satuan, harga, jumlah */
  function tebakPeran(m) {
    var h = m.rows[m.header] || [];
    var peta = {};
    h.forEach(function (s, c) {
      if (!s) return;
      var t = s.v.toLowerCase();
      if (/no\.?$|^no$|nomor/.test(t) && peta.no == null) peta.no = c;
      else if (/uraian|pekerjaan|\bnama\b|spesifikasi|item/.test(t) && peta.uraian == null) peta.uraian = c;
      else if (/volume|vol\b|qty|jumlah barang|banyak/.test(t) && peta.volume == null) peta.volume = c;
      else if (/satuan$|sat\b/.test(t) && peta.satuan == null) peta.satuan = c;
      else if (/harga satuan|harga\b/.test(t) && peta.harga == null) peta.harga = c;
      else if (/^hps|hps\b/.test(t) && peta.hps == null) peta.hps = c;
      else if (/jumlah|total/.test(t) && peta.jumlah == null) peta.jumlah = c;
    });
    if (peta.uraian == null && m.cols > 1) peta.uraian = 1;
    if (peta.jumlah == null && m.cols > 2) peta.jumlah = m.cols - 1;
    m.map = peta;
  }

  /* ---------- hitungan ---------- */
  function hitung(m) {
    var map = m.map || {}, total = 0;
    m.rows.forEach(function (baris, r) {
      if (r <= m.header) return;
      var vol = map.volume != null && baris[map.volume] ? angka(baris[map.volume].v) : null;
      var hrg = map.harga != null && baris[map.harga] ? angka(baris[map.harga].v) : null;
      var hps = null;
      if (map.hps != null && baris[map.hps]) {
        if (hrg !== null) { hps = Math.round(hrg * (1 + (Number(m.ppn) || 0) / 100)); baris[map.hps].v = String(hps); baris[map.hps].t = 'rp'; }
        else hps = angka(baris[map.hps].v);
      }
      var satuanNilai = hps !== null ? hps : hrg;
      if (map.jumlah != null && baris[map.jumlah] && vol !== null && satuanNilai !== null) {
        var j = Math.round(vol * satuanNilai);
        baris[map.jumlah].v = String(j);
        baris[map.jumlah].t = 'rp';
      }
      if (map.jumlah != null && baris[map.jumlah]) {
        var jn = angka(baris[map.jumlah].v);
        if (jn !== null) total += jn;
      }
    });
    m.total = total;
    m.pembulatan = hitungPembulatan(m);
    return totalAkhir(m);
  }

  function totalSaja(m) {
    if (!m || !m.rows) return 0;
    var map = m.map || {}, total = 0;
    if (map.jumlah == null) return Number(m.total) || 0;
    m.rows.forEach(function (baris, r) {
      if (r <= m.header) return;
      var c = baris[map.jumlah]; if (!c) return;
      var n = angka(c.v); if (n !== null) total += n;
    });
    return total;
  }

  /* Hitung nilai pembulatan (selisih) sesuai mode pilihan. Untuk SEMUA mode di bawah,
     m.pembulatan adalah SELISIH (total -> nilai akhir); nilai akhir = total + pembulatan.
     bulatMode:
       0 = tidak dibulatkan
       1 = bulatkan ke kelipatan (bulatNilai: 100 / 1000 / 10000, dst.;
           arah: bulatArah 'atas' (default, ceil) atau 'bawah' (floor))
       2 = nominal pembulatan bebas — bulatNilai adalah NILAI AKHIR yang diinginkan
           (bukan selisih), jadi pembulatan = bulatNilai - total
       3 = sesuaikan agar total akhir = pagu paket, selalu (tanpa syarat pagu > total) —
           pembulatan = pagu - total */
  function hitungPembulatan(m) {
    var mode = Number(m.bulatMode) || 0;
    var total = totalSaja(m);
    if (!mode) { m.pembulatan = 0; return 0; }
    if (mode === 2) {
      var target2 = Number(m.bulatNilai) || 0;
      m.pembulatan = target2 - total;
      return m.pembulatan;
    }
    if (mode === 3) {
      var pagu = Number(m.pagu) || 0;
      m.pembulatan = pagu - total;
      return m.pembulatan;
    }
    /* mode 1: kelipatan, dibulatkan ke atas (ceil) atau ke bawah (floor) sesuai bulatArah */
    var kelipatan = Number(m.bulatNilai) || 0;
    if (!kelipatan) { m.pembulatan = 0; return 0; }
    var keBawah = m.bulatArah === 'bawah';
    var dibulat = (keBawah ? Math.floor(total / kelipatan) : Math.ceil(total / kelipatan)) * kelipatan;
    m.pembulatan = dibulat - total;
    return m.pembulatan;
  }
  function totalAkhir(m) {
    var t = totalSaja(m);
    var p = Number(m.pembulatan) || 0;
    return t + p;
  }

  /* ---------- daftar item ringkas (dipakai tab Menilai/Monev & dokumen Monev) ----------
     Mengembalikan [{ uraian, volume, satuan }, ...] sesuai urutan baris HPS, dilewati
     bila kolom "uraian" belum dipetakan atau baris tanpa uraian (baris kosong/sisipan). */
  function daftarItem(m) {
    var out = [];
    if (!m || !m.rows || !m.map || m.map.uraian == null) return out;
    for (var r = (m.header || 0) + 1; r < m.rows.length; r++) {
      var baris = m.rows[r] || [];
      var uCell = baris[m.map.uraian];
      if (!uCell || !String(uCell.v || '').trim()) continue;
      var vCell = m.map.volume != null ? baris[m.map.volume] : null;
      var sCell = m.map.satuan != null ? baris[m.map.satuan] : null;
      out.push({
        uraian: String(uCell.v).trim(),
        volume: vCell && vCell.v != null ? String(vCell.v).trim() : '',
        satuan: sCell && sCell.v != null ? String(sCell.v).trim() : ''
      });
    }
    return out;
  }

  /* ---------- tabel untuk dokumen ---------- */
  function tabelDokumen(m, opt) {
    opt = opt || {};
    var buang = {};
    if (opt.tanpaHarga) {
      ['harga', 'hps', 'jumlah'].forEach(function (k) { if (m.map && m.map[k] != null) buang[m.map[k]] = 1; });
    }
    var kolomPakai = [];
    for (var c = 0; c < m.cols; c++) if (!buang[c]) kolomPakai.push(c);
    var indeksBaru = {}; kolomPakai.forEach(function (c, i) { indeksBaru[c] = i; });

    var html = '<table class="doc-tabel"><tbody>';
    for (var r = 0; r < m.rows.length; r++) {
      var isi = '', adaIsi = false;
      for (var cc = 0; cc < m.cols; cc++) {
        var s = m.rows[r][cc];
        if (!s || buang[cc]) continue;
        var lebar = 0;
        for (var k = 0; k < s.cs; k++) if (!buang[cc + k]) lebar++;
        if (!lebar) continue;
        var teks = s.v;
        if (s.t === 'rp' || (s.t === 'num' && (cc === m.map.harga || cc === m.map.hps || cc === m.map.jumlah))) {
          var n = angka(teks); if (n !== null) teks = Fmt.num(n, 0);
        }
        if (teks !== '') adaIsi = true;
        isi += '<td' + (s.rs > 1 ? ' rowspan="' + s.rs + '"' : '') + (lebar > 1 ? ' colspan="' + lebar + '"' : '') +
          ' class="' + (s.b ? 'tb ' : '') + (s.t === 'num' || s.t === 'rp' ? 'kanan' : '') + '">' +
          esc(teks).replace(/\n/g, '<br>') + '</td>';
      }
      if (isi) html += '<tr>' + isi + '</tr>';
    }
    if (!opt.tanpaHarga && m.map && m.map.jumlah != null) {
      var total = totalSaja(m);
      /* segarkan pembulatan agar footer konsisten dengan total terkini */
      try { hitungPembulatan(m); } catch (e) { }
      var mode = Number(m.bulatMode) || 0;
      var bulat = Number(m.pembulatan) || 0;
      var akhir = total + bulat;
      var span = Math.max(1, kolomPakai.length - 1);
      html += '<tr><td class="tb" colspan="' + span + '">Total Jumlah</td><td class="tb kanan">' + Fmt.num(total, 0) + '</td></tr>';
      if (mode !== 0) {
        /* Semua mode pembulatan (kelipatan / nominal bebas / sesuaikan pagu): baris
           "Pembulatan" menampilkan NILAI AKHIR (Total Jumlah setelah dibulatkan/
           disesuaikan) — bukan selisihnya. Tidak pernah ada baris Jumlah Akhir. */
        html += '<tr><td class="tb" colspan="' + span + '">Pembulatan</td><td class="tb kanan">' + Fmt.num(akhir, 0) + '</td></tr>';
      }
    }
    return html + '</tbody></table>';
  }

  /* ---------- pustaka Excel dimuat hanya saat dibutuhkan ---------- */
  function muatXLSX() {
    if (w.XLSX) return Promise.resolve(w.XLSX);
    return new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
      s.onload = function () { res(w.XLSX); };
      s.onerror = function () { rej(new Error('Pustaka pembaca Excel gagal dimuat. Gunakan salin-tempel dari Excel sebagai gantinya.')); };
      document.head.appendChild(s);
    });
  }

  function dariWorkbook(wb, namaSheet) {
    var X = w.XLSX, ws = wb.Sheets[namaSheet || wb.SheetNames[0]];
    if (!ws || !ws['!ref']) throw new Error('Lembar kerja kosong.');
    var rng = X.utils.decode_range(ws['!ref']);
    var nBaris = rng.e.r - rng.s.r + 1, nKol = rng.e.c - rng.s.c + 1;
    var gabung = {}, taruh = [];
    (ws['!merges'] || []).forEach(function (mg) {
      var r = mg.s.r - rng.s.r, c = mg.s.c - rng.s.c;
      gabung[r + ':' + c] = { rs: mg.e.r - mg.s.r + 1, cs: mg.e.c - mg.s.c + 1 };
      for (var a = 0; a <= mg.e.r - mg.s.r; a++) for (var b = 0; b <= mg.e.c - mg.s.c; b++) {
        if (a || b) gabung['x' + (r + a) + ':' + (c + b)] = 1;
      }
    });
    for (var r2 = 0; r2 < nBaris; r2++) {
      for (var c2 = 0; c2 < nKol; c2++) {
        if (gabung['x' + r2 + ':' + c2]) continue;
        var addr = X.utils.encode_cell({ r: rng.s.r + r2, c: rng.s.c + c2 });
        var cell = ws[addr];
        var v = cell ? (cell.w != null ? cell.w : cell.v) : '';
        var g = gabung[r2 + ':' + c2] || { rs: 1, cs: 1 };
        taruh.push({ r: r2, c: c2, rs: g.rs, cs: g.cs, s: sel(v == null ? '' : String(v).trim(), { rs: g.rs, cs: g.cs }) });
      }
    }
    return rakit(taruh, nBaris, nKol);
  }

  /* ---------- editor ---------- */
  function editor(host, model, onChange, jenisHint, pagu) {
    var m = model && model.rows && model.rows.length ? model : contoh(jenisHint);
    if (pagu != null) m.pagu = Number(pagu) || 0;
    /* migrasi: versi lama menyimpan bulatMode sebagai kelipatan langsung (100/1000/10000) */
    if (Number(m.bulatMode) >= 100) {
      m.bulatNilai = Number(m.bulatMode) || 0;
      m.bulatMode = 1;
    }
    var pilihan = null, jangkar = null;
    var alat = el('div.hps-alat'), bungkus = el('div.hps-wrap'), ringkas = el('div.hps-total');

    function ubah() { if (onChange) onChange(m); }

    function normalkan() {
      m.cols = Math.max.apply(null, m.rows.map(function (b) { return b.length; }).concat([1]));
      m.rows.forEach(function (b) { while (b.length < m.cols) b.push(sel('')); });
    }

    function gambar() {
      normalkan();
      var tabel = el('table.kisi');
      var thead = el('thead'), trh = el('tr');
      trh.appendChild(el('th', { style: 'min-width:34px' }, ''));
      for (var c = 0; c < m.cols; c++) {
        var peran = '';
        for (var k in m.map) if (m.map[k] === c) peran = k;
        trh.appendChild(el('th', { title: 'Kolom ' + (c + 1) + (peran ? ' · ' + peran : '') },
          String.fromCharCode(65 + (c % 26)) + (peran ? ' · ' + peran : '')));
      }
      thead.appendChild(trh); tabel.appendChild(thead);

      var tb = el('tbody'), frag = document.createDocumentFragment();
      for (var r = 0; r < m.rows.length; r++) {
        var tr = el('tr');
        tr.appendChild(el('th', { style: 'min-width:34px;position:static', text: String(r + 1) }));
        for (var c2 = 0; c2 < m.cols; c2++) {
          var s = m.rows[r][c2];
          if (!s) continue;
          var td = el('td', {
            contenteditable: 'true', spellcheck: 'false',
            rowspan: s.rs > 1 ? s.rs : null, colspan: s.cs > 1 ? s.cs : null,
            class: (s.b ? 'tebal' : ''), 'data-r': r, 'data-c': c2, 'data-t': s.t
          });
          td.textContent = s.v;
          tr.appendChild(td);
        }
        frag.appendChild(tr);
      }
      tb.appendChild(frag); tabel.appendChild(tb);
      clear(bungkus).appendChild(tabel);
      hitungRingkas();
    }

    function hitungRingkas() {
      hitungPembulatan(m);
      var t = totalSaja(m), akhir = totalAkhir(m);
      clear(ringkas);
      ringkas.appendChild(el('span', null, ['Total jumlah: ', el('b', { text: Fmt.rp(t) })]));
      if (m.pembulatan) ringkas.appendChild(el('span.diam', null,
        (Number(m.bulatMode) === 3 ? 'Penyesuaian: ' : 'Pembulatan: ') + Fmt.rp(m.pembulatan)));
      if (akhir !== t) ringkas.appendChild(el('span', null, ['HPS akhir: ', el('b', { text: Fmt.rp(akhir) })]));
      ringkas.appendChild(el('span.diam', null, m.rows.length + ' baris × ' + m.cols + ' kolom'));
    }

    /* pengeditan sel */
    bungkus.addEventListener('input', function (e) {
      var td = e.target.closest('td[data-r]'); if (!td) return;
      var s = m.rows[+td.dataset.r][+td.dataset.c];
      if (s) { s.v = td.textContent.replace(/\s+$/, ''); }
    });
    bungkus.addEventListener('blur', function (e) {
      var td = e.target.closest && e.target.closest('td[data-r]');
      if (td) { hitungRingkas(); ubah(); }
    }, true);
    bungkus.addEventListener('click', function (e) {
      var td = e.target.closest('td[data-r]'); if (!td) return;
      if (e.shiftKey && jangkar) tandai(jangkar, { r: +td.dataset.r, c: +td.dataset.c });
      else { jangkar = { r: +td.dataset.r, c: +td.dataset.c }; tandai(jangkar, jangkar); }
    });
    function tandai(a, b) {
      pilihan = {
        r1: Math.min(a.r, b.r), r2: Math.max(a.r, b.r),
        c1: Math.min(a.c, b.c), c2: Math.max(a.c, b.c)
      };
      $$('td.pilih', bungkus).forEach(function (t) { t.classList.remove('pilih'); });
      $$('td[data-r]', bungkus).forEach(function (t) {
        var r = +t.dataset.r, c = +t.dataset.c;
        if (r >= pilihan.r1 && r <= pilihan.r2 && c >= pilihan.c1 && c <= pilihan.c2) t.classList.add('pilih');
      });
    }

    /* tempel dari Excel */
    bungkus.addEventListener('paste', function (e) {
      var html = e.clipboardData.getData('text/html');
      var teks = e.clipboardData.getData('text/plain');
      if (!/\t|<table/i.test(html + teks)) return;       // tempelan satu sel: biarkan bawaan
      e.preventDefault();
      var baru = html ? dariHTML(html) : null;
      if (!baru) baru = dariTSV(teks);
      if (!baru) return UI.toast('Tempelan tidak dikenali', 'bad');
      baru.ppn = m.ppn; baru.judul = m.judul;
      m = baru; gambar(); ubah();
      UI.toast('Tabel disalin: ' + m.rows.length + ' baris, ' + m.cols + ' kolom', 'ok');
    });

    /* alat */
    function tombol(label, judul, fn) {
      return el('button.btn.kecil', { type: 'button', title: judul || label, onclick: fn }, label);
    }
    alat.appendChild(tombol('Tempel dari Excel', 'Klik sel mana saja lalu tekan Ctrl+V', function () {
      UI.toast('Klik salah satu sel, lalu tekan Ctrl+V');
      var td = $('td[data-r]', bungkus); if (td) td.focus();
    }));
    var berkas = el('input', { type: 'file', accept: '.xlsx,.xls,.csv', style: 'display:none', onchange: function () {
      var f = berkas.files[0]; if (!f) return;
      muatXLSX().then(function (X) {
        var fr = new FileReader();
        fr.onload = function () {
          try {
            var wb = X.read(new Uint8Array(fr.result), { type: 'array', cellDates: false });
            var pilih = wb.SheetNames;
            function pakai(nama) {
              var baru = dariWorkbook(wb, nama);
              baru.ppn = m.ppn; m = baru; gambar(); ubah();
              UI.toast('Berkas dibaca: ' + m.rows.length + ' baris', 'ok');
            }
            if (pilih.length > 1) {
              var s2 = el('select.inp', null, pilih.map(function (n) { return el('option', { value: n }, n); }));
              UI.modal({
                title: 'Pilih lembar kerja', body: el('div.field', null, [el('span.lbl', { text: 'Lembar' }), s2]),
                actions: [{ label: 'Batal' }, { label: 'Ambil', kind: 'primary', onclick: function () { pakai(s2.value); } }]
              });
            } else pakai(pilih[0]);
          } catch (err) { UI.err(err); }
          berkas.value = '';
        };
        fr.readAsArrayBuffer(f);
      }).catch(UI.err);
    } });
    alat.appendChild(berkas);
    alat.appendChild(tombol('Impor .xlsx', 'Baca berkas Excel', function () { berkas.click(); }));
    alat.appendChild(tombol('Gabung sel', 'Gabungkan sel terpilih', function () {
      if (!pilihan || (pilihan.r1 === pilihan.r2 && pilihan.c1 === pilihan.c2)) return UI.toast('Pilih dua sel atau lebih (klik lalu Shift+klik)', 'bad');
      var utama = m.rows[pilihan.r1][pilihan.c1] || sel('');
      var kumpul = [];
      for (var r = pilihan.r1; r <= pilihan.r2; r++) for (var c = pilihan.c1; c <= pilihan.c2; c++) {
        var s = m.rows[r][c];
        if (s && s.v && !(r === pilihan.r1 && c === pilihan.c1)) kumpul.push(s.v);
        if (!(r === pilihan.r1 && c === pilihan.c1)) m.rows[r][c] = null;
      }
      utama.rs = pilihan.r2 - pilihan.r1 + 1; utama.cs = pilihan.c2 - pilihan.c1 + 1;
      if (kumpul.length && !utama.v) utama.v = kumpul.join(' ');
      m.rows[pilihan.r1][pilihan.c1] = utama;
      gambar(); ubah();
    }));
    alat.appendChild(tombol('Pisah sel', 'Batalkan penggabungan', function () {
      if (!pilihan) return UI.toast('Pilih sel gabungan lebih dulu', 'bad');
      var s = m.rows[pilihan.r1][pilihan.c1]; if (!s) return;
      for (var r = pilihan.r1; r < pilihan.r1 + s.rs; r++) for (var c = pilihan.c1; c < pilihan.c1 + s.cs; c++) {
        if (r === pilihan.r1 && c === pilihan.c1) continue;
        m.rows[r][c] = sel('');
      }
      s.rs = 1; s.cs = 1; gambar(); ubah();
    }));
    alat.appendChild(tombol('+ Baris', 'Tambah baris di bawah', function () {
      var pos = pilihan ? pilihan.r2 + 1 : m.rows.length, b = [];
      for (var c = 0; c < m.cols; c++) b.push(sel(''));
      m.rows.splice(pos, 0, b); gambar(); ubah();
    }));
    alat.appendChild(tombol('+ Kolom', 'Tambah kolom di kanan', function () {
      m.cols++; m.rows.forEach(function (b) { b.push(sel('')); }); gambar(); ubah();
    }));
    alat.appendChild(tombol('Hapus baris', 'Hapus baris terpilih', function () {
      if (!pilihan) return UI.toast('Pilih baris lebih dulu', 'bad');
      m.rows.splice(pilihan.r1, pilihan.r2 - pilihan.r1 + 1);
      if (!m.rows.length) m = contoh(jenisHint || m.tipe);
      pilihan = null; gambar(); ubah();
    }));
    alat.appendChild(tombol('Tebal', 'Tebalkan sel terpilih', function () {
      if (!pilihan) return;
      for (var r = pilihan.r1; r <= pilihan.r2; r++) for (var c = pilihan.c1; c <= pilihan.c2; c++) {
        var s = m.rows[r][c]; if (s) s.b = !s.b;
      }
      gambar(); ubah();
    }));
    alat.appendChild(tombol('Format baku', 'Mulai dari susunan kolom standar', function () {
      UI.modal({
        title: 'Pilih format kolom standar',
        body: el('div.rapi', null, [
          el('p.mini', { text: 'Kolom yang ada saat ini akan diganti dengan salah satu susunan baku berikut. Isian yang sudah diketik akan hilang.' }),
          el('div.dok-item', null, [el('div', null, [
            el('div.dok-nama', { text: 'Pemeliharaan gedung' }),
            el('div.dok-file', null, [el('span.diam', { text: 'NO. · URAIAN PEKERJAAN · VOLUME · SATUAN · HARGA SATUAN (Rp) · TOTAL (Rp)' })])
          ])]),
          el('div.dok-item', null, [el('div', null, [
            el('div.dok-nama', { text: 'Peralatan, buku, ekstrakomptabel' }),
            el('div.dok-file', null, [el('span.diam', { text: 'NO. · NAMA · SPESIFIKASI · VOL · HARGA SATUAN · JUMLAH' })])
          ])])
        ]),
        actions: [
          { label: 'Batal' },
          { label: 'Pakai format gedung', onclick: function () { m = templateGedung(); gambar(); ubah(); } },
          { label: 'Pakai format barang', kind: 'primary', onclick: function () { m = templateBarang(); gambar(); ubah(); } }
        ]
      });
    }));
    alat.appendChild(tombol('Peran kolom', 'Tentukan kolom volume, harga, dan jumlah', function () {
      var form = el('div.grid2');
      KOLOM_PERAN.forEach(function (p) {
        var opsi = [{ value: '', label: '— tidak ada —' }];
        for (var c = 0; c < m.cols; c++) opsi.push({ value: String(c), label: 'Kolom ' + String.fromCharCode(65 + c) + ((m.rows[m.header] && m.rows[m.header][c] && m.rows[m.header][c].v) ? ' — ' + m.rows[m.header][c].v : '') });
        form.appendChild(UI.field({ label: p.label, name: p.k, type: 'select', value: m.map[p.k] == null ? '' : String(m.map[p.k]), options: opsi }));
      });
      form.appendChild(UI.field({ label: 'Baris judul tabel (nomor baris)', name: 'header', type: 'number', value: m.header + 1, min: 1 }));
      form.appendChild(UI.field({ label: 'PPN (%)', name: 'ppn', type: 'number', value: m.ppn, step: '0.01', hint: 'Dipakai untuk mengisi kolom HPS dari harga satuan.' }));
      UI.modal({
        title: 'Peran kolom dan hitungan', body: form,
        actions: [{ label: 'Batal' }, {
          label: 'Simpan peran', kind: 'primary', onclick: function () {
            var map = {};
            KOLOM_PERAN.forEach(function (p) {
              var v = form.querySelector('[name="' + p.k + '"]').value;
              if (v !== '') map[p.k] = Number(v);
            });
            m.map = map;
            m.header = Math.max(0, Number(form.querySelector('[name="header"]').value || 1) - 1);
            m.ppn = Number(form.querySelector('[name="ppn"]').value || 0);
            gambar(); ubah();
          }
        }]
      });
    }));
    alat.appendChild(tombol('Hitung', 'Isi kolom HPS dan jumlah lalu totalkan', function () {
      if (m.map.jumlah == null) return UI.toast('Tentukan peran kolom lebih dulu', 'bad');
      hitung(m); gambar(); ubah();
      UI.toast('Total: ' + Fmt.rp(m.total) + ' · HPS akhir: ' + Fmt.rp(totalAkhir(m)), 'ok');
    }));
    alat.appendChild(tombol('Pembulatan', 'Atur pembulatan total HPS', function () {
      var kotak = el('div');
      var info2 = el('p.mini');
      var totalSekarang = totalSaja(m);
      var kotakNilai = el('div'), kotakArah = el('div'), kotakPagu = el('div');
      function segarkan() {
        var mode = Number($('select[name="bulatMode"]', kotak).value) || 0;
        kotakNilai.hidden = mode !== 1 && mode !== 2;
        kotakArah.hidden = mode !== 1;
        kotakPagu.hidden = mode !== 3;
        var fNilai = $('input[name="bulatNilai"]', kotak);
        if (fNilai) fNilai.placeholder = mode === 1 ? 'contoh 1000' : 'contoh 50000000';
        var lblNilai = kotakNilai.querySelector('.lbl');
        if (lblNilai) lblNilai.textContent = mode === 1 ? 'Kelipatan (Rp)' : 'Nilai HPS akhir (Rp)';
        m.bulatMode = mode;
        var fArah = $('select[name="bulatArah"]', kotak);
        if (fArah) m.bulatArah = fArah.value;
        if (mode === 3) m.pagu = Fmt.parseNum($('input[name="pagu"]', kotak).value) || 0;
        hitungPembulatan(m);
        var akhir = totalAkhir(m);
        info2.textContent = mode === 0 ? 'Total tetap: ' + Fmt.rp(totalSekarang) :
          'Pembulatan ' + Fmt.rp(m.pembulatan) + ' → HPS akhir ' + Fmt.rp(akhir) +
          (mode === 3 && !m.pagu ? ' — pagu belum diisi' : '');
      }
      var fMode = UI.field({
        label: 'Opsi pembulatan', name: 'bulatMode', type: 'select',
        value: String(Number(m.bulatMode) || 0),
        options: [
          { value: '0', label: 'Tidak dibulatkan' },
          { value: '1', label: 'Bulatkan ke kelipatan' },
          { value: '2', label: 'Nominal pembulatan bebas' },
          { value: '3', label: 'Sesuaikan dengan pagu' }
        ],
        onchange: function () {
          m.bulatNilai = 0;
          var f = $('input[name="bulatNilai"]', kotak); if (f) f.value = '';
          segarkan();
        }
      });
      kotakNilai.appendChild(UI.field({
        label: 'Kelipatan / nominal (Rp)', name: 'bulatNilai', format: 'rp',
        value: Number(m.bulatNilai) || 0, placeholder: 'contoh 1000',
        oninput: function () { m.bulatNilai = Fmt.parseNum(this.value); segarkan(); }
      }));
      kotakArah.appendChild(UI.field({
        label: 'Arah pembulatan', name: 'bulatArah', type: 'select',
        value: m.bulatArah === 'bawah' ? 'bawah' : 'atas',
        options: [
          { value: 'atas', label: 'Ke atas' },
          { value: 'bawah', label: 'Ke bawah' }
        ],
        hint: 'Ke atas menambah selisih ke total, ke bawah mengurangi.',
        onchange: segarkan
      }));
      kotakPagu.appendChild(UI.field({
        label: 'Pagu paket (Rp)', name: 'pagu', format: 'rp',
        value: Number(m.pagu) || 0, placeholder: 'sesuai paket',
        hint: 'Terisi otomatis dari data paket — ubah bila perlu.',
        oninput: function () { m.pagu = Fmt.parseNum(this.value); segarkan(); }
      }));
      kotak.appendChild(fMode); kotak.appendChild(kotakNilai); kotak.appendChild(kotakArah); kotak.appendChild(kotakPagu); kotak.appendChild(info2);
      segarkan();
      UI.modal({
        title: 'Pembulatan HPS', body: kotak,
        actions: [
          { label: 'Tanpa pembulatan', onclick: function () { m.bulatMode = 0; m.bulatNilai = 0; hitungPembulatan(m); gambar(); ubah(); } },
          { label: 'Terapkan', kind: 'primary', onclick: function () { hitungPembulatan(m); gambar(); ubah(); } }
        ]
      });
    }));
    alat.appendChild(tombol('Kosongkan', 'Mulai dari tabel kosong dengan format kolom yang sama', function () {
      UI.confirm('Kosongkan seluruh isi kisi? Susunan kolom saat ini akan dipertahankan.', function () {
        m = contoh(jenisHint || m.tipe); gambar(); ubah();
      }, { yes: 'Kosongkan', kind: 'danger' });
    }));

    clear(host);
    host.appendChild(alat);
    host.appendChild(el('p.mini', null, 'Klik satu sel lalu tekan Ctrl+V untuk menempel langsung dari Excel — kolom, baris, dan sel gabung ikut tersalin. Klik lalu Shift+klik untuk memilih rentang.'));
    host.appendChild(bungkus);
    host.appendChild(ringkas);
    gambar();

    return {
      model: function () { return m; },
      total: function () { return totalSaja(m); },
      gambar: gambar
    };
  }

  w.HPS = {
    kosong: kosong, contoh: contoh, editor: editor, hitung: hitung, total: totalSaja,
    totalAkhir: totalAkhir, hitungPembulatan: hitungPembulatan,
    tabelDokumen: tabelDokumen, daftarItem: daftarItem, dariHTML: dariHTML, dariTSV: dariTSV, angka: angka
  };
})(window);