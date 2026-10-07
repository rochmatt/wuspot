// Halaman statis. Paragraf ditulis sebagai array string supaya gampang diubah
// pemilik tanpa menyentuh komponen.

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
  updated?: string; // YYYY-MM-DD
  sections: StaticSection[];
}

export const TENTANG: StaticPage = {
  slug: "tentang",
  metaTitle: "Tentang wuspot",
  metaDescription:
    "wuspot dulu situs cari video dan MP3 di era WAP. Sekarang wuspot kembali sebagai kumpulan alat online gratis untuk urusan berkas.",
  h1: "Tentang wuspot",
  sections: [
    {
      paragraphs: [
        "Kalau kamu sempat main internet lewat HP sekitar 2014–2016, mungkin pernah mampir ke wuspot. Dulu wuspot adalah situs WAP tempat orang mencari video dan MP3. Sempat ramai, lalu tutup karena domainnya lepas.",
        "Domain ini akhirnya kembali ke pemilik aslinya, dan wuspot dibuka lagi dengan arah baru: alat online gratis untuk urusan berkas sehari-hari. Mulai dari yang paling sering dicari, yaitu mengecilkan ukuran PDF.",
      ],
    },
    {
      heading: "Prinsipnya sederhana",
      paragraphs: [],
      list: [
        "File kamu tidak di-upload. Semua proses berjalan di browser HP atau laptopmu sendiri.",
        "Tidak perlu daftar akun dan tidak ada batas pemakaian.",
        "Bahasanya bahasa Indonesia sehari-hari, dan kalau hasilnya tidak sesuai target, kami bilang terus terang.",
      ],
    },
    {
      heading: "Yang sedang disiapkan",
      paragraphs: [
        "Gabung PDF, foto ke PDF, kompres foto ke ukuran KB tertentu, dan pembuat pas foto. Kalau ada alat yang kamu butuhkan, kabari lewat halaman Kontak.",
      ],
    },
  ],
};

export const PRIVASI: StaticPage = {
  slug: "privasi",
  metaTitle: "Kebijakan Privasi",
  metaDescription:
    "Bagaimana wuspot memperlakukan file dan data kamu: file diproses di perangkatmu sendiri dan tidak pernah dikirim ke server.",
  h1: "Kebijakan Privasi",
  updated: "2026-10-07",
  sections: [
    {
      heading: "File yang kamu proses",
      paragraphs: [
        "Alat di wuspot bekerja di dalam browser. File yang kamu pilih dibaca dan diolah oleh perangkatmu sendiri, lalu hasilnya kamu unduh langsung. File tersebut tidak dikirim, tidak disimpan, dan tidak bisa kami lihat.",
        "Begitu tab ditutup, salinan file di memori browser ikut hilang.",
      ],
    },
    {
      heading: "Data yang tercatat saat kamu berkunjung",
      paragraphs: [
        "Seperti hampir semua situs, server hosting mencatat data teknis standar seperti alamat IP, jenis browser, dan halaman yang dibuka, untuk keamanan dan mencegah penyalahgunaan. Data ini tidak kami jual dan tidak kami pakai untuk mengenali kamu secara pribadi.",
        "Saat ini wuspot tidak memasang iklan dan tidak memakai alat pelacak pihak ketiga. Kalau nanti kami memasang iklan atau statistik pengunjung (misalnya Google AdSense atau Google Analytics), layanan tersebut bisa memakai cookie, dan halaman ini akan diperbarui lebih dulu beserta cara menolaknya.",
      ],
    },
    {
      heading: "Penyimpanan di browser",
      paragraphs: [
        "wuspot bisa menyimpan pilihan kecil di browsermu, misalnya target ukuran terakhir yang kamu pakai, supaya tidak perlu memilih ulang. Data ini tetap di perangkatmu dan bisa dihapus lewat pengaturan browser.",
      ],
    },
    {
      heading: "Pertanyaan",
      paragraphs: ["Kalau ada pertanyaan soal privasi, hubungi kami lewat halaman Kontak."],
    },
  ],
};

export const SYARAT: StaticPage = {
  slug: "syarat",
  metaTitle: "Syarat Penggunaan",
  metaDescription: "Aturan singkat memakai alat-alat di wuspot.",
  h1: "Syarat Penggunaan",
  updated: "2026-10-07",
  sections: [
    {
      paragraphs: [
        "Dengan memakai wuspot, kamu setuju dengan hal-hal berikut. Kami menulisnya sesingkat mungkin.",
      ],
      list: [
        "Alat di wuspot gratis dan disediakan apa adanya. Kami berusaha membuatnya benar dan rapi, tapi tidak bisa menjamin hasilnya selalu sesuai kebutuhan setiap formulir atau instansi.",
        "Selalu periksa hasil sebelum dipakai atau dikirim. Tanggung jawab atas berkas yang kamu kirim tetap ada padamu.",
        "Pakai hanya untuk file yang memang berhak kamu olah. Jangan gunakan wuspot untuk memalsukan dokumen atau hal yang melanggar hukum.",
        "Karena file diproses di perangkatmu, kami tidak menyimpan cadangan. Simpan file aslimu sampai kamu yakin hasilnya sudah benar.",
        "Syarat ini bisa diperbarui sewaktu-waktu. Tanggal pembaruan terakhir tercantum di halaman ini.",
      ],
    },
  ],
};

export const STATIC_PAGES = [TENTANG, PRIVASI, SYARAT];
