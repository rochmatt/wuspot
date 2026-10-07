// Kompres ulang gambar di dalam PDF (teks tetap teks).
// Alurnya dua tahap supaya pencarian tangga kualitas murah:
//   encodeImages()       -> hanya menghasilkan byte JPEG baru, dokumen tidak diubah
//   applyEncodedImages() -> baru menulis ke dokumen

import {
  decodePDFRawStream,
  PDFArray,
  PDFBool,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFNumber,
  PDFObject,
  PDFRawStream,
  PDFRef,
  PDFStream,
} from "pdf-lib";
import type { PDFContext } from "pdf-lib";
import { bitmapToJpeg, createCanvas, releaseCanvas, type AnyCanvas } from "./canvas";
import { inflateBytes, removeUnreachable } from "./optimize";
import { rowBytes, undoPredictor } from "./png-predictor";
import { CompressError } from "./types";

export interface ImageCandidate {
  refTag: string;
  ref: PDFRef;
  width: number;
  height: number;
  streamBytes: number;
  kind: "jpeg" | "flate";
}

export interface EncodedImage {
  refTag: string;
  bytes: Uint8Array;
  width: number;
  height: number;
}

/** Batas aman; di atas ini decode di HP rawan kehabisan memori. */
const MAX_PIXELS = 40_000_000;
const MIN_STREAM_BYTES = 10 * 1024;
const MIN_PIXELS = 64 * 64;
const MIN_SIDE = 16;
/** Ganti stream hanya bila hasil baru < 90% ukuran lama. */
const KEEP_RATIO = 0.9;
/** Perkiraan tambahan byte per gambar yang diganti (dict baru, xref). */
const PER_IMAGE_OVERHEAD = 120;

const N = {
  Subtype: PDFName.of("Subtype"),
  Image: PDFName.of("Image"),
  ImageMask: PDFName.of("ImageMask"),
  Mask: PDFName.of("Mask"),
  SMask: PDFName.of("SMask"),
  Matte: PDFName.of("Matte"),
  Decode: PDFName.of("Decode"),
  Filter: PDFName.of("Filter"),
  DecodeParms: PDFName.of("DecodeParms"),
  Width: PDFName.of("Width"),
  Height: PDFName.of("Height"),
  BitsPerComponent: PDFName.of("BitsPerComponent"),
  ColorSpace: PDFName.of("ColorSpace"),
  ColorTransform: PDFName.of("ColorTransform"),
  Predictor: PDFName.of("Predictor"),
  Colors: PDFName.of("Colors"),
  Columns: PDFName.of("Columns"),
  N: PDFName.of("N"),
  Alternate: PDFName.of("Alternate"),
  DCTDecode: PDFName.of("DCTDecode"),
  FlateDecode: PDFName.of("FlateDecode"),
  DeviceRGB: PDFName.of("DeviceRGB"),
  DeviceGray: PDFName.of("DeviceGray"),
  ICCBased: PDFName.of("ICCBased"),
  CalRGB: PDFName.of("CalRGB"),
  CalGray: PDFName.of("CalGray"),
  Lab: PDFName.of("Lab"),
} as const;

/** Kunci dict lama yang tetap dibawa ke stream baru. */
const KEEP_KEYS = ["SMask", "Interpolate", "Intent", "OC", "StructParent", "Name", "ID"].map((k) => PDFName.of(k));

// ---------------------------------------------------------------------------
// Analisis dict gambar (murni pdf-lib, bisa diuji di node)

export interface ImageInfo {
  kind: "jpeg" | "flate";
  width: number;
  height: number;
  /** 1 (abu-abu) atau 3 (RGB). */
  components: 1 | 3;
  /** Hanya untuk Flate. 1 = tanpa predictor. */
  predictor: number;
}

function num(context: PDFContext, obj: PDFObject | undefined): number | undefined {
  const v = obj instanceof PDFRef ? context.lookup(obj) : obj;
  return v instanceof PDFNumber ? v.asNumber() : undefined;
}

