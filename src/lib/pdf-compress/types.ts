// Kontrak publik mesin kompres PDF. UI hanya boleh bergantung pada file ini
// dan pada fungsi `compressPdf` dari ./index.

export type CompressLevel = "ringan" | "sedang" | "kuat";

export type CompressMode =
  | { kind: "target"; targetBytes: number }
  | { kind: "level"; level: CompressLevel };

export type CompressStage =
  | "membaca"
  | "menganalisis"
  | "mengompres"
  | "menyusun"
  | "selesai";

export interface CompressProgress {
  stage: CompressStage;
  /** Perkiraan kemajuan keseluruhan, 0..1. Tidak boleh mundur. */
  ratio: number;
  /** Keterangan singkat untuk pengguna, mis. "Halaman 3 dari 12". */
  detail?: string;
}

export interface CompressOptions {
  mode: CompressMode;
  /** Ubah gambar/halaman jadi hitam-putih (abu-abu) supaya lebih kecil. */
  grayscale?: boolean;
  /** Password untuk PDF yang dikunci. */
  password?: string;
  signal?: AbortSignal;
  onProgress?: (p: CompressProgress) => void;
}

/**
 * - original : file asli dikembalikan apa adanya (sudah paling kecil)
 * - optimize : struktur dirapikan tanpa mengubah isi (lossless)
 * - images   : gambar di dalam PDF dikompres ulang, teks tetap teks
 * - rasterize: tiap halaman diubah jadi gambar JPG (teks tidak bisa dipilih lagi)
 */
export type CompressStrategy = "original" | "optimize" | "images" | "rasterize";

export interface CompressResult {
  blob: Blob;
  originalBytes: number;
  outputBytes: number;
  pageCount: number;
  strategy: CompressStrategy;
  /** true bila teks di PDF hasil masih bisa dipilih/dicari. */
  textPreserved: boolean;
  /** Mode target: apakah ukuran target tercapai. Mode level: null. */
  targetMet: boolean | null;
  /** Pengaturan yang akhirnya dipakai (untuk ditampilkan/diagnosis). */
  settings: { dpi?: number; quality?: number; maxImageSide?: number };
  /** Catatan untuk pengguna, dalam bahasa Indonesia, jujur & singkat. */
  notes: string[];
}

export type CompressErrorCode =
  | "not-pdf"
  | "needs-password"
  | "wrong-password"
  | "corrupt"
  | "too-large"
  | "aborted"
  | "unsupported"
  | "out-of-memory";

export class CompressError extends Error {
  readonly code: CompressErrorCode;
  constructor(code: CompressErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "CompressError";
    this.code = code;
  }
}

/** Batas ukuran input yang masih wajar diproses di HP. */
export const MAX_INPUT_BYTES = 150 * 1024 * 1024;
