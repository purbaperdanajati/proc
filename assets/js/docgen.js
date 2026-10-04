/* SIPADU - pembuat dokumen.
   Seluruh proses berjalan di peramban: server hanya menyimpan data,
   tidak pernah merakit dokumen.

   Tata letak yang dijaga di pratinjau, cetak, .doc, dan .pdf:
   - logo kop diperkecil dan diberi ukuran eksplisit (lihat logo()/kop());
   - baris tabel, paragraf, butir daftar, dan tanda tangan tidak terpotong di batas halaman
     (.pdf: lihat paginasi(); .doc/cetak: lihat rapikan() dan aturan CSS "pemenggalan halaman");
   - bagian bertanda <div class="hal-baru"></div> (mis. HPS pada berkas gabungan KAK+HPS)
     selalu dimulai di halaman baru. */
(function (w) {
  'use strict';

  var DASAR_SK = [
    'Undang-Undang Nomor 17 Tahun 2003 tentang Keuangan Negara (Lembaran Negara Republik Indonesia Tahun 2003 Nomor 47, Tambahan Lembaran Negara Republik Indonesia Nomor 4286);',
    'Undang-Undang Nomor 1 Tahun 2004 tentang Perbendaharaan Negara (Lembaran Negara Republik Indonesia Tahun 2004 Nomor 5, Tambahan Lembaran Negara Republik Indonesia Nomor 4355);',
    'Undang-Undang Nomor 15 Tahun 2004 tentang Pemeriksaan Pengelolaan dan Tanggung Jawab Keuangan Negara (Lembaran Negara Republik Indonesia Tahun 2004 Nomor 66, Tambahan Lembaran Negara Republik Indonesia Nomor 4400);',
    'Undang-Undang Nomor 19 Tahun 2008 tentang Surat Berharga Syariah Negara (Lembaran Negara Republik Indonesia Tahun 2008 Nomor 70);',
    'Peraturan Pemerintah Nomor 45 Tahun 2013 tentang Tata Cara Pelaksanaan Anggaran Pendapatan dan Belanja Negara sebagaimana telah diubah dengan Peraturan Pemerintah Nomor 50 Tahun 2018;',
    'Peraturan Presiden Nomor 83 Tahun 2015 tentang Kementerian Agama (Lembaran Negara Republik Indonesia Tahun 2015 Nomor 168);',
    'Peraturan Presiden Nomor 16 Tahun 2018 tentang Pengadaan Barang/Jasa Pemerintah sebagaimana telah diubah terakhir dengan Peraturan Presiden Nomor 46 Tahun 2025;',
    'Peraturan Menteri Agama Nomor 19 Tahun 2019 tentang Organisasi dan Tata Kerja Instansi Vertikal Kementerian Agama sebagaimana telah diubah dengan Peraturan Menteri Agama Nomor 6 Tahun 2022;',
    'Peraturan Menteri Agama Nomor 6 Tahun 2020 tentang Pejabat Perbendaharaan Negara Pada Kementerian Agama sebagaimana telah diubah dengan Peraturan Menteri Agama Nomor 32 Tahun 2021;',
    'Peraturan Menteri Agama Nomor 4 Tahun 2019 tentang Unit Kerja Pengadaan Barang/Jasa Pada Kementerian Agama (Berita Negara Republik Indonesia Tahun 2019 Nomor 312);',
    'Peraturan Lembaga Kebijakan Pengadaan Barang/Jasa Pemerintah Nomor 14 Tahun 2018 tentang Unit Kerja Pengadaan Barang/Jasa (Berita Negara Republik Indonesia Tahun 2018 Nomor 767);'
  ];

  var DASAR_KAK = [
    'Undang-Undang Nomor 17 Tahun 2003 tentang Keuangan Negara',
    'Undang-Undang Nomor 1 Tahun 2004 tentang Perbendaharaan Negara',
    'Undang-Undang Nomor 15 Tahun 2004 tentang Pemeriksaan Pengelolaan dan Tanggung Jawab Keuangan Negara',
    'Peraturan Pemerintah Nomor 50 Tahun 2018 tentang Perubahan atas Peraturan Pemerintah Nomor 45 Tahun 2013 tentang Tata Cara Pelaksanaan Anggaran Pendapatan dan Belanja Negara',
    'Peraturan Pemerintah Nomor 28 Tahun 2020 tentang Perubahan atas Peraturan Pemerintah Nomor 27 Tahun 2014 tentang Pengelolaan Barang Milik Negara/Daerah',
    'Peraturan Pemerintah Nomor 6 Tahun 2023 tentang Penyusunan Rencana Kerja dan Anggaran',
    'Peraturan Presiden Nomor 12 Tahun 2021 tentang Perubahan atas Peraturan Presiden Nomor 16 Tahun 2018 tentang Pengadaan Barang/Jasa Pemerintah',
    'Peraturan Presiden Nomor 46 Tahun 2025 tentang Perubahan Kedua atas Peraturan Presiden Nomor 16 Tahun 2018 tentang Pengadaan Barang/Jasa Pemerintah',
    'Peraturan Menteri Agama Nomor 72 Tahun 2022 tentang Organisasi dan Tata Kerja Instansi Vertikal Kementerian Agama',
    'Peraturan Lembaga Kebijakan Pengadaan Barang/Jasa Pemerintah Nomor 1 Tahun 2025',
    'Peraturan Lembaga Kebijakan Pengadaan Barang/Jasa Pemerintah Nomor 2 Tahun 2025'
  ];

  var GAYA = `
  @page { size: A4; margin: 2cm 2cm 2cm 2.5cm; }
  body { font: 11pt/1.45 Arial, Helvetica, sans-serif; color: #000; margin: 0; }
  .lembar { width: 17cm; margin: 0 auto; padding: 10px 0 40px; }
  .kop { width:100%; border-collapse:collapse; }
  .kop td { vertical-align: middle; padding:0; }
  .kop .logo { text-align:center; }
  .kop .t1 { font-size:13pt; letter-spacing:.3px; }
  .kop .t2 { font-size:12pt; }
  .kop .t3 { font-size:17pt; font-weight:bold; letter-spacing:.4px; }
  .kop .t4 { font-size:8.5pt; line-height:1.25; }
  .kop-tengah { text-align:center; }
  .garis-kop { border-bottom:3px solid #000; margin-top:3px; font-size:1pt; line-height:1pt; mso-line-height-rule:exactly; }
  .garis-kop.tipis { border-bottom:1px solid #000; margin-top:1px; }
  h1.judul { text-align:center; font-size:12pt; margin:18px 0 2px; text-transform:uppercase; }
  h1.judul.garis { text-decoration:underline; }
  .nomor { text-align:center; font-size:11pt; margin:0 0 14px; }
  p { margin:0 0 8px; text-align:justify; }
  .tengah { text-align:center; }
  .kanan { text-align:right; }
  table.doc-tabel { width:100%; border-collapse:collapse; font-size:9.5pt; margin:8px 0; }
  table.doc-tabel td, table.doc-tabel th { border:1px solid #000; padding:3px 5px; vertical-align:middle; }
  table.doc-tabel .tb { font-weight:bold; }
  table.doc-tabel .kanan { text-align:right; }
  table.tata { width:100%; border-collapse:collapse; }
  table.tata td { vertical-align:top; padding:2px 4px 2px 0; }
  .ttd { width:100%; border-collapse:collapse; margin-top:24px; page-break-inside:avoid; }
  .ttd td { vertical-align:top; text-align:left; }
  .ttd .nm { font-weight:bold; text-decoration:underline; margin-top:62px; }
  ol.dasar { margin:0; padding-left:20px; text-align:justify; }
  ol.dasar li { margin-bottom:5px; }
  ol.huruf { list-style:lower-alpha; margin:0; padding-left:20px; }
  /* ---------- pemenggalan halaman (cetak, .doc, dan PDF) ---------- */
  .hal-baru { page-break-before:always; break-before:page; height:0; margin:0; padding:0; border:0; font-size:1pt; line-height:1pt; }
  table.doc-tabel thead { display:table-header-group; }
  table.doc-tabel tr, table.foto tr, table.ttd tr { page-break-inside:avoid; break-inside:avoid; }
  h1.judul, .nomor { page-break-after:avoid; break-after:avoid; }
  .foto { width:100%; border-collapse:collapse; margin-top:10px; }
  .foto td { border:1px solid #000; height:5.2cm; width:50%; text-align:center; color:#888; font-size:9pt; padding:4px; }
  .foto td img { max-width:100%; max-height:5cm; object-fit:cover; }
  .kecil { font-size:9.5pt; }
  .spasi { height:10px; }
  `;

  /* hanya untuk tampilan layar (pratinjau & iframe PDF); TIDAK ikut ke berkas .doc */
  var GAYA_LAYAR = `
  @media screen {
    body { background:#e8ebe7; }
    .lembar { background:#fff; width:21cm; padding:2cm 2cm 2cm 2.5cm; margin:16px auto; box-shadow:0 2px 14px rgba(0,0,0,.18); }
    .hal-baru { height:20px; margin:28px -2cm 28px -2.5cm; background:#e8ebe7; border-top:1px solid #d0d6d0; border-bottom:1px solid #d0d6d0; position:relative; }
    .hal-baru::after { content:'HALAMAN BARU'; position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); font:9px/1 Arial,Helvetica,sans-serif; letter-spacing:1px; color:#8b958d; }
  }
  `;

  /* ---------- logo kop ----------
     Berkas logo resmi beresolusi besar (mis. 3694x3513 px). Dipakai apa adanya ia
     (1) membuat data URI puluhan-ratusan KB per dokumen dan memperlambat PDF, serta
     (2) tampil sebesar aslinya di Word, karena Word tidak mematuhi CSS width pada <img>.
     Karena itu logo diperkecil sekali lewat canvas (sisi terpanjang LOGO_PX piksel — masih
     sangat tajam pada 2-3 cm di kertas) dan ukuran tampilnya ditulis eksplisit: atribut
     width/height (untuk Word) sekaligus CSS (untuk peramban/html2canvas), dengan proporsi asli.
     Ukuran sisi terpanjang di kertas = CONFIG.LOGO_CM (baku 2,3 cm). */
  var LOGO_PX = 360;                 // resolusi berkas logo yang disematkan
  var PX_CM = 96 / 2.54;             // piksel CSS per cm
  var logoCache = null;              // null = belum dimuat; {src:''} = tidak ada logo
  function logoCm() {
    var v = Number(w.CONFIG && w.CONFIG.LOGO_CM);
    return v >= 1 && v <= 5 ? v : 2.3;
  }
  function bacaDataURI(b) {
    return new Promise(function (res, rej) {
      var fr = new FileReader(); fr.onload = function () { res(fr.result); }; fr.onerror = rej; fr.readAsDataURL(b);
    });
  }
  function muatGambar(src) {
    return new Promise(function (res, rej) {
      var im = new Image(); im.onload = function () { res(im); }; im.onerror = rej; im.src = src;
    });
  }
  function perkecil(im, W, H) {
    var f = Math.min(1, LOGO_PX / Math.max(W, H));
    if (f >= 1) return im.src;                       // sudah kecil
    var tw = Math.max(1, Math.round(W * f)), th = Math.max(1, Math.round(H * f));
    var sumber = im, cw = W, ch = H;
    while (cw / 2 >= tw && ch / 2 >= th) {           // dibagi dua bertahap supaya hasilnya tetap tajam
      var c = document.createElement('canvas');
      cw = Math.floor(cw / 2); ch = Math.floor(ch / 2);
      c.width = cw; c.height = ch;
      var g = c.getContext('2d'); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
      g.drawImage(sumber, 0, 0, cw, ch);
      sumber = c;
    }
    var out = document.createElement('canvas'); out.width = tw; out.height = th;
    var go = out.getContext('2d'); go.imageSmoothingEnabled = true; go.imageSmoothingQuality = 'high';
    go.drawImage(sumber, 0, 0, tw, th);
    return out.toDataURL('image/png');               // PNG: latar transparan tetap terjaga
  }
  function logo() {
    if (logoCache !== null) return Promise.resolve(logoCache);
    return fetch(w.CONFIG.LOGO)
      .then(function (r) { if (!r.ok) throw 0; return r.blob(); })
      .then(bacaDataURI)
      .then(function (uri) {
        return muatGambar(uri).then(function (im) {
          var W = im.naturalWidth || im.width, H = im.naturalHeight || im.height;
          if (!W || !H) throw 0;
          var src;
          try { src = perkecil(im, W, H); } catch (e) { src = uri; }   // gagal diperkecil -> pakai apa adanya (ukuran tampil tetap dikunci)
          var cm = logoCm(), rasio = W / H;
          var cmW = rasio >= 1 ? cm : cm * rasio, cmH = rasio >= 1 ? cm / rasio : cm;
          return { src: src, cmW: cmW, cmH: cmH, pxW: Math.round(cmW * PX_CM), pxH: Math.round(cmH * PX_CM) };
        });
      })
      .then(function (d) { logoCache = d; return d; })
      .catch(function () { logoCache = { src: '' }; return logoCache; });
  }

  function E(s) { return esc(s == null ? '' : s); }

  function kop(s, opt) {
    s = s || {};
    opt = opt || {};
    var alamat = [s.alamat, s.desa, s.kecamatan].filter(Boolean).join(', ');
    var baris2 = [alamat, s.kode_pos ? 'Kode Pos ' + s.kode_pos : ''].filter(Boolean).join(' ');
    var baris3 = [s.telp ? 'Telp/Fax. ' + s.telp : '', s.email ? 'e-mail : ' + s.email : '', s.website || ''].filter(Boolean).join('  ');
    var L = logoCache && logoCache.src ? logoCache : null;
    var sel = Math.max(2.4, logoCm() + 0.1);          // lebar sel logo (kiri = kanan supaya teks tetap di tengah)
    var selAttr = ' width="' + Math.round(sel * PX_CM) + '" style="width:' + sel.toFixed(2) + 'cm"';
    var gambar = L
      ? '<img src="' + L.src + '" width="' + L.pxW + '" height="' + L.pxH + '" alt="" ' +
        'style="width:' + L.cmW.toFixed(2) + 'cm;height:' + L.cmH.toFixed(2) + 'cm">'
      : '';
    return `<table class="kop" width="100%" border="0" cellpadding="0" cellspacing="0"><tr>
      <td class="logo"${selAttr}>${gambar}</td>
      <td class="kop-tengah">
        <div class="t1">KEMENTERIAN AGAMA REPUBLIK INDONESIA</div>
        <div class="t2">${E(w.CONFIG.INSTANSI).toUpperCase()}</div>
        <div class="t3">${E(s.nama || '')}</div>
        <div class="t4">${E(baris2)}</div>
        <div class="t4">${E(baris3)}</div>
      </td>
      <td class="logo"${selAttr}></td></tr></table>
      <div class="garis-kop"></div><div class="garis-kop tipis"></div>`;
  }

  function ttd(kiri, kanan) {
    /* o.label (opsional): baris di atas jabatan, mis. "PIHAK KESATU" — dipisah dari
       o.jabatan supaya keduanya lewat E() masing-masing sekali saja (sebelumnya, kode
       yang menempelkan '<br>' langsung ke dalam string jabatan lalu di-escape lagi oleh
       blok() menghasilkan teks "&lt;br&gt;" mentah di dokumen, bukan baris baru).
       o.nip / o.bawah (opsional, pilih salah satu): baris di bawah nama — o.nip otomatis
       diberi awalan "NIP. ", o.bawah dipakai apa adanya (mis. jabatan penyedia "Direktur"). */
    function blok(o) {
      if (!o) return '';
      return (o.kota ? E(o.kota) + ', ' + E(o.tanggal) + '<br>' : '') +
        (o.label ? E(o.label) + '<br>' : '') +
        E(o.jabatan || '') + ',' +
        '<div class="nm">' + E(o.nama || '..................') + '</div>' +
        (o.nip ? 'NIP. ' + E(o.nip) : (o.bawah ? E(o.bawah) : ''));
    }
    if (!kanan) return `<table class="ttd"><tr><td style="width:50%"></td><td>${blok(kiri)}</td></tr></table>`;
    return `<table class="ttd"><tr><td style="width:50%">${blok(kiri)}</td><td>${blok(kanan)}</td></tr></table>`;
  }

  function tglPanjang(v) { return Fmt.tanggal(v); }
  function terbilangTgl(v) {
    var d = Fmt.toDate(v); if (!d) return '';
    return Fmt.kapital(Fmt.terbilang(d.getDate())) + ' bulan ' + Fmt.bulanText(d.getMonth()) +
      ' tahun ' + Fmt.kapital(Fmt.terbilang(d.getFullYear()));
  }
  function rupiahTerbilang(n) { return Fmt.rp(n) + ' (' + Fmt.kapital(Fmt.terbilang(n)) + ' Rupiah)'; }

  /* Teks "Sumber Dana" di KAK butir 6 mengikuti isi combobox Sumber dana (tab Data paket):
       "DIPA (BOS)"       -> "DIPA (BOS) Satker <nama satker>"
       "DIPA Satker"      -> "DIPA Satker <nama satker>"        (kata "Satker" tidak dobel)
       "DIPA Operasional Perkantoran" -> "DIPA Operasional Perkantoran Satker <nama satker>"
     Isian yang sudah memuat nama satker dicetak apa adanya. */
  function sumberDanaTeks(sumber, namaSatker) {
    var sd = String(sumber == null ? '' : sumber).trim() || 'DIPA';
    var nama = String(namaSatker || '').trim();
    if (!nama || sd.toLowerCase().indexOf(nama.toLowerCase()) >= 0) return sd;
    return /satker\s*$/i.test(sd) ? sd + ' ' + nama : sd + ' Satker ' + nama;
  }

  /* daftar item HPS {uraian, volume, satuan} — dipakai T.bast & T.monev. HPS.daftarItem
     baru ada sejak fitur Monev; kalau hps.js di server belum diperbarui, jangan sampai
     dokumen gagal total karena TypeError — anggap saja daftar itemnya kosong (kedua
     pemanggil sudah punya jalur cadangan sendiri untuk kondisi ini). */
  function itemHPS(h) {
    return (h && h.rows && typeof HPS.daftarItem === 'function') ? HPS.daftarItem(h) : [];
  }

  /* ---------- template ---------- */
  var T = {};

  T.sk_ppk = function (c) { return skPejabat(c, 'ppk'); };
  T.sk_pp = function (c) { return skPejabat(c, 'pp'); };

  function skPejabat(c, jenis) {
    var s = c.satker || {}, p = jenis === 'ppk' ? c.ppk : c.pp, kpa = c.kpa || {};
    var peran = jenis === 'ppk' ? 'PEJABAT PEMBUAT KOMITMEN' : 'PEJABAT PENGADAAN BARANG DAN JASA';
    var peranSingkat = jenis === 'ppk' ? 'Pejabat Pembuat Komitmen (PPK)' : 'Pejabat Pengadaan Barang dan Jasa';
    var nomor = c.nomor || '..........';
    var kepala = 'KEPALA ' + (s.nama || '').toUpperCase();
    var body = `
      <div class="tengah" style="margin-top:16px">
        <b>KEPUTUSAN ${E(kepala)}</b><br>
        <b>NOMOR ${E(nomor)} TAHUN ${E(c.tahun)}</b><br>
        <b>TENTANG</b><br>
        <b>PENUNJUKAN ${peran}</b><br>
        <b>PADA ${E((s.nama || '').toUpperCase())}</b>
        <div class="spasi"></div>
        <b>DENGAN RAHMAT TUHAN YANG MAHA ESA</b>
        <div class="spasi"></div>
        <b>${E(kepala)} :</b>
      </div>
      <table class="tata" style="margin-top:12px">
        <tr><td style="width:2.6cm">Menimbang</td><td style="width:.4cm">:</td><td>
          <ol class="huruf">
            <li>bahwa dalam rangka pelaksanaan kegiatan ${E(c.paket && c.paket.nama || 'Pengadaan Barang dan Jasa')} secara transparan, terintegrasi, dan terpadu sesuai tata nilai Pengadaan Barang/Jasa Pemerintah, perlu menunjuk ${peranSingkat} pelaksana kegiatan dimaksud;</li>
            <li>bahwa berdasarkan pertimbangan sebagaimana dimaksud dalam huruf a, perlu menetapkan Keputusan ${E(Fmt.kapital((s.nama || '').toLowerCase()))} tentang Penunjukan ${peranSingkat};</li>
          </ol></td></tr>
        <tr><td colspan="3" class="spasi"></td></tr>
        <tr><td>Mengingat</td><td>:</td><td><ol class="dasar">${DASAR_SK.map(function (x) { return '<li>' + E(x) + '</li>'; }).join('')}</ol></td></tr>
      </table>
      <div class="tengah" style="margin:14px 0"><b>MEMUTUSKAN</b></div>
      <table class="tata">
        <tr><td style="width:2.6cm">Menetapkan</td><td style="width:.4cm">:</td><td><b>KEPUTUSAN ${E(kepala)} TENTANG PENUNJUKAN ${peran} :</b></td></tr>
        <tr><td colspan="3" class="spasi"></td></tr>
        <tr><td>KESATU</td><td>:</td><td>
          Menunjuk Aparatur Sipil Negara :
          <table class="tata" style="margin:4px 0 6px 10px">
            <tr><td style="width:.5cm">a.</td><td style="width:3.4cm">Nama</td><td style="width:.3cm">:</td><td><b>${E(p && p.nama)}</b></td></tr>
            <tr><td>b.</td><td>NIP</td><td>:</td><td>${E(p && p.nip)}</td></tr>
            <tr><td>c.</td><td>Pangkat / Golongan</td><td>:</td><td>${E(p && p.pangkat)}</td></tr>
            <tr><td>d.</td><td>Jabatan</td><td>:</td><td>${E(p && p.jabatan)}</td></tr>
          </table>
          sebagai ${peranSingkat} pada ${E(s.nama)} yang bersumber dari anggaran DIPA Tahun ${E(c.tahun)}.
        </td></tr>
        <tr><td colspan="3" class="spasi"></td></tr>
        <tr><td>KEDUA</td><td>:</td><td>Segala biaya yang timbul akibat dikeluarkannya keputusan ini dibebankan pada DIPA Tahun Anggaran ${E(c.tahun)} dengan Nomor : ${E(c.sp_dipa || '-')}.</td></tr>
        <tr><td colspan="3" class="spasi"></td></tr>
        <tr><td>KETIGA</td><td>:</td><td>Keputusan ini berlaku sejak tanggal ditetapkan dan apabila terdapat kekeliruan akan diperbaiki sebagaimana mestinya.</td></tr>
      </table>
      <table class="ttd"><tr><td style="width:50%"></td><td>
        <table class="tata"><tr><td>Ditetapkan di</td><td>:</td><td>${E(c.kota || 'Indramayu')}</td></tr>
        <tr><td>Pada Tanggal</td><td>:</td><td>${E(tglPanjang(c.tanggal))}</td></tr></table>
        ${E(c.jabatan_kpa || 'Kepala Satuan Kerja')}<br>Selaku Kuasa Pengguna Anggaran,
        <div class="nm">${E(kpa.nama || '..................')}</div>${kpa.nip ? 'NIP. ' + E(kpa.nip) : ''}
      </td></tr></table>`;
    return { judul: 'SK ' + (jenis === 'ppk' ? 'PPK' : 'PP') + ' - ' + (s.nama || ''), html: kop(s) + body };
  }

  T.kak = function (c) {
    var s = c.satker || {}, pk = c.paket || {}, j = c.jenis || {};
    var pagu = Number(pk.pagu) || 0;
    var spek = c.hps && c.hps.rows ? HPS.tabelDokumen(c.hps, { tanpaHarga: true }) : '<p class="kecil">Spesifikasi teknis terlampir.</p>';
    function br(label, isi) {
      return `<tr><td style="width:3.6cm">${label}</td><td style="width:.4cm">:</td><td>${isi}</td></tr>
              <tr><td colspan="3" style="height:7px"></td></tr>`;
    }
    var body = `
      <h1 class="judul">KERANGKA ACUAN KERJA (KAK) / SPESIFIKASI TEKNIS<br>${E(pk.nama || '')}<br>PADA ${E((s.nama || '').toUpperCase())}</h1>
      <div class="spasi"></div>
      <table class="tata">
        ${br('Pekerjaan', E(pk.nama || ''))}
        ${br('1. LATAR BELAKANG', `<p>Peningkatan kualitas pelayanan publik melalui penyelenggaraan pendidikan dan pelayanan keagamaan yang baik perlu didukung pengelolaan keuangan yang efektif, efisien, transparan, dan akuntabel. Pengadaan barang/jasa yang dibiayai APBN dilaksanakan dengan mengedepankan keterbukaan dan akuntabilitas sehingga diperoleh barang/jasa yang terjangkau dan berkualitas serta dapat dipertanggungjawabkan dari segi fisik, keuangan, maupun manfaatnya.</p>
          <p>Peraturan Presiden Nomor 12 Tahun 2021 tentang Perubahan atas Peraturan Presiden Nomor 16 Tahun 2018 menjadi landasan penguatan tata kelola pengadaan, yang selanjutnya disempurnakan melalui Peraturan Presiden Nomor 46 Tahun 2025 dengan penekanan pada pengadaan yang adaptif, pemanfaatan sistem elektronik, serta prioritas produk dalam negeri.</p>
          <p>${E(s.nama || '')} Tahun Anggaran ${E(c.tahun)} melaksanakan kegiatan ${E(pk.nama || '')} guna menambah dan melengkapi sarana dan prasarana serta fasilitas pendukung layanan, sehingga kegiatan sehari-hari berjalan lebih mudah dan lancar.</p>`)}
        ${br('2. DASAR HUKUM', '<ol class="dasar">' + DASAR_KAK.map(function (x) { return '<li>' + E(x) + '</li>'; }).join('') +
      '<li>Daftar Isian Pelaksanaan Anggaran (DIPA) Satker ' + E(s.nama || '') + ' Tahun Anggaran ' + E(c.tahun) + ' Nomor : ' + E(c.sp_dipa || '-') + '</li></ol>')}
        ${br('3. MAKSUD DAN TUJUAN', `<ol class="huruf"><li>Maksud pengadaan ${E(pk.nama || '')} adalah memenuhi kebutuhan sarana dan prasarana pada ${E(s.nama || '')}.</li>
          <li>Tujuannya adalah meningkatkan kualitas pelayanan pada ${E(s.nama || '')}.</li></ol>`)}
        ${br('4. TARGET DAN SASARAN', `Terpenuhinya kebutuhan sarana dan prasarana sehingga meningkatkan kualitas pelayanan pada ${E(s.nama || '')}.`)}
        ${br('5. NAMA ORGANISASI PENGADAAN', `<table class="tata">
            <tr><td style="width:.5cm">a.</td><td style="width:2.2cm">K/L/D/I</td><td style="width:.3cm">:</td><td>Kementerian Agama</td></tr>
            <tr><td></td><td>Satker</td><td>:</td><td>${E(s.nama || '')}</td></tr>
            <tr><td>b.</td><td>KPA</td><td>:</td><td>${E(c.kpa && c.kpa.nama || '-')}</td></tr>
            <tr><td></td><td>PPK</td><td>:</td><td>${E(c.ppk && c.ppk.nama || '-')}</td></tr>
            <tr><td></td><td>PP</td><td>:</td><td>${E(c.pp && c.pp.nama || '-')}</td></tr></table>`)}
        ${br('6. SUMBER DANA DAN PEMBIAYAAN', `<table class="tata">
            <tr><td style="width:.5cm">a.</td><td style="width:4.2cm">Sumber Dana</td><td style="width:.3cm">:</td><td>${E(sumberDanaTeks(pk.sumber_dana || j.sumber || 'DIPA', s.nama))}</td></tr>
            <tr><td>b.</td><td>Total Perkiraan Biaya</td><td>:</td><td>${E(rupiahTerbilang(pagu))}</td></tr></table>`)}
        ${br('7. JENIS KONTRAK', `<table class="tata">
            <tr><td style="width:.5cm">a.</td><td style="width:5.6cm">Kontrak berdasarkan cara pembayaran</td><td style="width:.3cm">:</td><td>${E(pk.jenis_kontrak || 'Kontrak Harga Satuan')}</td></tr>
            <tr><td>b.</td><td>Kontrak berdasarkan pembebanan Tahun Anggaran</td><td>:</td><td>Kontrak Tahun Tunggal</td></tr></table>`)}
        ${br('8. JANGKA WAKTU PELAKSANAAN', `${E(pk.jangka_waktu || 14)} (${E(Fmt.terbilang(pk.jangka_waktu || 14))}) hari kalender sejak ditandatanganinya Surat Pesanan.`)}
        ${br('9. RUANG LINGKUP DAN LOKASI', `<ol class="huruf"><li>${E(pk.nama || '')}</li><li>Lokasi di ${E(pk.lokasi || s.nama || '')}</li></ol>`)}
        ${br('10. KELUARAN / PRODUK', 'Paket pengadaan ini harus memiliki jaminan kualitas. Apabila ditemukan barang yang mengalami kerusakan, harus dapat dilakukan perbaikan atau penggantian dengan spesifikasi yang sama.')}
        ${br('11. PERSYARATAN PENYEDIA', `<ol class="huruf">
            <li>Memiliki izin usaha yang masih berlaku sesuai bidang pekerjaan (SIUP/NIB dengan KBLI yang sesuai);</li>
            <li>Memiliki TDP atau NIB;</li>
            <li>Akta pendirian perusahaan (CV/PT) beserta perubahannya;</li>
            <li>Tidak dalam pengawasan pengadilan, tidak pailit, kegiatan usaha tidak sedang diberhentikan, dan direksi tidak sedang menjalani sanksi pidana;</li>
            <li>Tidak masuk Daftar Hitam dan tidak pernah wanprestasi pada pekerjaan sebelumnya;</li>
            <li>Memiliki status valid Keterangan Wajib Pajak berdasarkan Konfirmasi Status Wajib Pajak;</li>
            <li>Memiliki pengalaman pekerjaan sejenis paling kurang 1 (satu) pekerjaan dalam 4 (empat) tahun terakhir, kecuali pelaku usaha yang berdiri kurang dari 3 (tiga) tahun.</li></ol>`)}
        ${br('12. METODE PENGADAAN', E(pk.metode || 'Pengadaan Langsung / E-Purchasing'))}
        ${br('13. SPESIFIKASI TEKNIS', spek)}
      </table>
      ${ttd(null, { kota: c.kota || 'Indramayu', tanggal: tglPanjang(c.tanggal), jabatan: 'Pejabat Pembuat Komitmen', nama: c.ppk && c.ppk.nama, nip: c.ppk && c.ppk.nip })}`;
    return { judul: 'KAK - ' + (pk.nama || ''), html: kop(s) + body };
  };

  T.hps = function (c) {
    var s = c.satker || {}, pk = c.paket || {};
    var tabel = c.hps && c.hps.rows ? HPS.tabelDokumen(c.hps, {}) : '<p>Rincian belum diisi.</p>';
    var total = c.hps ? HPS.totalAkhir(c.hps) : 0;
    var body = `
      <h1 class="judul" style="font-size:15pt">HARGA PERKIRAAN SENDIRI (HPS)</h1>
      <p class="tengah" style="margin-top:-6px">${E(pk.nama || '')}<br>${E(s.nama || '')}</p>
      ${tabel}
      <p class="kecil">Terbilang : ${E(Fmt.kapital(Fmt.terbilang(total)))} Rupiah</p>
      ${ttd(null, { kota: c.kota || 'Indramayu', tanggal: tglPanjang(c.tanggal), jabatan: 'Pejabat Pembuat Komitmen', nama: c.ppk && c.ppk.nama, nip: c.ppk && c.ppk.nip })}`;
    return { judul: 'HPS - ' + (pk.nama || ''), html: kop(s) + body };
  };

  /* dokumen gabungan untuk syarat #4 "KAK, HPS + RAB": KAK/Spesifikasi Teknis
     (tanpa harga) diikuti HPS (dengan harga, PPN, total) yang SELALU mulai di
     halaman baru (.hal-baru; dipatuhi cetak, .doc, dan .pdf) dengan kop sendiri --
     satu berkas, tanpa nomor surat; masing-masing memakai tanggalnya sendiri
     (tgl_kak, tgl_hps) dari data paket. */
  T.kak_hps = function (c) {
    var pk = c.paket || {}, m = pk.meta || {};
    function salin(tambahan) {
      var o = {}; for (var k in c) o[k] = c[k];
      for (var k2 in tambahan) o[k2] = tambahan[k2];
      return o;
    }
    var kak = T.kak(salin({ nomor: '', tanggal: m.tgl_kak || new Date() }));
    var hps = T.hps(salin({ nomor: '', tanggal: m.tgl_hps || new Date() }));
    return {
      judul: 'KAK, HPS & RAB - ' + (pk.nama || ''),
      html: kak.html + '<div class="hal-baru"></div>' + hps.html
    };
  };

  T.bast = function (c) {
    var s = c.satker || {}, pk = c.paket || {}, v = c.penyedia || {};
    var jabatanKpa = c.jabatan_kpa || 'Kepala Satuan Kerja';
    var items = itemHPS(c.hps);
    var tabelBarang = items.length
      ? '<table class="doc-tabel"><thead><tr data-kepala="1"><td class="tb tengah" style="width:1.2cm">No</td><td class="tb">Uraian Barang</td>' +
        '<td class="tb tengah" style="width:3cm">Satuan Ukuran</td><td class="tb tengah" style="width:3cm">Volume Barang</td></tr></thead><tbody>' +
        items.map(function (it, i) {
          return '<tr><td class="tengah">' + (i + 1) + '.</td><td>' + E(String(it.uraian)).replace(/\n/g, '<br>') +
            '</td><td class="tengah">' + E(it.satuan || '-') + '</td><td class="tengah">' + E(it.volume || '-') + '</td></tr>';
        }).join('') + '</tbody></table>'
      : '<p class="kecil">Rincian barang belum diisi pada HPS/RAB.</p>';
    var body = `
      <h1 class="judul garis">BERITA ACARA SERAH TERIMA PEKERJAAN</h1>
      <p class="nomor">Nomor : ${E(c.nomor || '..........')}</p>
      <p>Pada hari ini, ${E(Fmt.hariText(c.tanggal))} tanggal ${E(terbilangTgl(c.tanggal))} (${E(Fmt.tglAngka(c.tanggal))}), kami yang bertanda tangan di bawah ini :</p>
      <table class="tata">
        <tr><td style="width:.6cm">1.</td><td style="width:4cm"><b>${E(c.ppk && c.ppk.nama)}</b></td><td style="width:.3cm">:</td>
          <td>Pejabat Pembuat Komitmen bertindak atas nama ${E(jabatanKpa)} ${E(s.nama || '')} sebagaimana Surat Keputusan ${E(jabatanKpa)} ${E(s.nama || '')} Nomor ${E(c.no_sk_ppk || '..........')} tanggal ${E(tglPanjang(c.tgl_sk_ppk || c.tanggal))} tentang Penunjukan Pejabat Pembuat Komitmen Pengadaan Barang dan Jasa Pada ${E(s.nama || '')}</td></tr>
        <tr><td></td><td colspan="3" style="padding-top:6px">Selanjutnya disebut <b>PIHAK KESATU</b></td></tr>
        <tr><td colspan="4" class="spasi"></td></tr>
        <tr><td>2.</td><td><b>${E(v.direktur || '')}</b></td><td>:</td>
          <td>${E(v.jabatan_direktur || 'Direktur')} ${E(v.nama || '')}, bertindak untuk dan atas nama penyedia ${E(v.nama || '')}</td></tr>
        <tr><td></td><td colspan="3" style="padding-top:6px">Selanjutnya disebut <b>PIHAK KEDUA</b></td></tr>
      </table>
      <p style="margin-top:12px">Dengan ini telah disetujui dan disepakati untuk melakukan serah terima hasil pekerjaan dengan ketentuan sebagai berikut :</p>
      <ol class="dasar">
        <li>PIHAK KEDUA dalam kedudukannya seperti di atas telah menyerahkan hasil pekerjaan berupa <b>${E(pk.nama || '')}</b> yang dilaksanakan oleh <b>${E(v.nama || '')}</b> kepada PIHAK KESATU, dan PIHAK KESATU dalam kedudukan seperti tersebut di atas telah menerima hasil pekerjaan tersebut dalam keadaan baik dan prestasi pekerjaan telah mencapai 100% (seratus persen).</li>
        <li>Penyerahan sebagaimana dimaksud pada poin satu di atas, berupa :
          ${tabelBarang}
        </li>
        <li>Serah terima hasil pekerjaan dilaksanakan berdasarkan :
          <ol class="huruf">
            <li>Surat Pesanan Nomor : ${E(c.no_sp || '..........')} tanggal ${E(tglPanjang(c.tgl_sp || c.tanggal))}</li>
            <li>Berita Acara Pemeriksaan Barang Nomor : ${E(c.no_bap || '..........')}</li>
          </ol>
        </li>
      </ol>
      <p>Demikian Berita Acara Serah Terima Pekerjaan ini dibuat dalam rangkap yang diperlukan untuk dapat dipergunakan sebagaimana mestinya.</p>
      ${ttd(
      { label: 'PIHAK KEDUA', jabatan: v.nama || '', nama: v.direktur, bawah: v.jabatan_direktur || 'Direktur' },
      { label: 'PIHAK KESATU', jabatan: 'Pejabat Pembuat Komitmen', nama: c.ppk && c.ppk.nama, nip: c.ppk && c.ppk.nip }
    )}`;
    return { judul: 'BAST - ' + (pk.nama || ''), html: kop(s) + body };
  };

  /* tabel No | Uraian Barang | Satuan Ukuran | Volume Barang dari rincian HPS —
     dipakai T.bast dan T.bap */
  function tabelBarangHTML(c) {
    var items = itemHPS(c.hps);
    return items.length
      ? '<table class="doc-tabel"><thead><tr data-kepala="1"><td class="tb tengah" style="width:1.2cm">No</td><td class="tb tengah">Uraian Barang</td>' +
        '<td class="tb tengah" style="width:3cm">Satuan Ukuran</td><td class="tb tengah" style="width:3cm">Volume Barang</td></tr></thead><tbody>' +
        items.map(function (it, i) {
          return '<tr><td class="tengah">' + (i + 1) + '.</td><td>' + E(String(it.uraian)).replace(/\n/g, '<br>') +
            '</td><td class="tengah">' + E(it.satuan || '-') + '</td><td class="tengah">' + E(it.volume || '-') + '</td></tr>';
        }).join('') + '</tbody></table>'
      : '<p class="kecil">Rincian barang belum diisi pada HPS/RAB.</p>';
  }
  function alamatSatker(s) {
    return [s.alamat, s.desa, s.kecamatan].filter(Boolean).join(', ');
  }
  function rpKoma(n) { return 'Rp. ' + Fmt.num(Math.round(Number(n) || 0), 2); }

  /* BA Pemeriksaan Barang — nomor/tanggal dari field "BA Pemeriksaan Barang" (no_bap/tgl_bap) */
  T.bap = function (c) {
    var s = c.satker || {}, pk = c.paket || {}, v = c.penyedia || {};
    var jabatanKpa = c.jabatan_kpa || 'Kepala Satuan Kerja';
    var body = `
      <h1 class="judul garis">BERITA ACARA PEMERIKSAAN BARANG</h1>
      <p class="nomor">Nomor : ${E(c.nomor || '..........')}</p>
      <p>Pada hari ini, ${E(Fmt.hariText(c.tanggal))} tanggal ${E(terbilangTgl(c.tanggal))} (${E(Fmt.tglAngka(c.tanggal))}), Pejabat Pembuat Komitmen bertindak atas nama ${E(jabatanKpa)} ${E(s.nama || '')} sebagaimana Surat Keputusan ${E(jabatanKpa)} ${E(s.nama || '')} Nomor ${E(c.no_sk_ppk || '..........')} tanggal ${E(tglPanjang(c.tgl_sk_ppk || c.tanggal))} tentang Penunjukan Pejabat Pembuat Komitmen Pengadaan Barang dan Jasa Pada ${E(s.nama || '')}, telah melakukan pemeriksaan terhadap <b>${E(pk.nama || '')}</b> dilaksanakan oleh ${E(v.nama || '..........')}${v.alamat ? ' yang beralamat di ' + E(v.alamat) : ''}.</p>
      <p style="margin-bottom:2px">Berdasarkan antara lain :</p>
      <ol class="dasar" style="list-style:decimal"><li>Surat Pesanan Nomor : ${E(c.no_sp || '..........')} tanggal ${E(tglPanjang(c.tgl_sp || c.tanggal))}</li></ol>
      <p style="margin-top:6px">Adapun hasil pemeriksaan adalah sebagai berikut :</p>
      ${tabelBarangHTML(c)}
      <p>Kesimpulan hasil penelitian dan pemeriksaan terhadap prestasi pekerjaan yang telah dilaksanakan antara lain :</p>
      <ol class="dasar" style="list-style:decimal">
        <li>Kemajuan pelaksanaan tersebut sebesar 100% (seratus persen)</li>
        <li>Hal-hal lain yang luput dari pemeriksaan dan menyimpang atau tidak sesuai dengan Surat Pesanan menjadi tanggungjawab Penyedia Barang</li>
      </ol>
      <p style="margin-top:10px">Demikian Berita Acara Pemeriksaan ini dibuat dalam rangkap yang diperlukan untuk dapat dipergunakan sebagaimana mestinya.</p>
      ${ttd(
      { label: 'PIHAK KEDUA', jabatan: v.nama || '', nama: v.direktur, bawah: v.jabatan_direktur || 'Direktur' },
      { label: 'PIHAK KESATU', jabatan: 'Pejabat Pembuat Komitmen', nama: c.ppk && c.ppk.nama, nip: c.ppk && c.ppk.nip }
    )}`;
    return { judul: 'BA Pemeriksaan Barang - ' + (pk.nama || ''), html: kop(s) + body };
  };

  /* BA Pembayaran — nomor/tanggal dari field "BA Pembayaran" (no_bayar/tgl_bayar).
     Nilai kontrak diambil dari Nilai kontrak paket (dianggap sudah termasuk PPN); bila kosong,
     dipakai total HPS. DPP = nilai / (1 + PPN%), PPN% mengikuti pengaturan pada rincian HPS (baku 11%).
     Jenis pengadaan tanpa PPN (JENIS_PENGADAAN[].ppn === false, mis. buku): PPN 0 dan barisnya tidak dicetak. */
  T.bayar = function (c) {
    var s = c.satker || {}, pk = c.paket || {}, v = c.penyedia || {}, ppk = c.ppk || {};
    var nilai = Number(pk.nilai) || (c.hps && c.hps.rows ? HPS.totalAkhir(c.hps) : 0);
    var kenaPpn = !(c.jenis && c.jenis.ppn === false);          // jenis tanpa PPN (mis. buku): tanpa rincian PPN
    var ppnPersen = !kenaPpn ? 0 : ((c.hps && c.hps.ppn != null && c.hps.ppn !== '') ? Number(c.hps.ppn) || 0 : 11);
    var dpp = ppnPersen ? Math.round(nilai / (1 + ppnPersen / 100)) : nilai;
    var ppn = nilai - dpp;
    var namaRek = v.nama_rekening || v.nama || '..........';
    var alamatS = alamatSatker(s);
    function baris(no, label, isi) {
      return '<tr><td style="width:.7cm">' + no + '</td><td style="width:3.6cm">' + label + '</td><td style="width:.3cm">:</td><td>' + isi + '</td></tr>';
    }
    function hitung(label, nominal) {
      return '<tr><td>' + label + '</td><td style="width:.8cm;text-align:center">=</td><td style="width:2.4cm">Rp.</td><td style="width:3.2cm;text-align:right">' + Fmt.num(Math.round(nominal), 2) + '</td></tr>';
    }
    var body = `
      <h1 class="judul garis">BERITA ACARA PEMBAYARAN</h1>
      <p class="nomor">Nomor : ${E(c.nomor || '..........')}</p>
      <p>Pada hari ini, ${E(Fmt.hariText(c.tanggal))} tanggal ${E(terbilangTgl(c.tanggal))} (${E(Fmt.tglAngka(c.tanggal))}), bertempat di ${E(s.nama || '')}${alamatS ? ' ' + E(alamatS) : ''}, para pihak yang bertanda tangan di bawah ini :</p>
      <table class="tata">
        ${baris('I.', 'Nama', E(ppk.nama || '..........'))}
        ${baris('', 'NIP', E(ppk.nip || '-'))}
        ${baris('', 'Jabatan', 'PPK Pengadaan Barang dan Jasa pada ' + E(s.nama || ''))}
        ${baris('', 'Alamat', E(alamatS || '-'))}
        <tr><td></td><td colspan="3" style="padding:6px 0 8px">selanjutnya disebut <b>Pihak Kesatu</b></td></tr>
        ${baris('II.', 'Nama', E(v.direktur || '..........'))}
        ${baris('', 'Badan Usaha', E(v.nama || '..........'))}
        ${baris('', 'Jabatan', E(v.jabatan_direktur || 'Direktur'))}
        ${baris('', 'Alamat', E(v.alamat || '-'))}
        <tr><td></td><td colspan="3" style="padding:6px 0 8px">selanjutnya disebut <b>Pihak Kedua</b></td></tr>
      </table>
      <p style="margin-bottom:4px">menyatakan bahwa :</p>
      <table class="tata">
        <tr><td style="width:.7cm">A.</td><td colspan="3">Sesuai data pekerjaan :</td></tr>
        <tr><td></td><td colspan="3">
          <table class="tata">
            <tr><td style="width:.7cm">1.</td><td style="width:3.6cm">Paket Pekerjaan</td><td style="width:.3cm">:</td><td>${E(pk.nama || '')}</td></tr>
            <tr><td>2.</td><td>Lokasi</td><td>:</td><td>${E(pk.lokasi || s.nama || '')}</td></tr>
            <tr><td>3.</td><td>Penyedia Jasa</td><td>:</td><td>${E(v.nama || '..........')}</td></tr>
            <tr><td>4.</td><td>Surat Pesanan</td><td>:</td><td>Nomor : ${E(c.no_sp || '..........')}<br>Tanggal : ${E(tglPanjang(c.tgl_sp || c.tanggal))}</td></tr>
            <tr><td>5.</td><td>Nilai Kontrak</td><td>:</td><td>${E(rpKoma(nilai))} (${E(Fmt.kapital(Fmt.terbilang(nilai)))} Rupiah)</td></tr>
            <tr><td>6.</td><td>Addendum I</td><td>:</td><td>Nomor : -<br>Tanggal : -</td></tr>
            <tr><td>7.</td><td>Nilai Kontrak Addendum I</td><td>:</td><td>Rp. -</td></tr>
          </table></td></tr>
        <tr><td colspan="4" class="spasi"></td></tr>
        <tr><td>B.</td><td colspan="3"><p style="margin:0">Berdasarkan Surat Pesanan dan Berita Acara Pemeriksaan Pekerjaan, maka <b>Pihak Kedua</b> berhak menerima pembayaran 100% dari nilai kontrak dari <b>Pihak Kesatu</b>, dengan rincian sebagai berikut :</p></td></tr>
        <tr><td></td><td colspan="3">
          <table class="tata">
            <tr><td style="width:.7cm">1.</td><td colspan="4">Perhitungan Pembayaran</td></tr>
            <tr><td></td><td colspan="4"><table class="tata" style="width:auto">
              <tr><td>100% x ${E(rpKoma(dpp))}</td><td style="width:.8cm;text-align:center">=</td><td style="width:1.2cm">Rp.</td><td style="width:3.2cm;text-align:right">${Fmt.num(dpp, 2)}</td></tr>
              ${ppnPersen ? hitung('PPN ' + Fmt.num(ppnPersen, 2).replace(/,00$/, '') + '%', ppn).replace('<td style="width:2.4cm">Rp.</td>', '<td>Rp.</td>') : ''}
            </table></td></tr>
            <tr><td>2.</td><td colspan="4">Rekapitulasi pembayaran kontrak :</td></tr>
            <tr><td></td><td colspan="4"><table class="tata" style="width:auto">
              <tr><td style="width:6.4cm">Nilai Kontrak</td><td style="width:.8cm;text-align:center">=</td><td style="width:1.2cm">Rp.</td><td style="width:3.2cm;text-align:right">${Fmt.num(nilai, 2)}</td></tr>
              <tr><td>Pembayaran BAP yang lalu</td><td style="text-align:center">=</td><td>Rp.</td><td style="text-align:right">${Fmt.num(0, 2)}</td></tr>
              <tr><td>Pembayaran BAP ini</td><td style="text-align:center">=</td><td>Rp.</td><td style="text-align:right">${Fmt.num(nilai, 2)}</td></tr>
              <tr><td>Pembayaran s.d. BAP ini</td><td style="text-align:center">=</td><td>Rp.</td><td style="text-align:right">${Fmt.num(nilai, 2)}</td></tr>
              <tr><td>Sisa pembayaran kontrak s.d. BAP ini</td><td style="text-align:center">=</td><td>Rp.</td><td style="text-align:right">${Fmt.num(0, 2)}</td></tr>
            </table></td></tr>
          </table></td></tr>
        <tr><td colspan="4" class="spasi"></td></tr>
        <tr><td>C.</td><td colspan="3"><p style="margin:0"><b>Pihak Kedua</b> sepakat atas jumlah pembayaran tersebut di atas dibayarkan kepada <b>${E(v.bank || '..........')}</b> Rekening Nomor <b>${E(v.no_rekening || '..........')}</b> atas nama penyedia <b>${E(namaRek)}</b></p></td></tr>
      </table>
      <p style="margin-top:10px">Demikian Berita Acara Pembayaran ini dibuat dengan sebenarnya dalam rangkap 2 (dua) untuk dapat dipergunakan sebagaimana mestinya.</p>
      <table class="ttd" style="margin-top:14px">
        <tr><td colspan="2">Para Pihak :</td></tr>
        <tr><td style="width:7.2cm;padding-top:12px">1. ${E(ppk.nama || '..................')}<br>&nbsp;&nbsp;&nbsp;&nbsp;Pejabat Pembuat Komitmen</td><td style="padding-top:12px">: ……………………………………………</td></tr>
        <tr><td style="padding-top:26px">2. ${E(v.direktur || '..................')}<br>&nbsp;&nbsp;&nbsp;&nbsp;${E(v.jabatan_direktur || 'Direktur')} ${E(v.nama || '')}</td><td style="padding-top:26px">: ……………………………………………</td></tr>
      </table>`;
    return { judul: 'BA Pembayaran - ' + (pk.nama || ''), html: kop(s) + body };
  };

  T.monev = function (c) {
    var s = c.satker || {}, pk = c.paket || {}, v = c.penyedia || {};
    var mv = c.monev || {};
    /* kesimpulan: pakai catatan hasil tab "Menilai (Monev)" bila sudah diisi; kalau belum
       pernah diisi (paket lama / belum dinilai), pakai kalimat baku seperti sebelumnya. */
    var kesimpulan = String(mv.catatan || '').trim() ||
      'Pelaksanaan pekerjaan telah terealisasi 100% (seratus persen) sesuai Surat Pesanan. Seluruh pekerjaan sudah memenuhi spesifikasi yang ditetapkan dan berada dalam kondisi baik serta siap dimanfaatkan sesuai peruntukannya.';
    var lamp = '';
    if (c.hps && c.hps.rows) {
      var items = itemHPS(c.hps);
      var mvItems = mv.items || [];

      /* tabel rencana vs realisasi per item, sesuai hasil penilaian di tab Monev */
      var tBody = items.length
        ? '<table class="doc-tabel"><thead><tr data-kepala="1"><td class="tb">No</td><td class="tb">Uraian Pekerjaan</td>' +
          '<td class="tb" style="width:2.6cm">Rencana</td><td class="tb" style="width:2.6cm">Realisasi</td>' +
          '<td class="tb" style="width:3.6cm">Keterangan</td></tr></thead><tbody>' +
          items.map(function (it, i) {
            var d = mvItems[i] || {};
            var rencana = (it.volume || '-') + (it.satuan ? ' ' + it.satuan : '');
            var realisasi = d.realisasi != null && d.realisasi !== '' ? String(d.realisasi) : String(it.volume || '');
            return '<tr><td class="tengah">' + (i + 1) + '</td><td>' + E(String(it.uraian)).replace(/\n/g, '<br>') +
              '</td><td class="tengah">' + E(rencana) +
              '</td><td class="tengah">' + E((realisasi || '-') + (realisasi && it.satuan ? ' ' + it.satuan : '')) +
              '</td><td>' + E(d.keterangan || '-') + '</td></tr>';
          }).join('') + '</tbody></table>'
        : HPS.tabelDokumen(c.hps, { tanpaHarga: true });

      /* dokumentasi foto: berkas #13 bertipe gambar yang diunggah lewat tab Monev / Berkas */
      var fotoTag = function (f) {
        return '<img src="https://drive.google.com/thumbnail?id=' + E(f.file_id) + '&sz=w900" alt="' + E(f.nama_file || 'Foto dokumentasi') + '">';
      };
      var semuaFoto = (c.dokumen || []).filter(function (x) { return String(x.kode) === '13' && /^image\//i.test(x.mime || ''); });
      var fotoTampil = semuaFoto.slice(-6);
      var fotoHtml;
      if (fotoTampil.length) {
        var barisFoto = [];
        for (var i2 = 0; i2 < fotoTampil.length; i2 += 2) {
          barisFoto.push('<tr><td>' + fotoTag(fotoTampil[i2]) + '</td><td>' +
            (fotoTampil[i2 + 1] ? fotoTag(fotoTampil[i2 + 1]) : '') + '</td></tr>');
        }
        fotoHtml = '<table class="foto">' + barisFoto.join('') + '</table>' +
          (semuaFoto.length > fotoTampil.length
            ? '<p class="kecil">+' + (semuaFoto.length - fotoTampil.length) + ' foto lainnya, lihat tab Berkas (13).</p>' : '');
      } else {
        fotoHtml = '<table class="foto"><tr><td colspan="2">Belum ada dokumentasi foto diunggah</td></tr></table>';
      }

      lamp = `<div class="hal-baru"></div><div><p><b>Lampiran Hasil Monitoring dan Evaluasi ${E(pk.nama || '')} pada ${E(s.nama || '')}</b></p>
        ${tBody}
        <p style="margin-top:14px"><b>Dokumentasi Monitoring dan Evaluasi</b></p>
        ${fotoHtml}</div>`;
    }
    var body = `
      <h1 class="judul garis">BERITA ACARA HASIL MONITORING DAN EVALUASI</h1>
      <p class="nomor">Nomor : ${E(c.nomor || '..........')}</p>
      <p>Pada hari ini ${E(Fmt.hariText(c.tanggal))} tanggal ${E(terbilangTgl(c.tanggal))} (${E(Fmt.iso(c.tanggal))}), Pejabat Pembuat Komitmen bertindak atas nama ${E(c.jabatan_kpa || 'Kepala Satuan Kerja')} ${E(s.nama || '')} sebagaimana Surat Keputusan Nomor ${E(c.no_sk_ppk || '..........')} tanggal ${E(tglPanjang(c.tgl_sk_ppk || c.tanggal))} tentang Penunjukan Pejabat Pembuat Komitmen Pengadaan Barang dan Jasa pada ${E(s.nama || '')}, telah melakukan kegiatan monitoring dan evaluasi terhadap pekerjaan <b>${E(pk.nama || '')}</b> yang dilaksanakan oleh <b>${E(v.nama || '..........')}</b>${v.alamat ? ' yang beralamat di ' + E(v.alamat) : ''}.</p>
      <p>Berdasarkan antara lain :</p>
      <ol class="dasar"><li>Kontrak/Surat Pesanan Nomor : ${E(c.no_sp || '..........')} tanggal ${E(tglPanjang(c.tgl_sp || c.tanggal))}</li></ol>
      <p>Adapun hasil monitoring dan evaluasi adalah sebagaimana terlampir.</p>
      <p>Kesimpulan hasil monitoring dan evaluasi terhadap prestasi pekerjaan yang telah dilaksanakan adalah sebagai berikut :</p>
      <p style="text-align:justify">${E(kesimpulan).replace(/\n/g, '<br>')}</p>
      <p>Demikian Berita Acara Hasil Monitoring dan Evaluasi ini dibuat dalam rangkap yang diperlukan untuk dapat dipergunakan sebagaimana mestinya.</p>
      ${ttd(null, { kota: c.kota || 'Indramayu', tanggal: tglPanjang(c.tanggal), jabatan: 'Pejabat Pembuat Komitmen', nama: c.ppk && c.ppk.nama, nip: c.ppk && c.ppk.nip })}
      ${lamp}`;
    return { judul: 'Monev - ' + (pk.nama || ''), html: kop(s) + body };
  };

  /* ---------- penyempurnaan HTML sebelum dipakai ----------
     Dipakai oleh pratinjau, cetak, PDF, dan .doc:
     - judul, nomor, kalimat pengantar berakhiran ":" dan kalimat penutup sebelum tanda tangan
       diberi penanda "lekat" (data-lekat + page-break-after:avoid) supaya tidak terpisah
       halaman dari blok sesudahnya;
     - khusus .doc (untukWord): baris tabel dilarang terbelah, dan pemisah halaman ditulis
       sebagai paragraf ber-page-break-before — bentuk yang dipatuhi Word (kelas CSS pada
       <div> berisi tabel diabaikan Word). */
  function rapikan(html, untukWord) {
    var dok = new DOMParser().parseFromString('<!DOCTYPE html><html><body>' + html + '</body></html>', 'text/html');
    var body = dok.body;
    function tiap(sel, fn) { Array.prototype.forEach.call(body.querySelectorAll(sel), fn); }
    /* gaya ditulis langsung ke atribut style (BUKAN lewat n.style.*): Chrome menyimpan
       page-break-* sebagai break-* saat diserialisasi, nama yang tidak dikenali Word */
    function gaya(n, css) {
      var s = n.getAttribute('style') || '';
      n.setAttribute('style', s + (s && !/;\s*$/.test(s) ? ';' : '') + css);
    }
    function lekat(n) { n.setAttribute('data-lekat', '1'); gaya(n, 'page-break-after:avoid'); }
    tiap('h1.judul, p.nomor', lekat);
    tiap('h1.judul', function (h) {
      var nx = h.nextElementSibling;
      if (nx && nx.tagName === 'P' && nx.classList.contains('tengah')) lekat(nx);
    });
    tiap('p', function (p) {
      var nx = p.nextElementSibling;
      if (!nx) return;
      var teks = (p.textContent || '').replace(/\s+$/, '');
      var subjudul = p.children.length === 1 && /^(B|STRONG)$/.test(p.children[0].tagName) &&
        (p.children[0].textContent || '').trim() === teks.trim();
      if (/:$/.test(teks) || subjudul || nx.classList.contains('ttd')) lekat(p);
    });
    if (untukWord) {
      tiap('table.doc-tabel tr, table.foto tr, table.ttd tr', function (tr) { gaya(tr, 'page-break-inside:avoid'); });
      tiap('.hal-baru', function (n) {
        var p = dok.createElement('p');
        p.setAttribute('style', 'margin:0;padding:0;font-size:1pt;line-height:1pt;mso-line-height-rule:exactly;page-break-before:always');
        p.innerHTML = '&nbsp;';
        n.parentNode.replaceChild(p, n);
      });
    }
    return body.innerHTML;
  }

  /* ---------- paginasi untuk PDF ----------
     PDF dibuat dari SATU kolom panjang hasil html2canvas yang lalu dipotong per halaman.
     Kalau kolom itu dipotong buta di tinggi kertas, baris tabel dan teks terbelah di tengah.
     Karena itu, sebelum dirasterisasi, kolom "dipaginasi" dulu:
       1. isi dipecah menjadi UNIT yang tak boleh terbelah — baris tabel bergaris (baris yang
          disatukan rowspan dihitung satu), baris tabel tata letak, paragraf, butir daftar,
          blok tanda tangan, kop;
       2. unit yang melewati batas halaman didorong ke awal halaman berikut dengan menyisipkan
          spasi kosong di depannya (baris spasi di dalam tabel, <div> di luar tabel);
       3. unit berpenanda lekat (judul, kalimat pengantar ":", 3 baris terakhir tabel + tanda
          tangan) ikut pindah bersama unit sesudahnya;
       4. .hal-baru memaksa unit berikutnya mulai di halaman baru;
       5. tabel bergaris yang bersambung ke halaman berikut mengulang baris kepalanya.
     Setelah itu tiap halaman persis setinggi `tinggi` px, sehingga kanvas tinggal dipotong
     kelipatannya. Mengembalikan { tinggi, halaman, pxCm }. */
  var ISI_W_CM = 17, ISI_H_CM = 25.7;      // area isi per halaman PDF (A4 dikurangi margin 2 cm)

  function paginasi(lembar) {
    var doc = lembar.ownerDocument, win = doc.defaultView;
    var pxCm = lembar.getBoundingClientRect().width / ISI_W_CM;
    var H = Math.floor(ISI_H_CM * pxCm);   // tinggi isi satu halaman, px CSS (bilangan bulat)
    if (!(pxCm > 5 && H > 200)) throw new Error('Lebar lembar tidak valid (iframe belum tertata)');
    var TOL = 0.75;                        // toleransi pengukuran
    var LONGGAR = 1;                       // sisa 1px di tepi halaman agar garis tabel tak terpotong
    var ATOM = H * 0.14;                   // blok/baris sependek ini (~3,6 cm) tidak dipecah
    var unit = [], dorongan = 0;

    /* ----- ukur ----- */
    function y0() { return lembar.getBoundingClientRect().top; }
    function atas(e) { return e.getBoundingClientRect().top - y0(); }
    function bawah(e) { return e.getBoundingClientRect().bottom - y0(); }
    function tinggi(e) { return e.getBoundingClientRect().height; }
    function gaya(e) { return win.getComputedStyle(e); }
    function angka(v) { return parseFloat(v) || 0; }
    function blokKah(n) {
      if (n.nodeType !== 1) return false;
      var d = gaya(n).display;
      return d !== 'none' && d !== 'contents' && d.indexOf('inline') !== 0;
    }
    function punyaBlok(e) {
      for (var c = e.firstElementChild; c; c = c.nextElementSibling) if (blokKah(c)) return true;
      return false;
    }
    function kosongKecil(e) {
      return tinggi(e) < 14 && !/\S/.test(e.textContent || '') && !e.querySelector('img');
    }

    /* teks/inline yang berdampingan dengan blok dibungkus <div data-anon> supaya bisa jadi unit */
    function bungkusInline(wadah) {
      var anak = Array.prototype.slice.call(wadah.childNodes);
      if (!anak.some(blokKah)) return;
      var lari = [];
      function tutup() {
        if (lari.length && lari.some(function (n) { return n.nodeType === 1 || /\S/.test(n.nodeValue); })) {
          var b = doc.createElement('div');
          b.setAttribute('data-anon', '1');
          wadah.insertBefore(b, lari[0]);
          lari.forEach(function (n) { b.appendChild(n); });
        }
        lari = [];
      }
      anak.forEach(function (n) {
        if (n.nodeType === 1 && blokKah(n)) tutup();
        else if (n.nodeType === 1 || n.nodeType === 3) lari.push(n);
      });
      tutup();
    }

    /* ----- kumpulkan unit (urutan dokumen) ----- */
    function lekatBawaan(e) {
      if (e.hasAttribute('data-lekat') || e.classList.contains('kop')) return true;
      return e.hasAttribute('data-anon') && /:\s*$/.test(e.textContent || '');
    }
    function tambah(u) {
      if (!u.paksa) { u.lekat = !!u.lekat || lekatBawaan(u.akhir || u.el); }
      unit.push(u);
    }
    function jumlahKolom(t) {
      var m = 0;
      Array.prototype.forEach.call(t.rows, function (r) {
        var s = 0; Array.prototype.forEach.call(r.cells, function (c) { s += c.colSpan || 1; });
        if (s > m) m = s;
      });
      return m || 1;
    }
    function bergaris(t) { return t.classList.contains('doc-tabel') || t.classList.contains('foto'); }

    function kumpulTabelBergaris(t) {
      var rows = Array.prototype.slice.call(t.rows), n = rows.length;
      if (!n) return;
      var ujung = rows.map(function (r, i) {
        var e = i;
        Array.prototype.forEach.call(r.cells, function (c) { e = Math.max(e, i + (c.rowSpan || 1) - 1); });
        return e;
      });
      var kepalaAkhir = -1;
      rows.forEach(function (r, i) {
        if (r.parentNode.tagName === 'THEAD' || r.hasAttribute('data-kepala')) kepalaAkhir = Math.max(kepalaAkhir, i, ujung[i]);
      });
      t.__kepala = rows.filter(function (r) { return r.parentNode.tagName === 'THEAD' || r.hasAttribute('data-kepala'); });
      /* kelompok baris: baris yang disatukan rowspan tidak boleh dipisah */
      var grup = [], i = 0;
      while (i < n) {
        var b = ujung[i], j = i + 1;
        while (j <= b && j < n) { if (ujung[j] > b) b = ujung[j]; j++; }
        if (b >= n) b = n - 1;
        grup.push({ a: i, b: b });
        i = b + 1;
      }
      var k0 = 0;
      while (k0 < grup.length - 1 && grup[k0].b <= kepalaAkhir) k0++;
      var us = [{ el: rows[0], akhir: rows[grup[k0].b], baris: true, tabel: t, pertama: true }];
      for (var k = k0 + 1; k < grup.length; k++) us.push({ el: rows[grup[k].a], akhir: rows[grup[k].b], baris: true, tabel: t });
      /* tiga kelompok terakhir ikut pindah bersama blok sesudah tabel (total, terbilang, tanda tangan) */
      for (var q = Math.max(1, us.length - 3); q < us.length; q++) us[q].lekat = true;
      us.forEach(tambah);
    }

    function kumpulBarisTata(tr) {
      var h = tinggi(tr);
      if (h < 14) return;                                  // baris pemisah tipis
      var t = tr.closest('table');
      if (h <= ATOM) { tambah({ el: tr, akhir: tr, baris: true, tabel: t }); return; }
      /* sel utama = sel dengan ISI tertinggi (tinggi kotak semua sel dalam satu baris sama,
         jadi sel label pendek tidak boleh terpilih hanya karena kotaknya setinggi baris) */
      var utama = null, tmax = 0;
      Array.prototype.forEach.call(tr.cells, function (c) {
        var rg = doc.createRange(); rg.selectNodeContents(c);
        var th = rg.getBoundingClientRect().height;
        if (th > tmax) { tmax = th; utama = c; }
      });
      if (utama && punyaBlok(utama)) kumpul(utama);
      else tambah({ el: tr, akhir: tr, baris: true, tabel: t });
    }

    function kumpulTabel(t, adaPaksa) {
      var h = tinggi(t);
      if (bergaris(t)) {
        if (!adaPaksa && h <= ATOM) tambah({ el: t, akhir: t });
        else kumpulTabelBergaris(t);
        return;
      }
      if (t.classList.contains('ttd') || t.classList.contains('kop') || (!adaPaksa && h <= ATOM)) { tambah({ el: t, akhir: t }); return; }
      Array.prototype.forEach.call(t.rows, kumpulBarisTata);
    }

    function kumpul(wadah) {
      bungkusInline(wadah);
      Array.prototype.slice.call(wadah.children).forEach(function (c) {
        if (c.classList.contains('spasi-hal')) return;
        if (c.classList.contains('hal-baru')) { tambah({ paksa: true }); return; }
        var h = tinggi(c);
        if (h < 0.5 || kosongKecil(c)) return;
        if (c.tagName === 'TABLE') { kumpulTabel(c, !!c.querySelector('.hal-baru')); return; }
        if (!c.querySelector('.hal-baru') && (h <= ATOM || !punyaBlok(c))) { tambah({ el: c, akhir: c }); return; }
        kumpul(c);
      });
    }

    /* ----- menyisipkan spasi ----- */
    function adaSebelum(x) {
      for (var s = x.previousSibling; s; s = s.previousSibling) {
        if (s.nodeType === 3) { if (/\S/.test(s.nodeValue)) return true; }
        else if (s.nodeType === 1 && !s.classList.contains('spasi-hal') && s.getBoundingClientRect().height > 1) return true;
      }
      return false;
    }
    function atasMargin(x) { return atas(x) - angka(gaya(x).marginTop); }
    function isiAtas(p) { var g = gaya(p); return atas(p) + angka(g.paddingTop) + angka(g.borderTopWidth); }
    /* naik ke pembungkus terluar yang awalnya menempel di ujung atas unit (mis. seluruh baris
       "13. SPESIFIKASI TEKNIS" bersama labelnya), supaya label tidak tertinggal sendirian */
    function jangkar(el) {
      var x = el, terbaik = el;
      for (;;) {
        var p = x.parentElement;
        if (!p || p === lembar) break;
        var tag = p.tagName;
        if (x.tagName === 'TD' || x.tagName === 'TH') { x = p; terbaik = p; continue; }
        if (adaSebelum(x)) break;
        var bagianTabel = tag === 'TBODY' || tag === 'THEAD' || tag === 'TFOOT' || tag === 'TABLE' || tag === 'TR';
        if (!bagianTabel && atasMargin(x) - isiAtas(p) > 1.5) break;
        x = p;
        if (tag !== 'TBODY' && tag !== 'THEAD' && tag !== 'TFOOT' && tag !== 'TD' && tag !== 'TH') terbaik = p;
      }
      return terbaik;
    }
    function buatSpasi(jang) {
      var sp;
      if (jang.tagName === 'TR') {
        var tr = doc.createElement('tr'); tr.className = 'spasi-hal';
        sp = doc.createElement('td');
        sp.colSpan = jumlahKolom(jang.closest('table'));
        sp.setAttribute('style', 'height:0;padding:0;border:0;font-size:0;line-height:0');
        tr.appendChild(sp);
        jang.parentNode.insertBefore(tr, jang);
      } else {
        sp = doc.createElement('div'); sp.className = 'spasi-hal';
        sp.setAttribute('style', 'height:0;margin:0;padding:0;border:0;font-size:0;line-height:0;overflow:hidden');
        jang.parentNode.insertBefore(sp, jang);
      }
      return sp;
    }
    /* geser unit u supaya berawal di y = alvo */
    function dorong(u, alvo) {
      var a = atas(u.el);
      var sp = buatSpasi(jangkar(u.el));
      var t = Math.max(0, alvo - a);
      for (var k = 0; k < 4; k++) {
        sp.style.height = t + 'px';
        var selisih = alvo - atas(u.el);
        if (Math.abs(selisih) <= 0.4) break;
        t = Math.max(0, t + selisih);
      }
      dorongan++;
    }
    function sisipKepala(u) {
      (u.tabel.__kepala || []).forEach(function (r) {
        var k = r.cloneNode(true);
        k.removeAttribute('data-kepala');
        k.setAttribute('data-salinan', '1');
        u.el.parentNode.insertBefore(k, u.el);
      });
    }

    /* ----- jalankan ----- */
    kumpul(lembar);
    for (var s = 0; s < unit.length - 1; s++) {          // blok tepat sebelum tanda tangan ikut pindah
      var nx = unit[s + 1];
      if (!unit[s].paksa && nx.el && nx.el.classList && nx.el.classList.contains('ttd')) unit[s].lekat = true;
    }

    var n = unit.length, i = 0, paksaBerikut = false;
    while (i < n) {
      var u = unit[i];
      if (u.paksa) { paksaBerikut = true; i++; continue; }
      var j = i;
      while (j + 1 < n && unit[j].lekat && !unit[j + 1].paksa) j++;
      var a = atas(u.el), b = bawah(unit[j].akhir || unit[j].el);
      var hal = Math.floor((a + TOL) / H);
      var muat = (b - a) <= H - 2 * LONGGAR;
      if (!muat && j > i) { j = i; b = bawah(u.akhir || u.el); muat = (b - a) <= H - 2 * LONGGAR; }
      var lewat = b > (hal + 1) * H - LONGGAR + TOL;
      var mulaiBaru = paksaBerikut && (a - hal * H) > 2;
      if ((lewat && muat) || mulaiBaru) { dorong(u, (hal + 1) * H + LONGGAR); }
      paksaBerikut = false;

      if (u.baris && u.tabel && !u.pertama && u.tabel.__kepala && u.tabel.__kepala.length) {
        var a2 = atas(u.el);
        if (a2 - Math.floor((a2 + TOL) / H) * H <= 3) {
          sisipKepala(u);
          var hal2 = Math.floor((atas(u.el) + TOL) / H);
          if (j > i && bawah(unit[j].akhir || unit[j].el) > (hal2 + 1) * H - LONGGAR + TOL) j = i;   // rantai tak muat lagi
        }
      }
      i = j + 1;
    }

    var total = lembar.getBoundingClientRect().height;
    return { tinggi: H, halaman: Math.max(1, Math.ceil((total - 2) / H)), pxCm: pxCm, dorongan: dorongan };
  }

  /* ---------- keluaran ---------- */
  function bungkus(d) {
    return '<!DOCTYPE html><html lang="id"><head><meta charset="utf-8"><title>' + E(d.judul) +
      '</title><style>' + GAYA + GAYA_LAYAR + '</style></head><body><div class="lembar">' + rapikan(d.html) + '</div></body></html>';
  }

  function siapkan(id, ctx) {
    return logo().then(function () {
      var f = T[id];
      if (!f) throw new Error('Template "' + id + '" belum tersedia.');
      return f(ctx);
    });
  }

  var Doc = {
    daftar: function () { return Object.keys(T); },
    /* opsi.simpanKeBerkas (opsional): callback disebut saat tombol "Simpan ke berkas"
       diklik, ditambahkan ke aksi modal (di .modal-foot) hanya bila diberikan — supaya
       docgen.js tetap generik, logika unggah-ke-Drive-nya sendiri tetap di paket.js. */
    pratinjau: function (id, ctx, opsi) {
      opsi = opsi || {};
      return siapkan(id, ctx).then(function (d) {
        var frame = el('iframe', {
          style: 'width:100%;height:68vh;border:1px solid var(--garis);border-radius:6px;background:#fff'
        });
        var box = el('div', null, [frame]);
        var aksi = [
          { label: 'Tutup' },
          { label: 'Unduh .doc', onclick: function () { Doc.unduh(id, ctx); return false; }, close: false },
          { label: 'Cetak', onclick: function () { frame.contentWindow.focus(); frame.contentWindow.print(); return false; }, close: false },
          {
            label: 'Unduh .pdf', kind: 'primary', close: false, onclick: function (_, btn) {
              var pulih = UI.busy(btn, 'Menyiapkan PDF…');
              Doc.unduhPdf(id, ctx).catch(UI.err).then(pulih);
              return false;
            }
          }
        ];
        if (opsi.simpanKeBerkas) {
          aksi.push({ label: 'Simpan ke berkas', kind: 'primary', onclick: function () { opsi.simpanKeBerkas(); return false; }, close: false });
        }
        UI.modal({ title: d.judul, body: box, actions: aksi });
        var doc = frame.contentDocument;
        doc.open(); doc.write(bungkus(d)); doc.close();
        return d;
      });
    },
    cetak: function (id, ctx) {
      return siapkan(id, ctx).then(function (d) {
        var win = w.open('', '_blank');
        if (!win) throw new Error('Peramban memblokir jendela baru. Izinkan pop-up untuk mencetak.');
        win.document.open(); win.document.write(bungkus(d)); win.document.close();
        win.onload = function () { win.focus(); win.print(); };
        setTimeout(function () { try { win.focus(); win.print(); } catch (e) { } }, 600);
      });
    },
    /* dokumen sebagai berkas .doc, siap diunduh atau diunggah ke Drive */
    berkas: function (id, ctx) {
      return siapkan(id, ctx).then(function (d) {
        var html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">' +
          '<head><meta charset="utf-8"><!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View>' +
          '<w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]--><style>' + GAYA +
          '@page WordSection1 { size:21cm 29.7cm; margin:2cm 2cm 2cm 2.5cm; } div.WordSection1 { page:WordSection1; }' +
          '</style></head><body><div class="WordSection1">' + rapikan(d.html, true) + '</div></body></html>';
        return {
          nama: d.judul.replace(/[\\/:*?"<>|]+/g, ' ').slice(0, 90) + '.doc',
          blob: new Blob(['\ufeff', html], { type: 'application/msword' })
        };
      });
    },
    unduh: function (id, ctx) {
      return Doc.berkas(id, ctx).then(function (r) {
        var a = el('a', { href: URL.createObjectURL(r.blob), download: r.nama });
        document.body.appendChild(a); a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
        UI.toast('Dokumen diunduh. Buka dengan Word lalu simpan sebagai .docx bila perlu diubah.', 'ok');
      });
    },
    /* unduh sebagai berkas .pdf sungguhan, tanpa lewat dialog cetak peramban.
       Dirender di iframe tersembunyi berukuran cetak A4 (lebar isi 17 cm, tanpa padding
       bawaan; margin 2 cm ditambahkan saat halaman PDF disusun). Isi DIPAGINASI lebih dulu
       (lihat paginasi()): blok yang tak boleh terbelah -- baris tabel, paragraf, butir daftar,
       tanda tangan -- yang melewati batas kertas didorong ke halaman berikutnya, pemisah
       halaman paksa (.hal-baru) dihormati, dan kepala tabel diulang di halaman lanjutan.
       Hasilnya dirasterisasi SEKALI oleh html2canvas lalu dipotong tepat per tinggi halaman.
       (Fungsi bawaan jsPDF pdf.html()/autoPaging tidak dipakai -- pada dokumen panjang/bertabel
       ia bisa salah hitung skala dan menghasilkan ribuan halaman kosong.) Bila paginasi gagal,
       dipakai pemotongan piksel lama (mencari baris putih terdekat) sebagai cadangan. */
    unduhPdf: function (id, ctx) {
      return siapkan(id, ctx).then(function (d) {
        var jsPDFCtor = (w.jspdf && w.jspdf.jsPDF) || w.jsPDF;
        if (!jsPDFCtor || !w.html2canvas) {
          UI.toast('Pustaka pembuat PDF belum termuat. Periksa berkas pustaka di assets/js/lib/ lalu muat ulang halaman.', 'bad');
          return Promise.reject(new Error('Pustaka PDF tidak tersedia.'));
        }
        return new Promise(function (resolve, reject) {
          var ifr = el('iframe', { style: 'position:fixed;left:-99999px;top:0;width:900px;height:0;border:0' });
          document.body.appendChild(ifr);
          function bersihkan() { if (ifr.parentNode) ifr.parentNode.removeChild(ifr); }
          /* paksa tampilan "layar" mengikuti ukuran cetak (bukan versi
             berbayang-abu untuk pratinjau di layar) TANPA padding bawaan --
             margin fisik halaman ditambahkan sendiri di bawah (MARGIN_X/Y)
             supaya berlaku rata di setiap halaman hasil potongan, bukan cuma
             di ujung atas dokumen pertama / ujung bawah dokumen terakhir.
             Pita "HALAMAN BARU" milik pratinjau dimatikan: pemisah halaman
             ditangani paginasi(). */
          var override = '<style>@media screen{ body{background:#fff!important} ' +
            '.lembar{width:17cm!important;max-width:none!important;margin:0!important;' +
            'padding:0!important;box-shadow:none!important;background:#fff!important} ' +
            '.hal-baru{height:0!important;margin:0!important;border:0!important;background:none!important} ' +
            '.hal-baru::after{display:none!important} }</style>';
          ifr.onload = function () {
            var lembar = ifr.contentDocument.querySelector('.lembar');
            if (!lembar) { bersihkan(); reject(new Error('Isi dokumen tidak ditemukan.')); return; }
            var pag = null;
            try { pag = paginasi(lembar); }
            catch (e) { pag = null; if (w.console) console.warn('Paginasi PDF gagal, memakai pemotongan piksel:', e); }
            var rc = lembar.getBoundingClientRect();
            /* kanvas lebih tinggi dari ±32.000 px ditolak peramban (hasilnya kosong) -> turunkan skala */
            var skala = Math.max(0.75, Math.min(2, 32000 / Math.max(1, rc.height)));
            w.html2canvas(lembar, { scale: skala, useCORS: true, backgroundColor: '#ffffff' }).then(function (kanvas) {
              try {
                var HAL_W = 21, HAL_H = 29.7;               // A4, cm
                var MARGIN_X = 2, MARGIN_Y = 2;              // margin cetak per halaman, cm
                var LEBAR_CM = HAL_W - MARGIN_X * 2;          // = 17, pas dengan lebar .lembar
                var TINGGI_CM = HAL_H - MARGIN_Y * 2;
                var potongan = [], cursor = 0, tinggiHalPx, tinggiCm = TINGGI_CM, lebarPx = kanvas.width;

                if (pag) {
                  /* tiap halaman persis setinggi pag.tinggi (px CSS) -> potong kelipatannya.
                     html2canvas memetakan 1 px CSS = `skala` px kanvas PERSIS; kanvas sendiri
                     dibulatkan ke atas lebarnya, jadi jangan menurunkan faktor dari
                     kanvas.width / rc.width (selisih kecil itu menumpuk tiap halaman). */
                  var fx = skala;
                  lebarPx = Math.min(kanvas.width, Math.round(rc.width * fx));
                  tinggiHalPx = Math.max(40, Math.round(pag.tinggi * fx));
                  tinggiCm = pag.tinggi / pag.pxCm;
                  for (var h = 0; h < Math.min(pag.halaman, 400); h++) {
                    var mulai = Math.round(h * pag.tinggi * fx);
                    if (mulai >= kanvas.height - 1) break;
                    potongan.push({ mulai: mulai, tinggi: Math.min(tinggiHalPx, kanvas.height - mulai) });
                  }
                } else {
                  /* cadangan: potong buta, mencari baris piksel yang nyaris putih */
                  var pxPerCm = kanvas.width / LEBAR_CM;
                  tinggiHalPx = Math.max(40, Math.round(pxPerCm * TINGGI_CM));
                  var ctxSumber = kanvas.getContext('2d');
                  var barisKosong = function (y) {
                    if (y <= 0 || y >= kanvas.height) return true;
                    var data = ctxSumber.getImageData(0, y, kanvas.width, 1).data;
                    var langkah = Math.max(1, Math.floor(kanvas.width / 300)) * 4;
                    for (var i = 0; i < data.length; i += langkah) {
                      if (data[i] < 246 || data[i + 1] < 246 || data[i + 2] < 246) return false;
                    }
                    return true;
                  };
                  var titikPotong = function (target) {
                    if (target >= kanvas.height) return kanvas.height;
                    var jendela = Math.round(pxPerCm * 1.5);
                    for (var jarak = 0; jarak <= jendela; jarak++) {
                      if (barisKosong(target - jarak)) return target - jarak;
                      if (barisKosong(target + jarak)) return Math.min(kanvas.height, target + jarak);
                    }
                    return target;
                  };
                  while (cursor < kanvas.height) {
                    var akhir = titikPotong(cursor + tinggiHalPx);
                    if (akhir - cursor < tinggiHalPx * 0.25) akhir = Math.min(kanvas.height, cursor + tinggiHalPx);
                    potongan.push({ mulai: cursor, tinggi: akhir - cursor });
                    cursor = akhir;
                  }
                }

                var pdf = new jsPDFCtor({ unit: 'cm', format: 'a4', orientation: 'portrait' });
                potongan.forEach(function (p, i) {
                  var potong = document.createElement('canvas');
                  potong.width = lebarPx; potong.height = tinggiHalPx;
                  var ctx2d = potong.getContext('2d');
                  ctx2d.fillStyle = '#fff'; ctx2d.fillRect(0, 0, potong.width, potong.height);
                  ctx2d.drawImage(kanvas, 0, p.mulai, lebarPx, p.tinggi, 0, 0, lebarPx, p.tinggi);
                  if (i > 0) pdf.addPage();
                  pdf.addImage(potong.toDataURL('image/jpeg', 0.95), 'JPEG', MARGIN_X, MARGIN_Y, LEBAR_CM, tinggiCm);
                });
                pdf.save((d.judul || 'dokumen').replace(/[\\/:*?"<>|]+/g, ' ').slice(0, 90) + '.pdf');
                bersihkan();
                UI.toast('PDF diunduh', 'ok');
                resolve();
              } catch (e) { bersihkan(); reject(e); }
            }).catch(function (e) { bersihkan(); reject(e); });
          };
          ifr.srcdoc = bungkus(d).replace('</head>', override + '</head>');
        });
      });
    }
  };

  w.Doc = Doc;
})(window);