function resolve(context: PDFContext, obj: PDFObject | undefined): PDFObject | undefined {
  // Rantai ref->ref jarang, tapi jangan sampai loop tanpa akhir.
  let v = obj;
  for (let i = 0; i < 4 && v instanceof PDFRef; i++) v = context.lookup(v);
  return v instanceof PDFRef ? undefined : v;
}

/** Filter tunggal (nama atau array 1 elemen) beserta DecodeParms-nya. */
function singleFilter(context: PDFContext, dict: PDFDict): { filter: PDFName; parms: PDFDict | undefined } | null {
  const f = resolve(context, dict.get(N.Filter));
  let parmsObj = resolve(context, dict.get(N.DecodeParms));
  let filter: PDFObject | undefined = f;
  if (f instanceof PDFArray) {
    if (f.size() !== 1) return null;
    filter = resolve(context, f.get(0));
    if (parmsObj instanceof PDFArray) {
      if (parmsObj.size() > 1) return null;
      parmsObj = parmsObj.size() === 1 ? resolve(context, parmsObj.get(0)) : undefined;
    }
  }
  if (!(filter instanceof PDFName)) return null;
  const parms = parmsObj instanceof PDFDict ? parmsObj : undefined;
  return { filter, parms };
}

/** Jumlah komponen warna yang aman diubah ke DeviceRGB, atau null. */
export function colorComponents(context: PDFContext, csObj: PDFObject | undefined): 1 | 3 | null {
  const cs = resolve(context, csObj);
  if (cs === N.DeviceRGB) return 3;
  if (cs === N.DeviceGray) return 1;
  if (!(cs instanceof PDFArray) || cs.size() < 1) return null;

  const family = resolve(context, cs.get(0));
  if (family === N.CalRGB) return 3;
  if (family === N.CalGray) return 1;
  if (family !== N.ICCBased || cs.size() < 2) return null;

  const profile = resolve(context, cs.get(1));
  if (!(profile instanceof PDFStream)) return null;
  const alt = resolve(context, profile.dict.get(N.Alternate));
  if (alt === N.Lab || (alt instanceof PDFArray && resolve(context, alt.get(0)) === N.Lab)) return null;
  const n = num(context, profile.dict.get(N.N));
  return n === 1 || n === 3 ? n : null;
}

function isTrue(context: PDFContext, obj: PDFObject | undefined): boolean {
  const v = resolve(context, obj);
  return v instanceof PDFBool && v.asBoolean();
}

/** Periksa apakah stream gambar aman dikompres ulang. */
export function analyzeImage(context: PDFContext, stream: PDFStream): ImageInfo | null {
  const dict = stream.dict;
  if (resolve(context, dict.get(N.Subtype)) !== N.Image) return null;
  if (isTrue(context, dict.get(N.ImageMask))) return null;
  if (dict.has(N.Mask) || dict.has(N.Decode)) return null;

  // SMask dengan /Matte bergantung pada ruang warna gambar induk; jangan diubah.
  const smask = resolve(context, dict.get(N.SMask));
  if (smask instanceof PDFStream && smask.dict.has(N.Matte)) return null;

  const width = num(context, dict.get(N.Width));
  const height = num(context, dict.get(N.Height));
  if (!width || !height || !Number.isInteger(width) || !Number.isInteger(height)) return null;
  if (width < MIN_SIDE || height < MIN_SIDE || width * height < MIN_PIXELS) return null;
  if (width * height > MAX_PIXELS) return null;

  const sf = singleFilter(context, dict);
  if (!sf) return null;
  const components = colorComponents(context, dict.get(N.ColorSpace));
  if (components === null) return null;
  const bpc = num(context, dict.get(N.BitsPerComponent));

  if (sf.filter === N.DCTDecode) {
    if (bpc !== undefined && bpc !== 8) return null;
    // ColorTransform eksplisit bisa membuat warna salah bila didecode browser.
    if (sf.parms?.has(N.ColorTransform)) return null;
    return { kind: "jpeg", width, height, components, predictor: 1 };
  }

  if (sf.filter === N.FlateDecode) {
    if (bpc !== 8) return null;
    let predictor = 1;
    if (sf.parms) {
      predictor = num(context, sf.parms.get(N.Predictor)) ?? 1;
      if (predictor > 1) {
        const ok = predictor === 2 || (predictor >= 10 && predictor <= 15);
        const colors = num(context, sf.parms.get(N.Colors)) ?? 1;
        const pbpc = num(context, sf.parms.get(N.BitsPerComponent)) ?? 8;
        const columns = num(context, sf.parms.get(N.Columns)) ?? 1;
        if (!ok || colors !== components || pbpc !== 8 || columns !== width) return null;
      }
    }
    return { kind: "flate", width, height, components, predictor };
  }

  return null;
}

