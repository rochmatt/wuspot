import { describe, expect, it } from "vitest";
import {
  IMAGE_LADDER,
  LEVEL_PRESETS,
  MAX_RASTER_DPI,
  NEAR_MISS_TOLERANCE,
  RASTER_LADDER,
  searchLadder,
} from "../ladder";

/** Estimator palsu dari daftar ukuran, sekalian mencatat indeks yang dihitung. */
function sizes(values: number[]) {
  const calls: number[] = [];
  const estimate = async (_step: number, i: number) => {
    calls.push(i);
    return values[i];
  };
  return { ladder: values.map((_, i) => i), estimate, calls };
}

describe("tangga", () => {
  it("IMAGE_LADDER makin kecil: maxSide & quality tidak naik", () => {
    for (let i = 1; i < IMAGE_LADDER.length; i++) {
      expect(IMAGE_LADDER[i].maxSide).toBeLessThanOrEqual(IMAGE_LADDER[i - 1].maxSide);
      expect(IMAGE_LADDER[i].quality).toBeLessThan(IMAGE_LADDER[i - 1].quality);
    }
  });

  it("RASTER_LADDER makin kecil: dpi & quality tidak naik", () => {
    for (let i = 1; i < RASTER_LADDER.length; i++) {
      expect(RASTER_LADDER[i].dpi).toBeLessThanOrEqual(RASTER_LADDER[i - 1].dpi);
      expect(RASTER_LADDER[i].quality).toBeLessThan(RASTER_LADDER[i - 1].quality);
    }
  });

  it("semua quality di rentang JPEG yang wajar", () => {
    for (const s of [...IMAGE_LADDER, ...RASTER_LADDER]) {
      expect(s.quality).toBeGreaterThan(0.2);
      expect(s.quality).toBeLessThanOrEqual(0.92);
    }
  });

  it("MAX_RASTER_DPI = dpi tertinggi, dan preset raster tidak melebihinya", () => {
    expect(MAX_RASTER_DPI).toBe(150);
    for (const p of Object.values(LEVEL_PRESETS)) {
      if (p.raster) expect(p.raster.dpi).toBeLessThanOrEqual(MAX_RASTER_DPI);
    }
  });

  it("preset level sesuai spesifikasi", () => {
    expect(LEVEL_PRESETS.ringan).toEqual({
      image: { maxSide: 2400, quality: 0.82 },
      raster: null,
      rasterizeWithText: false,
    });
    expect(LEVEL_PRESETS.sedang.image).toEqual({ maxSide: 1600, quality: 0.62 });
    expect(LEVEL_PRESETS.sedang.raster).toEqual({ dpi: 120, quality: 0.62 });
    expect(LEVEL_PRESETS.sedang.rasterizeWithText).toBe(false);
    expect(LEVEL_PRESETS.kuat.image).toEqual({ maxSide: 1000, quality: 0.45 });
    expect(LEVEL_PRESETS.kuat.raster).toEqual({ dpi: 90, quality: 0.5 });
    expect(LEVEL_PRESETS.kuat.rasterizeWithText).toBe(true);
  });

  it("level makin kuat = gambar makin kecil", () => {
    const { ringan, sedang, kuat } = LEVEL_PRESETS;
    expect(sedang.image.maxSide).toBeLessThan(ringan.image.maxSide);
    expect(kuat.image.maxSide).toBeLessThan(sedang.image.maxSide);
    expect(kuat.image.quality).toBeLessThan(sedang.image.quality);
    expect(kuat.raster!.dpi).toBeLessThan(sedang.raster!.dpi);
  });
});

