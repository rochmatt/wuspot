import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { crc32, deflateSync, inflateSync } from "node:zlib";
import jpeg from "jpeg-js";
import { PDFDict, PDFDocument, PDFName, PDFRawStream, PDFRef, StandardFonts, type PDFContext, type PDFObject } from "pdf-lib";
import { describe, expect, it } from "vitest";
import {
  analyzeImage,
  applyEncodedImages,
  boxFactor,
  decodeFlateRaster,
  estimateWithImages,
  findImageCandidates,
  rasterToRgba,
  scanJpeg,
  targetSize,
} from "../images";
import { deflateBytes, inflateBytes, loadEditable, optimizeStructure, removeUnreachable, savePdf } from "../optimize";

const enc = new TextEncoder();

function contains(haystack: Uint8Array, needle: string): boolean {
  return Buffer.from(haystack).includes(Buffer.from(needle, "latin1"));
}

function rawAt(ctx: PDFContext, ref: PDFRef | PDFObject | undefined): PDFRawStream {
  const obj = ref instanceof PDFRef ? ctx.lookup(ref) : ref;
  if (!(obj instanceof PDFRawStream)) throw new Error(`bukan PDFRawStream: ${String(ref)}`);
  return obj;
}

/** PNG RGBA minimal (filter 0 per baris) untuk menguji embedPng + SMask. */
function makePngRgba(width: number, height: number): Uint8Array {
  const rgb = noisyRgb(width, height, 11);
  const rows = new Uint8Array(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const d = y * (width * 4 + 1) + 1 + x * 4;
      const s = (y * width + x) * 3;
      rows[d] = rgb[s];
      rows[d + 1] = rgb[s + 1];
      rows[d + 2] = rgb[s + 2];
      rows[d + 3] = (x * 255) / width;
    }
  }
  const chunk = (type: string, data: Uint8Array): Buffer => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, "latin1"), Buffer.from(data)]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return new Uint8Array(
    Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", deflateSync(rows)), chunk("IEND", new Uint8Array(0))]),
  );
}

function hasTool(cmd: string): boolean {
  return spawnSync("which", [cmd]).status === 0;
}

