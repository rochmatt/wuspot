// Mesin kompres PDF, berjalan sepenuhnya di browser (file tidak diunggah).
//
// Alur:
//   1. validasi, buka dengan pdf.js (password, file rusak), periksa teks
//   2. optimize  : rapikan struktur tanpa mengubah isi (pdf-lib, lossless)
//   3. images    : kompres ulang gambar di dalam PDF, teks tetap teks
//   4. rasterize : tiap halaman jadi satu JPG (teks ikut jadi gambar)
// Mode target mencari langkah berkualitas terbaik yang muat; mode level
// memakai satu pengaturan tetap dan tidak pernah membuat file lebih besar.

import type { PDFDocument } from "pdf-lib";
import type { PDFDocumentProxy } from "pdfjs-dist/legacy/build/pdf.mjs";
import { formatBytes } from "./format";
import {
  applyEncodedImages,
  encodeImages,
  estimateWithImages,
  findImageCandidates,
  type EncodedImage,
  type ImageCandidate,
} from "./images";
import { loadDecrypted } from "./decrypt";
import { inspectDocument, type DocInfo } from "./inspect";
import {
  IMAGE_LADDER,
  LEVEL_PRESETS,
  MAX_RASTER_DPI,
  RASTER_LADDER,
  searchLadder,
  type ImageStep,
  type RasterStep,
} from "./ladder";
import { loadEditable, optimizeStructure, savePdf } from "./optimize";
import { closeDocument, openDocument, rewriteDocument } from "./pdfjs";
import {
  buildRasterPdf,
  encodeRasterPages,
  estimateRasterPdfBytes,
  renderMasters,
  type RasterMaster,
} from "./rasterize";
import {
  CompressError,
  MAX_INPUT_BYTES,
  type CompressLevel,
  type CompressMode,
  type CompressOptions,
  type CompressProgress,
  type CompressResult,
  type CompressStage,
  type CompressStrategy,
} from "./types";

export * from "./types";

// ---------------------------------------------------------------------------
// Progres: rasio tidak pernah mundur, walau tahap berganti.

interface Span {
  from: number;
  to: number;
}

const SPAN_INSPECT: Span = { from: 0.03, to: 0.12 };
const SPAN_PREPARE: Span = { from: 0.12, to: 0.15 };
const SPAN_OPTIMIZE: Span = { from: 0.15, to: 0.22 };
const IMAGES_END_WITH_RASTER = 0.55;
const MASTERS_END = 0.75;
const WORK_END = 0.94;

function at(span: Span, frac: number): number {
  const f = Number.isFinite(frac) ? Math.min(1, Math.max(0, frac)) : 0;
  return span.from + (span.to - span.from) * f;
}

/**
 * Bagian rentang untuk percobaan ke-k di tangga. Jumlah percobaan tidak
 * diketahui di awal, jadi tiap percobaan mendapat 40% dari sisa rentang:
 * progres terus maju tapi tidak pernah melewati ujungnya.
 */
function trialSpan(span: Span, k: number): Span {
  const w = span.to - span.from;
  return { from: span.from + w * (1 - 0.6 ** k), to: span.from + w * (1 - 0.6 ** (k + 1)) };
}

class Progress {
  private last = 0;
  constructor(private readonly cb?: (p: CompressProgress) => void) {}

  report(stage: CompressStage, ratio: number, detail?: string): void {
    const r = Math.min(1, Math.max(this.last, Number.isFinite(ratio) ? ratio : this.last));
    this.last = r;
    if (!this.cb) return;
    try {
      this.cb(detail ? { stage, ratio: r, detail } : { stage, ratio: r });
    } catch {
      // Error di callback UI tidak boleh menggagalkan kompresi.
    }
  }

  get ratio(): number {
    return this.last;
  }
}

// ---------------------------------------------------------------------------

