// Pemeriksaan awal dokumen: jumlah halaman, halaman mana yang punya teks
// (bukan hasil scan murni), dan judul dokumen.

import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist/legacy/build/pdf.mjs";
import { CompressError } from "./types";

export interface DocInfo {
  pageCount: number;
  textPages: boolean[];
  hasAnyText: boolean;
  title?: string;
}

export async function inspectDocument(doc: PDFDocumentProxy, signal?: AbortSignal): Promise<DocInfo> {
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
  }
  throwIfAborted(signal);
  const title = await readTitle(doc);
  return {
    pageCount,
    textPages,
    hasAnyText: textPages.some(Boolean),
    ...(title ? { title } : {}),
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

async function readTitle(doc: PDFDocumentProxy): Promise<string | undefined> {
  try {
    const { info, metadata } = await doc.getMetadata();
    const fromInfo = (info as Record<string, unknown>)?.Title;
    const fromXmp: unknown = metadata?.get("dc:title");
    for (const candidate of [fromInfo, fromXmp]) {
      if (typeof candidate === "string" && candidate.trim()) return candidate.trim().slice(0, 300);
    }
  } catch {
    // Metadata rusak tidak penting untuk kompresi.
  }
  return undefined;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new CompressError("aborted", "Dibatalkan.");
}
