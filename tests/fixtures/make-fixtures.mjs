#!/usr/bin/env node
// Membuat PDF contoh untuk menguji mesin kompres. Hasil ke tests/fixtures/out/.
// Deterministik (PRNG ber-seed), jadi ukuran file sama tiap kali dibuat.
//
//   scan-3p.pdf    3 halaman A4, tiap halaman JPEG "hasil scan" 300 dpi (2480x3508), beberapa MB
//   text-12p.pdf   12 halaman teks saja
//   mixed.pdf      teks + JPEG besar + PNG besar dengan alpha (Flate + SMask)
//   png-flate.pdf  PNG besar tanpa alpha (Flate) + gambar Flate ber-predictor PNG (RGB & abu-abu)
//   rotated.pdf    halaman lanskap + halaman dengan /Rotate 90
//   tiny.pdf       satu halaman kecil (sudah ringkas)
//   corrupt.pdf    PDF terpotong
//   not-pdf.pdf    file teks biasa berakhiran .pdf
//
// encrypted.pdf dibuat terpisah oleh make-encrypted.py (pikepdf).

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { crc32, deflateSync } from "node:zlib";
import jpeg from "jpeg-js";
import {
  PDFDocument,
  StandardFonts,
  concatTransformationMatrix,
  degrees,
  drawObject,
  popGraphicsState,
  pushGraphicsState,
  rgb,
} from "pdf-lib";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "out");
const A4 = { w: 595.28, h: 841.89 };
// Tanggal tetap supaya file identik di setiap pembuatan.
const FIXED_DATE = new Date("2026-01-15T08:00:00Z");

// ---------------------------------------------------------------------------
// Bahan dasar: PRNG, noise, kanvas RGBA sederhana
// ---------------------------------------------------------------------------

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Kira-kira normal(0, 1) dari jumlah tiga uniform. */
function gauss(rand) {
  return (rand() + rand() + rand() - 1.5) * 2;
}

/** Value noise halus pada grid gw x gh; sampel di (u, v) dalam 0..1. */
function valueNoise(rand, gw, gh) {
  const grid = new Float32Array((gw + 1) * (gh + 1));
  for (let i = 0; i < grid.length; i++) grid[i] = rand();
  const smooth = (t) => t * t * (3 - 2 * t);
  return (u, v) => {
    const x = u * gw;
    const y = v * gh;
    const x0 = Math.min(gw - 1, Math.floor(x));
    const y0 = Math.min(gh - 1, Math.floor(y));
    const fx = smooth(x - x0);
    const fy = smooth(y - y0);
    const i = y0 * (gw + 1) + x0;
    const a = grid[i] + (grid[i + 1] - grid[i]) * fx;
    const b = grid[i + gw + 1] + (grid[i + gw + 2] - grid[i + gw + 1]) * fx;
    return a + (b - a) * fy;
  };
}

class Raster {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.data = new Uint8Array(width * height * 4);
  }

  fill(fn) {
    const { width, height, data } = this;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const [r, g, b, a = 255] = fn(x, y);
        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = b;
        data[i + 3] = a;
      }
    }
  }

  blend(x, y, color, alpha) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height || alpha <= 0) return;
    const i = (y * this.width + x) * 4;
    const d = this.data;
    d[i] += (color[0] - d[i]) * alpha;
    d[i + 1] += (color[1] - d[i + 1]) * alpha;
    d[i + 2] += (color[2] - d[i + 2]) * alpha;
  }

  rect(x, y, w, h, color, alpha = 1) {
    const x0 = Math.max(0, Math.round(x));
    const y0 = Math.max(0, Math.round(y));
    const x1 = Math.min(this.width, Math.round(x + w));
    const y1 = Math.min(this.height, Math.round(y + h));
    for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) this.blend(xx, yy, color, alpha);
  }

  /** Lingkaran/cincin dengan tepi lembut; `keep(x, y)` = false melubangi (efek cap pudar). */
  disc(cx, cy, rOuter, rInner, color, alpha = 1, keep = () => true) {
    const x0 = Math.floor(cx - rOuter - 1);
    const x1 = Math.ceil(cx + rOuter + 1);
    const y0 = Math.floor(cy - rOuter - 1);
    const y1 = Math.ceil(cy + rOuter + 1);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const d = Math.hypot(x - cx, y - cy);
        const edge = Math.min(rOuter - d, rInner > 0 ? d - rInner : Infinity);
        const cover = Math.max(0, Math.min(1, edge + 0.5));
        if (cover > 0 && keep(x, y)) this.blend(x, y, color, alpha * cover);
      }
    }
  }

  ellipse(cx, cy, rx, ry, shade, alpha = 1) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x - cx) / rx;
        const dy = (y - cy) / ry;
        const d = dx * dx + dy * dy;
        if (d > 1) continue;
        const soft = Math.min(1, (1 - d) * Math.min(rx, ry) * 0.5);
        this.blend(x, y, shade(dx, dy), alpha * soft);
      }
    }
  }

  /** Tambah noise sensor scanner + pencahayaan tidak rata ke seluruh gambar. */
  scannerPass(rand, { lumaSd, chromaSd, lighting }) {
    const { width, height, data } = this;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const light = lighting ? lighting(x / width, y / height) : 1;
        const n = gauss(rand) * lumaSd;
        for (let c = 0; c < 3; c++) {
          const v = data[i + c] * light + n + gauss(rand) * chromaSd;
          data[i + c] = v < 0 ? 0 : v > 255 ? 255 : v;
        }
      }
    }
  }

  jpeg(quality) {
    return new Uint8Array(jpeg.encode({ data: this.data, width: this.width, height: this.height }, quality).data);
  }

  png({ alpha }) {
    return encodePng(this, alpha);
  }
}

