// Isi halaman Kompres PDF. Ditulis manual, bukan hasil generator —
// tiap halaman ukuran (100 KB, 200 KB, ...) sengaja punya isi yang berbeda.
// Gaya bahasa: santai tapi sopan, "kamu", "nggak". Teks di antara **…** ditebalkan.

export interface FaqItem {
  q: string;
  a: string;
}

export interface Step {
  title: string;
  body: string;
}

export interface KompresPage {
  slug: string;
  /** Target bawaan dalam KB; null = halaman utama (pakai level Sedang). */
  presetKb: number | null;
  metaTitle: string;
  metaDescription: string;
  h1: string;
  lead: string;
  /** Judul bagian pembuka di bawah alat. */
  introTitle: string;
  /** Paragraf pembuka di bawah alat. */
  intro: string[];
  steps: Step[];
  /** Judul + isi bagian "yang perlu kamu tahu". */
  notes: { title: string; items: string[] };
  faq: FaqItem[];
}

/** Langkah 1 dan 3 sama di semua halaman; langkah 2 ditulis per halaman. */
function steps(step2: Step): Step[] {
  return [
    {
      title: "Pilih file PDF",
      body: "Ketuk Pilih file PDF atau seret file-nya ke kotak di atas. Di HP, file bisa diambil dari folder Download, File Manager, Google Drive, atau dokumen WhatsApp.",
    },
    step2,
    {
      title: "Cek, lalu simpan",
      body: "Tunggu sampai tanda terimanya muncul, lihat ukuran barunya, lalu unduh. Buka dulu hasilnya sebelum di-upload supaya kamu yakin tulisannya masih terbaca.",
    },
  ];
}

const FAQ_UMUM: FaqItem[] = [
  {
    q: "File saya dikirim ke server nggak?",
    a: "Nggak. Kompresnya dikerjakan oleh browser di HP atau laptopmu sendiri. wuspot memang nggak punya server untuk menerima file, jadi scan KTP, KK, atau ijazahmu tetap di perangkatmu. Begitu tab ditutup, datanya ikut hilang dari memori.",
  },
  {
    q: "Gratis? Ada batas pemakaian?",
    a: "Gratis, tanpa daftar akun, tanpa watermark, dan nggak ada batas berapa kali dipakai. Satu file maksimal 150 MB.",
  },
  {
    q: "Kenapa teks di hasilnya nggak bisa disalin?",
    a: "Kalau targetnya kecil sekali, kadang tiap halaman harus diubah jadi gambar supaya muat. Tulisannya tetap terbaca, tapi nggak bisa diblok atau disalin. Kalau teksnya perlu bisa disalin, pilih target yang lebih longgar atau tingkat Ringan.",
  },
  {
    q: "PDF saya dikunci password. Bisa dikompres?",
    a: "Bisa. Nanti kamu diminta memasukkan password-nya, dan password itu cuma dipakai di perangkatmu. Hasil kompres nggak lagi memakai password, jadi simpan di tempat yang aman.",
  },
  {
    q: "Prosesnya lama di HP saya.",
    a: "Karena semua dikerjakan di perangkatmu, kecepatannya tergantung HP. PDF puluhan halaman di HP lama bisa makan waktu semenit lebih. Biarkan halaman tetap terbuka, atau coba di laptop.",
  },
];

