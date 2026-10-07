// Utilitas canvas: membuat canvas, menggambar dengan latar putih,
// mengecilkan gambar dengan rapi, dan menyimpan sebagai JPEG.
// Semua canvas sementara dinolkan setelah dipakai karena Safari/iOS
// baru melepas memori canvas kalau ukurannya diset 0.

import { CompressError } from "./types";

export type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;
export type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
/** Apa saja yang bisa digambar ke canvas dan punya ukuran piksel. */
export type DrawableSource = ImageBitmap | AnyCanvas | HTMLImageElement;

let offscreenSupport: boolean | null = null;

/** OffscreenCanvas dianggap layak hanya jika 2D dan convertToBlob tersedia. */
function canUseOffscreen(): boolean {
  if (offscreenSupport === null) {
    offscreenSupport = false;
    if (typeof OffscreenCanvas !== "undefined") {
      try {
        const probe = new OffscreenCanvas(1, 1);
        offscreenSupport = probe.getContext("2d") !== null && typeof probe.convertToBlob === "function";
        probe.width = 0;
        probe.height = 0;
      } catch {
        offscreenSupport = false;
      }
    }
  }
  return offscreenSupport;
}

function isOffscreen(c: AnyCanvas): c is OffscreenCanvas {
  return typeof OffscreenCanvas !== "undefined" && c instanceof OffscreenCanvas;
}

function toPx(n: number): number {
  return Number.isFinite(n) ? Math.max(1, Math.round(n)) : 1;
}

/**
 * Buat canvas. Default memilih OffscreenCanvas (tidak menyentuh DOM),
 * `prefer: "dom"` memaksa <canvas> biasa, misalnya untuk pdf.js.
 */
export function createCanvas(width: number, height: number, prefer: "auto" | "dom" = "auto"): AnyCanvas {
  const w = toPx(width);
  const h = toPx(height);
  if (prefer === "auto" && canUseOffscreen()) return new OffscreenCanvas(w, h);
  if (typeof document !== "undefined") {
    const el = document.createElement("canvas");
    el.width = w;
    el.height = h;
    return el;
  }
  if (canUseOffscreen()) return new OffscreenCanvas(w, h);
  throw new CompressError("unsupported", "Browser ini tidak mendukung canvas, jadi PDF tidak bisa dikompres di sini.");
}

/**
 * Ambil konteks 2D. Opsinya hanya berlaku pada panggilan pertama untuk
 * canvas tersebut, jadi panggil ini sebelum pihak lain (mis. pdf.js).
 */
export function get2d(
  canvas: AnyCanvas,
  opts: { alpha?: boolean; willReadFrequently?: boolean } = {},
): Ctx2D {
  const settings: CanvasRenderingContext2DSettings = {
    alpha: opts.alpha ?? true,
    willReadFrequently: opts.willReadFrequently ?? false,
  };
  const ctx = isOffscreen(canvas) ? canvas.getContext("2d", settings) : canvas.getContext("2d", settings);
  // Null di sini hampir selalu berarti memori canvas habis (umum di iOS).
  if (!ctx) throw outOfMemory();
  return ctx;
}

export function paintWhite(ctx: Ctx2D, w: number, h: number): void {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

export function releaseCanvas(c: AnyCanvas): void {
  c.width = 0;
  c.height = 0;
}

/** Simpan isi canvas sebagai Blob JPEG. */
export async function canvasToJpegBlob(canvas: AnyCanvas, quality: number): Promise<Blob> {
  const q = Math.min(1, Math.max(0, quality));
  let blob: Blob | null;
  try {
    blob = isOffscreen(canvas)
      ? await canvas.convertToBlob({ type: "image/jpeg", quality: q })
      : await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", q));
  } catch (err) {
    throw outOfMemory(err);
  }
  if (!blob || blob.size === 0) throw outOfMemory();
  // Browser yang tidak bisa JPEG diam-diam mengembalikan PNG; itu tidak
  // boleh masuk ke PDF sebagai DCTDecode.
  if (blob.type !== "image/jpeg") {
    throw new CompressError("unsupported", "Browser ini tidak bisa membuat gambar JPG. Coba pakai Chrome atau Firefox.");
  }
  return blob;
}

export async function encodeJpeg(canvas: AnyCanvas, quality: number): Promise<Uint8Array> {
  const blob = await canvasToJpegBlob(canvas, quality);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    throw new CompressError("unsupported", "Hasil JPG dari browser tidak valid.");
  }
  return bytes;
}

