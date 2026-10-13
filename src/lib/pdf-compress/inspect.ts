// Pemeriksaan awal dokumen: jumlah halaman, halaman mana yang punya teks
// (bukan hasil scan murni), dan judul dokumen.

import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist/legacy/build/pdf.mjs";
import { CompressError } from "./types";

export interface DocInfo {
  pageCount: number;
  textPages: boolean[];
  hasAnyText: boolean;
  title?: string;
  /** File aslinya terenkripsi (password pembuka atau hanya password pemilik). */
  encrypted?: boolean;
  /** Ada tanda tangan digital (mis. e-meterai) yang akan batal bila file diubah. */
  hasSignatures?: boolean;
}

export async function inspectDocument(
  doc: PDFDocumentProxy,
  signal?: AbortSignal,
  onPage?: (done: number, total: number) => void,
): Promise<DocInfo> {
  const pageCount = doc.numPages;
  const textPages: boolean[] = [];
  for (let n = 1; n <= pageCount; n++) {
    throwIfAborted(signal);
    const page = await doc.getPage(n);
    try {
      textPages.push(await pageHasText(page));
    } finally {
      page.cleanup();
    }
    onPage?.(n, pageCount);
  }
  throwIfAborted(signal);
  const meta = await readMeta(doc);
  return {
    pageCount,
    textPages,
    hasAnyText: textPages.some(Boolean),
    ...(meta.title ? { title: meta.title } : {}),
    encrypted: meta.encrypted,
    hasSignatures: meta.hasSignatures,
  };
}

interface TextChunk {
  items: Array<{ str?: unknown }>;
}

/**
 * Cukup temukan satu potong teks yang bukan spasi, lalu berhenti.
 * Teks tak terlihat dari OCR juga dihitung: halaman itu bisa dicari,
 * jadi sebaiknya tidak diubah jadi gambar.
 */
async function pageHasText(page: PDFPageProxy): Promise<boolean> {
  const reader = (page.streamTextContent({ disableNormalization: true }) as ReadableStream<TextChunk>).getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return false;
      if (value.items.some((it) => typeof it.str === "string" && /\S/.test(it.str))) {
        // pdf.js mewajibkan alasan berupa Error; tanpa itu stream-nya error
        // dan muncul exception tak tertangkap di konsol.
        reader.cancel(new Error("teks sudah ditemukan")).catch(() => undefined);
        return true;
      }
    }
  } catch {
    // Halaman rusak sebagian: anggap tidak berteks, bukan alasan untuk gagal.
    return false;
  } finally {
    reader.releaseLock();
  }
}

async function readMeta(
  doc: PDFDocumentProxy,
): Promise<{ title?: string; encrypted: boolean; hasSignatures: boolean }> {
  try {
    const { info, metadata } = await doc.getMetadata();
    const rec = (info ?? {}) as Record<string, unknown>;
    const fromXmp: unknown = metadata?.get("dc:title");
    let title: string | undefined;
    for (const candidate of [rec.Title, fromXmp]) {
      if (typeof candidate === "string" && candidate.trim()) {
        title = candidate.trim().slice(0, 300);
        break;
      }
    }
    return {
      title,
      encrypted: typeof rec.EncryptFilterName === "string" && rec.EncryptFilterName !== "",
      hasSignatures: rec.IsSignaturesPresent === true,
    };
  } catch {
    // Metadata rusak tidak penting untuk kompresi.
    return { encrypted: false, hasSignatures: false };
  }
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new CompressError("aborted", "Dibatalkan.");
}
