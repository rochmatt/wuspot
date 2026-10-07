// Uji mesin kompres di Chromium sungguhan lewat halaman /uji-mesin.
// Hasil ditulis ke tests/.output/ lalu diperiksa secara independen dengan
// pdf-lib (Node) dan poppler (pdfinfo, pdftoppm, pdftotext).
//
// Persiapan: `npm run fixtures`. Jalankan: `npm run test:e2e`.

import { execFile } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { test as base, expect, type Page } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import type { HarnessOptions, HarnessResponse } from "../../src/app/uji-mesin/harness";
import type { CompressMode } from "../../src/lib/pdf-compress/types";

const run = promisify(execFile);

const FIXTURE_DIR = resolve(__dirname, "../fixtures/out");
const OUTPUT_DIR = resolve(__dirname, "../.output");
const RENDER_DIR = join(OUTPUT_DIR, "render");
const SUMMARY_JSONL = join(OUTPUT_DIR, "summary.jsonl");
const RUN_ID = process.env.WUSPOT_E2E_RUN ?? "lokal";

const KB = 1024;

interface FixtureInfo {
  pages: number;
  /** Kata yang pasti ada di teks PDF (null = PDF tanpa teks / hasil scan). */
  word: string | null;
  password?: string;
}

const FIXTURES: Record<string, FixtureInfo> = {
  "scan-3p.pdf": { pages: 3, word: null },
  "text-12p.pdf": { pages: 12, word: "Panduan" },
  "mixed.pdf": { pages: 3, word: "Laporan" },
  "png-flate.pdf": { pages: 2, word: "Gambar" },
  "rotated.pdf": { pages: 2, word: "lanskap" },
  "tiny.pdf": { pages: 1, word: "wuspot" },
  "encrypted.pdf": { pages: 3, word: "Laporan", password: "rahasia" },
};

const MODES: CompressMode[] = [
  { kind: "target", targetBytes: 100 * KB },
  { kind: "target", targetBytes: 200 * KB },
  { kind: "target", targetBytes: 500 * KB },
  { kind: "target", targetBytes: 1024 * KB },
  { kind: "level", level: "ringan" },
  { kind: "level", level: "sedang" },
  { kind: "level", level: "kuat" },
];

interface Case {
  fixture: string;
  mode: CompressMode;
  grayscale: boolean;
}

const CASES: Case[] = [
  ...Object.keys(FIXTURES).flatMap((fixture) => MODES.map((mode) => ({ fixture, mode, grayscale: false }))),
  { fixture: "scan-3p.pdf", mode: { kind: "target", targetBytes: 200 * KB }, grayscale: true },
  { fixture: "scan-3p.pdf", mode: { kind: "level", level: "sedang" }, grayscale: true },
  { fixture: "scan-3p.pdf", mode: { kind: "level", level: "kuat" }, grayscale: true },
  { fixture: "mixed.pdf", mode: { kind: "level", level: "kuat" }, grayscale: true },
  { fixture: "png-flate.pdf", mode: { kind: "target", targetBytes: 500 * KB }, grayscale: true },
];

function modeLabel(mode: CompressMode): string {
  if (mode.kind === "level") return mode.level;
  return mode.targetBytes >= 1024 * KB ? `${mode.targetBytes / (1024 * KB)}MB` : `${mode.targetBytes / KB}KB`;
}

function caseLabel(c: Case): string {
  return `${c.fixture} ${modeLabel(c.mode)}${c.grayscale ? " hitam-putih" : ""}`;
}

function outputName(c: Case): string {
  return `${c.fixture.replace(/\.pdf$/, "")}__${modeLabel(c.mode)}${c.grayscale ? "-gray" : ""}.pdf`;
}

function readFixture(name: string): Uint8Array {
  return new Uint8Array(readFileSync(join(FIXTURE_DIR, name)));
}

// ---------------------------------------------------------------------------
// Harness di browser: satu halaman per worker, dibuat ulang bila crash.
// ---------------------------------------------------------------------------

