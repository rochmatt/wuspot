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
}

// Urutan = urutan tampil. Alat yang belum siap tetap ditampilkan tanpa link
// (tidak dibuat halamannya dulu supaya Google tidak mengindeks halaman kosong).
export const TOOLS: ToolEntry[] = [
  { slug: "kompres-pdf", name: "Kompres PDF", blurb: "Kecilkan PDF sampai ukuran KB yang kamu mau", category: "pdf", ready: true },
  { slug: "gabung-pdf", name: "Gabung PDF", blurb: "Satukan beberapa PDF jadi satu berkas", category: "pdf", ready: false },
  { slug: "foto-ke-pdf", name: "Foto ke PDF", blurb: "Ubah foto atau scan HP jadi PDF rapi", category: "pdf", ready: false },
  { slug: "pdf-ke-gambar", name: "PDF ke Gambar", blurb: "Simpan tiap halaman PDF sebagai JPG", category: "pdf", ready: false },
  { slug: "kompres-foto", name: "Kompres Foto", blurb: "Kecilkan foto ke 100, 200, atau 300 KB", category: "foto", ready: false },
  { slug: "pas-foto", name: "Pas Foto", blurb: "Ukuran 3x4 dan 4x6, latar merah atau biru", category: "foto", ready: false },
  { slug: "video-ke-mp3", name: "Video ke MP3", blurb: "Ambil suara dari video milikmu sendiri", category: "audio", ready: false },
  { slug: "kompres-video", name: "Kompres Video", blurb: "Kecilkan video supaya muat dikirim", category: "video", ready: false },
];

export const CATEGORY_LABEL: Record<ToolCategory, string> = {
  pdf: "PDF",
  foto: "Foto",
  video: "Video",
  audio: "Audio",
};
