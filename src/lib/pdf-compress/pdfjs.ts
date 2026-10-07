// Pemuat pdf.js. Modulnya besar (~1 MB) dan hanya jalan di browser, jadi
// di-import secara dinamis saat pertama kali dibutuhkan, lalu disimpan.

import type { PDFDocumentProxy } from "pdfjs-dist/legacy/build/pdf.mjs";
import { CompressError } from "./types";

type PdfjsModule = typeof import("pdfjs-dist/legacy/build/pdf.mjs");

/** Lokasi aset statis; disalin oleh scripts/copy-pdfjs-assets.mjs. */
export const PDFJS_ASSET_BASE = "/pdfjs/";
const WORKER_SRC = `${PDFJS_ASSET_BASE}pdf.worker.min.mjs`;

let modulePromise: Promise<PdfjsModule> | null = null;

export async function getPdfjs(): Promise<PdfjsModule> {
  if (typeof window === "undefined") {
    throw new Error("pdf.js hanya bisa dipakai di browser.");
  }
  if (!modulePromise) {
    modulePromise = import("pdfjs-dist/legacy/build/pdf.mjs").then(
      (mod) => {
        mod.GlobalWorkerOptions.workerSrc = WORKER_SRC;
        return mod;
      },
      (err: unknown) => {
        // Biasanya chunk gagal diunduh (koneksi putus). Jangan simpan
        // kegagalan ini supaya percobaan berikutnya bisa mengulang.
        modulePromise = null;
        throw libraryLoadError(err);
      },
    );
  }
  return modulePromise;
}

/**
 * Buka PDF dengan pdf.js. `bytes` tidak diubah: pdf.js memindahkan
 * (transfer) buffer ke worker, jadi yang dikirim adalah salinannya.
 */
export async function openDocument(bytes: Uint8Array, password?: string): Promise<PDFDocumentProxy> {
  const pdfjs = await getPdfjs();
  const task = pdfjs.getDocument({
    data: bytes.slice(),
    password: password || undefined,
    cMapUrl: `${PDFJS_ASSET_BASE}cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${PDFJS_ASSET_BASE}standard_fonts/`,
    wasmUrl: `${PDFJS_ASSET_BASE}wasm/`,
    iccUrl: `${PDFJS_ASSET_BASE}iccs/`,
    enableXfa: false,
    verbosity: pdfjs.VerbosityLevel.ERRORS,
  });
  try {
    return await task.promise;
  } catch (err) {
    await task.destroy().catch(() => undefined);
    throw mapOpenError(err, Boolean(password));
  }
}

/**
 * Tutup dokumen dan hentikan worker-nya. Di pdf.js v6 PDFDocumentProxy
 * tidak punya destroy(); yang dihancurkan adalah loadingTask-nya.
 */
export async function closeDocument(doc: PDFDocumentProxy | null | undefined): Promise<void> {
  if (!doc) return;
  try {
    await doc.loadingTask.destroy();
  } catch {
    // Sudah tertutup atau worker sudah mati; tidak ada yang perlu dilakukan.
  }
}

const PASSWORD_NEEDED = 1;
const PASSWORD_INCORRECT = 2;

/**
 * Terjemahkan error pdf.js saat membuka dokumen ke CompressError.
 * Dipisah (dan diekspor) supaya bisa diuji tanpa browser.
 */
export function mapOpenError(err: unknown, passwordGiven: boolean): CompressError {
  if (err instanceof CompressError) return err;

  const name = errorField(err, "name");
  const message = errorField(err, "message") ?? "";

  if (name === "PasswordException") {
    const code = (err as { code?: unknown }).code;
    // pdf.js menganggap password kosong sama dengan "belum diisi".
    if (code === PASSWORD_INCORRECT || (code === PASSWORD_NEEDED && passwordGiven)) {
      return new CompressError("wrong-password", "Password-nya salah. Coba ketik ulang.", { cause: err });
    }
    return new CompressError("needs-password", "PDF ini dikunci password. Masukkan password-nya dulu.", {
      cause: err,
    });
  }

  // Worker gagal dimuat bukan salah file-nya; jangan bilang file rusak.
  if (/fake worker|dynamically imported module|importing a module script failed/i.test(message)) {
    return libraryLoadError(err);
  }

  return new CompressError("corrupt", "PDF ini tidak bisa dibaca. Mungkin file-nya rusak atau belum terunduh utuh.", {
    cause: err,
  });
}

function libraryLoadError(err: unknown): CompressError {
  return new CompressError(
    "unsupported",
    "Komponen pembaca PDF gagal dimuat. Periksa koneksi internet, lalu muat ulang halaman.",
    { cause: err },
  );
}

function errorField(err: unknown, key: "name" | "message"): string | undefined {
  if (typeof err !== "object" || err === null) return undefined;
  const value = (err as Record<string, unknown>)[key];
  return typeof value === "string" ? value : undefined;
}