/** Validasi independen dengan poppler, bila tersedia. */
function popplerCheck(bytes: Uint8Array): { pages: number; text: string } | null {
  if (!hasTool("pdfinfo") || !hasTool("pdftotext")) return null;
  const dir = mkdtempSync(join(tmpdir(), "wuspot-opt-"));
  try {
    const file = join(dir, "out.pdf");
    writeFileSync(file, bytes);
    const info = spawnSync("pdfinfo", [file], { encoding: "utf8" });
    expect(info.status, info.stderr).toBe(0);
    expect(info.stderr).not.toMatch(/error/i);
    const pages = Number(/Pages:\s+(\d+)/.exec(info.stdout)?.[1]);
    const text = spawnSync("pdftotext", [file, "-"], { encoding: "utf8" });
    expect(text.status, text.stderr).toBe(0);
    return { pages, text: text.stdout };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function noisyRgb(width: number, height: number, seed = 1): Uint8Array {
  const out = new Uint8Array(width * height * 3);
  let s = seed;
  for (let i = 0; i < out.length; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    out[i] = ((i % (width * 3)) + (s >> 20)) & 0xff;
  }
  return out;
}

function makeJpeg(width: number, height: number, quality = 92): Uint8Array {
  const rgb = noisyRgb(width, height, width);
  const rgba = new Uint8Array(width * height * 4);
  for (let p = 0; p < width * height; p++) {
    rgba[p * 4] = rgb[p * 3];
    rgba[p * 4 + 1] = rgb[p * 3 + 1];
    rgba[p * 4 + 2] = rgb[p * 3 + 2];
    rgba[p * 4 + 3] = 255;
  }
  return new Uint8Array(jpeg.encode({ width, height, data: rgba }, quality).data);
}

interface Fixture {
  bytes: Uint8Array;
  orphanRef: PDFRef;
  pieceRef: PDFRef;
  thumbRef: PDFRef;
  formPieceRef: PDFRef;
  contentRef: PDFRef;
  contentText: string;
}

/** PDF 3 halaman berisi teks + sampah yang seharusnya dibuang optimize. */
async function buildMessyPdf(): Promise<Fixture> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= 3; i++) {
    const page = doc.addPage([595, 842]);
    page.drawText(`Halaman ${i} wuspot uji teks`, { x: 50, y: 780, size: 18, font });
  }
  const ctx = doc.context;
  const pages = doc.getPages();

  // 1) objek yatim besar
  const orphanRef = ctx.register(ctx.stream(enc.encode("ORPHAN-MARKER ".repeat(500))));

  // 2) /PieceInfo di katalog + halaman, menunjuk data privat
  const pieceRef = ctx.register(ctx.stream(enc.encode("PIECEINFO-MARKER")));
  const pieceDict = ctx.obj({ Illustrator: ctx.obj({ Private: pieceRef }) });
  doc.catalog.set(PDFName.of("PieceInfo"), pieceDict);
  pages[0].node.set(PDFName.of("PieceInfo"), pieceDict);

  // 3) /Thumb di halaman 2
  const thumbRef = ctx.register(
    ctx.stream(enc.encode("THUMB-MARKER"), { Type: "XObject", Subtype: "Image", Width: 1, Height: 1 }),
  );
  pages[1].node.set(PDFName.of("Thumb"), thumbRef);

  // 4) form XObject dengan /PieceInfo, dipakai halaman 3
  const formPieceRef = ctx.register(ctx.stream(enc.encode("FORMPIECE-MARKER")));
  const form = ctx.stream(enc.encode("0 0 m 10 10 l S"), {
    Type: "XObject",
    Subtype: "Form",
    BBox: [0, 0, 10, 10],
    PieceInfo: { App: { Private: formPieceRef } },
  });
  const formRef = ctx.register(form);
  pages[2].node.setXObject(PDFName.of("Fx1"), formRef);

  // 5) content stream besar tanpa filter (tetap valid & bisa dirender)
  const lines: string[] = [];
  for (let i = 0; i < 200; i++) lines.push(`% UNCOMPRESSED-MARKER baris ${i}\nq 1 0 0 1 0 0 cm Q`);
  lines.push("q /Fx1 Do Q");
  const contentText = lines.join("\n");
  const contentRef = ctx.register(ctx.stream(enc.encode(contentText)));
  pages[2].node.addContentStream(contentRef);

  const bytes = await doc.save({ useObjectStreams: false });
  return { bytes, orphanRef, pieceRef, thumbRef, formPieceRef, contentRef, contentText };
}

describe("deflate/inflate", () => {
  it("menghasilkan zlib yang bisa dibaca zlib node (cocok dengan FlateDecode)", async () => {
    const data = enc.encode("wuspot ".repeat(1000));
    const packed = await deflateBytes(data);
    expect(packed[0]).toBe(0x78); // header zlib
    expect(new Uint8Array(inflateSync(packed))).toEqual(data);
    expect(await inflateBytes(packed)).toEqual(data);
  });
});

describe("loadEditable", () => {
  it("menolak PDF terenkripsi", async () => {
    const doc = await PDFDocument.create();
    doc.addPage();
    doc.context.trailerInfo.Encrypt = doc.context.register(doc.context.obj({ Filter: "Standard", V: 2 }));
    const bytes = await doc.save({ useObjectStreams: false });
    expect(await loadEditable(bytes)).toBeNull();
  });

  it("menolak data yang bukan PDF", async () => {
    expect(await loadEditable(enc.encode("ini bukan pdf sama sekali"))).toBeNull();
  });

  it("memuat PDF biasa tanpa mengubah metadata", async () => {
    const doc = await PDFDocument.create();
    doc.addPage();
    doc.setProducer("Scanner ABC");
    const loaded = await loadEditable(await doc.save());
    expect(loaded).not.toBeNull();
    expect(loaded?.getProducer()).toBe("Scanner ABC");
  });
});

