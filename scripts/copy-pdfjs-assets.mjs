#!/usr/bin/env node
// Salin aset runtime pdf.js (worker, cmaps, font standar, wasm, profil ICC)
// dari node_modules ke public/pdfjs/ supaya bisa dilayani sebagai file statis.
//
// Aman dijalankan berulang kali: kalau versi pdfjs-dist sama dan semua aset
// sudah ada, skrip langsung selesai. Kalau versinya berubah, folder lama
// dihapus dulu supaya tidak ada sisa file dari versi sebelumnya.

import { createRequire } from "node:module";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(join(root, "package.json"));

const pkgJsonPath = require.resolve("pdfjs-dist/package.json");
const pkgDir = dirname(pkgJsonPath);
const { version } = JSON.parse(readFileSync(pkgJsonPath, "utf8"));

const outDir = join(root, "public", "pdfjs");
const stampFile = join(outDir, ".pdfjs-version");

/** [sumber relatif ke pdfjs-dist, tujuan relatif ke public/pdfjs] */
const assets = [
  ["legacy/build/pdf.worker.min.mjs", "pdf.worker.min.mjs"],
  ["cmaps", "cmaps"],
  ["standard_fonts", "standard_fonts"],
  ["wasm", "wasm"],
  ["iccs", "iccs"],
];

for (const [from] of assets) {
  if (!existsSync(join(pkgDir, from))) {
    console.error(`[copy-pdfjs] ${from} tidak ada di pdfjs-dist@${version}. Coba jalankan "npm install" lagi.`);
    process.exit(1);
  }
}

const readStamp = () => {
  try {
    return readFileSync(stampFile, "utf8").trim();
  } catch {
    return null;
  }
};

const upToDate = readStamp() === version && assets.every(([, to]) => existsSync(join(outDir, to)));

if (upToDate) {
  console.log(`[copy-pdfjs] public/pdfjs sudah pdfjs-dist@${version}, dilewati.`);
} else {
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  for (const [from, to] of assets) {
    cpSync(join(pkgDir, from), join(outDir, to), { recursive: true });
  }
  writeFileSync(stampFile, `${version}\n`);
  console.log(`[copy-pdfjs] aset pdfjs-dist@${version} disalin ke ${relative(root, outDir)}/`);
}
