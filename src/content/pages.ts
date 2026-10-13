// Halaman statis. Paragraf ditulis sebagai array string supaya gampang diubah
// pemilik tanpa menyentuh komponen. Markup kecil yang didukung: **tebal** dan
// [teks tautan](/alamat-di-situs-ini).

/** Iklan aktif kalau NEXT_PUBLIC_ADSENSE_CLIENT diisi (lihat AdSlot). */
const ADS_ON = Boolean(process.env.NEXT_PUBLIC_ADSENSE_CLIENT);

export interface StaticSection {
  heading?: string;
  paragraphs: string[];
  list?: string[];
}

export interface StaticPage {
  slug: string;
  metaTitle: string;
  metaDescription: string;
  h1: string;
  /** Kalimat pembuka di bawah judul (opsional). */
  lead?: string;
  updated?: string; // YYYY-MM-DD
  sections: StaticSection[];
}

export const TENTANG: StaticPage = {
  slug: "tentang",
  metaTitle: "Tentang wuspot",
  metaDescription:
    "wuspot dulu situs cari video dan MP3 di era WAP. Sekarang wuspot kembali sebagai kumpulan alat online gratis untuk urusan berkas.",
  h1: "Tentang wuspot",
  lead: "Nama lama, wajah baru: alat online gratis buat beresin berkas sehari-hari.",
  sections: [
    {
      heading: "Dulu",
      paragraphs: [
        "Kalau kamu sempat main internet lewat HP sekitar 2014–2016, mungkin pernah mampir ke wuspot. Dulu wuspot adalah situs WAP tempat orang mencari video dan MP3. Sempat ramai, lalu tutup karena domainnya lepas.",
      ],
    },
    {
      heading: "Sekarang",
      paragraphs: [
        "Domain ini akhirnya kembali ke pemilik aslinya, dan wuspot dibuka lagi dengan arah baru: alat online gratis untuk urusan berkas sehari-hari. Mulai dari yang paling sering dicari, yaitu mengecilkan ukuran PDF untuk syarat upload.",
      ],
    },
    {
      heading: "Prinsipnya sederhana",
      paragraphs: [],
      list: [
        "File kamu nggak di-upload. Semua proses berjalan di browser HP atau laptopmu sendiri.",
        "Nggak perlu daftar akun dan nggak ada batas pemakaian.",
        "Bahasanya bahasa Indonesia sehari-hari, dan kalau hasilnya nggak sesuai target, kami bilang terus terang.",
      ],
    },
    {
      heading: "Yang sedang disiapkan",
      paragraphs: [
        "Gabung PDF, foto ke PDF, kompres foto ke ukuran KB tertentu, dan pembuat pas foto. Kalau ada alat yang kamu butuhkan, kabari lewat [halaman Kontak](/kontak).",
      ],
    },
  ],
};

export const PRIVASI: StaticPage = {
  slug: "privasi",
  metaTitle: "Kebijakan Privasi",
  metaDescription:
    "Bagaimana wuspot memperlakukan file dan data kamu: file diproses di perangkatmu sendiri dan nggak pernah dikirim ke server.",
  h1: "Kebijakan Privasi",
  lead: "Versi singkatnya: file kamu nggak pernah meninggalkan perangkatmu.",
  updated: "2026-10-07",
  sections: [
    {
      heading: "File yang kamu proses",
      paragraphs: [
        "Alat di wuspot bekerja di dalam browser. File yang kamu pilih dibaca dan diolah oleh perangkatmu sendiri, lalu hasilnya kamu unduh langsung. File tersebut nggak dikirim, nggak disimpan, dan nggak bisa kami lihat.",
        "Begitu tab ditutup, salinan file di memori browser ikut hilang.",
      ],
    },
    {
      heading: "Data yang tercatat saat kamu berkunjung",
      paragraphs: [
        "Seperti hampir semua situs, server hosting mencatat data teknis standar seperti alamat IP, jenis browser, dan halaman yang dibuka, untuk keamanan dan mencegah penyalahgunaan. Data ini nggak kami jual dan nggak kami pakai untuk mengenali kamu secara pribadi.",
        ADS_ON
          ? "Halaman wuspot menampilkan iklan dari Google AdSense. Google dan mitranya bisa memakai cookie untuk menampilkan iklan berdasarkan kunjunganmu ke situs ini dan situs lain. Iklan yang dipersonalisasi bisa kamu matikan lewat Setelan Iklan Google (adssettings.google.com). Isi file kamu tetap nggak pernah dikirim ke mana pun."
          : "Saat ini wuspot belum memasang iklan dan nggak memakai alat pelacak pihak ketiga. Kalau nanti kami memasang iklan atau statistik pengunjung (misalnya Google AdSense atau Google Analytics), layanan tersebut bisa memakai cookie, dan halaman ini akan diperbarui lebih dulu beserta cara menolaknya.",
      ],
    },
    {
      heading: "Penyimpanan di browser",
      paragraphs: [
        "wuspot bisa menyimpan pilihan kecil di browsermu, misalnya target ukuran terakhir yang kamu pakai atau tampilan terang/gelap, supaya nggak perlu memilih ulang. Data ini tetap di perangkatmu dan bisa dihapus lewat pengaturan browser.",
      ],
    },
    {
      heading: "Pertanyaan",
      paragraphs: ["Kalau ada pertanyaan soal privasi, hubungi kami lewat [halaman Kontak](/kontak)."],
    },
  ],
};

