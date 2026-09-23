/* SIPADU - pembuat dokumen.
   Seluruh proses berjalan di peramban: server hanya menyimpan data,
   tidak pernah merakit dokumen. */
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
  @media screen { body { background:#e8ebe7; } .lembar { background:#fff; width:21cm; padding:2cm 2cm 2cm 2.5cm; margin:16px auto; box-shadow:0 2px 14px rgba(0,0,0,.18);} }
  .kop { width:100%; border-collapse:collapse; }
  .kop td { vertical-align: middle; padding:0; }
  .kop .logo { width:2.4cm; text-align:center; }
  .kop .logo img { width:2.1cm; }
  .kop .t1 { font-size:13pt; letter-spacing:.3px; }
  .kop .t2 { font-size:12pt; }
  .kop .t3 { font-size:17pt; font-weight:bold; letter-spacing:.4px; }
  .kop .t4 { font-size:8.5pt; line-height:1.25; }
  .kop-tengah { text-align:center; }
  .garis-kop { border-bottom:3px solid #000; margin-top:3px; }
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
  .lampiran { page-break-before:always; }
  .foto { width:100%; border-collapse:collapse; margin-top:10px; }
  .foto td { border:1px solid #000; height:5.2cm; width:50%; text-align:center; color:#888; font-size:9pt; }
  .kecil { font-size:9.5pt; }
  .spasi { height:10px; }
  `;

  /* ---------- logo sebagai data URI supaya ikut terbawa saat diunduh ---------- */
  var logoCache = null;
  function logo() {
    if (logoCache !== null) return Promise.resolve(logoCache);
    return fetch(w.CONFIG.LOGO)
      .then(function (r) { if (!r.ok) throw 0; return r.blob(); })
      .then(function (b) {
        return new Promise(function (res) {
          var fr = new FileReader(); fr.onload = function () { res(fr.result); }; fr.readAsDataURL(b);
        });
      })
      .then(function (d) { logoCache = d; return d; })
      .catch(function () { logoCache = ''; return ''; });
  }

  function E(s) { return esc(s == null ? '' : s); }

  function kop(s, opt) {
    s = s || {};
    opt = opt || {};
    var alamat = [s.alamat, s.desa, s.kecamatan].filter(Boolean).join(', ');
    var baris2 = [alamat, s.kode_pos ? 'Kode Pos ' + s.kode_pos : ''].filter(Boolean).join(' ');
    var baris3 = [s.telp ? 'Telp/Fax. ' + s.telp : '', s.email ? 'e-mail : ' + s.email : '', s.website || ''].filter(Boolean).join('  ');
    return `<table class="kop"><tr>
      <td class="logo">${logoCache ? '<img src="' + logoCache + '" alt="">' : ''}</td>
      <td class="kop-tengah">
        <div class="t1">KEMENTERIAN AGAMA REPUBLIK INDONESIA</div>
        <div class="t2">${E(w.CONFIG.INSTANSI).toUpperCase()}</div>
        <div class="t3">${E(s.nama || '')}</div>
        <div class="t4">${E(baris2)}</div>
        <div class="t4">${E(baris3)}</div>
      </td>
      <td class="logo"></td></tr></table>
      <div class="garis-kop"></div><div class="garis-kop tipis"></div>`;
  }

  function ttd(kiri, kanan) {
    function blok(o) {
      if (!o) return '';
      return (o.kota ? E(o.kota) + ', ' + E(o.tanggal) + '<br>' : '') +
        E(o.jabatan || '') + ',' +
        '<div class="nm">' + E(o.nama || '..................') + '</div>' +
        (o.nip ? 'NIP. ' + E(o.nip) : '');
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
      ${c.nomor ? '<p class="nomor">Nomor : ' + E(c.nomor) + '</p>' : '<div class="spasi"></div>'}
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
            <tr><td style="width:.5cm">a.</td><td style="width:4.2cm">Sumber Dana</td><td style="width:.3cm">:</td><td>${E(pk.sumber_dana || j.sumber || 'DIPA')} Satker ${E(s.nama || '')}</td></tr>
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
      ${c.nomor ? '<p class="nomor">Nomor : ' + E(c.nomor) + '</p>' : ''}
      ${tabel}
      <p class="kecil">Terbilang : ${E(Fmt.kapital(Fmt.terbilang(total)))} Rupiah</p>
      ${ttd(null, { kota: c.kota || 'Indramayu', tanggal: tglPanjang(c.tanggal), jabatan: 'Pejabat Pembuat Komitmen', nama: c.ppk && c.ppk.nama, nip: c.ppk && c.ppk.nip })}`;
    return { judul: 'HPS - ' + (pk.nama || ''), html: kop(s) + body };
  };

  T.bast = function (c) {
    var s = c.satker || {}, pk = c.paket || {}, v = c.penyedia || {};
    var nilai = Number(pk.nilai || pk.pagu) || 0;
    var rincian = c.hps && c.hps.rows ? HPS.tabelDokumen(c.hps, { tanpaHarga: true }) : '';
    var body = `
      <h1 class="judul garis">BERITA ACARA SERAH TERIMA PEKERJAAN</h1>
      <p class="nomor">Nomor : ${E(c.nomor || '..........')}</p>
      <p>Pada hari ini ${E(Fmt.hariText(c.tanggal))} tanggal ${E(terbilangTgl(c.tanggal))} (${E(Fmt.iso(c.tanggal))}), kami yang bertanda tangan di bawah ini :</p>
      <table class="tata">
        <tr><td style="width:.6cm">1.</td><td style="width:3.4cm">Nama</td><td style="width:.3cm">:</td><td><b>${E(c.ppk && c.ppk.nama)}</b></td></tr>
        <tr><td></td><td>NIP</td><td>:</td><td>${E(c.ppk && c.ppk.nip)}</td></tr>
        <tr><td></td><td>Jabatan</td><td>:</td><td>Pejabat Pembuat Komitmen pada ${E(s.nama || '')}</td></tr>
        <tr><td></td><td colspan="3">Selanjutnya disebut <b>PIHAK PERTAMA</b>.</td></tr>
        <tr><td colspan="4" style="height:8px"></td></tr>
        <tr><td>2.</td><td>Nama</td><td>:</td><td><b>${E(v.direktur || '')}</b></td></tr>
        <tr><td></td><td>Jabatan</td><td>:</td><td>${E(v.jabatan_direktur || 'Direktur')} ${E(v.nama || '')}</td></tr>
        <tr><td></td><td>Alamat</td><td>:</td><td>${E(v.alamat || '')}</td></tr>
        <tr><td></td><td colspan="3">Selanjutnya disebut <b>PIHAK KEDUA</b>.</td></tr>
      </table>
      <p style="margin-top:10px">PIHAK KEDUA menyerahkan kepada PIHAK PERTAMA, dan PIHAK PERTAMA menerima dari PIHAK KEDUA, hasil pekerjaan <b>${E(pk.nama || '')}</b> sesuai Surat Pesanan/SPK Nomor ${E(c.no_sp || '..........')} tanggal ${E(tglPanjang(c.tgl_sp || c.tanggal))}, dengan nilai pekerjaan sebesar ${E(rupiahTerbilang(nilai))}.</p>
      ${rincian ? '<p>Rincian hasil pekerjaan :</p>' + rincian : ''}
      <p>Pekerjaan tersebut telah diselesaikan 100% (seratus persen), sesuai spesifikasi yang ditetapkan, dan diterima dalam keadaan baik serta siap dimanfaatkan sesuai peruntukannya.</p>
      <p>Demikian Berita Acara Serah Terima ini dibuat dengan sebenarnya untuk dipergunakan sebagaimana mestinya.</p>
      ${ttd(
      { jabatan: 'PIHAK KEDUA<br>' + E(v.nama || ''), nama: v.direktur, nip: '' },
      { kota: c.kota || 'Indramayu', tanggal: tglPanjang(c.tanggal), jabatan: 'PIHAK PERTAMA<br>Pejabat Pembuat Komitmen', nama: c.ppk && c.ppk.nama, nip: c.ppk && c.ppk.nip }
    )}`;
    return { judul: 'BAST - ' + (pk.nama || ''), html: kop(s) + body };
  };

  T.monev = function (c) {
    var s = c.satker || {}, pk = c.paket || {}, v = c.penyedia || {};
    var lamp = '';
    if (c.hps && c.hps.rows) {
      /* monev per item: baris di bawah header dengan kolom uraian & volume */
      var h = c.hps, map = h.map || {}, items = [];
      if (map.uraian != null && map.volume != null) {
        for (var r = (h.header || 0) + 1; r < h.rows.length; r++) {
          var row = h.rows[r] || [];
          var uCell = row[map.uraian], vCell = row[map.volume];
          if (uCell && uCell.v && vCell && vCell.v) items.push({ uraian: uCell.v, vol: vCell.v });
        }
      }
      var tBody = items.length
        ? '<table class="doc-tabel"><tbody><tr><td class="tb">No</td><td class="tb">Uraian Pekerjaan</td><td class="tb" style="width:3cm">Volume</td><td class="tb" style="width:3.4cm">Realisasi</td></tr>' +
          items.map(function (it, i) {
            return '<tr><td class="tengah">' + (i + 1) + '</td><td>' + E(String(it.uraian)).replace(/\n/g, '<br>') +
              '</td><td class="tengah">' + E(String(it.vol)) + '</td><td class="tengah">100%</td></tr>';
          }).join('') + '</tbody></table>'
        : HPS.tabelDokumen(h, { tanpaHarga: true });
      lamp = `<div class="lampiran"><p><b>Lampiran Hasil Monitoring dan Evaluasi ${E(pk.nama || '')} pada ${E(s.nama || '')}</b></p>
        ${tBody}
        <p class="kecil">Seluruh volume pekerjaan di atas dikerjakan sesuai kontrak dengan kondisi baik dan sesuai spesifikasi.</p>
        <p style="margin-top:14px"><b>Dokumentasi Monitoring dan Evaluasi</b></p>
        <table class="foto"><tr><td>Foto 1</td><td>Foto 2</td></tr><tr><td>Foto 3</td><td>Foto 4</td></tr></table></div>`;
    }
    var body = `
      <h1 class="judul garis">BERITA ACARA HASIL MONITORING DAN EVALUASI</h1>
      <p class="nomor">Nomor : ${E(c.nomor || '..........')}</p>
      <p>Pada hari ini ${E(Fmt.hariText(c.tanggal))} tanggal ${E(terbilangTgl(c.tanggal))} (${E(Fmt.iso(c.tanggal))}), Pejabat Pembuat Komitmen bertindak atas nama ${E(c.jabatan_kpa || 'Kepala Satuan Kerja')} ${E(s.nama || '')} sebagaimana Surat Keputusan Nomor ${E(c.no_sk_ppk || '..........')} tanggal ${E(tglPanjang(c.tgl_sk_ppk || c.tanggal))} tentang Penunjukan Pejabat Pembuat Komitmen Pengadaan Barang dan Jasa pada ${E(s.nama || '')}, telah melakukan kegiatan monitoring dan evaluasi terhadap pekerjaan <b>${E(pk.nama || '')}</b> yang dilaksanakan oleh <b>${E(v.nama || '..........')}</b>${v.alamat ? ' yang beralamat di ' + E(v.alamat) : ''}.</p>
      <p>Berdasarkan antara lain :</p>
      <ol class="dasar"><li>Kontrak/Surat Pesanan Nomor : ${E(c.no_sp || '..........')} tanggal ${E(tglPanjang(c.tgl_sp || c.tanggal))}</li></ol>
      <p>Adapun hasil monitoring dan evaluasi adalah sebagaimana terlampir.</p>
      <p>Kesimpulan hasil monitoring dan evaluasi terhadap prestasi pekerjaan yang telah dilaksanakan antara lain :</p>
      <ol class="dasar">
        <li>Pelaksanaan pekerjaan telah terealisasi 100% (seratus persen) sesuai Surat Pesanan;</li>
        <li>Seluruh pekerjaan sudah memenuhi spesifikasi yang ditetapkan dan berada dalam kondisi baik serta siap dimanfaatkan sesuai peruntukannya.</li>
      </ol>
      <p>Demikian Berita Acara Hasil Monitoring dan Evaluasi ini dibuat dalam rangkap yang diperlukan untuk dapat dipergunakan sebagaimana mestinya.</p>
      ${ttd(null, { kota: c.kota || 'Indramayu', tanggal: tglPanjang(c.tanggal), jabatan: 'Pejabat Pembuat Komitmen', nama: c.ppk && c.ppk.nama, nip: c.ppk && c.ppk.nip })}
      ${lamp}`;
    return { judul: 'Monev - ' + (pk.nama || ''), html: kop(s) + body };
  };

  /* ---------- keluaran ---------- */
  function bungkus(d) {
    return '<!DOCTYPE html><html lang="id"><head><meta charset="utf-8"><title>' + E(d.judul) +
      '</title><style>' + GAYA + '</style></head><body><div class="lembar">' + d.html + '</div></body></html>';
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
    pratinjau: function (id, ctx) {
      return siapkan(id, ctx).then(function (d) {
        var frame = el('iframe', {
          style: 'width:100%;height:68vh;border:1px solid var(--garis);border-radius:6px;background:#fff'
        });
        var box = el('div', null, [frame]);
        UI.modal({
          title: d.judul, body: box,
          actions: [
            { label: 'Tutup' },
            { label: 'Unduh .doc', onclick: function () { Doc.unduh(id, ctx); return false; }, close: false },
            { label: 'Cetak / simpan PDF', kind: 'primary', onclick: function () { frame.contentWindow.focus(); frame.contentWindow.print(); return false; }, close: false }
          ]
        });
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
          '</style></head><body><div class="WordSection1">' + d.html + '</div></body></html>';
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
    }
  };

  w.Doc = Doc;
})(window);