/** Ref gambar yang dipakai sebagai /SMask atau /Mask gambar lain: jangan disentuh. */
function maskRefs(context: PDFContext): Set<PDFRef> {
  const out = new Set<PDFRef>();
  for (const [, obj] of context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFStream)) continue;
    for (const key of [N.SMask, N.Mask]) {
      const v = obj.dict.get(key);
      if (v instanceof PDFRef) out.add(v);
    }
  }
  return out;
}

export function findImageCandidates(doc: PDFDocument): ImageCandidate[] {
  const { context } = doc;
  const masks = maskRefs(context);
  const out: ImageCandidate[] = [];
  for (const [ref, obj] of context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFRawStream) || masks.has(ref)) continue;
    const streamBytes = obj.contents.length;
    if (streamBytes < MIN_STREAM_BYTES) continue;
    const info = analyzeImage(context, obj);
    if (!info) continue;
    out.push({ refTag: ref.tag, ref, width: info.width, height: info.height, streamBytes, kind: info.kind });
  }
  // Gambar terbesar dulu: progres terasa lebih jujur & hemat bila dibatalkan.
  return out.sort((a, b) => b.streamBytes - a.streamBytes);
}

// ---------------------------------------------------------------------------
// Encode (tidak mengubah dokumen)

export function targetSize(width: number, height: number, maxSide: number): { width: number; height: number } {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export async function encodeImages(
  doc: PDFDocument,
  candidates: ImageCandidate[],
  step: { maxSide: number; quality: number },
  grayscale: boolean,
  opts: { signal?: AbortSignal; onImage?: (done: number, total: number) => void } = {},
): Promise<EncodedImage[]> {
  const { context } = doc;
  const total = candidates.length;
  const out: EncodedImage[] = [];
  let attempted = 0;
  let oomCount = 0;
  let lastOom: unknown;

  for (let i = 0; i < total; i++) {
    throwIfAborted(opts.signal);
    const c = candidates[i];
    const stream = context.lookup(c.ref);
    const info = stream instanceof PDFRawStream ? analyzeImage(context, stream) : null;

    if (stream instanceof PDFRawStream && info) {
      attempted++;
      const size = targetSize(info.width, info.height, step.maxSide);
      try {
        const bytes =
          info.kind === "jpeg"
            ? await reencodeJpeg(stream.contents, info, size, step.quality, grayscale)
            : await reencodeFlate(stream, info, size, step.quality, grayscale);
        if (bytes && bytes.length < c.streamBytes * KEEP_RATIO) {
          out.push({ refTag: c.refTag, bytes, width: size.width, height: size.height });
        }
      } catch (err) {
        if (isOutOfMemory(err)) {
          // Satu gambar raksasa gagal bukan alasan membatalkan semuanya.
          oomCount++;
          lastOom = err;
        } else if (err instanceof CompressError) {
          throw err;
        }
        // Error lain (gambar rusak, format tak didukung browser): lewati gambar ini.
      }
    }
    opts.onImage?.(i + 1, total);
  }

  throwIfAborted(opts.signal);
  if (attempted > 0 && oomCount === attempted) {
    throw lastOom instanceof CompressError
      ? lastOom
      : new CompressError("out-of-memory", "Memori browser tidak cukup untuk memproses gambar di PDF ini.", { cause: lastOom });
  }
  return out;
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new CompressError("aborted", "Proses dibatalkan.");
}

function isOutOfMemory(err: unknown): boolean {
  return err instanceof RangeError || (err instanceof CompressError && err.code === "out-of-memory");
}

async function reencodeJpeg(
  contents: Uint8Array,
  info: ImageInfo,
  size: { width: number; height: number },
  quality: number,
  grayscale: boolean,
): Promise<Uint8Array | null> {
  const header = scanJpeg(contents);
  if (!header) return null;
  const { sof } = header;
  // Hanya baseline/progressive 8-bit yang pasti bisa didecode browser.
  if (sof.precision !== 8 || sof.components !== info.components) return null;
  if (sof.width !== info.width || sof.height !== info.height) return null;

  // Viewer PDF mengabaikan orientasi EXIF, browser tidak. Buang EXIF supaya sama.
  const jpeg = removeRanges(contents, header.exifRanges);
  const blob = new Blob([jpeg as Uint8Array<ArrayBuffer>], { type: "image/jpeg" });
  // Decode ukuran penuh lalu kecilkan di canvas.ts. Resize langsung saat decode
  // (opsi resizeWidth pada Blob) diukur di Chromium: hasilnya lebih kasar dan
  // malah lebih besar, jadi tidak dipakai.
  const bitmap = await createImageBitmap(blob, {
    // Nilai piksel mentah, persis seperti yang dibaca viewer PDF.
    colorSpaceConversion: "none",
    imageOrientation: "none",
    premultiplyAlpha: "none",
  });
  try {
    if (bitmap.width !== info.width || bitmap.height !== info.height) return null;
    return await bitmapToJpeg(bitmap, { ...size, quality, grayscale });
  } finally {
    bitmap.close();
  }
}

async function reencodeFlate(
  stream: PDFRawStream,
  info: ImageInfo,
  size: { width: number; height: number },
  quality: number,
  grayscale: boolean,
): Promise<Uint8Array | null> {
  const raster = await decodeFlateRaster(stream, info);
  if (!raster) return null;

  // Kecilkan dulu dengan rata-rata blok (faktor bulat) supaya canvas &
  // ImageData yang dibuat tidak sebesar gambar aslinya.
  const k = boxFactor(info.width, info.height, size.width, size.height);
  const w = Math.ceil(info.width / k);
  const h = Math.ceil(info.height / k);
  const imageData = new ImageData(w, h);
  rasterToRgba(raster, info.width, info.height, info.components, k, imageData.data);

  const canvas = createCanvas(w, h);
  try {
    contextOf(canvas).putImageData(imageData, 0, 0);
    return await bitmapToJpeg(canvas, { ...size, quality, grayscale });
  } finally {
    releaseCanvas(canvas);
  }
}

function contextOf(canvas: AnyCanvas): CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D {
  const ctx =
    typeof OffscreenCanvas !== "undefined" && canvas instanceof OffscreenCanvas
      ? canvas.getContext("2d")
      : (canvas as HTMLCanvasElement).getContext("2d");
  if (!ctx) throw new CompressError("out-of-memory", "Canvas tidak bisa dibuat (memori tidak cukup).");
  return ctx;
}

/** Inflate + buang predictor. Hasil: width*height*components byte, atau null bila datanya kurang. */
export async function decodeFlateRaster(stream: PDFRawStream, info: ImageInfo): Promise<Uint8Array | null> {
  let raw: Uint8Array;
  try {
    raw = await inflateBytes(stream.contents);
  } catch (err) {
    if (err instanceof RangeError) throw err;
    // Inflate bawaan browser ketat (sampah di ekor, checksum hilang). Dekoder
    // JS milik pdf-lib (port pdf.js) lebih toleran, walau lebih lambat.
    raw = decodePDFRawStream(stream).decode();
  }
  if (info.predictor > 1) {
    raw = undoPredictor(raw, {
      predictor: info.predictor,
      colors: info.components,
      bitsPerComponent: 8,
      columns: info.width,
    });
  }
  const need = rowBytes({ colors: info.components, bitsPerComponent: 8, columns: info.width }) * info.height;
  return raw.length >= need ? raw : null;
}

/** Faktor bulat terbesar k sehingga gambar/k masih >= ukuran target. */
export function boxFactor(width: number, height: number, targetW: number, targetH: number): number {
  return Math.max(1, Math.floor(Math.min(width / targetW, height / targetH)));
}

/**
 * Ubah raster 8-bit (1 atau 3 komponen) jadi RGBA opak, sekaligus mengecilkan
 * dengan rata-rata blok k x k. `out` panjangnya ceil(w/k)*ceil(h/k)*4.
 */
export function rasterToRgba(
  raw: Uint8Array,
  width: number,
  height: number,
  components: 1 | 3,
  k: number,
  out: Uint8ClampedArray,
): void {
  const ow = Math.ceil(width / k);
  const oh = Math.ceil(height / k);

  if (k === 1) {
    for (let p = 0, s = 0, d = 0; p < width * height; p++, d += 4) {
      if (components === 3) {
        out[d] = raw[s++];
        out[d + 1] = raw[s++];
        out[d + 2] = raw[s++];
      } else {
        const v = raw[s++];
        out[d] = v;
        out[d + 1] = v;
        out[d + 2] = v;
      }
      out[d + 3] = 255;
    }
    return;
  }

  const acc = new Uint32Array(ow * components);
  for (let oy = 0; oy < oh; oy++) {
    acc.fill(0);
    const y0 = oy * k;
    const y1 = Math.min(height, y0 + k);
    for (let y = y0; y < y1; y++) {
      let s = y * width * components;
      for (let x = 0; x < width; x++) {
        const a = ((x / k) | 0) * components;
        for (let c = 0; c < components; c++) acc[a + c] += raw[s++];
      }
    }
    const rows = y1 - y0;
    for (let ox = 0; ox < ow; ox++) {
      const cols = Math.min(width, (ox + 1) * k) - ox * k;
      const n = rows * cols;
      const d = (oy * ow + ox) * 4;
      const a = ox * components;
      if (components === 3) {
        out[d] = Math.round(acc[a] / n);
        out[d + 1] = Math.round(acc[a + 1] / n);
        out[d + 2] = Math.round(acc[a + 2] / n);
      } else {
        const v = Math.round(acc[a] / n);
        out[d] = v;
        out[d + 1] = v;
        out[d + 2] = v;
      }
      out[d + 3] = 255;
    }
  }
}

// ---------------------------------------------------------------------------
// Header JPEG

interface JpegScan {
  sof: { precision: number; width: number; height: number; components: number };
  /** Rentang [start, end) segmen APP1 Exif. */
  exifRanges: Array<[number, number]>;
}

/** Baca marker sampai SOF. Hanya SOF0/1/2 (Huffman baseline/extended/progressive). */
export function scanJpeg(b: Uint8Array): JpegScan | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  const exifRanges: Array<[number, number]> = [];
  let pos = 2;
  while (pos + 4 <= b.length) {
    if (b[pos] !== 0xff) return null;
    const marker = b[pos + 1];
    if (marker === 0xff) {
      pos++; // byte pengisi
      continue;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      pos += 2;
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) return null; // EOI/SOS sebelum SOF
    const len = (b[pos + 2] << 8) | b[pos + 3];
    if (len < 2 || pos + 2 + len > b.length) return null;

    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      if (len < 8) return null;
      return {
        sof: {
          precision: b[pos + 4],
          height: (b[pos + 5] << 8) | b[pos + 6],
          width: (b[pos + 7] << 8) | b[pos + 8],
          components: b[pos + 9],
        },
        exifRanges,
      };
    }
    if (marker >= 0xc3 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return null; // lossless / aritmetik: browser umumnya tidak bisa
    }
    if (marker === 0xe1 && isExifHeader(b, pos + 4)) exifRanges.push([pos, pos + 2 + len]);
    pos += 2 + len;
  }
  return null;
}