export const SYARAT: StaticPage = {
  slug: "syarat",
  metaTitle: "Syarat Penggunaan",
  metaDescription:
    "Aturan singkat memakai alat di wuspot: gratis dan apa adanya, cek hasil sebelum dikirim, pakai hanya untuk file milikmu sendiri.",
  h1: "Syarat Penggunaan",
  lead: "Dengan memakai wuspot, kamu setuju dengan hal-hal berikut. Kami menulisnya sesingkat mungkin.",
  updated: "2026-10-07",
  sections: [
    {
      paragraphs: [],
      list: [
        "Alat di wuspot gratis dan disediakan apa adanya. Kami berusaha membuatnya benar dan rapi, tapi nggak bisa menjamin hasilnya selalu sesuai kebutuhan setiap formulir atau instansi.",
        "Selalu periksa hasil sebelum dipakai atau dikirim. Tanggung jawab atas berkas yang kamu kirim tetap ada padamu.",
        "Pakai hanya untuk file yang memang berhak kamu olah. Jangan gunakan wuspot untuk memalsukan dokumen atau hal yang melanggar hukum.",
        "Karena file diproses di perangkatmu, kami nggak menyimpan cadangan. Simpan file aslimu sampai kamu yakin hasilnya sudah benar.",
        "Syarat ini bisa diperbarui sewaktu-waktu. Tanggal pembaruan terakhir tercantum di halaman ini.",
      ],
    },
  ],
};

export const KONTAK: StaticPage = {
  slug: "kontak",
  metaTitle: "Kontak",
  metaDescription:
    "Hubungi wuspot lewat email: saran alat baru, laporan bug, atau pertanyaan soal privasi. Dibaca dan dibalas manusia.",
  h1: "Kontak",
  lead: "Ada saran alat, nemu yang aneh, atau sekadar mau tanya? Kirim email saja.",
  sections: [
    {
      heading: "Yang bisa kamu tulis",
      paragraphs: [],
      list: [
        "Saran alat: alat apa yang kamu butuhkan dan buat urusan apa, misalnya “gabung PDF buat berkas PPPK”.",
        "Laporan bug: halaman mana, HP/laptop dan browser apa, kira-kira berapa ukuran file-nya, dan apa yang terjadi.",
        "Pertanyaan soal privasi, syarat penggunaan, atau kerja sama.",
      ],
    },
    {
      heading: "Satu hal penting",
      paragraphs: [
        "Jangan lampirkan file pribadi seperti KTP, KK, atau ijazah di email. Kami nggak butuh file-nya untuk membantu. Cukup ceritakan masalahnya, kalau perlu sertakan tangkapan layar yang data pribadinya sudah ditutup.",
      ],
    },
    {
      heading: "Kapan dibalas",
      paragraphs: [
        "Semua email dibaca dan dibalas manusia, bukan robot. Balasannya bisa makan beberapa hari, apalagi kalau lagi ramai. Laporan bug kami dahulukan.",
      ],
    },
  ],
};

export const STATIC_PAGES = [TENTANG, PRIVASI, SYARAT];