/**
 * Ubah piksel jadi abu-abu (luma BT.601). Diproses per pita baris supaya
 * ImageData yang dipegang sekaligus tetap kecil (~4 MB), penting di HP.
 */
export function grayscaleInPlace(ctx: Ctx2D, w: number, h: number): void {
  const width = Math.floor(w);
  const height = Math.floor(h);
  if (width <= 0 || height <= 0) return;
  const bandRows = Math.max(1, Math.floor((4 * 1024 * 1024) / (width * 4)));
  for (let y = 0; y < height; y += bandRows) {
    const rows = Math.min(bandRows, height - y);
    const img = ctx.getImageData(0, y, width, rows);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      // 77 + 150 + 29 = 256, jadi hasilnya tetap 0..255.
      const v = (d[i] * 77 + d[i + 1] * 150 + d[i + 2] * 29 + 128) >> 8;
      d[i] = v;
      d[i + 1] = v;
      d[i + 2] = v;
    }
    ctx.putImageData(img, 0, y);
  }
}

export function sourceSize(src: DrawableSource): { width: number; height: number } {
  if (typeof HTMLImageElement !== "undefined" && src instanceof HTMLImageElement) {
    return { width: src.naturalWidth, height: src.naturalHeight };
  }
  return { width: src.width, height: src.height };
}

/**
 * Gambar `source` ke JPEG berukuran width x height di atas latar putih.
 * `source` tidak ditutup; pemanggil tetap pemiliknya.
 */
export async function bitmapToJpeg(
  source: DrawableSource,
  opts: { width: number; height: number; quality: number; grayscale: boolean },
): Promise<Uint8Array> {
  const w = toPx(opts.width);
  const h = toPx(opts.height);
  const canvas = createCanvas(w, h);
  try {
    const ctx = get2d(canvas, { alpha: false, willReadFrequently: opts.grayscale });
    paintWhite(ctx, w, h);
    await drawScaled(ctx, source, w, h);
    if (opts.grayscale) grayscaleInPlace(ctx, w, h);
    return await encodeJpeg(canvas, opts.quality);
  } finally {
    releaseCanvas(canvas);
  }
}

/**
 * Gambar source ke (0,0,w,h). Untuk pengecilan, pakai resize bawaan
 * createImageBitmap (kualitas tinggi di Chrome/Firefox). Kalau tidak
 * didukung, kecilkan bertahap setengah-setengah supaya tidak bergerigi.
 */
async function drawScaled(ctx: Ctx2D, source: DrawableSource, w: number, h: number): Promise<void> {
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  const { width: sw, height: sh } = sourceSize(source);
  if (sw === w && sh === h) {
    ctx.drawImage(source, 0, 0);
    return;
  }

  const shrinking = sw > w || sh > h;
  if (shrinking) {
    const resized = await nativeResize(source, w, h);
    if (resized) {
      try {
        ctx.drawImage(resized, 0, 0);
      } finally {
        resized.close();
      }
      return;
    }
  }

  let current: DrawableSource = source;
  let cw = sw;
  let ch = sh;
  let temp: AnyCanvas | null = null;
  try {
    while (cw >= w * 2 && ch >= h * 2) {
      const nw = Math.ceil(cw / 2);
      const nh = Math.ceil(ch / 2);
      const next = createCanvas(nw, nh);
      const nctx = get2d(next);
      nctx.imageSmoothingEnabled = true;
      nctx.imageSmoothingQuality = "high";
      nctx.drawImage(current, 0, 0, nw, nh);
      if (temp) releaseCanvas(temp);
      temp = next;
      current = next;
      cw = nw;
      ch = nh;
    }
    ctx.drawImage(current, 0, 0, w, h);
  } finally {
    if (temp) releaseCanvas(temp);
  }
}

async function nativeResize(source: DrawableSource, w: number, h: number): Promise<ImageBitmap | null> {
  if (typeof createImageBitmap !== "function") return null;
  try {
    const bmp = await createImageBitmap(source, { resizeWidth: w, resizeHeight: h, resizeQuality: "high" });
    // Browser lama bisa mengabaikan opsi resize; cek hasilnya.
    if (bmp.width === w && bmp.height === h) return bmp;
    bmp.close();
  } catch {
    // Jatuh ke cara manual.
  }
  return null;
}

export function outOfMemory(cause?: unknown): CompressError {
  return new CompressError(
    "out-of-memory",
    "Memori browser tidak cukup untuk memproses halaman ini. Tutup tab lain lalu coba lagi, atau pisahkan PDF jadi beberapa bagian.",
    cause === undefined ? undefined : { cause },
  );
}