function isExifHeader(b: Uint8Array, p: number): boolean {
  // "Exif\0\0"
  return (
    p + 6 <= b.length &&
    b[p] === 0x45 &&
    b[p + 1] === 0x78 &&
    b[p + 2] === 0x69 &&
    b[p + 3] === 0x66 &&
    b[p + 4] === 0 &&
    b[p + 5] === 0
  );
}

function removeRanges(b: Uint8Array, ranges: Array<[number, number]>): Uint8Array {
  if (ranges.length === 0) return b;
  const removed = ranges.reduce((s, [a, z]) => s + (z - a), 0);
  const out = new Uint8Array(b.length - removed);
  let src = 0;
  let dst = 0;
  for (const [a, z] of ranges) {
    out.set(b.subarray(src, a), dst);
    dst += a - src;
    src = z;
  }
  out.set(b.subarray(src), dst);
  return out;
}

// ---------------------------------------------------------------------------
// Apply (mengubah dokumen)

function refFromTag(tag: string): PDFRef | null {
  const m = /^(\d+) (\d+) R$/.exec(tag);
  return m ? PDFRef.of(Number(m[1]), Number(m[2])) : null;
}

/**
 * Tulis JPEG baru ke dokumen. Mengembalikan fungsi `undo` yang memulihkan
 * stream lama (berguna bila ukuran nyata ternyata belum memenuhi target dan
 * orkestrator ingin mencoba anak tangga berikutnya dari gambar asli).
 */