type Compress = (bytes: Uint8Array, options: HarnessOptions) => Promise<HarnessResponse>;

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
const test = base.extend<{}, { compress: Compress }>({
  compress: [
    async ({ browser }, use, workerInfo) => {
      const baseURL = workerInfo.project.use.baseURL ?? "http://localhost:3100";
      const state: { page: Page | null } = { page: null };

      const open = async (): Promise<Page> => {
        if (state.page && !state.page.isClosed()) return state.page;
        const context = await browser.newContext({ baseURL });
        const p = await context.newPage();
        p.on("pageerror", (err) => console.log(`[browser] ${err.message}`));
        p.on("console", (msg) => {
          if (msg.type() === "error") console.log(`[browser] ${msg.text()}`);
        });
        const resp = await p.goto("/uji-mesin", { timeout: 5 * 60_000 });
        if (!resp?.ok()) {
          // Biasanya error kompilasi (mis. modul mesin belum ada) — gagal cepat dengan pesannya.
          const body = await p
            .locator("body")
            .innerText()
            .catch(() => "");
          throw new Error(`/uji-mesin gagal dimuat (HTTP ${resp?.status()}): ${body.slice(0, 800)}`);
        }
        await p.waitForFunction(() => window.__wuspotReady === true || !!window.__wuspotLoadError, null, {
          timeout: 5 * 60_000,
        });
        const loadError = await p.evaluate(() => window.__wuspotLoadError);
        if (loadError) throw new Error(`Mesin gagal dimuat di /uji-mesin: ${loadError}`);
        state.page = p;
        return p;
      };

      await use(async (bytes, options) => {
        const p = await open();
        try {
          return await p.evaluate(({ b64, opts }) => window.__wuspotCompress!(b64, opts), {
            b64: Buffer.from(bytes).toString("base64"),
            opts: options,
          });
        } catch (err) {
          // Tab crash / kehabisan memori: buang halaman supaya tes berikutnya mulai bersih.
          await p
            .context()
            .close()
            .catch(() => {});
          state.page = null;
          throw err;
        }
      });

      await state.page
        ?.context()
        .close()
        .catch(() => {});
    },
    { scope: "worker", timeout: 6 * 60_000 },
  ],
});

// ---------------------------------------------------------------------------
// Validator independen (poppler + pdf-lib)
// ---------------------------------------------------------------------------

function pwArgs(password?: string): string[] {
  return password ? ["-upw", password] : [];
}

interface PageGeom {
  /** Ukuran yang tampil di penampil (sudah memperhitungkan /Rotate). */
  w: number;
  h: number;
}

async function pdfinfo(file: string, password?: string): Promise<{ pages: number; geom: PageGeom[] }> {
  const { stdout } = await run("pdfinfo", [...pwArgs(password), "-f", "1", "-l", "9999", file]);
  const pages = Number(/^Pages:\s+(\d+)/m.exec(stdout)?.[1]);
  const sizes = new Map<number, { w: number; h: number }>();
  const rots = new Map<number, number>();
  for (const m of stdout.matchAll(/^Page\s+(\d+) size:\s+([\d.]+) x ([\d.]+) pts/gm)) {
    sizes.set(Number(m[1]), { w: Number(m[2]), h: Number(m[3]) });
  }
  for (const m of stdout.matchAll(/^Page\s+(\d+) rot:\s+(\d+)/gm)) rots.set(Number(m[1]), Number(m[2]));
  const geom: PageGeom[] = [];
  for (let i = 1; i <= pages; i++) {
    const s = sizes.get(i) ?? { w: NaN, h: NaN };
    const turned = (rots.get(i) ?? 0) % 180 === 90;
    geom.push(turned ? { w: s.h, h: s.w } : s);
  }
  return { pages, geom };
}

async function pdftotext(file: string, password?: string): Promise<string> {
  const { stdout } = await run("pdftotext", [...pwArgs(password), file, "-"], { maxBuffer: 64 * 1024 * 1024 });
  return stdout;
}

interface Ppm {
  width: number;
  height: number;
  rgb: Uint8Array;
}