describe("searchLadder", () => {
  it("menemukan indeks pertama yang muat pada tangga menurun", async () => {
    const values = [1000, 800, 600, 450, 300, 200, 150, 100, 80];
    for (const [target, expected] of [
      [1000, 0],
      [999, 1],
      [600, 2],
      [599, 3],
      [300, 4],
      [100, 7],
      [80, 8],
    ] as const) {
      const { ladder, estimate } = sizes(values);
      const r = await searchLadder(ladder, estimate, target);
      expect(r, `target ${target}`).toEqual({ index: expected, estimate: values[expected], met: true });
    }
  });

  it("tidak ada yang muat -> langkah terakhir (terkecil), met=false", async () => {
    const { ladder, estimate } = sizes([1000, 800, 600, 400]);
    expect(await searchLadder(ladder, estimate, 100)).toEqual({ index: 3, estimate: 400, met: false });
  });

  it("tidak ada yang muat & tidak monoton -> perkiraan terkecil yang dihitung", async () => {
    // Langkah terakhir sedikit lebih besar dari langkah sebelumnya.
    const { ladder, estimate } = sizes([1000, 800, 300, 310]);
    const r = await searchLadder(ladder, estimate, 100);
    expect(r.met).toBe(false);
    expect(r.estimate).toBeLessThanOrEqual(310);
    expect([2, 3]).toContain(r.index);
  });

  it("seri pada perkiraan terkecil -> indeks paling akhir", async () => {
    const { ladder, estimate } = sizes([500, 400, 400, 400]);
    expect(await searchLadder(ladder, estimate, 100)).toEqual({ index: 3, estimate: 400, met: false });
  });

  it("langkah pertama sudah muat -> indeks 0, cukup sedikit estimasi", async () => {
    const { ladder, estimate, calls } = sizes([90, 80, 70, 60, 50, 40, 30, 20, 10]);
    expect(await searchLadder(ladder, estimate, 100)).toEqual({ index: 0, estimate: 90, met: true });
    expect(calls.length).toBeLessThanOrEqual(5);
  });

  it("satu langkah saja", async () => {
    expect(await searchLadder(...args([50]), 100)).toEqual({ index: 0, estimate: 50, met: true });
    expect(await searchLadder(...args([150]), 100)).toEqual({ index: 0, estimate: 150, met: false });
  });

  it("jumlah estimasi ~log2(n) pada tangga menurun & tiap indeks paling banyak sekali", async () => {
    const values = Array.from({ length: 64 }, (_, i) => 10_000 - i * 100);
    const { ladder, estimate, calls } = sizes(values);
    const r = await searchLadder(ladder, estimate, 5_000);
    expect(r).toEqual({ index: 50, estimate: 5_000, met: true });
    expect(new Set(calls).size).toBe(calls.length);
    expect(calls.length).toBeLessThanOrEqual(Math.ceil(Math.log2(64)) + 2);
  });

  it("menangkap tonjolan kecil tepat sebelum batas", async () => {
    // Binary search melompati indeks 3 (melihat 4 -> meleset), tapi indeks 3 muat.
    const target = 1000;
    const values = [1500, 1200, 1100, 990, 1050, 900, 800, 700];
    const { ladder, estimate } = sizes(values);
    const r = await searchLadder(ladder, estimate, target);
    expect(r).toEqual({ index: 3, estimate: 990, met: true });
  });

  it("tonjolan kecil di ujung tangga tetap ketemu", async () => {
    // Binary search hanya melihat indeks terakhir (meleset tipis) -> cek tetangganya.
    const values = [3000, 2000, 1500, 980, 1020];
    const { ladder, estimate } = sizes(values);
    expect(await searchLadder(ladder, estimate, 1000)).toEqual({ index: 3, estimate: 980, met: true });
  });

  it("tidak memeriksa ke belakang bila langkah sebelumnya jauh di atas target", async () => {
    const values = [5000, 4000, 3000, 2000, 900, 800, 700, 600];
    const { ladder, estimate, calls } = sizes(values);
    const r = await searchLadder(ladder, estimate, 1000);
    expect(r).toEqual({ index: 4, estimate: 900, met: true });
    // Hanya indeks yang dilihat binary search; tidak ada tambahan.
    expect([...calls].sort()).toEqual([2, 3, 4]);
  });

  it(`meleset tipis = maksimal ${NEAR_MISS_TOLERANCE * 100}% di atas target`, async () => {
    const target = 1000;
    const inside = [2000, 990, target * (1 + NEAR_MISS_TOLERANCE), 900];
    expect((await searchLadder(...args(inside), target)).index).toBe(1);
    const outside = [2000, 990, target * (1 + NEAR_MISS_TOLERANCE) + 1, 900];
    expect((await searchLadder(...args(outside), target)).index).toBe(3);
  });

  it("estimasi melempar error -> diteruskan (mis. dibatalkan)", async () => {
    const err = new Error("aborted");
    await expect(
      searchLadder(
        [1, 2, 3],
        async () => {
          throw err;
        },
        100,
      ),
    ).rejects.toBe(err);
  });

  it("tangga kosong -> error", async () => {
    await expect(searchLadder([], async () => 0, 100)).rejects.toThrow();
  });

  it("estimator menerima langkah & indeks yang benar", async () => {
    const seen: Array<[string, number]> = [];
    await searchLadder(
      ["a", "b", "c"],
      async (step, i) => {
        seen.push([step, i]);
        return 100 - i;
      },
      99,
    );
    for (const [step, i] of seen) expect(step).toBe("abc"[i]);
  });
});

function args(values: number[]): [number[], (s: number, i: number) => Promise<number>] {
  const { ladder, estimate } = sizes(values);
  return [ladder, estimate];
}
