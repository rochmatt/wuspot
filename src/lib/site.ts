export const SITE = {
  name: "wuspot",
  url: "https://wuspot.com",
  locale: "id_ID",
  tagline: "Alat online gratis untuk urusan berkas sehari-hari",
  // TODO(pemilik): ganti dengan alamat email yang benar-benar aktif.
  email: "halo@wuspot.com",
} as const;

export type ToolCategory = "pdf" | "foto" | "video" | "audio";

export interface ToolEntry {
  slug: string;
  name: string;
  /** Kalimat pendek, maksimal ~60 karakter. */
  blurb: string;
  category: ToolCategory;
  ready: boolean;
  /** Alat berikutnya yang dibuka: satu-satunya yang diberi cap SEGERA merah. */
  next?: boolean;
  /** Kata lain yang mungkin diketik orang di kotak cari. */
  keywords?: string[];
}

// Urutan = urutan tampil. Alat yang belum siap tetap ditampilkan tanpa link
// (tidak dibuat halamannya dulu supaya Google tidak mengindeks halaman kosong).
export const TOOLS: ToolEntry[] = [
  {
    slug: "kompres-pdf",
    name: "Kompres PDF",
    blurb: "Kecilkan PDF sampai ukuran KB yang kamu mau",
    category: "pdf",
    ready: true,
    keywords: [
      "kecilkan",
      "kecilin",
      "mengecilkan",
      "perkecil",
      "memperkecil",
      "kecil",
      "compress",
      "resize",
      "reduce",
      "kb",
      "mb",
      "100kb",
      "200kb",
      "300kb",
      "500kb",
      "1mb",
      "cpns",
      "pppk",
      "lamaran",
      "ijazah",
      "transkrip",
    ],
  },
  {
    slug: "gabung-pdf",
    name: "Gabung PDF",
    blurb: "Satukan beberapa PDF jadi satu berkas",
    category: "pdf",
    ready: false,
    next: true,
    keywords: ["merge", "satukan", "jadikan satu", "gabungkan", "combine"],
  },
  {
    slug: "foto-ke-pdf",
    name: "Foto ke PDF",
    blurb: "Ubah foto atau scan HP jadi PDF rapi",
    category: "pdf",
    ready: false,
    keywords: ["jpg ke pdf", "gambar ke pdf", "scan", "ktp", "kk"],
  },
  {
    slug: "pdf-ke-gambar",
    name: "PDF ke Gambar",
    blurb: "Simpan tiap halaman PDF sebagai JPG",
    category: "pdf",
    ready: false,
    keywords: ["pdf ke jpg", "png", "foto"],
  },
  {
    slug: "kompres-foto",
    name: "Kompres Foto",
    blurb: "Kecilkan foto ke 100, 200, atau 300 KB",
    category: "foto",
    ready: false,
    keywords: ["jpg", "gambar", "kecilkan", "kb"],
  },
  {
    slug: "pas-foto",
    name: "Pas Foto",
    blurb: "Ukuran 3x4 dan 4x6, latar merah atau biru",
    category: "foto",
    ready: false,
    keywords: ["3x4", "4x6", "background", "latar"],
  },
  {
    slug: "video-ke-mp3",
    name: "Video ke MP3",
    blurb: "Ambil suara dari video milikmu sendiri",
    category: "audio",
    ready: false,
    keywords: ["audio", "suara", "mp4"],
  },
  {
    slug: "kompres-video",
    name: "Kompres Video",
    blurb: "Kecilkan video supaya muat dikirim",
    category: "video",
    ready: false,
    keywords: ["mp4", "kecilkan", "whatsapp"],
  },
];

/** Kode map tiap alat ("Map 01" = Kompres PDF), sama dengan tab di halaman alatnya. */
export function mapCode(slug: string): string {
  return String(TOOLS.findIndex((t) => t.slug === slug) + 1).padStart(2, "0");
}

/** Tanggal isi halaman terakhir diubah (sitemap lastmod). */
export const CONTENT_UPDATED = "2026-10-07";

export const CATEGORY_LABEL: Record<ToolCategory, string> = {
  pdf: "PDF",
  foto: "Foto",
  video: "Video",
  audio: "Audio",
};

/**
 * Laci di beranda. Video dan audio digabung satu laci karena alatnya sedikit.
 * `id` dipakai sebagai jangkar (/#alat-pdf) oleh menu kategori.
 */
export const SHELVES: { id: string; label: string; categories: ToolCategory[] }[] = [
  { id: "alat-pdf", label: "PDF", categories: ["pdf"] },
  { id: "alat-foto", label: "Foto", categories: ["foto"] },
  { id: "alat-video", label: "Video & audio", categories: ["video", "audio"] },
];

/** Menu kategori di kepala halaman. Semua mengarah ke laci di beranda (tidak ada 404). */
export const NAV: { href: string; label: string; match: (path: string) => boolean }[] = [
  { href: "/#alat", label: "Semua alat", match: (p) => p === "/" },
  { href: "/#alat-pdf", label: "PDF", match: (p) => p.startsWith("/kompres-pdf") },
  { href: "/#alat-foto", label: "Foto", match: () => false },
  { href: "/#alat-video", label: "Video", match: () => false },
  { href: "/tentang", label: "Tentang", match: (p) => p === "/tentang" },
];

export interface KabarItem {
  when: string;
  /** Tanggal mesin (YYYY-MM) bila sudah terjadi. */
  date?: string;
  title: string;
  body?: string;
}

/** "Kabar wuspot": catatan perubahan singkat, terbaru di atas. */
export const KABAR: KabarItem[] = [
  {
    when: "Okt 2026",
    date: "2026-10",
    title: "Kompres PDF dibuka.",
    body: "Ada yang aneh? Kabari lewat [halaman Kontak](/kontak), kami baca semua.",
  },
  { when: "berikutnya", title: "Gabung PDF" },
  { when: "setelah itu", title: "Foto ke PDF, Kompres Foto" },
];
