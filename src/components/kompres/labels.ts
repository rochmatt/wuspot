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
 * Catatan "Target … belum tercapai" dan "Coba …" dari mesin sudah diwakili
 * vonis dan tips di tanda terima, jadi tidak ditampilkan dua kali.
 */
export function isVerdictNote(note: string): boolean {
  return note.startsWith("Target ") || note.startsWith("Coba ");
}
