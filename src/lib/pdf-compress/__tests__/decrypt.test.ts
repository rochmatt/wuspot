// Dekripsi PDF: file dibuat dengan pdf-lib, dienkripsi dengan pikepdf (qpdf)
// dalam berbagai metode, lalu dibuka dengan loadDecrypted dan dibandingkan
// dengan aslinya. Hasil simpanannya juga diperiksa poppler.

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { decodePDFRawStream, PDFArray, PDFDocument, PDFHexString, PDFRawStream, PDFRef, PDFString, StandardFonts } from "pdf-lib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadDecrypted, md5, pdfStringBytes, rc4 } from "../decrypt";

const dir = mkdtempSync(join(tmpdir(), "wuspot-decrypt-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const TITLE = "Transkrip Nilai — Ujian Akhir";
const WORD = "Transkrip";

function hasPikepdf(): boolean {
  try {
    execFileSync("python3", ["-c", "import pikepdf"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

async function makeSource(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(TITLE);
  doc.setAuthor("Universitas (contoh)");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < 3; i++) {
    const page = doc.addPage([595.28, 841.89]);
    page.drawText(`${WORD} halaman ${i + 1}`, { x: 60, y: 760, size: 18, font });
    for (let line = 0; line < 30; line++) {
      page.drawText(`Baris ${line} mata kuliah dengan nilai A (${i}-${line})`, { x: 60, y: 720 - line * 20, size: 10, font });
    }
  }
  // Sebuah gambar (stream biner) supaya dekripsi stream besar ikut teruji.
  const raw = new Uint8Array(64 * 64 * 3).map((_, k) => (k * 37) & 255);
  const img = doc.context.flateStream(raw, {
    Type: "XObject",
    Subtype: "Image",
    Width: 64,
    Height: 64,
    ColorSpace: "DeviceRGB",
    BitsPerComponent: 8,
  });
  doc.context.register(img);
  return doc.save({ useObjectStreams: false });
}

interface Variant {
  name: string;
  /** Argumen pikepdf.Encryption. */
  enc: string;
  objectStreams: boolean;
  /** Password yang dipakai untuk membuka. */
  password: string;
  /** Simpan sebagai "Fast Web View" (linearized), seperti bawaan Acrobat. */
  linearize?: boolean;
}

const VARIANTS: Variant[] = [
  { name: "RC4 40-bit (R2)", enc: "owner='pemilik', user='kunci', R=2, metadata=False, aes=False", objectStreams: false, password: "kunci" },
  { name: "RC4 128-bit (R3)", enc: "owner='pemilik', user='kunci', R=3, metadata=False, aes=False", objectStreams: false, password: "kunci" },
  { name: "AES-128 (R4)", enc: "owner='pemilik', user='kunci', R=4, aes=True", objectStreams: true, password: "kunci" },
  { name: "RC4 128 (R4, tanpa AES)", enc: "owner='pemilik', user='kunci', R=4, aes=False, metadata=False", objectStreams: false, password: "kunci" },
  { name: "AES-256 (R6)", enc: "owner='pemilik', user='kunci', R=6", objectStreams: true, password: "kunci" },
  { name: "AES-256 (R6) dengan password pemilik", enc: "owner='pemilik', user='kunci', R=6", objectStreams: false, password: "pemilik" },
  { name: "RC4 128 dengan password pemilik", enc: "owner='pemilik', user='kunci', R=3, metadata=False, aes=False", objectStreams: false, password: "pemilik" },
  { name: "hanya password pemilik (R4 AES)", enc: "owner='pemilik', user='', R=4, aes=True", objectStreams: true, password: "" },
  { name: "metadata tidak dienkripsi (R4)", enc: "owner='pemilik', user='', R=4, aes=True, metadata=False", objectStreams: false, password: "" },
  { name: "password Unicode (R6)", enc: "owner='pemilik', user='rahasiä', R=6", objectStreams: true, password: "rahasiä" },
  // Linearized + object stream: trailer /Encrypt & /Info hanya ada di stream xref
  // halaman pertama (lihat pdflib-patches.ts).
  { name: "linearized, hanya password pemilik (R4 AES)", enc: "owner='pemilik', user='', R=4, aes=True", objectStreams: true, password: "", linearize: true },
  { name: "linearized, password pembuka (R6)", enc: "owner='pemilik', user='kunci', R=6", objectStreams: true, password: "kunci", linearize: true },
];

let source: Uint8Array;
const files = new Map<string, Uint8Array>();
const available = hasPikepdf();

beforeAll(async () => {
  source = await makeSource();
  if (!available) return;
  const src = join(dir, "source.pdf");
  writeFileSync(src, source);
  VARIANTS.forEach((v, i) => {
    const out = join(dir, `v${i}.pdf`);
    const mode = v.objectStreams ? "generate" : "disable";
    const script = [
      "import pikepdf, sys",
      `p = pikepdf.open(${JSON.stringify(src)})`,
      `p.save(${JSON.stringify(out)}, encryption=pikepdf.Encryption(${v.enc}), object_stream_mode=pikepdf.ObjectStreamMode.${mode}${v.linearize ? ", linearize=True" : ""})`,
    ].join("\n");
    execFileSync("python3", ["-c", script]);
    files.set(v.name, new Uint8Array(readFileSync(out)));
  });
});

function pageText(doc: PDFDocument, index: number): string {
  const contents = doc.getPages()[index].node.Contents();
  const items = contents instanceof PDFArray ? contents.asArray() : contents ? [contents] : [];
  let text = "";
  for (const item of items) {
    const stream = item instanceof PDFRef ? doc.context.lookup(item) : item;
    if (stream instanceof PDFRawStream) text += Buffer.from(decodePDFRawStream(stream).decode()).toString("latin1");
  }
  return text;
}

describe("pdfStringBytes (ISO 32000 7.3.4)", () => {
  const hex = (b: Uint8Array) => Buffer.from(b).toString("hex");

  it("string hex: spasi & baris baru diabaikan, digit ganjil diberi 0", () => {
    expect(hex(pdfStringBytes(PDFHexString.of("4a 6b\n 7C\r\n0")))).toBe("4a6b7c00");
    expect(hex(pdfStringBytes(PDFHexString.of("")))).toBe("");
  });

  it("string literal: escape, oktal, dan sambungan baris", () => {
    // \n \r \t \b \f \( \) \\ lalu oktal 1-3 digit
    expect(hex(pdfStringBytes(PDFString.of("a\\n\\r\\t\\b\\f\\(\\)\\\\b")))).toBe("610a0d09080c28295c62");
    expect(hex(pdfStringBytes(PDFString.of("\\101\\0\\7779")))).toBe("4100ff39");
    // backslash + CRLF / LF = sambungan (tanpa byte); CR mentah dibaca LF
    expect(hex(pdfStringBytes(PDFString.of("ab\\\r\ncd\\\nef")))).toBe("616263646566");
    expect(hex(pdfStringBytes(PDFString.of("x\r\ny\rz")))).toBe("780a790a7a");
  });
});

describe("primitif kripto", () => {
  it("md5 sama dengan node:crypto", () => {
    for (const len of [0, 1, 55, 56, 63, 64, 65, 1000]) {
      const data = new Uint8Array(len).map((_, i) => (i * 7 + 3) & 255);
      const expected = createHash("md5").update(data).digest("hex");
      expect(Buffer.from(md5(data)).toString("hex")).toBe(expected);
    }
  });

  it("rc4 sesuai vektor uji klasik", () => {
    const out = rc4(new TextEncoder().encode("Key"), new TextEncoder().encode("Plaintext"));
    expect(Buffer.from(out).toString("hex")).toBe("bbf316e8d940af0ad3");
  });
});

describe.skipIf(!available)("loadDecrypted", () => {
  for (const v of VARIANTS) {
    it(`membuka ${v.name}`, async () => {
      const bytes = files.get(v.name)!;
      const doc = await loadDecrypted(bytes, v.password);
      expect(doc, "dokumen harus terbuka").not.toBeNull();
      const d = doc!;
      expect(d.isEncrypted).toBe(false);
      expect(d.getPageCount()).toBe(3);
      expect(d.getTitle()).toBe(TITLE);
      expect(d.getAuthor()).toBe("Universitas (contoh)");
      // Content stream hasil dekripsi identik dengan aslinya.
      const original = await PDFDocument.load(source);
      for (let i = 0; i < 3; i++) expect(pageText(d, i)).toBe(pageText(original, i));
      expect(pageText(d, 0)).toContain(" Tj");

      // Simpan, lalu periksa dengan poppler: tidak terkunci & teksnya terbaca.
      const out = join(dir, `out-${v.name.replace(/\W+/g, "_")}.pdf`);
      writeFileSync(out, await d.save({ useObjectStreams: true }));
      const info = execFileSync("pdfinfo", [out]).toString();
      expect(info).toMatch(/Encrypted:\s+no/);
      expect(info).toMatch(/Pages:\s+3/);
      const text = execFileSync("pdftotext", [out, "-"]).toString();
      expect(text).toContain(`${WORD} halaman 3`);
    });
  }

  it("password salah -> null", async () => {
    expect(await loadDecrypted(files.get("AES-256 (R6)")!, "salah")).toBeNull();
    expect(await loadDecrypted(files.get("RC4 128-bit (R3)")!, "salah")).toBeNull();
  });

  it("PDF tanpa enkripsi -> null (bukan urusan modul ini)", async () => {
    expect(await loadDecrypted(source, "")).toBeNull();
  });
});
