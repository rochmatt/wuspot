// Tambalan kecil untuk pdf-lib 1.17.1 (rilis terakhir, tidak lagi dirawat).
//
// 1. PDFXRefStreamParser menimpa trailerInfo dengan isi tiap stream xref tanpa
// cadangan, padahal parser trailer klasik memakai `|| sebelumnya`. Di PDF
// "Fast Web View" (linearized) dengan object stream — format simpan bawaan
// Acrobat — stream xref terakhir hanya berisi /Size /W /ID, jadi /Info dan
// /Encrypt hilang: metadata terbuang dan PDF berproteksi tidak bisa didekripsi.
// Di sini nilai yang tidak ada di stream berikutnya diambil dari sebelumnya.
// 2. PDFName: lihat di bawah.

import { PDFName, PDFXRefStreamParser } from "pdf-lib";
import type { PDFContext } from "pdf-lib";

interface XRefStreamParserInternals {
  context: PDFContext;
  parseIntoContext(): unknown;
}

const proto = PDFXRefStreamParser.prototype as unknown as XRefStreamParserInternals & {
  __wuspotTrailerMerge?: true;
};

if (!proto.__wuspotTrailerMerge) {
  const original = proto.parseIntoContext;
  proto.parseIntoContext = function (this: XRefStreamParserInternals) {
    const prev = { ...this.context.trailerInfo };
    const entries = original.call(this);
    const next = this.context.trailerInfo;
    this.context.trailerInfo = {
      Root: next.Root ?? prev.Root,
      Encrypt: next.Encrypt ?? prev.Encrypt,
      Info: next.Info ?? prev.Info,
      ID: next.ID ?? prev.ID,
    };
    return entries;
  };
  proto.__wuspotTrailerMerge = true;
}

// PDFName: pdf-lib hanya mendekode escape #xx berhuruf besar (#E5). Escape
// berhuruf kecil (#e5, sah menurut ISO 32000) dibiarkan, lalu '#'-nya di-escape
// lagi saat menyimpan (#23e5). Nama font/gambar di resource jadi tidak cocok
// dengan content stream, dan halaman hasilnya kosong. Samakan ke huruf besar.
const nameClass = PDFName as unknown as { of: (name: string) => PDFName; __wuspotHexCase?: true };
if (!nameClass.__wuspotHexCase) {
  const originalOf = nameClass.of;
  nameClass.of = (name: string) =>
    originalOf(name.includes("#") ? name.replace(/#([0-9a-fA-F]{2})/g, (_m, hex: string) => `#${hex.toUpperCase()}`) : name);
  nameClass.__wuspotHexCase = true;
}

export {};