describe("optimizeStructure", () => {
  it("membuang objek yatim, PieceInfo, Thumb dan mengompres stream polos", async () => {
    const fx = await buildMessyPdf();
    for (const m of ["ORPHAN-MARKER", "PIECEINFO-MARKER", "THUMB-MARKER", "FORMPIECE-MARKER", "UNCOMPRESSED-MARKER"]) {
      expect(contains(fx.bytes, m), m).toBe(true);
    }

    const doc = await loadEditable(fx.bytes);
    expect(doc).not.toBeNull();
    if (!doc) return;
    await optimizeStructure(doc);
    const ctx = doc.context;

    expect(ctx.lookup(fx.orphanRef)).toBeUndefined();
    expect(ctx.lookup(fx.pieceRef)).toBeUndefined();
    expect(ctx.lookup(fx.thumbRef)).toBeUndefined();
    expect(ctx.lookup(fx.formPieceRef)).toBeUndefined();
    expect(doc.catalog.has(PDFName.of("PieceInfo"))).toBe(false);
    for (const page of doc.getPages()) {
      expect(page.node.has(PDFName.of("PieceInfo"))).toBe(false);
      expect(page.node.has(PDFName.of("Thumb"))).toBe(false);
    }

    const content = ctx.lookup(fx.contentRef);
    expect(content).toBeInstanceOf(PDFRawStream);
    const cs = content as PDFRawStream;
    expect(cs.dict.get(PDFName.of("Filter"))).toBe(PDFName.of("FlateDecode"));
    expect(Buffer.from(inflateSync(cs.contents)).toString("latin1")).toBe(fx.contentText);

    const out = await savePdf(doc, { title: "Ijazah" });
    expect(out.length).toBeLessThan(fx.bytes.length);
    for (const m of ["ORPHAN-MARKER", "PIECEINFO-MARKER", "THUMB-MARKER", "FORMPIECE-MARKER", "UNCOMPRESSED-MARKER"]) {
      expect(contains(out, m), m).toBe(false);
    }

    const reloaded = await PDFDocument.load(out, { updateMetadata: false });
    expect(reloaded.getPageCount()).toBe(3);
    expect(reloaded.getProducer()).toBe("wuspot.com");
    expect(reloaded.getTitle()).toBe("Ijazah");
    // Form tidak boleh ditambahkan diam-diam oleh pdf-lib.
    expect(reloaded.catalog.has(PDFName.of("AcroForm"))).toBe(false);

    const poppler = popplerCheck(out);
    if (poppler) {
      expect(poppler.pages).toBe(3);
      expect(poppler.text).toContain("Halaman 1 wuspot uji teks");
      expect(poppler.text).toContain("Halaman 3 wuspot uji teks");
    }
  });

  it("tidak membuang objek yang masih terpakai dan aman dijalankan dua kali", async () => {
    const fx = await buildMessyPdf();
    const doc = await loadEditable(fx.bytes);
    if (!doc) throw new Error("gagal memuat");
    await optimizeStructure(doc);
    const first = await savePdf(doc);
    await optimizeStructure(doc);
    expect(removeUnreachable(doc)).toEqual([]);
    const second = await savePdf(doc);
    // ModDate bisa beda beberapa byte; struktur harus sama.
    expect(Math.abs(second.length - first.length)).toBeLessThan(64);
    const again = await loadEditable(second);
    expect(again?.getPageCount()).toBe(3);
  });

  it("membiarkan XMP metadata tetap polos", async () => {
    const doc = await PDFDocument.create();
    doc.addPage();
    const xmp = `<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>${" ".repeat(3000)}<?xpacket end="w"?>`;
    doc.catalog.set(PDFName.of("Metadata"), doc.context.register(doc.context.stream(xmp, { Type: "Metadata", Subtype: "XML" })));
    const loaded = await loadEditable(await doc.save());
    if (!loaded) throw new Error("gagal memuat");
    await optimizeStructure(loaded);
    const meta = rawAt(loaded.context, loaded.catalog.get(PDFName.of("Metadata")));
    expect(meta.dict.has(PDFName.of("Filter"))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// images.ts: bagian yang tidak butuh canvas (deteksi kandidat, decode Flate,
// penerapan & perkiraan ukuran) diuji di sini karena berjalan di node.

function imageStream(ctx: PDFContext, dict: Record<string, unknown>, data: Uint8Array): PDFRef {
  return ctx.register(ctx.stream(data, dict as Parameters<PDFContext["stream"]>[1]));
}

describe("images: findImageCandidates", () => {
  it("memilih gambar yang aman dan melewati yang berisiko", async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage();
    const ctx = doc.context;
    const big = noisyRgb(200, 200);
    const packed = await deflateBytes(big);
    const base = { Type: "XObject", Subtype: "Image", Width: 200, Height: 200, BitsPerComponent: 8 };

    const jpg = await doc.embedJpg(makeJpeg(256, 256));
    page.drawImage(jpg, { x: 0, y: 0, width: 100, height: 100 });

    const iccRgb = ctx.register(ctx.flateStream(new Uint8Array(4000), { N: 3 }));
    const iccCmyk = ctx.register(ctx.flateStream(new Uint8Array(4000), { N: 4 }));
    const smask = imageStream(ctx, { ...base, ColorSpace: "DeviceGray", Filter: "FlateDecode" }, await deflateBytes(noisyRgb(200, 67).subarray(0, 40000)));

    const refs = {
      flateRgb: imageStream(ctx, { ...base, ColorSpace: "DeviceRGB", Filter: "FlateDecode" }, packed),
      flateArrFilter: imageStream(ctx, { ...base, ColorSpace: "DeviceRGB", Filter: ["FlateDecode"], DecodeParms: [null] }, packed),
      iccRgb: imageStream(ctx, { ...base, ColorSpace: ["ICCBased", iccRgb], Filter: "FlateDecode", SMask: smask }, packed),
      iccCmyk: imageStream(ctx, { ...base, ColorSpace: ["ICCBased", iccCmyk], Filter: "FlateDecode" }, packed),
      cmyk: imageStream(ctx, { ...base, ColorSpace: "DeviceCMYK", Filter: "FlateDecode" }, packed),
      indexed: imageStream(ctx, { ...base, ColorSpace: ["Indexed", "DeviceRGB", 1, "abcdef"], Filter: "FlateDecode" }, packed),
      bpc4: imageStream(ctx, { ...base, BitsPerComponent: 4, ColorSpace: "DeviceRGB", Filter: "FlateDecode" }, packed),
      decode: imageStream(ctx, { ...base, ColorSpace: "DeviceRGB", Filter: "FlateDecode", Decode: [1, 0, 1, 0, 1, 0] }, packed),
      mask: imageStream(ctx, { ...base, ColorSpace: "DeviceRGB", Filter: "FlateDecode", Mask: [0, 10, 0, 10, 0, 10] }, packed),
      imageMask: imageStream(ctx, { ...base, ImageMask: true, BitsPerComponent: 1, Filter: "FlateDecode" }, packed),
      chain: imageStream(ctx, { ...base, ColorSpace: "DeviceRGB", Filter: ["ASCIIHexDecode", "FlateDecode"] }, packed),
      jpx: imageStream(ctx, { ...base, ColorSpace: "DeviceRGB", Filter: "JPXDecode" }, packed),
      tiny: imageStream(ctx, { ...base, Width: 20, Height: 20, ColorSpace: "DeviceRGB", Filter: "FlateDecode" }, packed),
      smallStream: imageStream(ctx, { ...base, ColorSpace: "DeviceRGB", Filter: "FlateDecode" }, packed.subarray(0, 5000)),
      badPredictor: imageStream(
        ctx,
        { ...base, ColorSpace: "DeviceRGB", Filter: "FlateDecode", DecodeParms: { Predictor: 15, Colors: 1, Columns: 200 } },
        packed,
      ),
      goodPredictor: imageStream(
        ctx,
        { ...base, ColorSpace: "DeviceRGB", Filter: "FlateDecode", DecodeParms: { Predictor: 15, Colors: 3, Columns: 200 } },
        packed,
      ),
      dctTransform: imageStream(
        ctx,
        { ...base, ColorSpace: "DeviceRGB", Filter: "DCTDecode", DecodeParms: { ColorTransform: 0 } },
        makeJpeg(200, 200),
      ),
    };
    await doc.flush(); // embedJpg baru menulis stream saat flush

    const found = new Set(findImageCandidates(doc).map((c) => c.refTag));
    const expectIn = ["flateRgb", "flateArrFilter", "iccRgb", "goodPredictor"] as const;
    for (const k of expectIn) expect(found.has(refs[k].tag), k).toBe(true);
    const expectOut = [
      "iccCmyk",
      "cmyk",
      "indexed",
      "bpc4",
      "decode",
      "mask",
      "imageMask",
      "chain",
      "jpx",
      "tiny",
      "smallStream",
      "badPredictor",
      "dctTransform",
    ] as const;
    for (const k of expectOut) expect(found.has(refs[k].tag), k).toBe(false);
    // SMask milik gambar lain tidak boleh ikut dikompres jadi JPEG RGB.
    expect(found.has(smask.tag)).toBe(false);

    const jpegCands = findImageCandidates(doc).filter((c) => c.kind === "jpeg");
    expect(jpegCands).toHaveLength(1);
    expect(jpegCands[0]).toMatchObject({ width: 256, height: 256 });
  });

  it("gambar PNG beralpha dari pdf-lib: gambar dasar jadi kandidat, SMask tidak", async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage();
    const img = await doc.embedPng(makePngRgba(300, 200));
    page.drawImage(img, { x: 0, y: 0, width: 300, height: 200 });
    await doc.flush();

    const base = rawAt(doc.context, img.ref);
    const smaskRef = base.dict.get(PDFName.of("SMask"));
    expect(smaskRef).toBeInstanceOf(PDFRef);

    const cands = findImageCandidates(doc);
    expect(cands.map((c) => c.refTag)).toEqual([img.ref.tag]);
    expect(cands[0]).toMatchObject({ kind: "flate", width: 300, height: 200 });

    const info = analyzeImage(doc.context, base);
    if (!info) throw new Error("harusnya kandidat");
    const raster = await decodeFlateRaster(base, info);
    expect(raster?.length).toBe(300 * 200 * 3);
  });
});

describe("images: decode Flate", () => {
  it("inflate + PNG predictor menghasilkan raster asli", async () => {
    const w = 50;
    const h = 40;
    const raw = noisyRgb(w, h, 7);
    const rowLen = w * 3;
    const withFilters = new Uint8Array(h * (rowLen + 1));
    for (let y = 0; y < h; y++) {
      withFilters[y * (rowLen + 1)] = 2; // Up
      for (let i = 0; i < rowLen; i++) {
        const up = y > 0 ? raw[(y - 1) * rowLen + i] : 0;
        withFilters[y * (rowLen + 1) + 1 + i] = (raw[y * rowLen + i] - up) & 0xff;
      }
    }
    const ctx = (await PDFDocument.create()).context;
    const asStream = (data: Uint8Array) => ctx.stream(data, { Filter: "FlateDecode" });
    const packed = await deflateBytes(withFilters);
    const info = { kind: "flate", width: w, height: h, components: 3, predictor: 12 } as const;
    expect(await decodeFlateRaster(asStream(packed), info)).toEqual(raw);

    // Sampah di ekor stream (umum di PDF buatan tool lama) tetap bisa dibaca.
    const junk = new Uint8Array(packed.length + 2);
    junk.set(packed);
    junk.set([0x0d, 0x0a], packed.length);
    await expect(inflateBytes(junk)).rejects.toThrow();
    expect(await decodeFlateRaster(asStream(junk), info)).toEqual(raw);

    const short = await decodeFlateRaster(asStream(await deflateBytes(raw.subarray(0, 100))), {
      ...info,
      predictor: 1,
    });
    expect(short).toBeNull();
  });

  it("rasterToRgba: rata-rata blok & konversi abu-abu", () => {
    // 3x2 gray, k=2 -> 2x1
    const gray = new Uint8Array([0, 100, 50, 200, 100, 150]);
    const out = new Uint8ClampedArray(2 * 1 * 4);
    rasterToRgba(gray, 3, 2, 1, 2, out);
    expect(Array.from(out)).toEqual([100, 100, 100, 255, 100, 100, 100, 255]);

    const rgb = new Uint8Array([10, 20, 30, 40, 50, 60]);
    const out1 = new Uint8ClampedArray(2 * 4);
    rasterToRgba(rgb, 2, 1, 3, 1, out1);
    expect(Array.from(out1)).toEqual([10, 20, 30, 255, 40, 50, 60, 255]);
  });

  it("ukuran target & faktor blok", () => {
    expect(targetSize(4000, 3000, 2000)).toEqual({ width: 2000, height: 1500 });
    expect(targetSize(800, 600, 2000)).toEqual({ width: 800, height: 600 });
    expect(boxFactor(4000, 3000, 1000, 750)).toBe(4);
    expect(boxFactor(4000, 3000, 2000, 1500)).toBe(2);
    expect(boxFactor(1000, 1000, 700, 700)).toBe(1);
  });
});

describe("images: scanJpeg", () => {
  it("membaca SOF dan menemukan segmen EXIF", () => {
    const j = makeJpeg(120, 80);
    const scan = scanJpeg(j);
    expect(scan?.sof).toEqual({ precision: 8, width: 120, height: 80, components: 3 });
    expect(scan?.exifRanges).toEqual([]);

    // Sisipkan APP1 Exif setelah SOI
    const payload = new Uint8Array([0x45, 0x78, 0x69, 0x66, 0, 0, 1, 2, 3, 4]);
    const seg = new Uint8Array([0xff, 0xe1, 0, payload.length + 2, ...payload]);
    const withExif = new Uint8Array(j.length + seg.length);
    withExif.set(j.subarray(0, 2), 0);
    withExif.set(seg, 2);
    withExif.set(j.subarray(2), 2 + seg.length);
    const scan2 = scanJpeg(withExif);
    expect(scan2?.exifRanges).toEqual([[2, 2 + seg.length]]);
    expect(scan2?.sof.width).toBe(120);

    expect(scanJpeg(new Uint8Array([1, 2, 3, 4, 5]))).toBeNull();
  });
});

describe("images: applyEncodedImages & estimateWithImages", () => {
  it("mengganti stream, mempertahankan SMask, membuang ICC yatim, dan bisa di-undo", async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage();
    const ctx = doc.context;
    const raw = noisyRgb(300, 300, 3);
    const packed = await deflateBytes(raw);
    const icc = ctx.register(ctx.flateStream(new Uint8Array(5000), { N: 3 }));
    const smask = imageStream(
      ctx,
      { Type: "XObject", Subtype: "Image", Width: 10, Height: 10, ColorSpace: "DeviceGray", BitsPerComponent: 8 },
      new Uint8Array(100).fill(255),
    );
    const imgRef = imageStream(
      ctx,
      {
        Type: "XObject",
        Subtype: "Image",
        Width: 300,
        Height: 300,
        ColorSpace: ["ICCBased", icc],
        BitsPerComponent: 8,
        Filter: "FlateDecode",
        SMask: smask,
        Interpolate: true,
        Metadata: ctx.register(ctx.stream("<x/>")),
      },
      packed,
    );
    page.node.setXObject(PDFName.of("Im1"), imgRef);
    const before = await doc.save();
    const reloaded = await PDFDocument.load(before);

    const cands = findImageCandidates(reloaded);
    expect(cands.map((c) => c.refTag)).toEqual([imgRef.tag]);
    expect(analyzeImage(reloaded.context, rawAt(reloaded.context, imgRef))).toMatchObject({
      kind: "flate",
      components: 3,
    });

    const newJpeg = makeJpeg(150, 150, 50);
    const encoded = [{ refTag: imgRef.tag, bytes: newJpeg, width: 150, height: 150 }];
    expect(estimateWithImages(100_000, cands, encoded)).toBe(100_000 - cands[0].streamBytes + newJpeg.length + 120);

    const undo = applyEncodedImages(reloaded, encoded);
    const replaced = rawAt(reloaded.context, imgRef);
    const d = replaced.dict;
    expect(d.get(PDFName.of("Filter"))).toBe(PDFName.of("DCTDecode"));
    expect(d.get(PDFName.of("ColorSpace"))).toBe(PDFName.of("DeviceRGB"));
    expect(d.lookup(PDFName.of("Width"))?.toString()).toBe("150");
    expect(d.get(PDFName.of("SMask"))).toBe(smask);
    expect(d.has(PDFName.of("Interpolate"))).toBe(true);
    expect(d.has(PDFName.of("Metadata"))).toBe(false);
    expect(d.has(PDFName.of("DecodeParms"))).toBe(false);
    expect(replaced.contents).toBe(newJpeg);
    // ICC lama kini yatim -> dibuang
    expect(reloaded.context.lookup(icc)).toBeUndefined();
    expect(reloaded.context.lookup(smask)).toBeDefined();

    const saved = await savePdf(reloaded);
    const check = await PDFDocument.load(saved);
    expect(check.getPageCount()).toBe(1);
    const poppler = popplerCheck(saved);
    if (poppler) expect(poppler.pages).toBe(1);

    undo();
    const restored = rawAt(reloaded.context, imgRef);
    expect(restored.dict.get(PDFName.of("Filter"))).toBe(PDFName.of("FlateDecode"));
    expect(reloaded.context.lookup(icc)).toBeInstanceOf(PDFRawStream);
    expect(findImageCandidates(reloaded).map((c) => c.refTag)).toEqual([imgRef.tag]);
    expect(reloaded.context.lookup(imgRef)).toBeInstanceOf(PDFRawStream);
    expect((reloaded.context.lookup(icc) as PDFRawStream).dict).toBeInstanceOf(PDFDict);
  });
});