export const KOMPRES_MAIN: KompresPage = {
  slug: "kompres-pdf",
  presetKb: null,
  metaTitle: "Kompres PDF Online Gratis, Bisa Pilih Ukuran KB",
  metaDescription:
    "Kecilkan PDF sampai di bawah 200 KB, 500 KB, atau 1 MB langsung di HP. File nggak di-upload, aman untuk scan KTP, ijazah, dan berkas lamaran.",
  h1: "Kompres PDF",
  lead: "Kecilkan PDF buat berkas CPNS, lamaran kerja, atau tugas kuliah. **Diproses langsung di HP kamu, nggak di-upload.**",
  introTitle: "Pas dengan batas upload, tanpa tebak-tebakan",
  intro: [
    "Formulir pendaftaran online hampir selalu punya batas ukuran berkas, dan hasil scan dari HP sering kebesaran. Di sini kamu bisa langsung memilih angka yang diminta, misalnya 200 KB, lalu wuspot mencari kualitas terbaik yang masih muat di bawah angka itu.",
    "Kalau PDF-mu berisi teks hasil ketikan (bukan scan), wuspot berusaha membiarkan teksnya tetap teks. Kalau ukurannya memungkinkan, yang dikecilkan cuma gambar di dalamnya, jadi teksnya tetap bisa disalin.",
  ],
  steps: steps({
    title: "Tentukan ukurannya",
    body: "Kalau formulirnya punya batas (misalnya maksimal 200 KB), pilih angka itu. Nggak ada batasnya? Pakai tingkat Sedang saja.",
  }),
  notes: {
    title: "Biar hasilnya bagus",
    items: [
      "Scan dengan pencahayaan terang dan kertas rata. Bayangan dan latar abu-abu bikin file lebih berat.",
      "Satu dokumen satu file. Kalau yang diminta cuma halaman depan ijazah, jangan ikutkan halaman belakang.",
      "Pilihan Hitam-putih bisa menghemat cukup banyak untuk dokumen yang memang nggak butuh warna.",
      "Selalu buka hasilnya dulu. Kalau tulisan kecil mulai susah dibaca, naikkan targetnya sedikit.",
    ],
  },
  faq: FAQ_UMUM,
};