function parsePpm(buf: Buffer): Ppm {
  // P6 <w> <h> <max> lalu data biner (komentar tidak dipakai pdftoppm).
  const header = /^P6\s+(\d+)\s+(\d+)\s+(\d+)\s/.exec(buf.subarray(0, 64).toString("latin1"));
  if (!header) throw new Error("bukan PPM P6");
  const width = Number(header[1]);
  const height = Number(header[2]);
  const rgb = new Uint8Array(buf.subarray(header[0].length, header[0].length + width * height * 3));
  return { width, height, rgb };
}

async function renderFirstPage(file: string, name: string, password?: string): Promise<Ppm> {
  const prefix = join(RENDER_DIR, name.replace(/\.pdf$/, ""));
  await run("pdftoppm", [...pwArgs(password), "-r", "20", "-f", "1", "-l", "1", "-singlefile", file, prefix]);
  return parsePpm(readFileSync(`${prefix}.ppm`));
}

/** Persentase piksel yang jelas berwarna (bukan abu-abu). */
function colorfulShare(img: Ppm): number {
  let colorful = 0;
  const n = img.width * img.height;
  for (let i = 0; i < n; i++) {
    const r = img.rgb[i * 3];
    const g = img.rgb[i * 3 + 1];
    const b = img.rgb[i * 3 + 2];
    if (Math.max(r, g, b) - Math.min(r, g, b) > 16) colorful++;
  }
  return colorful / n;
}

const inputInfoCache = new Map<string, Promise<{ pages: number; geom: PageGeom[] }>>();
function inputInfo(fixture: string) {
  let p = inputInfoCache.get(fixture);
  if (!p) {
    p = pdfinfo(join(FIXTURE_DIR, fixture), FIXTURES[fixture].password);
    inputInfoCache.set(fixture, p);
  }
  return p;
}

// ---------------------------------------------------------------------------
// Ringkasan
// ---------------------------------------------------------------------------

interface Row {
  run: string;
  case: string;
  originalBytes: number;
  outputBytes: number;
  strategy: string;
  targetMet: boolean | null;
  textPreserved: boolean;
  settings: string;
  ms: number;
  notes: string[];
}

function recordRow(row: Row) {
  appendFileSync(SUMMARY_JSONL, `${JSON.stringify(row)}\n`);
}

function readRows(): Row[] {
  if (!existsSync(SUMMARY_JSONL)) return [];
  return readFileSync(SUMMARY_JSONL, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Row)
    .filter((r) => r.run === RUN_ID);
}

function summaryTable(rows: Row[]): string {
  const head = ["kasus", "asli KB", "hasil KB", "hemat", "strategi", "target", "teks", "pengaturan", "ms"];
  const body = rows.map((r) => {
    const failed = r.strategy.startsWith("GAGAL");
    return [
      r.case,
      (r.originalBytes / KB).toFixed(1),
      failed ? "-" : (r.outputBytes / KB).toFixed(1),
      failed ? "-" : `${Math.round((1 - r.outputBytes / r.originalBytes) * 100)}%`,
      r.strategy,
      r.targetMet === null ? "-" : r.targetMet ? "ya" : "TIDAK",
      r.textPreserved ? "ya" : "tidak",
      r.settings,
      String(r.ms),
    ];
  });
  const widths = head.map((h, i) => Math.max(h.length, ...body.map((b) => b[i].length)));
  const line = (cells: string[]) =>
    cells.map((c, i) => (i >= 1 && i <= 3 ? c.padStart(widths[i]) : c.padEnd(widths[i]))).join("  ");
  return [line(head), widths.map((w) => "-".repeat(w)).join("  "), ...body.map(line)].join("\n");
}

// ---------------------------------------------------------------------------
// Tes
// ---------------------------------------------------------------------------

test.beforeAll(() => {
  mkdirSync(RENDER_DIR, { recursive: true });
  // Buang baris dari run sebelumnya.
  if (existsSync(SUMMARY_JSONL)) {
    const keep = readRows();
    writeFileSync(SUMMARY_JSONL, keep.map((r) => `${JSON.stringify(r)}\n`).join(""));
  }
});

