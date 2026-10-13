import { describe, expect, it } from "vitest";
import { grayscaleInPlace, paperLevels, type Ctx2D, type LumaStats } from "../canvas";

/** Statistik luma dari daftar [nilai, jumlah, netral?]. */
function stats(bins: Array<[value: number, count: number, neutral?: boolean]>): LumaStats {
  const hist = new Uint32Array(256);
  const neutral = new Uint32Array(256);
  for (const [v, n, isNeutral = true] of bins) {
    hist[v] += n;
    if (isNeutral) neutral[v] += n;
  }
  return { hist, neutral };
}

/** Kertas: puncak di `paper` dengan sebaran ~sigma, plus tinta gelap. */
function scanLike(paper: number, sigma: number, inkShare = 0.1, neutral = true): LumaStats {
  const bins: Array<[number, number, boolean]> = [];
  const total = 100_000;
  for (let d = -4 * sigma; d <= 4 * sigma; d++) {
    const v = paper + d;
    if (v < 0 || v > 255) continue;
    const n = Math.round(((1 - inkShare) * total * Math.exp(-(d * d) / (2 * sigma * sigma))) / (sigma * Math.sqrt(2 * Math.PI)));
    bins.push([v, n, neutral]);
  }
  bins.push([40, Math.round(inkShare * total), true]);
  return stats(bins);
}

describe("paperLevels", () => {
  it("memutihkan kertas scan yang keabu-abuan, tinta tetap gelap", () => {
    const lut = paperLevels(scanLike(215, 6));
    expect(lut).not.toBeNull();
    const l = lut!;
    expect(l[215]).toBe(255);
    expect(l[205]).toBe(255); // derau kertas ikut putih
    expect(l[40]).toBeLessThan(60);
    expect(l[0]).toBe(0);
    for (let v = 1; v < 256; v++) expect(l[v]).toBeGreaterThanOrEqual(l[v - 1]);
  });

  it("tidak mengubah halaman yang kertasnya sudah putih", () => {
    expect(paperLevels(scanLike(253, 1))).toBeNull();
  });

  it("tidak mengubah foto dengan sebaran nada lebar", () => {
    const bins: Array<[number, number]> = [];
    for (let v = 0; v < 256; v++) bins.push([v, 400]);
    expect(paperLevels(stats(bins))).toBeNull();
  });

  it("tidak menganggap langit biru terang sebagai kertas", () => {
    expect(paperLevels(scanLike(200, 6, 0.1, false))).toBeNull();
  });

  it("tidak meregangkan gambar yang terlalu gelap", () => {
    expect(paperLevels(scanLike(110, 4))).toBeNull();
  });

  it("aman untuk histogram kosong", () => {
    expect(paperLevels(stats([]))).toBeNull();
  });
});

describe("grayscaleInPlace", () => {
  it("mengembalikan histogram luma dan menandai piksel netral", () => {
    const w = 4;
    const h = 1;
    // putih, merah, abu, krem pucat
    const pixels = new Uint8ClampedArray([255, 255, 255, 255, 255, 0, 0, 255, 128, 128, 128, 255, 240, 230, 210, 255]);
    const ctx = {
      getImageData: (_x: number, y: number, cw: number, rows: number) => ({
        data: pixels.slice(y * cw * 4, (y + rows) * cw * 4),
      }),
      putImageData: (img: { data: Uint8ClampedArray }, _x: number, y: number) => pixels.set(img.data, y * w * 4),
    } as unknown as Ctx2D;
    const { hist, neutral } = grayscaleInPlace(ctx, w, h);
    expect(hist.reduce((a, b) => a + b, 0)).toBe(4);
    expect(neutral.reduce((a, b) => a + b, 0)).toBe(3); // merah tidak netral
    expect(hist[255]).toBe(1);
    expect(neutral[(255 * 77 + 128) >> 8]).toBe(0);
  });
});
