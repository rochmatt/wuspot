// Strategi "rasterize": setiap halaman digambar ulang jadi satu JPEG.
//
// Supaya percobaan di tangga kualitas murah, tiap halaman dirender oleh
// pdf.js SEKALI saja ke "master" JPEG (q 0.92) pada dpi tertinggi yang
// dibutuhkan. Setiap percobaan cukup mengecilkan master lalu meng-encode
// ulang. Yang disimpan di memori hanya Blob, bukan bitmap.

import { PDFDocument } from "pdf-lib";
import type { PageViewport, PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist/legacy/build/pdf.mjs";
import {
  bitmapToJpeg,
  canvasToJpegBlob,
  createCanvas,
  get2d,
  outOfMemory,
  paintWhite,
  releaseCanvas,
  type AnyCanvas,
  type DrawableSource,
} from "./canvas";
import { CompressError } from "./types";

export interface RasterPageMaster {
  blob: Blob;
  pxWidth: number;
  pxHeight: number;
  /** Ukuran halaman (sudah termasuk /Rotate dan UserUnit) dalam point. */
  widthPt: number;
  heightPt: number;
}

export interface RasterMaster {
  /** Dpi yang diminta. Halaman sangat besar bisa dirender lebih rendah. */
  dpi: number;
  pages: RasterPageMaster[];
}

/** Batas aman canvas di iOS Safari. */
export const MAX_CANVAS_SIDE = 4096;
export const MAX_CANVAS_AREA = 16_000_000;
export const MASTER_JPEG_QUALITY = 0.92;
/** Batas ukuran halaman PDF yang diterima Acrobat (200 inci). */
const MAX_PDF_PAGE_SIDE = 14_400;

// Overhead pdf-lib terukur: ~700 B per dokumen + ~340 B per halaman
// (objek halaman, content stream, dict gambar, xref). Judul panjang bisa
// menambah ~1,2 KB. Angka di bawah sengaja sedikit di atasnya.
const RASTER_BASE_OVERHEAD = 2048;
const RASTER_PAGE_OVERHEAD = 512;

// ---------------------------------------------------------------------------
// Hitungan murni (diuji di __tests__)

/** Skala render (piksel per point) untuk dpi tertentu, dibatasi batas canvas. */
export function renderScale(widthPt: number, heightPt: number, dpi: number): number {
  const w = Math.max(widthPt, 1);
  const h = Math.max(heightPt, 1);
  let scale = Math.max(dpi, 1) / 72;
  const longSide = Math.max(w, h) * scale;
  if (longSide > MAX_CANVAS_SIDE) scale *= MAX_CANVAS_SIDE / longSide;
  const area = w * h * scale * scale;
  if (area > MAX_CANVAS_AREA) scale *= Math.sqrt(MAX_CANVAS_AREA / area);
  return scale;
}

/** Ukuran piksel satu halaman untuk percobaan pada `dpi` (tidak pernah melebihi master). */
export function trialSize(
  page: Pick<RasterPageMaster, "pxWidth" | "pxHeight" | "widthPt">,
  dpi: number,
): { width: number; height: number } {
  const wanted = (Math.max(page.widthPt, 1) * dpi) / 72;
  const s = Math.min(1, wanted / Math.max(page.pxWidth, 1));
  return {
    width: Math.max(1, Math.round(page.pxWidth * s)),
    height: Math.max(1, Math.round(page.pxHeight * s)),
  };
}

/** Ukuran halaman keluaran dalam point, dikecilkan proporsional bila melewati batas PDF. */
export function outputPageSize(page: Pick<RasterPageMaster, "widthPt" | "heightPt">): {
  width: number;
  height: number;
} {
  const w = Math.max(page.widthPt, 1);
  const h = Math.max(page.heightPt, 1);
  const s = Math.min(1, MAX_PDF_PAGE_SIDE / Math.max(w, h));
  return { width: w * s, height: h * s };
}

export function estimateRasterPdfBytes(pageJpegs: Uint8Array[]): number {
  let total = RASTER_BASE_OVERHEAD;
  for (const jpg of pageJpegs) total += jpg.length + RASTER_PAGE_OVERHEAD;
  return total;
}

// ---------------------------------------------------------------------------
// Render master (pdf.js)

export async function renderMasters(
  doc: PDFDocumentProxy,
  dpi: number,
  opts: { signal?: AbortSignal; onPage?: (done: number, total: number) => void },
): Promise<RasterMaster> {
  const total = doc.numPages;
  const pages: RasterPageMaster[] = [];
  for (let n = 1; n <= total; n++) {
    throwIfAborted(opts.signal);
    pages.push(await renderPageMaster(doc, n, dpi, opts.signal));
    opts.onPage?.(n, total);
  }
  return { dpi, pages };
}

async function renderPageMaster(
  doc: PDFDocumentProxy,
  pageNumber: number,
  dpi: number,
  signal?: AbortSignal,
): Promise<RasterPageMaster> {
  const page = await doc.getPage(pageNumber);
  let canvas: AnyCanvas | null = null;
  try {
    // Viewport skala 1 = ukuran asli dalam point, rotasi halaman ikut dihitung.
    const base = page.getViewport({ scale: 1 });
    const widthPt = base.width;
    const heightPt = base.height;
    const viewport = page.getViewport({ scale: renderScale(widthPt, heightPt, dpi) });
    const pxWidth = Math.max(1, Math.floor(viewport.width));
    const pxHeight = Math.max(1, Math.floor(viewport.height));

    // pdf.js butuh <canvas> DOM (filter SVG, font) — bukan OffscreenCanvas.
    canvas = createCanvas(pxWidth, pxHeight, "dom");
    if (typeof HTMLCanvasElement === "undefined" || !(canvas instanceof HTMLCanvasElement)) {
      throw new CompressError("unsupported", "Halaman PDF hanya bisa digambar di jendela browser biasa.");
    }
    // Opsi konteks sama dengan yang diminta pdf.js, jadi tidak bentrok.
    paintWhite(get2d(canvas, { alpha: false, willReadFrequently: true }), pxWidth, pxHeight);

    // Regangkan sedikit (<1 px) supaya halaman pas memenuhi canvas yang dibulatkan.
    const fit = [pxWidth / viewport.width, 0, 0, pxHeight / viewport.height, 0, 0];
    await renderPage(page, canvas, viewport, fit, pageNumber, signal);

    const blob = await canvasToJpegBlob(canvas, MASTER_JPEG_QUALITY);
    return { blob, pxWidth, pxHeight, widthPt, heightPt };
  } finally {
    if (canvas) releaseCanvas(canvas);
    page.cleanup();
  }
}

async function renderPage(
  page: PDFPageProxy,
  canvas: HTMLCanvasElement,
  viewport: PageViewport,
  transform: number[],
  pageNumber: number,
  signal?: AbortSignal,
): Promise<void> {
  const task = page.render({ canvas, viewport, transform, background: "#ffffff", intent: "display" });
  const onAbort = () => task.cancel();
  signal?.addEventListener("abort", onAbort, { once: true });
  try {
    await task.promise;
  } catch (err) {
    if (signal?.aborted || errorName(err) === "RenderingCancelledException") throw abortedError();
    if (err instanceof CompressError) throw err;
    if (err instanceof RangeError) throw outOfMemory(err);
    throw new CompressError("corrupt", `Halaman ${pageNumber} tidak bisa digambar. Bagian PDF ini mungkin rusak.`, {
      cause: err,
    });
  } finally {
    signal?.removeEventListener("abort", onAbort);
  }
}

// ---------------------------------------------------------------------------
// Percobaan: kecilkan master + encode ulang

export async function encodeRasterPages(
  master: RasterMaster,
  step: { dpi: number; quality: number },
  grayscale: boolean,
  opts: { signal?: AbortSignal; onPage?: (done: number, total: number) => void },
): Promise<Uint8Array[]> {
  const total = master.pages.length;
  const out: Uint8Array[] = [];
  for (let i = 0; i < total; i++) {
    throwIfAborted(opts.signal);
    const page = master.pages[i];
    const { width, height } = trialSize(page, step.dpi);
    const decoded = await decodeMaster(page, width, height);
    try {
      out.push(await bitmapToJpeg(decoded.image, { width, height, quality: step.quality, grayscale }));
    } finally {
      decoded.release();
    }
    opts.onPage?.(i + 1, total);
  }
  return out;
}

interface Decoded {
  image: DrawableSource;
  release: () => void;
}

/**
 * Decode master JPEG, sebisa mungkin langsung ke ukuran tujuan
 * (createImageBitmap + resize). Kalau opsi resize diabaikan browser,
 * bitmapToJpeg yang mengecilkan.
 */
async function decodeMaster(page: RasterPageMaster, width: number, height: number): Promise<Decoded> {
  const needsResize = width !== page.pxWidth || height !== page.pxHeight;
  if (typeof createImageBitmap === "function") {
    if (needsResize) {
      try {
        const bmp = await createImageBitmap(page.blob, {
          resizeWidth: width,
          resizeHeight: height,
          resizeQuality: "high",
        });
        return { image: bmp, release: () => bmp.close() };
      } catch {
        // Opsi resize tidak didukung: coba tanpa opsi.
      }
    }
    try {
      const bmp = await createImageBitmap(page.blob);
      return { image: bmp, release: () => bmp.close() };
    } catch {
      // Safari lama: pakai <img>.
    }
  }
  return decodeWithImageElement(page.blob);
}

async function decodeWithImageElement(blob: Blob): Promise<Decoded> {
  if (typeof Image === "undefined") {
    throw new CompressError("unsupported", "Browser ini tidak bisa membaca gambar halaman.");
  }
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.src = url;
  try {
    await img.decode();
  } catch (err) {
    URL.revokeObjectURL(url);
    throw outOfMemory(err);
  }
  return {
    image: img,
    release: () => {
      URL.revokeObjectURL(url);
      img.removeAttribute("src");
    },
  };
}

// ---------------------------------------------------------------------------
// Susun PDF baru (pdf-lib)

export async function buildRasterPdf(
  pageJpegs: Uint8Array[],
  master: RasterMaster,
  meta: { title?: string },
): Promise<Uint8Array> {
  if (pageJpegs.length !== master.pages.length) {
    throw new Error(`buildRasterPdf: ${pageJpegs.length} gambar untuk ${master.pages.length} halaman.`);
  }
  const pdf = await PDFDocument.create();
  for (let i = 0; i < pageJpegs.length; i++) {
    const image = await pdf.embedJpg(pageJpegs[i]);
    const { width, height } = outputPageSize(master.pages[i]);
    const page = pdf.addPage([width, height]);
    page.drawImage(image, { x: 0, y: 0, width, height });
  }
  const title = meta.title?.trim().slice(0, 300);
  if (title) pdf.setTitle(title);
  pdf.setProducer("wuspot.com");
  return pdf.save({ useObjectStreams: true, addDefaultPage: false });
}

// ---------------------------------------------------------------------------

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortedError();
}

function abortedError(): CompressError {
  return new CompressError("aborted", "Dibatalkan.");
}

function errorName(err: unknown): string | undefined {
  return typeof err === "object" && err !== null && typeof (err as { name?: unknown }).name === "string"
    ? (err as { name: string }).name
    : undefined;
}