export const KOMPRES_PRESETS: KompresPage[] = [
  {
    slug: "kompres-pdf-100kb",
    presetKb: 100,
    metaTitle: "Kompres PDF ke 100 KB (di Bawah 100 KB) Gratis",
    metaDescription:
      "Kecilkan PDF sampai di bawah 100 KB untuk formulir yang batasnya ketat. Diproses di HP-mu, tanpa upload. Ada opsi hitam-putih supaya tetap terbaca.",
    h1: "Kompres PDF ke 100 KB",
    lead: "Buat formulir yang batasnya paling ketat. **Target 100 KB sudah dipilihkan**, tinggal pilih file.",
    introTitle: "Seberapa kecil sih 100 KB itu?",
    intro: [
      "100 KB itu kecil. Satu halaman scan berwarna dari kamera HP biasanya 1–3 MB, jadi harus dikecilkan sampai puluhan kali lipat. Masih bisa, asal isinya nggak terlalu banyak.",
      "Untuk satu halaman (pas foto, KTP, kartu keluarga, surat pernyataan), 100 KB umumnya cukup dan tulisan masih terbaca. Untuk dokumen tiga halaman atau lebih, siap-siap hasilnya mulai kasar.",
    ],
    steps: steps({
      title: "Cek targetnya",
      body: "Target 100 KB sudah dipilihkan. Kalau batas di formulirmu beda, ganti angkanya atau isi kolom “lainnya”. Dokumennya nggak wajib berwarna? Nyalakan juga Hitam-putih.",
    }),
    notes: {
      title: "Supaya muat di 100 KB",
      items: [
        "Nyalakan Hitam-putih kalau dokumennya nggak wajib berwarna. Di target sekecil ini, cara ini sering paling membantu.",
        "Potong dulu bagian kosong di sekitar kertas waktu memotret atau men-scan.",
        "Kalau tetap nggak muat, cek lagi apakah semua halaman memang perlu dikirim.",
        "Di target ini, teks biasanya ikut diubah jadi gambar. Masih terbaca, tapi nggak bisa disalin.",
      ],
    },
    faq: [
      {
        q: "Hasilnya masih 120 KB, nggak bisa di bawah 100 KB. Kenapa?",
        a: "Artinya isi PDF-nya terlalu banyak untuk dipadatkan lagi tanpa jadi susah dibaca. wuspot sengaja berhenti di situ dan memberi tahu ukuran terkecil yang bisa dicapai. Coba nyalakan Hitam-putih atau kirim halaman yang diminta saja.",
      },
      {
        q: "Hasilnya pasti lolos batas 100 KB di formulir?",
        a: "Ada sistem yang menghitung 1 KB = 1.000 byte, ada juga yang 1.024 byte. Supaya aman di keduanya, wuspot memakai hitungan yang paling ketat dan menyisakan sedikit ruang: target 100 KB berarti hasilnya paling besar 99.000 byte.",
      },
      {
        q: "Scan KTP atau kartu keluarga, cukup 100 KB?",
        a: "Biasanya cukup. Satu halaman KTP atau KK muat di 100 KB dengan tulisan yang masih terbaca. Yang susah dipadatkan ke 100 KB itu dokumen banyak halaman, bukan satu kartu.",
      },
      FAQ_UMUM[0],
    ],
  },
  {
    slug: "kompres-pdf-200kb",
    presetKb: 200,
    metaTitle: "Kompres PDF ke 200 KB Online, Gratis Tanpa Upload",
    metaDescription:
      "Kecilkan PDF jadi di bawah 200 KB untuk berkas lamaran, pendaftaran sekolah, atau seleksi kerja. Diproses di perangkatmu, file nggak dikirim ke server.",
    h1: "Kompres PDF ke 200 KB",
    lead: "Batas yang paling sering muncul di formulir pendaftaran. **Target 200 KB sudah dipilihkan**, file tetap di HP kamu.",
    introTitle: "200 KB, batas yang paling sering diminta",
    intro: [
      "Banyak formulir online, mulai dari lamaran kerja, beasiswa, sampai pendaftaran sekolah, membatasi tiap berkas di kisaran 200 KB. Di ukuran ini, satu atau dua halaman scan masih bisa tajam.",
      "wuspot mencoba dulu cara yang paling halus: mengecilkan gambar di dalam PDF tanpa menyentuh teksnya. Kalau belum cukup, baru halaman diubah jadi gambar dengan kualitas setinggi mungkin yang masih di bawah 200 KB.",
    ],
    steps: steps({
      title: "Cek targetnya",
      body: "Target 200 KB sudah dipilihkan. Kalau batas di formulirmu beda, misalnya 250 KB, ketik angkanya di kolom “lainnya”.",
    }),
    notes: {
      title: "Perkiraan kasar di 200 KB",
      items: [
        "1 halaman scan berwarna: biasanya tetap jelas.",
        "2–3 halaman: masih terbaca, gambar mulai sedikit lembut.",
        "4 halaman atau lebih: sebaiknya pakai Hitam-putih, atau pisahkan jadi beberapa file kalau formulirnya mengizinkan.",
        "Dokumen ketikan (Word yang disimpan jadi PDF) biasanya sudah kecil dan teksnya tetap bisa disalin.",
      ],
    },
    faq: [
      {
        q: "Ijazah saya 2 halaman (depan-belakang), muat 200 KB?",
        a: "Biasanya muat. Kalau tulisan kecil di bagian belakang mulai kabur, coba Hitam-putih. Hasil hitam-putih justru sering lebih tajam untuk dokumen yang aslinya cuma tinta hitam.",
      },
      {
        q: "Bedanya sama memotret ulang pakai resolusi kecil?",
        a: "Kalau memotret ulang dengan resolusi kecil, kamu cuma bisa menebak: bisa masih kebesaran, bisa juga jadi buram. Di sini wuspot mencoba beberapa tingkat kualitas, lalu memilih yang paling tajam tapi masih di bawah 200 KB.",
      },
      {
        q: "Kenapa hasilnya nggak pernah pas 200 KB?",
        a: "Sengaja. wuspot menyisakan sedikit ruang supaya file tetap lolos, entah portalnya menghitung 1 KB = 1.000 byte atau 1.024 byte. Hasilnya paling besar 198.000 byte, yang di tanda terima tertulis 194 KB. Bedanya kecil, tapi bisa menentukan file-mu diterima atau ditolak.",
      },
      FAQ_UMUM[0],
    ],
  },
  {
    slug: "kompres-pdf-300kb",
    presetKb: 300,
    metaTitle: "Kompres PDF ke 300 KB, Tetap Jelas Dibaca",
    metaDescription:
      "Kecilkan PDF ke bawah 300 KB tanpa bikin tulisan kabur. Cocok untuk scan 2–4 halaman. Gratis, diproses di HP atau laptopmu sendiri.",
    h1: "Kompres PDF ke 300 KB",
    lead: "Sedikit lebih longgar dari 200 KB, jadi kualitasnya bisa dijaga lebih baik. **Target 300 KB sudah dipilihkan.**",
    introTitle: "300 KB: pas untuk 2–4 halaman",
    intro: [
      "Ukuran ini pas untuk dokumen 2–4 halaman: transkrip nilai, surat keterangan, atau sertifikat. Teks kecil dan stempel biasanya masih terbaca jelas.",
      "Kalau PDF-mu hasil ketikan dengan sedikit gambar, kemungkinan besar teksnya tetap bisa disalin setelah dikompres.",
    ],
    steps: steps({
      title: "Cek targetnya",
      body: "Target 300 KB sudah dipilihkan. Batasnya ternyata 200 KB? Ketuk 200. Batasnya lebih longgar? Pilih angka yang lebih besar supaya hasilnya lebih tajam.",
    }),
    notes: {
      title: "Perkiraan kasar di 300 KB",
      items: [
        "1–2 halaman scan berwarna: jelas.",
        "3–4 halaman: masih nyaman dibaca.",
        "5 halaman atau lebih: pertimbangkan Hitam-putih.",
        "Ada stempel atau tanda tangan berwarna? Biarkan Hitam-putih mati supaya warnanya tetap kelihatan.",
      ],
    },
    faq: [
      {
        q: "Transkrip saya banyak tabel kecil. Aman di 300 KB?",
        a: "Untuk 1–3 halaman biasanya aman. Setelah selesai, perbesar hasilnya di HP dan cek angka-angka di tabel. Kalau mulai susah dibaca, naikkan targetnya ke 500 KB kalau formulirnya mengizinkan.",
      },
      {
        q: "Stempel dan tanda tangan berwarna masih kelihatan?",
        a: "Kelihatan, selama Hitam-putih dimatikan. Di 300 KB warnanya biasanya masih terjaga untuk 1–3 halaman. Kalau stempelnya mulai pudar, kurangi jumlah halaman atau naikkan targetnya.",
      },
      {
        q: "Batasnya 200 KB, tapi saya buka halaman 300 KB. Gimana?",
        a: "Tinggal ketuk 200 di pilihan ukuran, nggak perlu pindah halaman. Halaman ini cuma memilihkan 300 KB lebih dulu.",
      },
      FAQ_UMUM[0],
    ],
  },
  {
    slug: "kompres-pdf-500kb",
    presetKb: 500,
    metaTitle: "Kompres PDF ke 500 KB Online Gratis",
    metaDescription:
      "Kecilkan PDF ke bawah 500 KB untuk berkas beberapa halaman: CV, portofolio, atau gabungan dokumen. Gratis, tanpa upload, langsung di browser.",
    h1: "Kompres PDF ke 500 KB",
    lead: "Cukup longgar untuk dokumen beberapa halaman. **Target 500 KB sudah dipilihkan.**",
    introTitle: "Ruang lega di 500 KB",
    intro: [
      "Di 500 KB kamu punya ruang untuk dokumen yang lebih panjang: CV dengan foto, portofolio ringkas, atau gabungan beberapa surat jadi satu PDF.",
      "Untuk scan 3–6 halaman, hasilnya biasanya masih enak dibaca dan warnanya tetap ada.",
    ],
    steps: steps({
      title: "Cek targetnya",
      body: "Target 500 KB sudah dipilihkan. Kalau formulirnya membolehkan lebih dari itu, pilih 1 MB: makin longgar targetnya, makin tajam hasilnya.",
    }),
    notes: {
      title: "Perkiraan kasar di 500 KB",
      items: [
        "Sampai 3 halaman scan: hampir nggak kelihatan bedanya dengan aslinya.",
        "4–6 halaman: tetap jelas.",
        "CV atau portofolio dengan foto: foto dikecilkan, teks tetap teks.",
        "7 halaman atau lebih: hasilnya mulai kasar, pertimbangkan target 1 MB.",
      ],
    },
    faq: [
      {
        q: "CV saya dari Canva ukurannya 4 MB. Bisa jadi 500 KB?",
        a: "Biasanya bisa. File dari aplikasi desain sering berat karena gambar latar dan foto beresolusi tinggi. wuspot mengecilkan gambar-gambar itu dan membiarkan teks tetap teks, jadi CV-mu masih bisa dibaca sistem rekrutmen.",
      },
      {
        q: "Gimana tahu teks CV-nya masih bisa dibaca sistem rekrutmen?",
        a: "Lihat tanda terimanya. Kalau baris “Teks” bertuliskan “bisa disalin”, berarti teksnya masih teks dan bisa dibaca sistem. Kalau tertulis “jadi gambar”, coba target yang lebih longgar atau tingkat Ringan.",
      },
      {
        q: "Beberapa surat mau dijadikan satu PDF 500 KB. Bisa?",
        a: "Menggabungkan file belum bisa di wuspot (Gabung PDF sedang disiapkan). Kalau suratnya sudah jadi satu PDF, tinggal kompres di sini. Untuk 4–6 halaman scan, 500 KB biasanya masih nyaman dibaca.",
      },
      FAQ_UMUM[0],
    ],
  },
  {
    slug: "kompres-pdf-1mb",
    presetKb: 1000,
    metaTitle: "Kompres PDF ke 1 MB (di Bawah 1 MB) Gratis",
    metaDescription:
      "Kecilkan PDF besar ke bawah 1 MB untuk dikirim lewat email, WhatsApp, atau formulir online. Kualitas tetap bagus, diproses di perangkatmu sendiri.",
    h1: "Kompres PDF ke 1 MB",
    lead: "Buat dokumen yang panjang atau penuh foto. **Target 1 MB sudah dipilihkan.**",
    introTitle: "Kapan target 1 MB dipakai",
    intro: [
      "Batas 1 MB sering muncul di formulir instansi dan lampiran email kantor. Di ukuran ini, dokumen belasan halaman masih bisa terlihat bagus.",
      "Laporan, bab skripsi, atau proposal dengan banyak foto biasanya bisa turun drastis tanpa kehilangan teks yang bisa dicari.",
    ],
    steps: steps({
      title: "Cek targetnya",
      body: "Target 1 MB sudah dipilihkan. Kalau batasnya ditulis 1.024 KB, pilihan ini tetap aman. Batasnya beda? Ganti angkanya atau isi kolom “lainnya”.",
    }),
    notes: {
      title: "Perkiraan kasar di 1 MB",
      items: [
        "Sampai 8 halaman scan berwarna: tetap bagus.",
        "Laporan ketikan dengan foto: teks tetap teks, foto dikecilkan.",
        "Puluhan halaman scan: masih bisa, tapi gambar lebih lembut.",
        "Kalau hasilnya sudah jauh di bawah 1 MB, berarti file aslinya memang nggak perlu dikompres banyak.",
      ],
    },
    faq: [
      {
        q: "1 MB itu 1.000 KB atau 1.024 KB?",
        a: "Tergantung sistemnya. Windows menghitung 1.024, sedangkan Android dan banyak situs menghitung 1.000. Supaya pasti lolos di mana pun, wuspot memakai hitungan yang paling ketat: target 1 MB berarti hasilnya paling besar 990.000 byte.",
      },
      {
        q: "Bisa buat lampiran email atau WhatsApp?",
        a: "Bisa. File di bawah 1 MB cepat terkirim lewat email kantor maupun WhatsApp, dan penerimanya nggak perlu menunggu lama untuk membukanya di HP.",
      },
      {
        q: "Skripsi saya 80 halaman. Bisa di bawah 1 MB?",
        a: "Kalau isinya ketikan dengan sedikit gambar, sering bisa, dan teksnya tetap bisa dicari. Kalau isinya scan, 80 halaman di 1 MB akan terlihat kasar. Lebih aman dipecah per bab.",
      },
      FAQ_UMUM[0],
    ],
  },
];

/**
 * Batas upload di formulir bisa dihitung 1 KB = 1.000 atau 1.024 byte, dan ada
 * yang memakai "<" bukan "<=". Pakai yang paling ketat lalu sisakan 1%.
 */
export function targetBytesFromKb(kb: number): number {
  return Math.floor(kb * 1000 * 0.99);
}

export const ALL_KOMPRES_PAGES = [KOMPRES_MAIN, ...KOMPRES_PRESETS];

export function getKompresPage(slug: string): KompresPage | undefined {
  return ALL_KOMPRES_PAGES.find((p) => p.slug === slug);
}