/**
 * Dokumen pdf.js yang dibuka seperlunya. Worker pdf.js memegang salinan file
 * sendiri, jadi setelah pemeriksaan awal dokumen ditutup supaya memori HP
 * lega selama tahap pdf-lib, lalu dibuka lagi hanya bila perlu (rasterize).
 */
class PdfjsHandle {
  private doc: PDFDocumentProxy | null = null;

  constructor(
    private readonly bytes: Uint8Array,
    private readonly password?: string,
  ) {}

  async get(): Promise<PDFDocumentProxy> {
    this.doc ??= await openDocument(this.bytes, this.password);
    return this.doc;
  }

  async close(): Promise<void> {
    const doc = this.doc;
    this.doc = null;
    await closeDocument(doc);
  }
}

interface Job {
  input: Uint8Array;
  info: DocInfo;
  pdfjs: PdfjsHandle;
  /** Dokumen pdf-lib yang boleh diubah; null bila hanya rasterize yang mungkin. */
  editable: PDFDocument | null;
  grayscale: boolean;
  /** Password yang diisi pengguna ("" bila tidak ada). */
  password: string;
  /** Pengguna mengisi password (PDF dikunci password pembuka). */
  passwordGiven: boolean;
  signal?: AbortSignal;
  progress: Progress;
  /** Kegagalan tahap yang dilewati (mis. memori habis), untuk catatan. */
  skipped: unknown[];
  /** Jumlah tahap yang berhasil menghasilkan PDF baru. */
  produced: number;
  /** Rasterize sudah dicoba (hasilnya dipakai atau tidak). */
  rasterTried: boolean;
}

interface Outcome {
  bytes: Uint8Array;
  strategy: CompressStrategy;
  settings: CompressResult["settings"];
}

interface Final {
  outcome: Outcome;
  /** Mode target: tercapai atau tidak. Mode level: null. */
  met: boolean | null;
}

/**
 * Kompres PDF sesuai `options.mode`. Melempar CompressError untuk file yang
 * bukan PDF, terkunci, rusak, terlalu besar, dibatalkan, atau memori habis.
 */
export async function compressPdf(
  input: Blob | ArrayBuffer | Uint8Array,
  options: CompressOptions,
): Promise<CompressResult> {
  const { signal } = options;
  const progress = new Progress(options.onProgress);
  let pdfjs: PdfjsHandle | null = null;
  try {
    progress.report("membaca", 0, "Membaca file");
    const bytes = await readInput(input);
    throwIfAborted(signal);
    validateInput(bytes);

    progress.report("menganalisis", SPAN_INSPECT.from, "Membuka PDF");
    pdfjs = new PdfjsHandle(bytes, options.password);
    const pdf = await pdfjs.get();
    throwIfAborted(signal);
    const info = await inspectDocument(pdf, signal, (done, total) =>
      progress.report("menganalisis", at(SPAN_INSPECT, done / total), `Memeriksa halaman ${done} dari ${total}`),
    );
    await pdfjs.close();

    const job: Job = {
      input: bytes,
      info,
      pdfjs,
      editable: null,
      grayscale: options.grayscale === true,
      password: options.password ?? "",
      passwordGiven: Boolean(options.password),
      signal,
      progress,
      skipped: [],
      produced: 0,
      rasterTried: false,
    };

    const final =
      options.mode.kind === "target" ? await runTarget(job, options.mode.targetBytes) : await runLevel(job, options.mode.level);

    progress.report("menyusun", WORK_END, "Menyiapkan file hasil");
    const result = toResult(job, final, options.mode);
    progress.report("selesai", 1);
    return result;
  } catch (err) {
    throw normalizeError(err, signal);
  } finally {
    await pdfjs?.close();
  }
}

// ---------------------------------------------------------------------------
// Validasi

