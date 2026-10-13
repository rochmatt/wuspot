import type { CompressLevel, CompressStage } from "@/lib/pdf-compress/types";
import type { ModeChoice } from "./useKompres";

export const TARGET_CHIPS = [100, 200, 300, 500, 1000] as const;

export const LEVELS: { level: CompressLevel; name: string; sub: string; dots: number }[] = [
  { level: "ringan", name: "Ringan", sub: "kualitas tinggi", dots: 1 },
  { level: "sedang", name: "Sedang", sub: "disarankan", dots: 2 },
  { level: "kuat", name: "Kuat", sub: "paling kecil", dots: 3 },
];

const LEVEL_NAME: Record<CompressLevel, string> = { ringan: "Ringan", sedang: "Sedang", kuat: "Kuat" };

/** 200 -> "200 KB", 1000 -> "1 MB", 1500 -> "1.500 KB". */
export function kbLabel(kb: number): string {
  if (kb >= 1000 && kb % 1000 === 0) return `${kb / 1000} MB`;
  return `${kb.toLocaleString("id-ID")} KB`;
}

export function modeLabel(mode: ModeChoice): string {
  return mode.kind === "target" ? `target ${kbLabel(mode.kb)}` : `tingkat ${LEVEL_NAME[mode.level]}`;
}

export function levelName(level: CompressLevel): string {
  return LEVEL_NAME[level];
}

export const STAGE_LABEL: Record<CompressStage, string> = {
  membaca: "Membaca file…",
  menganalisis: "Memeriksa isi PDF…",
  mengompres: "Mengompres…",
  menyusun: "Menyusun PDF baru…",
  selesai: "Hampir beres…",
};

/** Batas isian "lainnya". */
export const CUSTOM_MIN_KB = 10;
export const CUSTOM_MAX_KB = 150_000;

/**
 * Catatan dari mesin ditulis formal ("tidak", "Periksa"). Yang sudah dikenal
 * disamakan dengan gaya bahasa situs; sisanya ditampilkan apa adanya.
 */
const NOTE_CASUAL: Record<string, string> = {
  "Ukurannya sudah di bawah target, jadi file tidak diubah.":
    "Ukurannya sudah di bawah target, jadi file-nya nggak diubah.",
  "File ini sudah cukup ringkas, jadi tidak diubah.": "File ini sudah cukup ringkas, jadi nggak diubah.",
  "PDF ini hanya bisa dikecilkan dengan mengubah halamannya jadi gambar. Coba level Kuat atau pilih target ukuran.":
    "PDF ini cuma bisa dikecilkan dengan mengubah halamannya jadi gambar. Coba tingkat Kuat atau pilih target ukuran.",
  "Teks di PDF ini sekarang berupa gambar, jadi tidak bisa disalin atau dicari.":
    "Teks di PDF ini sekarang berupa gambar, jadi nggak bisa disalin atau dicari.",
  "Resolusinya diturunkan cukup banyak supaya muat. Periksa dulu apakah tulisannya masih terbaca.":
    "Resolusinya diturunkan cukup banyak biar muat. Cek dulu tulisannya masih kebaca atau nggak.",
  "Gambar di dalamnya diperkecil cukup banyak. Periksa dulu apakah masih jelas.":
    "Gambar di dalamnya diperkecil cukup banyak. Cek dulu masih jelas atau nggak.",
  "Tidak ada gambar yang bisa diubah jadi hitam-putih di PDF ini.":
    "Di PDF ini nggak ada gambar yang bisa diubah jadi hitam-putih.",
  "Hitam-putih hanya diterapkan pada gambar; teks dan garis tetap seperti aslinya.":
    "Hitam-putih cuma berlaku untuk gambar. Teks dan garisnya tetap seperti aslinya.",
  "File hasil tidak lagi dikunci password, jadi simpan baik-baik.":
    "File hasilnya nggak dikunci password lagi, jadi simpan baik-baik.",
  "Proteksi (pembatasan salin/edit) di PDF asli tidak ikut ke file hasil.":
    "Proteksi (larangan salin/edit) di PDF asli nggak ikut ke file hasil.",
  "Tanda tangan digital (mis. e-meterai) di PDF ini tidak berlaku lagi di file hasil. Kalau harus sah, unggah file aslinya.":
    "Tanda tangan digital (misalnya e-meterai) di PDF ini nggak berlaku lagi di file hasil. Kalau harus sah, upload file aslinya.",
  "Memori perangkat tidak cukup untuk mencoba semua cara, jadi hasilnya mungkin belum yang terkecil.":
    "Memori perangkatmu nggak cukup untuk mencoba semua cara, jadi hasilnya mungkin belum yang terkecil.",
};

export function casualNote(note: string): string {
  return NOTE_CASUAL[note] ?? note;
}

/**
 * Catatan "Target … belum tercapai" dan "Coba …" dari mesin sudah diwakili
 * vonis dan tips di tanda terima, jadi tidak ditampilkan dua kali.
 */
export function isVerdictNote(note: string): boolean {
  return note.startsWith("Target ") || note.startsWith("Coba ");
}
