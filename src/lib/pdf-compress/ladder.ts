// Tangga pengaturan kompresi (dari kualitas terbaik ke ukuran terkecil) dan
// pencarian langkah pertama yang muat di target. Murni, tanpa DOM.

import type { CompressLevel } from "./types";

export interface ImageStep {
  /** Sisi terpanjang gambar setelah diperkecil, dalam piksel. */
  maxSide: number;
  /** Kualitas JPEG 0..1. */
  quality: number;
}

export interface RasterStep {
  dpi: number;
  /** Kualitas JPEG 0..1. */
  quality: number;
}

export const IMAGE_LADDER: ImageStep[] = [
  { maxSide: 2400, quality: 0.82 },
  { maxSide: 2000, quality: 0.75 },
  { maxSide: 1800, quality: 0.68 },
  { maxSide: 1600, quality: 0.62 },
  { maxSide: 1400, quality: 0.56 },
  { maxSide: 1200, quality: 0.5 },
  { maxSide: 1000, quality: 0.45 },
  { maxSide: 850, quality: 0.4 },
  { maxSide: 700, quality: 0.35 },
];

export const RASTER_LADDER: RasterStep[] = [
  { dpi: 150, quality: 0.8 },
  { dpi: 150, quality: 0.7 },
  { dpi: 130, quality: 0.65 },
  { dpi: 110, quality: 0.6 },
  { dpi: 100, quality: 0.55 },
  { dpi: 90, quality: 0.5 },
  { dpi: 80, quality: 0.45 },
  { dpi: 72, quality: 0.4 },
  { dpi: 60, quality: 0.35 },
  { dpi: 50, quality: 0.3 },
];

export interface LevelPreset {
  image: ImageStep;
  /** null = jangan pernah ubah halaman jadi gambar. */
  raster: RasterStep | null;
  /**
   * false = rasterize hanya boleh untuk PDF tanpa teks sama sekali (hasil scan).
   * true  = boleh walau ada teks (teks ikut jadi gambar).
   */
  rasterizeWithText: boolean;
}

export const LEVEL_PRESETS: Record<CompressLevel, LevelPreset> = {
  ringan: { image: { maxSide: 2400, quality: 0.82 }, raster: null, rasterizeWithText: false },
  sedang: { image: { maxSide: 1600, quality: 0.62 }, raster: { dpi: 120, quality: 0.62 }, rasterizeWithText: false },
  kuat: { image: { maxSide: 1000, quality: 0.45 }, raster: { dpi: 90, quality: 0.5 }, rasterizeWithText: true },
};

/** Dpi tertinggi di tangga raster; master halaman cukup dirender sekali di dpi ini. */
export const MAX_RASTER_DPI = RASTER_LADDER.reduce((m, s) => Math.max(m, s.dpi), 0);

/**
 * Bila langkah tepat sebelum batas hanya meleset tipis (<= 10% di atas target),
 * langkah sebelumnya lagi ikut dicek: ukuran JPEG tidak selalu turun mulus,
 * jadi bisa saja ada langkah berkualitas lebih baik yang ternyata muat.
 */
export const NEAR_MISS_TOLERANCE = 0.1;

export interface LadderSearchResult {
  /** Indeks langkah terpilih. */
  index: number;
  /** Perkiraan ukuran (byte) di langkah itu. */
  estimate: number;
  /** true bila perkiraan <= target. */
  met: boolean;
}

/**
 * Cari indeks PERTAMA (kualitas terbaik) yang perkiraan ukurannya <= target.
 *
 * Mengandalkan anggapan bahwa ukuran tidak naik sepanjang tangga (binary search,
 * ~log2(n) kali estimasi), lalu memeriksa tetangga di sekitar batas untuk
 * menangkap tonjolan kecil. Setiap indeks paling banyak diestimasi sekali.
 *
 * Bila tidak ada yang muat: kembalikan langkah dengan perkiraan terkecil yang
 * sudah dihitung (pada tangga yang menurun, itu langkah terakhir), met=false.
 */
export async function searchLadder<T>(
  ladder: T[],
  estimate: (step: T, index: number) => Promise<number>,
  targetBytes: number,
): Promise<LadderSearchResult> {
  const n = ladder.length;
  if (n === 0) throw new Error("searchLadder: tangga kosong");

  const cache = new Map<number, number>();
  const get = async (i: number): Promise<number> => {
    const hit = cache.get(i);
    if (hit !== undefined) return hit;
    const v = await estimate(ladder[i], i);
    cache.set(i, v);
    return v;
  };
  const fits = (v: number) => v <= targetBytes;

  // Binary search: lo = indeks pertama yang muat (n = tidak ada).
  let lo = 0;
  let hi = n;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (fits(await get(mid))) hi = mid;
    else lo = mid + 1;
  }

  // Telusuri mundur dari batas. Indeks lo-1 (bila ada) sudah dihitung dan tidak muat.
  let best = lo < n ? lo : -1;
  let i = lo - 1;
  while (i >= 0) {
    const v = await get(i);
    if (fits(v)) {
      best = i;
      i -= 1;
      continue;
    }
    if (i === 0 || v > targetBytes * (1 + NEAR_MISS_TOLERANCE)) break;
    if (!fits(await get(i - 1))) break;
    best = i - 1;
    i -= 2;
  }

  if (best >= 0) return { index: best, estimate: cache.get(best)!, met: true };

  // Tidak ada yang muat: pilih yang terkecil; seri -> indeks paling akhir.
  let minIndex = -1;
  let minValue = Infinity;
  for (const [idx, v] of cache) {
    if (v < minValue || (v === minValue && idx > minIndex)) {
      minIndex = idx;
      minValue = v;
    }
  }
  return { index: minIndex, estimate: minValue, met: false };
}