// ---------------------------------------------------------------------------
// PNG encoder kecil (cukup untuk pdf-lib embedPng)
// ---------------------------------------------------------------------------

function pngChunk(type, body) {
  const out = Buffer.alloc(12 + body.length);
  out.writeUInt32BE(body.length, 0);
  out.write(type, 4, "latin1");
  Buffer.from(body).copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + body.length)), 8 + body.length);
  return out;
}

function encodePng(raster, withAlpha) {
  const { width, height, data } = raster;
  const bpp = withAlpha ? 4 : 3;
  const rowLen = width * bpp;
  const filtered = Buffer.alloc((rowLen + 1) * height);
  for (let y = 0; y < height; y++) {
    const o = y * (rowLen + 1);
    filtered[o] = 1; // filter Sub: cukup efektif untuk foto
    for (let x = 0; x < width; x++) {
      for (let c = 0; c < bpp; c++) {
        const cur = data[(y * width + x) * 4 + c];
        const left = x > 0 ? data[(y * width + x - 1) * 4 + c] : 0;
        filtered[o + 1 + x * bpp + c] = (cur - left) & 0xff;
      }
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = withAlpha ? 6 : 2; // RGBA : RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(filtered, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// Isi gambar: halaman scan, foto pemandangan, pas foto
// ---------------------------------------------------------------------------

const INK = [38, 40, 52];
const BLUE_INK = [28, 42, 120];

/** Satu "huruf": batang tegak + garis datar acak, mirip tekstur teks hasil scan. */
function drawGlyph(r, rand, x, baseline, xHeight, color, alpha) {
  const w = 10 + Math.floor(rand() * 12);
  const tall = rand() < 0.3;
  const desc = !tall && rand() < 0.12;
  const top = baseline - (tall ? xHeight * 1.45 : xHeight);
  const bottom = baseline + (desc ? xHeight * 0.4 : 0);
  const stem = 4 + Math.floor(rand() * 2);
  const a = alpha * (0.8 + rand() * 0.2);
  r.rect(x, top, stem, bottom - top, color, a);
  if (rand() < 0.6) r.rect(x + w - stem, baseline - xHeight, stem, xHeight, color, a);
  if (rand() < 0.5) r.rect(x, baseline - xHeight, w, 3, color, a);
  if (rand() < 0.5) r.rect(x, baseline - 3, w, 3, color, a);
  if (rand() < 0.25) r.rect(x, baseline - xHeight / 2, w, 3, color, a);
  return w;
}

function drawTextLine(r, rand, x0, x1, baseline, xHeight = 24, color = INK, alpha = 0.92) {
  let x = x0;
  while (x < x1 - 60) {
    const letters = 2 + Math.floor(rand() * 9);
    for (let k = 0; k < letters && x < x1; k++) x += drawGlyph(r, rand, x, baseline, xHeight, color, alpha) + 5;
    x += 22 + Math.floor(rand() * 10);
  }
}

function drawParagraph(r, rand, x0, x1, y0, lines, lineGap = 62) {
  for (let l = 0; l < lines; l++) {
    const end = l === lines - 1 ? x0 + (x1 - x0) * (0.3 + rand() * 0.5) : x1 - rand() * 80;
    drawTextLine(r, rand, l === 0 ? x0 + 90 : x0, end, y0 + l * lineGap);
  }
  return y0 + lines * lineGap;
}

function drawSignature(r, rand, x0, y0, width) {
  const steps = 1600;
  const k1 = 9 + rand() * 6;
  const k2 = 21 + rand() * 9;
  for (let s = 0; s < steps; s++) {
    const t = s / steps;
    const x = x0 + t * width + 25 * Math.sin(t * k2);
    const y = y0 + 55 * Math.sin(t * k1) * (1 - t * 0.6) + 22 * Math.cos(t * k2);
    r.disc(x, y, 3.2, 0, BLUE_INK, 0.35);
  }
}

function drawStamp(r, rand, cx, cy) {
  const color = [88, 64, 170];
  const holes = valueNoise(rand, 24, 24);
  const keep = (x, y) => holes((x - cx + 200) / 400, (y - cy + 200) / 400) > 0.3;
  r.disc(cx, cy, 175, 160, color, 0.7, keep);
  r.disc(cx, cy, 128, 118, color, 0.7, keep);
  for (let a = 0; a < 26; a++) {
    const ang = (a / 26) * Math.PI * 2;
    r.rect(cx + Math.cos(ang) * 142 - 6, cy + Math.sin(ang) * 142 - 6, 12, 12, color, 0.6);
  }
  r.rect(cx - 70, cy - 12, 140, 24, color, 0.6);
}

/** Pas foto: latar merah, wajah, rambut, baju gelap. */
function drawPortrait(r, x, y, w, h) {
  for (let yy = 0; yy < h; yy++) {
    const shade = 1 - yy / h / 4;
    r.rect(x, y + yy, w, 1, [176 * shade, 32 * shade, 44 * shade], 1);
  }
  const cx = x + w / 2;
  r.ellipse(cx, y + h * 1.02, w * 0.62, h * 0.36, () => [32, 38, 64]);
  r.rect(cx - w * 0.07, y + h * 0.55, w * 0.14, h * 0.14, [206, 160, 128], 1);
  r.ellipse(cx, y + h * 0.4, w * 0.27, h * 0.24, (dx, dy) => {
    const l = 1 - 0.18 * dx - 0.1 * dy;
    return [222 * l, 178 * l, 146 * l];
  });
  r.ellipse(cx, y + h * 0.25, w * 0.3, h * 0.13, () => [24, 20, 22]);
  r.ellipse(cx - w * 0.1, y + h * 0.39, w * 0.03, h * 0.012, () => [40, 30, 30]);
  r.ellipse(cx + w * 0.1, y + h * 0.39, w * 0.03, h * 0.012, () => [40, 30, 30]);
  r.ellipse(cx, y + h * 0.53, w * 0.07, h * 0.012, () => [150, 70, 70]);
}

/** Foto pemandangan: langit, matahari, bukit bertekstur. */
function landscape(width, height, seed, { lumaSd = 4, chromaSd = 1.5 } = {}) {
  const rand = mulberry32(seed);
  const foliage = valueNoise(rand, 64, 40);
  const fine = valueNoise(rand, 300, 200);
  const clouds = valueNoise(rand, 12, 6);
  const r = new Raster(width, height);
  const sunX = 0.72;
  const sunY = 0.22;
  r.fill((x, y) => {
    const u = x / width;
    const v = y / height;
    const horizon = 0.55 + 0.08 * Math.sin(u * 7 + 1) + 0.04 * Math.sin(u * 19);
    if (v < horizon) {
      const c = clouds(u, v * 1.6) > 0.62 ? 0.5 : 0;
      const sun = Math.max(0, 1 - Math.hypot(u - sunX, (v - sunY) * 0.66) * 9);
      const t = v / horizon;
      return [90 + 100 * t + 120 * c + 140 * sun, 150 + 70 * t + 90 * c + 110 * sun, 230 - 20 * t + 20 * c].map((q) =>
        Math.min(255, q),
      );
    }
    const f = foliage(u, v) * 0.7 + fine(u, v) * 0.3;
    const depth = (v - horizon) / (1 - horizon);
    return [40 + 90 * f - 20 * depth, 90 + 110 * f - 30 * depth, 30 + 40 * f];
  });
  r.scannerPass(rand, { lumaSd, chromaSd });
  return r;
}

/** Halaman A4 hasil scan 300 dpi. Variasi isi per halaman. */
function scanPage(seed, variant) {
  const W = 2480;
  const H = 3508;
  const rand = mulberry32(seed);
  const paper = valueNoise(rand, 160, 220);
  const blotch = valueNoise(rand, 9, 12);
  const r = new Raster(W, H);
  r.fill((x, y) => {
    const t = paper(x / W, y / H) * 10 + blotch(x / W, y / H) * 8;
    return [232 + t, 228 + t, 216 + t * 0.8];
  });

  const left = 250;
  const right = W - 250;
  // Kop: garis judul tebal + garis bawah ganda.
  for (let k = 0; k < 2; k++) drawTextLine(r, rand, 700, 1780, 330 + k * 80, 34, INK, 0.95);
  r.rect(left, 500, right - left, 7, INK, 0.9);
  r.rect(left, 516, right - left, 3, INK, 0.9);

  if (variant === 0) {
    // Ijazah/surat: pas foto, paragraf, cap & tanda tangan.
    drawPortrait(r, right - 480, 640, 480, 640);
    let y = drawParagraph(r, rand, left, right - 560, 720, 8);
    y = drawParagraph(r, rand, left, right, y + 80, 14);
    y = drawParagraph(r, rand, left, right, y + 80, 9);
    drawStamp(r, rand, right - 520, y + 330);
    drawSignature(r, rand, right - 640, y + 300, 520);
    drawTextLine(r, rand, right - 700, right - 120, y + 560, 24);
  } else if (variant === 1) {
    // Transkrip: tabel bergaris.
    const cols = [left, left + 160, left + 1200, left + 1450, left + 1700, right];
    const rowH = 66;
    const top = 640;
    const rows = 38;
    for (let k = 0; k <= rows; k++) r.rect(left, top + k * rowH, right - left, 3, INK, 0.8);
    for (const c of cols) r.rect(c, top, 3, rows * rowH, INK, 0.8);
    for (let k = 0; k < rows; k++) {
      const base = top + k * rowH + 48;
      for (let c = 0; c < cols.length - 1; c++) {
        const span = cols[c + 1] - cols[c] - 40;
        const len = c === 1 ? span * (0.35 + rand() * 0.6) : Math.min(span, 40 + rand() * 60);
        drawTextLine(r, rand, cols[c] + 20, cols[c] + 20 + len, base, 22);
      }
    }
    drawSignature(r, rand, right - 640, top + rows * rowH + 260, 480);
  } else {
    // Sertifikat dengan foto besar.
    const photo = landscape(1800, 1100, seed + 7, { lumaSd: 3, chromaSd: 1 });
    for (let y = 0; y < photo.height; y++) {
      for (let x = 0; x < photo.width; x++) {
        const i = (y * photo.width + x) * 4;
        r.blend(340 + x, 700 + y, [photo.data[i], photo.data[i + 1], photo.data[i + 2]], 0.97);
      }
    }
    let y = drawParagraph(r, rand, left, right, 1960, 9);
    y = drawParagraph(r, rand, left, right, y + 80, 5);
    drawStamp(r, rand, left + 420, y + 240);
    drawSignature(r, rand, right - 700, y + 200, 560);
  }

  // Pencahayaan tak rata (tutup scanner) + noise sensor.
  const shadow = valueNoise(rand, 3, 4);
  r.scannerPass(rand, {
    lumaSd: 5,
    chromaSd: 2,
    lighting: (u, v) => 1 - 0.07 * u - 0.05 * shadow(u, v) - 0.08 * Math.max(0, v - 0.92) * 12,
  });
  return r;
}

// ---------------------------------------------------------------------------
// Teks Indonesia untuk halaman teks
// ---------------------------------------------------------------------------

const SENTENCES = [
  "Dokumen ini dibuat untuk menguji alat kompres PDF wuspot.",
  "Semua proses berjalan di browser sehingga file tidak pernah dikirim ke server.",
  "Pelamar CPNS sering diminta mengunggah ijazah dan transkrip dengan batas ukuran tertentu.",
  "Batas yang umum dipakai adalah 100 KB, 200 KB, 300 KB, 500 KB, atau 1 MB.",
  "Teks yang tetap berupa teks bisa dipilih, disalin, dan dicari dengan mudah.",
  "Kalau halaman diubah menjadi gambar, ukuran bisa turun jauh tetapi teks tidak bisa disalin lagi.",
  "Gambar hasil pindaian biasanya menjadi penyumbang ukuran terbesar di dalam berkas PDF.",
  "Resolusi 150 dpi umumnya sudah cukup jelas untuk dibaca di layar maupun dicetak.",
  "Mode hitam-putih membantu memperkecil ukuran untuk dokumen yang memang tidak berwarna.",
  "Pastikan hasil kompres tetap terbaca sebelum diunggah ke portal pendaftaran.",
  "Nomor induk, nama lengkap, dan tanggal lahir harus sesuai dengan data kependudukan.",
  "Simpan salinan file asli di tempat yang aman sebelum melakukan perubahan apa pun.",
];

function paragraph(rand, count) {
  const out = [];
  for (let i = 0; i < count; i++) out.push(SENTENCES[Math.floor(rand() * SENTENCES.length)]);
  return out.join(" ");
}

function setMeta(doc, title) {
  doc.setTitle(title);
  doc.setAuthor("wuspot uji");
  doc.setCreator("make-fixtures.mjs");
  doc.setProducer("pdf-lib");
  doc.setCreationDate(FIXED_DATE);
  doc.setModificationDate(FIXED_DATE);
}

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

async function makeScan() {
  const doc = await PDFDocument.create();
  setMeta(doc, "Hasil Scan Ijazah dan Transkrip");
  for (let p = 0; p < 3; p++) {
    const t0 = Date.now();
    const bytes = scanPage(1000 + p, p).jpeg(88);
    const img = await doc.embedJpg(bytes);
    const page = doc.addPage([A4.w, A4.h]);
    page.drawImage(img, { x: 0, y: 0, width: A4.w, height: A4.h });
    console.log(`  scan halaman ${p + 1}: ${(bytes.length / 1024).toFixed(0)} KB (${Date.now() - t0} ms)`);
  }
  return doc.save({ useObjectStreams: false });
}

async function makeText() {
  const doc = await PDFDocument.create();
  setMeta(doc, "Panduan Unggah Berkas Pendaftaran");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const rand = mulberry32(42);
  for (let p = 1; p <= 12; p++) {
    const page = doc.addPage([A4.w, A4.h]);
    page.drawText(`Bab ${p}. Panduan unggah berkas`, { x: 60, y: A4.h - 80, size: 18, font: bold });
    let y = A4.h - 120;
    while (y > 90) {
      const text = paragraph(rand, 4);
      page.drawText(text, { x: 60, y, size: 11, font, maxWidth: A4.w - 120, lineHeight: 15 });
      const lines = Math.ceil(font.widthOfTextAtSize(text, 11) / (A4.w - 120)) + 1;
      y -= lines * 15 + 12;
    }
    page.drawText(`Halaman ${p} dari 12`, { x: A4.w / 2 - 40, y: 40, size: 9, font, color: rgb(0.4, 0.4, 0.4) });
  }
  return doc.save({ useObjectStreams: false });
}

async function makeMixed() {
  const doc = await PDFDocument.create();
  setMeta(doc, "Dokumen Campuran");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const rand = mulberry32(7);

  const photo = await doc.embedJpg(landscape(2000, 1500, 77).jpeg(92));
  const p1 = doc.addPage([A4.w, A4.h]);
  p1.drawText("Laporan kegiatan lapangan", { x: 60, y: A4.h - 80, size: 20, font: bold });
  p1.drawText(paragraph(rand, 5), { x: 60, y: A4.h - 115, size: 11, font, maxWidth: A4.w - 120, lineHeight: 15 });
  p1.drawImage(photo, { x: 60, y: 260, width: A4.w - 120, height: (A4.w - 120) * 0.75 });
  p1.drawText(paragraph(rand, 4), { x: 60, y: 230, size: 11, font, maxWidth: A4.w - 120, lineHeight: 15 });

  // PNG RGBA: foto dengan tepi memudar & lubang setengah transparan -> Flate + SMask.
  const art = landscape(1400, 1000, 99, { lumaSd: 2, chromaSd: 1 });
  for (let y = 0; y < art.height; y++) {
    for (let x = 0; x < art.width; x++) {
      const edge = Math.min(x, y, art.width - 1 - x, art.height - 1 - y);
      const fade = Math.min(1, edge / 80);
      const hole = Math.hypot(x - 1000, y - 300) < 160 ? 0.35 : 1;
      art.data[(y * art.width + x) * 4 + 3] = Math.round(255 * fade * hole);
    }
  }
  const png = await doc.embedPng(art.png({ alpha: true }));
  const p2 = doc.addPage([A4.w, A4.h]);
  p2.drawText("Peta lokasi", { x: 60, y: A4.h - 80, size: 20, font: bold });
  p2.drawRectangle({ x: 50, y: 330, width: A4.w - 100, height: 360, color: rgb(0.95, 0.85, 0.3) });
  p2.drawImage(png, { x: 60, y: 340, width: A4.w - 120, height: (A4.w - 120) * (1000 / 1400) });
  p2.drawText(paragraph(rand, 6), { x: 60, y: 300, size: 11, font, maxWidth: A4.w - 120, lineHeight: 15 });

  const p3 = doc.addPage([A4.w, A4.h]);
  p3.drawText("Catatan", { x: 60, y: A4.h - 80, size: 20, font: bold });
  p3.drawText(paragraph(rand, 18), { x: 60, y: A4.h - 115, size: 11, font, maxWidth: A4.w - 120, lineHeight: 15 });
  return doc.save({ useObjectStreams: false });
}

/** Data mentah RGB/abu-abu -> baris ber-filter PNG (campuran Sub/Up/Average/Paeth). */
function pngPredict(raw, width, height, colors) {
  const rowLen = width * colors;
  const out = new Uint8Array((rowLen + 1) * height);
  const paeth = (a, b, c) => {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  for (let y = 0; y < height; y++) {
    const f = y % 5; // 0..4: None, Sub, Up, Average, Paeth
    const o = y * (rowLen + 1);
    out[o] = f;
    for (let i = 0; i < rowLen; i++) {
      const x = raw[y * rowLen + i];
      const a = i >= colors ? raw[y * rowLen + i - colors] : 0;
      const b = y > 0 ? raw[(y - 1) * rowLen + i] : 0;
      const c = y > 0 && i >= colors ? raw[(y - 1) * rowLen + i - colors] : 0;
      const pred = f === 1 ? a : f === 2 ? b : f === 3 ? (a + b) >> 1 : f === 4 ? paeth(a, b, c) : 0;
      out[o + 1 + i] = (x - pred) & 0xff;
    }
  }
  return out;
}

function addPredictorImage(doc, page, raster, colors, box) {
  const { width, height, data } = raster;
  const raw = new Uint8Array(width * height * colors);
  for (let p = 0; p < width * height; p++) {
    if (colors === 3) {
      raw[p * 3] = data[p * 4];
      raw[p * 3 + 1] = data[p * 4 + 1];
      raw[p * 3 + 2] = data[p * 4 + 2];
    } else {
      raw[p] = Math.round(data[p * 4] * 0.299 + data[p * 4 + 1] * 0.587 + data[p * 4 + 2] * 0.114);
    }
  }
  const stream = doc.context.stream(deflateSync(pngPredict(raw, width, height, colors)), {
    Type: "XObject",
    Subtype: "Image",
    Width: width,
    Height: height,
    ColorSpace: colors === 3 ? "DeviceRGB" : "DeviceGray",
    BitsPerComponent: 8,
    Filter: "FlateDecode",
    DecodeParms: { Predictor: 15, Colors: colors, BitsPerComponent: 8, Columns: width },
  });
  const ref = doc.context.register(stream);
  const name = page.node.newXObject("ImPred", ref);
  page.pushOperators(
    pushGraphicsState(),
    concatTransformationMatrix(box.width, 0, 0, box.height, box.x, box.y),
    drawObject(name),
    popGraphicsState(),
  );
}

async function makePngFlate() {
  const doc = await PDFDocument.create();
  setMeta(doc, "Gambar PNG");
  const font = await doc.embedFont(StandardFonts.Helvetica);

  const png = await doc.embedPng(landscape(1800, 1300, 123, { lumaSd: 3, chromaSd: 1 }).png({ alpha: false }));
  const p1 = doc.addPage([A4.w, A4.h]);
  p1.drawText("Gambar PNG tanpa alpha (Flate)", { x: 60, y: A4.h - 70, size: 16, font });
  p1.drawImage(png, { x: 40, y: 200, width: A4.w - 80, height: (A4.w - 80) * (1300 / 1800) });

  const p2 = doc.addPage([A4.w, A4.h]);
  p2.drawText("Gambar Flate dengan predictor PNG (RGB dan abu-abu)", { x: 60, y: A4.h - 70, size: 14, font });
  addPredictorImage(doc, p2, landscape(1300, 900, 321, { lumaSd: 3, chromaSd: 1 }), 3, {
    x: 60,
    y: 400,
    width: A4.w - 120,
    height: (A4.w - 120) * (900 / 1300),
  });
  addPredictorImage(doc, p2, landscape(900, 600, 654, { lumaSd: 3, chromaSd: 0 }), 1, {
    x: 140,
    y: 80,
    width: A4.w - 280,
    height: (A4.w - 280) * (600 / 900),
  });
  return doc.save({ useObjectStreams: false });
}

async function makeRotated() {
  const doc = await PDFDocument.create();
  setMeta(doc, "Halaman Berputar");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const rand = mulberry32(5);
  const photo = await doc.embedJpg(landscape(1600, 1000, 55).jpeg(90));

  // Halaman 1: lanskap asli (lebar > tinggi).
  const p1 = doc.addPage([A4.h, A4.w]);
  p1.drawText("Halaman lanskap", { x: 50, y: A4.w - 60, size: 20, font: bold });
  p1.drawImage(photo, { x: 50, y: 60, width: 640, height: 400 });
  p1.drawText(paragraph(rand, 3), { x: 50, y: A4.w - 90, size: 11, font, maxWidth: A4.h - 100, lineHeight: 15 });

  // Halaman 2: potret dengan /Rotate 90 (tampil lanskap di penampil).
  const p2 = doc.addPage([A4.w, A4.h]);
  p2.setRotation(degrees(90));
  p2.drawText("Halaman potret dengan /Rotate 90", { x: 50, y: A4.h - 60, size: 18, font: bold });
  p2.drawImage(photo, { x: 50, y: 300, width: 480, height: 300 });
  p2.drawText(paragraph(rand, 6), { x: 50, y: A4.h - 90, size: 11, font, maxWidth: A4.w - 100, lineHeight: 15 });
  return doc.save({ useObjectStreams: false });
}

async function makeTiny() {
  const doc = await PDFDocument.create();
  setMeta(doc, "Kecil");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([A4.w, A4.h]);
  page.drawText("Halo dari wuspot. File ini sudah kecil.", { x: 60, y: A4.h - 80, size: 14, font });
  return doc.save({ useObjectStreams: true });
}

/**
 * PDF yang terpotong saat diunduh: hanya awal file yang tersisa, tanpa
 * katalog, xref, maupun trailer.
 */
function makeCorrupt(source) {
  const text = Buffer.from(source).toString("latin1");
  // Potong di tengah aliran gambar pertama.
  const streamAt = text.indexOf("stream", text.indexOf("/Subtype /Image"));
  const cut = streamAt > 0 ? streamAt + 2000 : Math.floor(source.length / 3);
  return source.slice(0, cut);
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const write = (name, bytes) => {
    writeFileSync(join(OUT, name), bytes);
    console.log(`${name.padEnd(16)} ${(bytes.length / 1024).toFixed(1).padStart(9)} KB`);
  };
  const t0 = Date.now();
  const scan = await makeScan();
  write("scan-3p.pdf", scan);
  write("text-12p.pdf", await makeText());
  write("mixed.pdf", await makeMixed());
  write("png-flate.pdf", await makePngFlate());
  write("rotated.pdf", await makeRotated());
  write("tiny.pdf", await makeTiny());
  write("corrupt.pdf", makeCorrupt(scan));
  write(
    "not-pdf.pdf",
    new TextEncoder().encode("Ini file teks biasa yang namanya berakhiran .pdf, bukan PDF sungguhan.\n".repeat(20)),
  );
  console.log(`selesai dalam ${((Date.now() - t0) / 1000).toFixed(1)} s -> ${OUT}`);
}

await main();