async function readInput(input: Blob | ArrayBuffer | Uint8Array): Promise<Uint8Array> {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (input.size > MAX_INPUT_BYTES) throw tooLarge();
  try {
    return new Uint8Array(await input.arrayBuffer());
  } catch (err) {
    if (isOutOfMemory(err)) throw err;
    // Mis. file dipindah/dihapus setelah dipilih (sering di Android).
    throw new CompressError("corrupt", "File ini tidak bisa dibaca. Coba pilih ulang file-nya.", { cause: err });
  }
}

function tooLarge(): CompressError {
  return new CompressError(
    "too-large",
    `File ini lebih dari ${formatBytes(MAX_INPUT_BYTES)}, terlalu besar untuk diproses di browser.`,
  );
}

function validateInput(bytes: Uint8Array): void {
  if (bytes.length === 0) throw new CompressError("not-pdf", "File-nya kosong.");
  if (bytes.length > MAX_INPUT_BYTES) throw tooLarge();
  if (!hasPdfHeader(bytes)) throw new CompressError("not-pdf", "File ini bukan PDF.");
}

/** `%PDF-` di 1024 byte pertama (sebagian PDF punya sampah di depan header). */
function hasPdfHeader(bytes: Uint8Array): boolean {
  const end = Math.min(bytes.length, 1024) - 5;
  for (let i = 0; i <= end; i++) {
    if (
      bytes[i] === 0x25 && // %
      bytes[i + 1] === 0x50 && // P
      bytes[i + 2] === 0x44 && // D
      bytes[i + 3] === 0x46 && // F
      bytes[i + 4] === 0x2d // -
    ) {
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Persiapan pdf-lib

/**
 * Muat dokumen untuk diedit dengan pdf-lib. PDF terenkripsi didekripsi dulu
 * (decrypt.ts). Bila pdf-lib tetap tidak bisa (struktur rusak, atau jumlah
 * halamannya beda dengan pdf.js), minta pdf.js menulis ulang dokumennya
 * supaya teks tetap bisa dipertahankan. Kalau semua gagal, hanya rasterize.
 */
async function prepareEditable(job: Job): Promise<void> {
  const { progress, info } = job;
  progress.report("menganalisis", SPAN_PREPARE.from, "Menyiapkan dokumen");
  if (info.encrypted) {
    // Hasil tulis ulang pdf.js tetap terenkripsi, jadi tidak ada cadangan di sini.
    const doc = await loadDecrypted(job.input, job.password);
    if (doc && doc.getPageCount() === info.pageCount) job.editable = doc;
    return;
  }
  const direct = await loadEditable(job.input);
  if (direct && direct.getPageCount() === info.pageCount) {
    job.editable = direct;
    return;
  }
  throwIfAborted(job.signal);
  progress.report("menganalisis", at(SPAN_PREPARE, 0.5), "Membaca ulang struktur PDF");
  const rewritten = await rewriteDocument(await job.pdfjs.get());
  throwIfAborted(job.signal);
  if (!rewritten) return;
  const doc = await loadEditable(rewritten);
  if (doc && doc.getPageCount() === info.pageCount) job.editable = doc;
}

// ---------------------------------------------------------------------------
// Mode target

async function runTarget(job: Job, targetBytes: number): Promise<Final> {
  const target = Math.max(1, Math.floor(targetBytes));
  const original: Outcome = { bytes: job.input, strategy: "original", settings: {} };
  // Sudah muat: kembalikan apa adanya (tanda tangan digital & form tetap utuh).
  if (job.input.length <= target) return { outcome: original, met: true };

  const tried: Outcome[] = [original];
  const optimized = await guard(job, () => stageOptimize(job));
  if (optimized) {
    tried.push(optimized);
    if (optimized.bytes.length <= target) return { outcome: optimized, met: true };

    const images = await guard(job, () =>
      stageImagesTarget(job, optimized.bytes.length, target, { from: SPAN_OPTIMIZE.to, to: IMAGES_END_WITH_RASTER }),
    );
    if (images) {
      tried.push(images.outcome);
      if (images.met) return { outcome: images.outcome, met: true };
    }
  }

  const raster = await guard(job, () => stageRasterTarget(job, target));
  if (raster) {
    tried.push(raster.outcome);
    if (raster.met) return { outcome: raster.outcome, met: true };
  }

  return { outcome: smallest(tried), met: false };
}

/** Hasil terkecil; bila seri, yang lebih awal di daftar (lebih menjaga teks) menang. */
function smallest(list: Outcome[]): Outcome {
  return list.reduce((best, o) => (o.bytes.length < best.bytes.length ? o : best));
}

// ---------------------------------------------------------------------------
// Mode level

/**
 * Pada level kuat, halaman berteks hanya diubah jadi gambar bila hasilnya
 * jelas lebih kecil (paling tidak 20%) daripada hasil yang tetap menjaga teks.
 */
const RASTER_MIN_GAIN_WITH_TEXT = 0.8;
/** Perkiraan kasar ukuran minimal satu halaman yang dirasterisasi. */
const RASTER_MIN_PAGE_BYTES = 16 * 1024;

async function runLevel(job: Job, level: CompressLevel): Promise<Final> {
  const preset = LEVEL_PRESETS[level];
  const original: Outcome = { bytes: job.input, strategy: "original", settings: {} };
  const textKeeping: Outcome[] = [];

  const rasterAllowed = preset.raster !== null && (preset.rasterizeWithText || !job.info.hasAnyText);
  const imagesEnd = rasterAllowed ? IMAGES_END_WITH_RASTER : WORK_END;

  const optimized = await guard(job, () => stageOptimize(job));
  if (optimized) {
    textKeeping.push(optimized);
    const images = await guard(job, () =>
      stageImagesSingle(job, optimized.bytes.length, preset.image, { from: SPAN_OPTIMIZE.to, to: imagesEnd }),
    );
    if (images) textKeeping.push(images);
  }

  const bestText = textKeeping.length > 0 ? smallest(textKeeping) : null;
  let best = bestText;

  if (preset.raster && rasterAllowed && !rasterPointless(job, bestText)) {
    const step = preset.raster;
    const raster = await guard(job, () => stageRasterSingle(job, step));
    if (raster) {
      const worthIt =
        !bestText ||
        (job.info.hasAnyText
          ? raster.bytes.length < bestText.bytes.length * RASTER_MIN_GAIN_WITH_TEXT
          : raster.bytes.length < bestText.bytes.length);
      if (worthIt) best = raster;
    }
  }

  if (!best || best.bytes.length >= job.input.length) return { outcome: original, met: null };
  return { outcome: best, met: null };
}

/** Rasterize tidak mungkin menang bila hasil berteks sudah lebih kecil dari halaman-halaman JPG minimal. */
function rasterPointless(job: Job, bestText: Outcome | null): boolean {
  if (!bestText || !job.info.hasAnyText) return false;
  return bestText.bytes.length * RASTER_MIN_GAIN_WITH_TEXT <= job.info.pageCount * RASTER_MIN_PAGE_BYTES;
}

// ---------------------------------------------------------------------------
// Tahap: optimize

async function stageOptimize(job: Job): Promise<Outcome | null> {
  await prepareEditable(job);
  const doc = job.editable;
  if (!doc) return null;
  throwIfAborted(job.signal);
  job.progress.report("mengompres", SPAN_OPTIMIZE.from, "Merapikan struktur PDF");
  try {
    await optimizeStructure(doc);
    throwIfAborted(job.signal);
    const bytes = await savePdf(doc, { title: job.info.title });
    job.progress.report("mengompres", SPAN_OPTIMIZE.to, "Merapikan struktur PDF");
    return { bytes, strategy: "optimize", settings: {} };
  } catch (err) {
    // Dokumen bisa setengah berubah: jangan dipakai lagi untuk tahap gambar.
    job.editable = null;
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Tahap: images

/**
 * Percobaan kompres gambar pada beberapa langkah. Byte hasil encode disimpan
 * seperlunya saja (langkah terbaik yang muat dan langkah terkecil), supaya
 * memori HP tidak penuh oleh percobaan yang tidak akan dipakai.
 */
class ImageTrials {
  private readonly estimates = new Map<number, number>();
  private readonly encoded = new Map<number, EncodedImage[]>();
  private trials = 0;

  constructor(
    private readonly job: Job,
    private readonly doc: PDFDocument,
    private readonly candidates: ImageCandidate[],
    private readonly steps: ImageStep[],
    private readonly baseBytes: number,
    private readonly span: Span,
    private readonly target: number | null,
  ) {}

  async estimate(index: number): Promise<number> {
    const hit = this.estimates.get(index);
    if (hit !== undefined) return hit;
    await this.encode(index);
    return this.estimates.get(index)!;
  }

  private async encode(index: number): Promise<EncodedImage[]> {
    const hit = this.encoded.get(index);
    if (hit) return hit;
    const { job } = this;
    const span = this.target === null ? this.span : trialSpan(this.span, this.trials++);
    const total = this.candidates.length;
    job.progress.report("mengompres", span.from, `Gambar 1 dari ${total}`);
    const result = await encodeImages(this.doc, this.candidates, this.steps[index], job.grayscale, {
      signal: job.signal,
      onImage: (done, all) =>
        job.progress.report("mengompres", at(span, done / all), `Gambar ${Math.min(done + 1, all)} dari ${all}`),
    });
    this.estimates.set(index, estimateWithImages(this.baseBytes, this.candidates, result));
    this.encoded.set(index, result);
    this.prune(index);
    return result;
  }

  private prune(justEncoded: number): void {
    if (this.target === null) return;
    let firstFit = -1;
    let minIndex = -1;
    for (const [i, v] of this.estimates) {
      if (v <= this.target && (firstFit < 0 || i < firstFit)) firstFit = i;
      if (minIndex < 0 || v < this.estimates.get(minIndex)!) minIndex = i;
    }
    for (const i of [...this.encoded.keys()]) {
      if (i !== firstFit && i !== minIndex && i !== justEncoded) this.encoded.delete(i);
    }
  }

  /** Terapkan langkah `index`, simpan, lalu kembalikan dokumen ke keadaan semula. */
  async build(index: number): Promise<Outcome | null> {
    const encoded = await this.encode(index);
    if (encoded.length === 0) return null;
    const { job } = this;
    throwIfAborted(job.signal);
    job.progress.report("menyusun", job.progress.ratio, "Menyusun PDF");
    const undo = applyEncodedImages(this.doc, encoded);
    try {
      const bytes = await savePdf(this.doc, { title: job.info.title });
      const step = this.steps[index];
      return { bytes, strategy: "images", settings: { maxImageSide: step.maxSide, quality: step.quality } };
    } finally {
      undo();
    }
  }
}

async function stageImagesTarget(
  job: Job,
  baseBytes: number,
  target: number,
  span: Span,
): Promise<{ outcome: Outcome; met: boolean } | null> {
  const doc = job.editable;
  if (!doc) return null;
  const candidates = findImageCandidates(doc);
  if (candidates.length === 0) return null;

  const trials = new ImageTrials(job, doc, candidates, IMAGE_LADDER, baseBytes, span, target);
  const found = await searchLadder(IMAGE_LADDER, (_step, i) => trials.estimate(i), target);

  if (!found.met) {
    const outcome = await trials.build(found.index);
    return outcome ? { outcome, met: false } : null;
  }
  // Perkiraan biasanya sedikit di atas ukuran nyata, tapi tetap diperiksa:
  // bila ternyata belum muat, turun satu langkah.
  let best: Outcome | null = null;
  for (let i = found.index; i < IMAGE_LADDER.length; i++) {
    const outcome = await trials.build(i);
    if (!outcome) continue;
    if (outcome.bytes.length <= target) return { outcome, met: true };
    if (!best || outcome.bytes.length < best.bytes.length) best = outcome;
  }
  return best ? { outcome: best, met: false } : null;
}

async function stageImagesSingle(job: Job, baseBytes: number, step: ImageStep, span: Span): Promise<Outcome | null> {
  const doc = job.editable;
  if (!doc) return null;
  const candidates = findImageCandidates(doc);
  if (candidates.length === 0) return null;
  const trials = new ImageTrials(job, doc, candidates, [step], baseBytes, span, null);
  return trials.build(0);
}

// ---------------------------------------------------------------------------
// Tahap: rasterize

class RasterTrials {
  private readonly estimates = new Map<number, number>();
  private readonly encoded = new Map<number, Uint8Array[]>();
  private trials = 0;

  constructor(
    private readonly job: Job,
    private readonly master: RasterMaster,
    private readonly steps: RasterStep[],
    private readonly span: Span,
    private readonly target: number | null,
  ) {}

  async estimate(index: number): Promise<number> {
    const hit = this.estimates.get(index);
    if (hit !== undefined) return hit;
    await this.encode(index);
    return this.estimates.get(index)!;
  }

  private async encode(index: number): Promise<Uint8Array[]> {
    const hit = this.encoded.get(index);
    if (hit) return hit;
    const { job } = this;
    const span = this.target === null ? this.span : trialSpan(this.span, this.trials++);
    const total = this.master.pages.length;
    job.progress.report("mengompres", span.from, `Halaman 1 dari ${total}`);
    const pages = await encodeRasterPages(this.master, this.steps[index], job.grayscale, {
      signal: job.signal,
      onPage: (done, all) =>
        job.progress.report("mengompres", at(span, done / all), `Halaman ${Math.min(done + 1, all)} dari ${all}`),
    });
    this.estimates.set(index, estimateRasterPdfBytes(pages));
    this.encoded.set(index, pages);
    this.prune(index);
    return pages;
  }

  private prune(justEncoded: number): void {
    if (this.target === null) return;
    let firstFit = -1;
    let minIndex = -1;
    for (const [i, v] of this.estimates) {
      if (v <= this.target && (firstFit < 0 || i < firstFit)) firstFit = i;
      if (minIndex < 0 || v < this.estimates.get(minIndex)!) minIndex = i;
    }
    for (const i of [...this.encoded.keys()]) {
      if (i !== firstFit && i !== minIndex && i !== justEncoded) this.encoded.delete(i);
    }
  }

  async build(index: number): Promise<Outcome> {
    const pages = await this.encode(index);
    const { job } = this;
    throwIfAborted(job.signal);
    job.progress.report("menyusun", job.progress.ratio, "Menyusun PDF");
    const bytes = await buildRasterPdf(pages, this.master, { title: job.info.title });
    const step = this.steps[index];
    return { bytes, strategy: "rasterize", settings: { dpi: step.dpi, quality: step.quality } };
  }
}

async function renderAllMasters(job: Job, dpi: number, span: Span): Promise<RasterMaster> {
  job.rasterTried = true;
  const total = job.info.pageCount;
  job.progress.report("mengompres", span.from, `Menggambar halaman 1 dari ${total}`);
  return renderMasters(await job.pdfjs.get(), dpi, {
    signal: job.signal,
    onPage: (done, all) =>
      job.progress.report("mengompres", at(span, done / all), `Menggambar halaman ${Math.min(done + 1, all)} dari ${all}`),
  });
}

function rasterSpans(job: Job): { masters: Span; trials: Span } {
  const start = Math.max(job.progress.ratio, SPAN_OPTIMIZE.to);
  const mastersEnd = Math.max(start, MASTERS_END);
  return { masters: { from: start, to: mastersEnd }, trials: { from: mastersEnd, to: WORK_END } };
}

async function stageRasterTarget(job: Job, target: number): Promise<{ outcome: Outcome; met: boolean }> {
  const spans = rasterSpans(job);
  const master = await renderAllMasters(job, MAX_RASTER_DPI, spans.masters);
  const trials = new RasterTrials(job, master, RASTER_LADDER, spans.trials, target);
  const found = await searchLadder(RASTER_LADDER, (_step, i) => trials.estimate(i), target);
  if (!found.met) return { outcome: await trials.build(found.index), met: false };

  let best: Outcome | null = null;
  for (let i = found.index; i < RASTER_LADDER.length; i++) {
    const outcome = await trials.build(i);
    if (outcome.bytes.length <= target) return { outcome, met: true };
    if (!best || outcome.bytes.length < best.bytes.length) best = outcome;
  }
  return { outcome: best!, met: false };
}

async function stageRasterSingle(job: Job, step: RasterStep): Promise<Outcome> {
  const spans = rasterSpans(job);
  const master = await renderAllMasters(job, step.dpi, spans.masters);
  const trials = new RasterTrials(job, master, [step], spans.trials, null);
  return trials.build(0);
}

// ---------------------------------------------------------------------------
// Penanganan error per tahap

/**
 * Jalankan satu tahap. Bila gagal karena hal selain pembatalan (gambar
 * aneh, memori habis, halaman rusak), tahap itu dilewati dan strategi lain
 * tetap dicoba. Kegagalannya dicatat untuk catatan & keputusan akhir.
 */
async function guard<T>(job: Job, fn: () => Promise<T | null>): Promise<T | null> {
  try {
    const out = await fn();
    if (out !== null) job.produced++;
    return out;
  } catch (err) {
    if (job.signal?.aborted || (err instanceof CompressError && err.code === "aborted")) throw err;
    if (process.env.NODE_ENV !== "production") console.warn("[wuspot] tahap dilewati:", err);
    job.skipped.push(err);
    return null;
  }
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new CompressError("aborted", "Dibatalkan.");
}

function isOutOfMemory(err: unknown): boolean {
  if (err instanceof CompressError) return err.code === "out-of-memory";
  if (err instanceof RangeError) return true;
  const message = typeof (err as { message?: unknown })?.message === "string" ? (err as Error).message : "";
  return /out of memory|allocation failed|array buffer allocation/i.test(message);
}

function normalizeError(err: unknown, signal?: AbortSignal): unknown {
  if (err instanceof CompressError && err.code === "aborted") return err;
  if (signal?.aborted) return new CompressError("aborted", "Dibatalkan.", { cause: err });
  if (err instanceof CompressError) return err;
  if (isOutOfMemory(err)) {
    return new CompressError(
      "out-of-memory",
      "Memori browser tidak cukup untuk file ini. Tutup tab lain lalu coba lagi, atau pisahkan PDF jadi beberapa bagian.",
      { cause: err },
    );
  }
  return err;
}

// ---------------------------------------------------------------------------
// Hasil & catatan

function toResult(job: Job, final: Final, mode: CompressMode): CompressResult {
  const { outcome } = final;
  // Tidak ada satu tahap pun yang berhasil, dan penyebabnya jelas (memori habis,
  // halaman rusak): lebih jujur memberi tahu itu daripada mengembalikan file
  // asli seolah "sudah ringkas".
  if (outcome.strategy === "original" && final.met !== true && job.produced === 0) {
    const cause = job.skipped.find(isOutOfMemory) ?? job.skipped.find((e) => e instanceof CompressError);
    if (cause) throw normalizeError(cause);
  }
  const blob = new Blob([outcome.bytes as Uint8Array<ArrayBuffer>], { type: "application/pdf" });
  return {
    blob,
    originalBytes: job.input.length,
    outputBytes: blob.size,
    pageCount: job.info.pageCount,
    strategy: outcome.strategy,
    textPreserved: job.info.hasAnyText && outcome.strategy !== "rasterize",
    targetMet: final.met,
    settings: outcome.settings,
    notes: buildNotes(job, final, mode),
  };
}

/** Hasil terkecil paling banyak segini kali target: Hitam-putih mungkin cukup. */
const NEAR_MISS_FOR_GRAY_TIP = 1.08;
/** Langkah gambar sekecil ini mulai terlihat kasar. */
const SMALL_IMAGE_SIDE = 1000;
/** Dpi serendah ini membuat tulisan kecil sulit terbaca. */
const LOW_DPI = 72;

function buildNotes(job: Job, final: Final, mode: CompressMode): string[] {
  const notes: string[] = [];
  const { strategy, settings, bytes } = final.outcome;
  const { info } = job;
  const changed = strategy !== "original";

  if (mode.kind === "target") {
    if (final.met && !changed) notes.push("Ukurannya sudah di bawah target, jadi file tidak diubah.");
    if (!final.met) {
      notes.push(`Target ${formatBytes(mode.targetBytes)} belum tercapai. Hasil terkecil ${formatBytes(bytes.length)}.`);
      const tips: string[] = [];
      // Hitam-putih hanya menghemat sedikit di kualitas serendah ini; sarankan
      // hanya bila memang tinggal sedikit lagi.
      if (!job.grayscale && bytes.length <= mode.targetBytes * NEAR_MISS_FOR_GRAY_TIP) tips.push("nyalakan Hitam-putih");
      if (info.pageCount > 1) tips.push("kirim halaman yang diminta saja atau pisahkan jadi beberapa file");
      if (tips.length > 0) notes.push(`Coba ${tips.join(", atau ")}.`);
    }
  } else if (!changed) {
    // Tanpa pdf-lib (struktur yang tidak bisa diolah) hanya rasterize yang tersisa.
    notes.push(
      job.editable === null && !job.rasterTried
        ? "PDF ini hanya bisa dikecilkan dengan mengubah halamannya jadi gambar. Coba level Kuat atau pilih target ukuran."
        : "File ini sudah cukup ringkas, jadi tidak diubah.",
    );
  }

  const lowRaster = strategy === "rasterize" && settings.dpi !== undefined && settings.dpi <= LOW_DPI;
  const lowImages =
    strategy === "images" && settings.maxImageSide !== undefined && settings.maxImageSide < SMALL_IMAGE_SIDE;
  if (strategy === "rasterize" && info.hasAnyText) {
    notes.push("Teks di PDF ini sekarang berupa gambar, jadi tidak bisa disalin atau dicari.");
  }
  if (lowRaster || (lowImages && !info.hasAnyText)) {
    notes.push("Resolusinya diturunkan cukup banyak supaya muat. Periksa dulu apakah tulisannya masih terbaca.");
  } else if (lowImages) {
    notes.push("Gambar di dalamnya diperkecil cukup banyak. Periksa dulu apakah masih jelas.");
  }

  if (job.grayscale && changed) {
    if (strategy === "optimize") notes.push("Tidak ada gambar yang bisa diubah jadi hitam-putih di PDF ini.");
    else if (strategy === "images" && info.hasAnyText) {
      notes.push("Hitam-putih hanya diterapkan pada gambar; teks dan garis tetap seperti aslinya.");
    }
  }

  if (changed && info.encrypted) {
    notes.push(
      job.passwordGiven
        ? "File hasil tidak lagi dikunci password, jadi simpan baik-baik."
        : "Proteksi (pembatasan salin/edit) di PDF asli tidak ikut ke file hasil.",
    );
  }
  if (changed && info.hasSignatures) {
    notes.push(
      "Tanda tangan digital (mis. e-meterai) di PDF ini tidak berlaku lagi di file hasil. Kalau harus sah, unggah file aslinya.",
    );
  }
  if (changed && job.skipped.some(isOutOfMemory)) {
    notes.push("Memori perangkat tidak cukup untuk mencoba semua cara, jadi hasilnya mungkin belum yang terkecil.");
  }
  return notes;
}
