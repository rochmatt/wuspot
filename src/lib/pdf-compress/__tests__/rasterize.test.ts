import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import jpeg from "jpeg-js";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { grayscaleInPlace, type Ctx2D } from "../canvas";
import {
  MAX_CANVAS_AREA,
  MAX_CANVAS_SIDE,
  buildRasterPdf,
  estimateRasterPdfBytes,
  outputPageSize,
  renderScale,
  trialSize,
  type RasterMaster,
} from "../rasterize";

const A4 = { w: 595.28, h: 841.89 };

describe("renderScale", () => {
  it("memakai dpi apa adanya untuk halaman normal", () => {
    expect(renderScale(A4.w, A4.h, 150)).toBeCloseTo(150 / 72, 10);
  });

  it("membatasi sisi panjang 4096 px", () => {
    const s = renderScale(2384, 3370, 150); // A0
    expect(Math.floor(3370 * s)).toBeLessThanOrEqual(MAX_CANVAS_SIDE);
    expect(Math.floor(3370 * s)).toBeGreaterThan(MAX_CANVAS_SIDE - 2);
  });

  it("membatasi luas 16 MP untuk halaman persegi besar", () => {
    const side = 2000; // ~70 cm persegi
    const s = renderScale(side, side, 300);
    const px = Math.floor(side * s);
    expect(px * px).toBeLessThanOrEqual(MAX_CANVAS_AREA);
    expect(px).toBeLessThanOrEqual(MAX_CANVAS_SIDE);
  });

  it("tahan terhadap ukuran nol", () => {
    expect(Number.isFinite(renderScale(0, 0, 150))).toBe(true);
  });
});

describe("trialSize", () => {
  const master = { pxWidth: 1240, pxHeight: 1754, widthPt: A4.w };

  it("mengecilkan proporsional sesuai dpi", () => {
    const { width, height } = trialSize(master, 75);
    expect(width).toBe(Math.round(1240 * ((A4.w * 75) / 72 / 1240)));
    expect(height / width).toBeCloseTo(1754 / 1240, 2);
  });

  it("tidak pernah memperbesar melebihi master", () => {
    expect(trialSize(master, 300)).toEqual({ width: 1240, height: 1754 });
  });

  it("halaman yang master-nya terpotong batas canvas tetap pakai dpi fisik", () => {
    // Poster 2000 pt: master dibatasi 4096 px, percobaan 72 dpi = 2000 px.
    const poster = { pxWidth: 4096, pxHeight: 2048, widthPt: 2000 };
    expect(trialSize(poster, 72)).toEqual({ width: 2000, height: 1000 });
  });
});

describe("outputPageSize", () => {
  it("mempertahankan ukuran normal", () => {
    expect(outputPageSize({ widthPt: A4.w, heightPt: A4.h })).toEqual({ width: A4.w, height: A4.h });
  });

  it("mengecilkan halaman di atas batas 14400 pt secara proporsional", () => {
    const { width, height } = outputPageSize({ widthPt: 28800, heightPt: 7200 });
    expect(width).toBe(14400);
    expect(height).toBe(3600);
  });
});

describe("grayscaleInPlace", () => {
  it("mengubah setiap piksel jadi abu-abu, termasuk pita terakhir yang tidak penuh", () => {
    const w = 1500; // pita ~699 baris -> 3 pita untuk 1500 baris
    const h = 1500;
    const pixels = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < pixels.length; i += 4) {
      pixels[i] = 255;
      pixels[i + 1] = 0;
      pixels[i + 2] = 0;
      pixels[i + 3] = 255;
    }
    // Konteks tiruan yang cukup untuk getImageData/putImageData.
    const ctx = {
      getImageData(_x: number, y: number, cw: number, rows: number) {
        return { data: pixels.slice(y * cw * 4, (y + rows) * cw * 4) };
      },
      putImageData(img: { data: Uint8ClampedArray }, _x: number, y: number) {
        pixels.set(img.data, y * w * 4);
      },
    } as unknown as Ctx2D;
    grayscaleInPlace(ctx, w, h);
    const red = (255 * 77 + 128) >> 8;
    for (const offset of [0, (w * h * 4) / 2, w * h * 4 - 4]) {
      expect([pixels[offset], pixels[offset + 1], pixels[offset + 2], pixels[offset + 3]]).toEqual([
        red,
        red,
        red,
        255,
      ]);
    }
  });
});

function noisyJpeg(width: number, height: number, seed: number): Uint8Array {
  const data = Buffer.alloc(width * height * 4);
  let s = seed;
  for (let i = 0; i < data.length; i += 4) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    data[i] = s & 255;
    data[i + 1] = (s >> 8) & 255;
    data[i + 2] = (s >> 16) & 255;
    data[i + 3] = 255;
  }
  return new Uint8Array(jpeg.encode({ data, width, height }, 60).data);
}

describe("buildRasterPdf + estimateRasterPdfBytes", () => {
  const sizes = [
    { widthPt: A4.w, heightPt: A4.h, px: [124, 175] },
    { widthPt: A4.h, heightPt: A4.w, px: [175, 124] }, // halaman landscape / hasil /Rotate 90
    { widthPt: 612, heightPt: 1008, px: [128, 210] }, // F4/legal
  ];

  it("menyusun satu halaman per gambar dengan ukuran asli, dan perkiraannya tidak meleset ke bawah", async () => {
    const jpegs = sizes.map((s, i) => noisyJpeg(s.px[0], s.px[1], i + 7));
    const master: RasterMaster = {
      dpi: 15,
      pages: sizes.map((s, i) => ({
        blob: new Blob([jpegs[i] as BlobPart], { type: "image/jpeg" }),
        pxWidth: s.px[0],
        pxHeight: s.px[1],
        widthPt: s.widthPt,
        heightPt: s.heightPt,
      })),
    };
    const title = "Transkrip Nilai — Universitas Contoh";
    const bytes = await buildRasterPdf(jpegs, master, { title });

    const estimate = estimateRasterPdfBytes(jpegs);
    expect(estimate).toBeGreaterThanOrEqual(bytes.length);
    expect(estimate - bytes.length).toBeLessThan(4096);

    const reloaded = await PDFDocument.load(bytes, { updateMetadata: false });
    expect(reloaded.getPageCount()).toBe(sizes.length);
    reloaded.getPages().forEach((page, i) => {
      expect(page.getWidth()).toBeCloseTo(sizes[i].widthPt, 2);
      expect(page.getHeight()).toBeCloseTo(sizes[i].heightPt, 2);
    });
    expect(reloaded.getTitle()).toBe(title);
    expect(reloaded.getProducer()).toBe("wuspot.com");

    // Validasi independen dengan poppler kalau tersedia.
    const dir = mkdtempSync(join(tmpdir(), "wuspot-raster-"));
    try {
      const file = join(dir, "out.pdf");
      writeFileSync(file, bytes);
      let info: string | null = null;
      try {
        info = execFileSync("pdfinfo", [file], { encoding: "utf8" });
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
      }
      if (info !== null) {
        expect(info).toMatch(/Pages:\s+3/);
        expect(info).toMatch(/Producer:\s+wuspot\.com/);
        execFileSync("pdftoppm", ["-r", "10", "-png", file, join(dir, "p")]);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("menolak jumlah gambar yang tidak sama dengan jumlah halaman", async () => {
    const master: RasterMaster = { dpi: 72, pages: [] };
    await expect(buildRasterPdf([noisyJpeg(8, 8, 1)], master, {})).rejects.toThrow();
  });
});