export function applyEncodedImages(doc: PDFDocument, encoded: EncodedImage[]): () => void {
  const { context } = doc;
  const replaced: Array<[PDFRef, PDFObject]> = [];
  for (const e of encoded) {
    const ref = refFromTag(e.refTag);
    if (!ref) continue;
    const old = context.lookup(ref);
    if (!(old instanceof PDFStream)) continue;

    const dict = context.obj({
      Type: "XObject",
      Subtype: "Image",
      Width: e.width,
      Height: e.height,
      // JPEG dari canvas selalu 3 komponen, juga untuk mode hitam-putih.
      ColorSpace: "DeviceRGB",
      BitsPerComponent: 8,
      Filter: "DCTDecode",
    });
    for (const key of KEEP_KEYS) {
      const v = old.dict.get(key);
      if (v !== undefined) dict.set(key, v);
    }
    context.assign(ref, PDFRawStream.of(dict, e.bytes));
    replaced.push([ref, old]);
  }
  // Profil ICC / metadata lama yang kini yatim ikut dibuang.
  const collected = replaced.length > 0 ? removeUnreachable(doc) : [];

  return () => {
    for (const [ref, obj] of collected) context.assign(ref, obj);
    for (const [ref, obj] of replaced) context.assign(ref, obj);
  };
}

export function estimateWithImages(baseBytes: number, candidates: ImageCandidate[], encoded: EncodedImage[]): number {
  const byTag = new Map(candidates.map((c) => [c.refTag, c]));
  let size = baseBytes;
  for (const e of encoded) {
    const c = byTag.get(e.refTag);
    if (!c) continue;
    size += e.bytes.length - c.streamBytes + PER_IMAGE_OVERHEAD;
  }
  return size;
}