test.afterAll(() => {
  const rows = readRows();
  if (rows.length === 0) return;
  const table = summaryTable(rows);
  writeFileSync(join(OUTPUT_DIR, "summary.txt"), `${table}\n`);
  console.log(`\nRingkasan (${rows.length} kasus) — juga di tests/.output/summary.txt\n${table}\n`);
});

test.describe("mesin kompres", () => {
  test.skip(!existsSync(join(FIXTURE_DIR, "scan-3p.pdf")), "Fixture belum ada: jalankan `npm run fixtures`.");

  for (const c of CASES) {
    test(caseLabel(c), async ({ compress }) => {
      const info = FIXTURES[c.fixture];
      const input = readFixture(c.fixture);
      const res = await compress(input, {
        mode: c.mode,
        grayscale: c.grayscale,
        password: info.password,
        fileName: c.fixture,
      });
      if (!res.ok) {
        recordRow({
          run: RUN_ID,
          case: caseLabel(c),
          originalBytes: input.length,
          outputBytes: 0,
          strategy: `GAGAL:${res.code}`,
          targetMet: null,
          textPreserved: false,
          settings: "",
          ms: res.elapsedMs,
          notes: [res.message],
        });
        throw new Error(`Mesin gagal (${res.code}): ${res.message}`);
      }

      const { result } = res;
      const bytes = new Uint8Array(Buffer.from(res.bytesBase64, "base64"));
      const outFile = join(OUTPUT_DIR, outputName(c));
      writeFileSync(outFile, bytes);

      recordRow({
        run: RUN_ID,
        case: caseLabel(c),
        originalBytes: result.originalBytes,
        outputBytes: result.outputBytes,
        strategy: result.strategy,
        targetMet: result.targetMet,
        textPreserved: result.textPreserved,
        settings: Object.entries(result.settings)
          .map(([k, v]) => `${k}=${v}`)
          .join(" "),
        ms: res.elapsedMs,
        notes: result.notes,
      });
      test.info().annotations.push({
        type: "hasil",
        description: `${result.strategy} ${(result.outputBytes / KB).toFixed(1)} KB, ${res.elapsedMs} ms — ${result.notes.join(" | ")}`,
      });

      // --- Kontrak hasil ---
      expect(result.originalBytes).toBe(input.length);
      expect(result.outputBytes).toBe(res.blobSize);
      expect(bytes.length).toBe(result.outputBytes);
      expect(res.blobType).toBe("application/pdf");
      expect(result.pageCount).toBe(info.pages);
      expect(Array.isArray(result.notes)).toBe(true);
      for (const n of result.notes) expect(typeof n).toBe("string");

      if (c.mode.kind === "target") {
        expect(typeof result.targetMet).toBe("boolean");
        if (result.targetMet) expect(result.outputBytes).toBeLessThanOrEqual(c.mode.targetBytes);
        else expect(result.notes.length, "target gagal harus ada catatan").toBeGreaterThan(0);
        if (input.length <= c.mode.targetBytes) {
          expect(result.targetMet).toBe(true);
          expect(result.outputBytes).toBeLessThanOrEqual(input.length);
        }
      } else {
        expect(result.targetMet).toBeNull();
        expect(result.outputBytes, "mode level tidak boleh lebih besar dari asli").toBeLessThanOrEqual(
          result.originalBytes,
        );
        if (result.strategy === "original") expect(result.notes.length).toBeGreaterThan(0);
      }

      // Progres: 0..1 dan tidak pernah mundur.
      expect(res.progress.length).toBeGreaterThan(0);
      let prev = 0;
      for (const p of res.progress) {
        expect(p.ratio).toBeGreaterThanOrEqual(0);
        expect(p.ratio).toBeLessThanOrEqual(1);
        expect(p.ratio, `progres mundur di "${p.stage} ${p.detail ?? ""}"`).toBeGreaterThanOrEqual(prev);
        prev = p.ratio;
      }

      // --- Strategi vs teks ---
      if (result.strategy === "original") {
        expect(Buffer.compare(Buffer.from(bytes), Buffer.from(input)), "strategi original = byte asli").toBe(0);
      }
      if (result.strategy === "rasterize") {
        expect(result.textPreserved).toBe(false);
        if (info.word)
          expect(result.notes.length, "rasterize pada PDF berteks harus memberi catatan").toBeGreaterThan(0);
      } else if (info.word) {
        expect(result.textPreserved).toBe(true);
      }

      // --- Validasi independen ---
      // Hasil 'original' dari PDF terkunci tetap terkunci; selain itu password harus sudah hilang.
      const outPassword = result.strategy === "original" ? info.password : undefined;
      if (info.password && result.strategy !== "original") {
        expect(result.notes.length, "PDF terkunci: beri tahu bahwa password dihapus").toBeGreaterThan(0);
      }

      const doc = await PDFDocument.load(bytes, { ignoreEncryption: !!outPassword, updateMetadata: false });
      expect(doc.getPageCount()).toBe(info.pages);

      const outInfo = await pdfinfo(outFile, outPassword);
      expect(outInfo.pages).toBe(info.pages);
      const inInfo = await inputInfo(c.fixture);
      for (let i = 0; i < info.pages; i++) {
        expect(Math.abs(outInfo.geom[i].w - inInfo.geom[i].w), `lebar halaman ${i + 1}`).toBeLessThan(1);
        expect(Math.abs(outInfo.geom[i].h - inInfo.geom[i].h), `tinggi halaman ${i + 1}`).toBeLessThan(1);
      }

      const img = await renderFirstPage(outFile, outputName(c), outPassword);
      expect(img.width).toBeGreaterThan(0);
      expect(img.height).toBeGreaterThan(0);

      const text = await pdftotext(outFile, outPassword);
      if (result.textPreserved && info.word) {
        expect(text.toLowerCase()).toContain(info.word.toLowerCase());
      }
      if (result.strategy === "rasterize") {
        expect(text.trim(), "hasil rasterize tidak boleh punya teks").toBe("");
      }

      // Hitam-putih: halaman hasil scan (isinya gambar semua) harus abu-abu.
      if (c.grayscale && !info.word && (result.strategy === "images" || result.strategy === "rasterize")) {
        expect(colorfulShare(img)).toBeLessThan(0.005);
      }
      if (!c.grayscale && !info.word && result.strategy !== "original") {
        // Tanpa hitam-putih warna cap/foto harus tetap ada.
        expect(colorfulShare(img)).toBeGreaterThan(0.005);
      }
    });
  }

  test("PDF terkunci tanpa password -> needs-password", async ({ compress }) => {
    const res = await compress(readFixture("encrypted.pdf"), { mode: { kind: "level", level: "sedang" } });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("needs-password");
  });

  test("PDF terkunci dengan password salah -> wrong-password", async ({ compress }) => {
    const res = await compress(readFixture("encrypted.pdf"), {
      mode: { kind: "level", level: "sedang" },
      password: "salah",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("wrong-password");
  });

  test("PDF terpotong -> corrupt", async ({ compress }) => {
    const res = await compress(readFixture("corrupt.pdf"), { mode: { kind: "target", targetBytes: 200 * KB } });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("corrupt");
  });

  test("bukan PDF -> not-pdf", async ({ compress }) => {
    const res = await compress(readFixture("not-pdf.pdf"), { mode: { kind: "target", targetBytes: 200 * KB } });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("not-pdf");
  });

  test("dibatalkan di tengah jalan -> aborted", async ({ compress }) => {
    const res = await compress(readFixture("scan-3p.pdf"), {
      mode: { kind: "target", targetBytes: 100 * KB },
      abortAfterMs: 300,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("aborted");
    // Halaman masih sehat setelah pembatalan.
    const again = await compress(readFixture("tiny.pdf"), { mode: { kind: "level", level: "ringan" } });
    expect(again.ok).toBe(true);
  });
});
