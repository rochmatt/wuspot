// Isi halaman Kompres PDF. Ditulis manual, bukan hasil generator —
// tiap halaman ukuran (100 KB, 200 KB, ...) sengaja punya isi yang berbeda.

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
  /** Paragraf pembuka di bawah alat. */
  intro: string[];
  steps: Step[];
  /** Judul + isi bagian "yang perlu kamu tahu". */
  notes: { title: string; items: string[] };
  faq: FaqItem[];
}

const STEPS_UMUM: Step[] = [
  {
    title: "Pilih file PDF",
    body: "Ketuk kotak di atas atau seret PDF ke situ. Di HP, file bisa diambil dari folder Download, File Manager, atau Google Drive.",
  },
  {
    title: "Tentukan ukurannya",
    body: "Kalau formulirnya punya batas (misalnya maksimal 200 KB), pilih angka itu. Kalau tidak ada batas, pakai level Sedang saja.",
  },
  {
    title: "Cek, lalu simpan",
    body: "Tunggu sampai selesai, lihat ukuran barunya, lalu unduh. Buka dulu hasilnya sebelum di-upload supaya kamu yakin tulisannya masih terbaca.",
  },
];

const FAQ_UMUM: FaqItem[] = [
  {
    q: "File saya dikirim ke server tidak?",
    a: "Tidak. Kompresnya dikerjakan oleh browser di HP atau laptopmu sendiri. wuspot memang tidak punya server untuk menerima file, jadi scan KTP, KK, atau ijazahmu tetap di perangkatmu.",
  },
  {
    q: "Gratis? Ada batas pemakaian?",
    a: "Gratis, tanpa daftar akun, dan tidak ada batas berapa kali dipakai. Satu file maksimal 150 MB.",
  },
  {
    q: "Kenapa teks di hasilnya tidak bisa disalin?",
    a: "Kalau targetnya kecil sekali, kadang tiap halaman harus diubah jadi gambar supaya muat. Tulisannya tetap terbaca, tapi tidak bisa diblok atau disalin. Kalau teksnya perlu bisa disalin, pilih target yang lebih longgar atau level Ringan.",
  },
  {
    q: "PDF saya dikunci password. Bisa dikompres?",
    a: "Bisa. Nanti kamu diminta memasukkan password-nya. Hasil kompres tidak lagi memakai password, jadi simpan di tempat yang aman.",
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
    "Kecilkan PDF sampai di bawah 200 KB, 500 KB, atau 1 MB langsung di HP. File tidak di-upload, aman untuk scan KTP, ijazah, dan berkas lamaran.",
  h1: "Kompres PDF",
  lead: "Kecilkan ukuran PDF sesuai batas upload. Semuanya diproses di perangkatmu, filenya tidak dikirim ke mana-mana.",
  intro: [
    "Formulir pendaftaran online hampir selalu punya batas ukuran berkas, dan hasil scan dari HP sering kebesaran. Di sini kamu bisa langsung memilih angka yang diminta, misalnya 200 KB, lalu wuspot mencari kualitas terbaik yang masih muat di bawah angka itu.",
    "Kalau PDF-mu berisi teks hasil ketikan (bukan scan), wuspot berusaha mempertahankan teksnya tetap teks. Yang dikecilkan hanya gambar di dalamnya.",
  ],
  steps: STEPS_UMUM,
  notes: {
    title: "Biar hasilnya bagus",
    items: [
      "Scan dengan pencahayaan terang dan kertas rata. Bayangan dan latar abu-abu bikin file lebih berat.",
      "Satu dokumen satu file. Kalau yang diminta hanya halaman depan ijazah, jangan ikutkan halaman belakang.",
      "Pilihan Hitam-putih bisa menghemat cukup banyak untuk dokumen yang memang tidak butuh warna.",
      "Selalu buka hasilnya dulu. Kalau tulisan kecil mulai sulit dibaca, naikkan targetnya sedikit.",
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
    lead: "Untuk formulir yang batasnya paling ketat. Target 100 KB sudah terpasang, tinggal pilih file.",
    intro: [
      "100 KB itu kecil. Satu halaman scan berwarna dari kamera HP biasanya 1–3 MB, jadi harus dikecilkan sampai puluhan kali lipat. Masih bisa, asal isinya tidak terlalu banyak.",
      "Untuk satu halaman (pas foto, KTP, kartu keluarga, surat pernyataan), 100 KB umumnya cukup dan tulisan masih terbaca. Untuk dokumen tiga halaman atau lebih, siap-siap hasilnya mulai kasar.",
    ],
    steps: STEPS_UMUM,
    notes: {
      title: "Supaya muat di 100 KB",
      items: [
        "Nyalakan Hitam-putih kalau dokumennya tidak wajib berwarna. Ini cara paling ampuh di target sekecil ini.",
        "Potong dulu bagian kosong di sekitar kertas saat memotret atau men-scan.",
        "Kalau tetap tidak muat, cek lagi apakah memang semua halaman perlu dikirim.",
        "Di target ini, teks biasanya ikut diubah jadi gambar. Masih terbaca, tapi tidak bisa disalin.",
      ],
    },
    faq: [
      {
        q: "Hasilnya 120 KB, tidak sampai 100 KB. Kenapa?",
        a: "Artinya isi PDF-nya terlalu banyak untuk dipadatkan tanpa jadi tidak terbaca. wuspot sengaja berhenti di titik itu dan memberi tahu ukuran terkecil yang bisa dicapai. Coba aktifkan Hitam-putih atau kirim halaman yang diminta saja.",
      },
      {
        q: "Hasilnya pasti lolos batas 100 KB di formulir?",
        a: "Ada sistem yang menghitung 1 KB = 1.000 byte, ada juga yang 1.024 byte. Supaya aman di keduanya, wuspot memakai hitungan yang paling ketat dan menyisakan sedikit ruang: target 100 KB berarti hasilnya di bawah 99.000 byte.",
      },
      ...FAQ_UMUM.slice(0, 2),
    ],
  },
  {
    slug: "kompres-pdf-200kb",
    presetKb: 200,
    metaTitle: "Kompres PDF ke 200 KB Online, Gratis Tanpa Upload",
    metaDescription:
      "Kecilkan PDF jadi di bawah 200 KB untuk berkas lamaran, pendaftaran sekolah, atau seleksi kerja. Diproses di perangkatmu, file tidak dikirim ke server.",
    h1: "Kompres PDF ke 200 KB",
    lead: "Batas yang paling sering muncul di formulir pendaftaran. Target 200 KB sudah terpasang.",
    intro: [
      "Banyak formulir online, mulai dari lamaran kerja, beasiswa, sampai pendaftaran sekolah, membatasi tiap berkas di kisaran 200 KB. Di ukuran ini, satu atau dua halaman scan masih bisa tetap tajam.",
      "wuspot mencoba dulu cara yang paling halus: mengecilkan gambar di dalam PDF tanpa menyentuh teksnya. Kalau belum cukup, baru halaman diubah jadi gambar dengan kualitas setinggi mungkin yang masih di bawah 200 KB.",
    ],
    steps: STEPS_UMUM,
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
        q: "Bedanya dengan memotret ulang pakai resolusi kecil?",
        a: "Memotret ulang dengan resolusi kecil membuang detail sebelum sempat dipilih. Di sini wuspot mencoba beberapa tingkat kualitas dan memilih yang paling bagus tapi masih di bawah 200 KB.",
      },
      ...FAQ_UMUM.slice(0, 3),
    ],
  },
  {
    slug: "kompres-pdf-300kb",
    presetKb: 300,
    metaTitle: "Kompres PDF ke 300 KB, Tetap Jelas Dibaca",
    metaDescription:
      "Kecilkan PDF ke bawah 300 KB tanpa membuat tulisan kabur. Cocok untuk scan 2–4 halaman. Gratis, diproses di HP atau laptopmu sendiri.",
    h1: "Kompres PDF ke 300 KB",
    lead: "Sedikit lebih longgar dari 200 KB, jadi kualitas bisa dijaga lebih baik. Target 300 KB sudah terpasang.",
    intro: [
      "300 KB adalah titik nyaman untuk dokumen 2–4 halaman: transkrip nilai, surat keterangan, atau sertifikat. Teks kecil dan stempel biasanya masih terbaca jelas.",
      "Kalau PDF-mu hasil ketikan dengan sedikit gambar, kemungkinan besar teksnya tetap bisa disalin setelah dikompres.",
    ],
    steps: STEPS_UMUM,
    notes: {
      title: "Perkiraan kasar di 300 KB",
      items: [
        "1–2 halaman scan berwarna: jelas.",
        "3–4 halaman: masih nyaman dibaca.",
        "Lebih dari 5 halaman: pertimbangkan Hitam-putih.",
        "Stempel dan tanda tangan berwarna tetap kelihatan kalau Hitam-putih dimatikan.",
      ],
    },
    faq: [
      {
        q: "Transkrip saya banyak tabel kecil. Aman di 300 KB?",
        a: "Untuk 1–3 halaman biasanya aman. Setelah selesai, perbesar hasilnya di HP dan cek angka-angka di tabel. Kalau mulai sulit dibaca, naikkan targetnya ke 500 KB jika formulirnya mengizinkan.",
      },
      ...FAQ_UMUM.slice(0, 3),
    ],
  },
  {
    slug: "kompres-pdf-500kb",
    presetKb: 500,
    metaTitle: "Kompres PDF ke 500 KB Online Gratis",
    metaDescription:
      "Kecilkan PDF ke bawah 500 KB untuk berkas beberapa halaman: CV, portofolio, atau gabungan dokumen. Gratis, tanpa upload, langsung di browser.",
    h1: "Kompres PDF ke 500 KB",
    lead: "Cukup longgar untuk dokumen beberapa halaman. Target 500 KB sudah terpasang.",
    intro: [
      "Di 500 KB kamu punya ruang untuk dokumen yang lebih panjang: CV dengan foto, portofolio ringkas, atau gabungan beberapa surat jadi satu PDF.",
      "Untuk scan 3–6 halaman, hasilnya biasanya masih enak dibaca dan warnanya tetap ada.",
    ],
    steps: STEPS_UMUM,
    notes: {
      title: "Perkiraan kasar di 500 KB",
      items: [
        "Sampai 3 halaman scan: hampir tidak terlihat bedanya dengan aslinya.",
        "4–6 halaman: tetap jelas.",
        "CV atau portofolio dengan foto: foto dikecilkan, teks tetap teks.",
        "Lebih dari 10 halaman scan: hasilnya mulai kasar, pertimbangkan target 1 MB.",
      ],
    },
    faq: [
      {
        q: "CV saya dari Canva ukurannya 4 MB. Bisa jadi 500 KB?",
        a: "Biasanya bisa. File dari aplikasi desain sering berat karena gambar latar dan foto beresolusi tinggi. wuspot mengecilkan gambar-gambar itu dan membiarkan teks tetap teks, jadi CV-mu masih bisa dibaca sistem rekrutmen.",
      },
      ...FAQ_UMUM.slice(0, 3),
    ],
  },
  {
    slug: "kompres-pdf-1mb",
    presetKb: 1000,
    metaTitle: "Kompres PDF ke 1 MB (di Bawah 1 MB) Gratis",
    metaDescription:
      "Kecilkan PDF besar ke bawah 1 MB untuk dikirim lewat email, WhatsApp, atau formulir online. Kualitas tetap bagus, diproses di perangkatmu sendiri.",
    h1: "Kompres PDF ke 1 MB",
    lead: "Untuk dokumen yang panjang atau penuh foto. Target 1 MB sudah terpasang.",
    intro: [
      "Batas 1 MB sering muncul di formulir instansi dan lampiran email kantor. Di ukuran ini, dokumen belasan halaman masih bisa terlihat bagus.",
      "Laporan, skripsi bab tertentu, atau proposal dengan banyak foto biasanya bisa turun drastis tanpa kehilangan teks yang bisa dicari.",
    ],
    steps: STEPS_UMUM,
    notes: {
      title: "Perkiraan kasar di 1 MB",
      items: [
        "Sampai 8 halaman scan berwarna: tetap bagus.",
        "Laporan ketikan dengan foto: teks tetap teks, foto dikecilkan.",
        "Puluhan halaman scan: masih bisa, tapi gambar lebih lembut.",
        "Kalau hasilnya sudah jauh di bawah 1 MB, berarti file aslinya memang tidak perlu dikompres banyak.",
      ],
    },
    faq: [
      {
        q: "1 MB itu 1.000 KB atau 1.024 KB?",
        a: "Tergantung sistemnya. Windows menghitung 1.024, sedangkan Android dan banyak situs menghitung 1.000. Supaya pasti lolos di mana pun, wuspot memakai hitungan yang paling ketat: target 1 MB berarti hasilnya di bawah 990.000 byte.",
      },
      ...FAQ_UMUM.slice(0, 3),
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
