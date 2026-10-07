// Optimasi lossless lewat pdf-lib: buang objek yatim, buang thumbnail &
// data privat aplikasi (PieceInfo), kompres stream yang belum dikompres.

import {
  ParseSpeeds,
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFInvalidObject,
  PDFName,
  PDFObject,
  PDFRawStream,
  PDFRef,
  PDFStream,
} from "pdf-lib";

const N = {
  Thumb: PDFName.of("Thumb"),
  PieceInfo: PDFName.of("PieceInfo"),
  Filter: PDFName.of("Filter"),
  DecodeParms: PDFName.of("DecodeParms"),
  Type: PDFName.of("Type"),
  Subtype: PDFName.of("Subtype"),
  Form: PDFName.of("Form"),
  Page: PDFName.of("Page"),
  Metadata: PDFName.of("Metadata"),
  XRef: PDFName.of("XRef"),
  ObjStm: PDFName.of("ObjStm"),
  FlateDecode: PDFName.of("FlateDecode"),
} as const;

/** Stream tanpa filter yang lebih kecil dari ini tidak sepadan dikompres. */
const MIN_FLATE_BYTES = 1024;

// ---------------------------------------------------------------------------
// Deflate / inflate memakai CompressionStream bawaan browser (zlib = FlateDecode).

async function pipeBytes(data: Uint8Array, transform: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  // Blob menyalin data, jadi buffer asli aman dari "transfer".
  const source = new Blob([data as Uint8Array<ArrayBuffer>]).stream();
  const buf = await new Response(source.pipeThrough(transform)).arrayBuffer();
  return new Uint8Array(buf);
}

export function deflateBytes(data: Uint8Array): Promise<Uint8Array> {
  return pipeBytes(data, new CompressionStream("deflate"));
}

export function inflateBytes(data: Uint8Array): Promise<Uint8Array> {
  return pipeBytes(data, new DecompressionStream("deflate"));
}

// ---------------------------------------------------------------------------

/** Muat PDF untuk diedit. `null` bila terenkripsi, rusak, atau tidak punya halaman. */
export async function loadEditable(bytes: Uint8Array): Promise<PDFDocument | null> {
  try {
    const doc = await PDFDocument.load(bytes, {
      updateMetadata: false,
      throwOnInvalidObject: false,
      parseSpeed: ParseSpeeds.Fast,
    });
    if (doc.isEncrypted) return null;
    if (doc.getPageCount() < 1) return null;
    return doc;
  } catch {
    return null;
  }
}

/** Optimasi struktur, langsung mengubah `doc`. Isi visual tidak berubah. */
export async function optimizeStructure(doc: PDFDocument): Promise<void> {
  stripPrivateData(doc);
  removeUnreachable(doc);
  await flateUncompressedStreams(doc);
}

export async function savePdf(doc: PDFDocument, meta?: { title?: string }): Promise<Uint8Array> {
  if (meta?.title && !safeTitle(doc)) doc.setTitle(meta.title);
  doc.setProducer("wuspot.com");
  doc.setModificationDate(new Date());
  return doc.save({
    useObjectStreams: true,
    addDefaultPage: false,
    // Jangan regenerasi tampilan form: bisa mengubah isi & menambah font.
    updateFieldAppearances: false,
    objectsPerTick: 200,
  });
}

function safeTitle(doc: PDFDocument): string | undefined {
  try {
    return doc.getTitle();
  } catch {
    return undefined; // /Title bertipe aneh: anggap tidak ada
  }
}

// ---------------------------------------------------------------------------

/** Hapus /Thumb di halaman, /PieceInfo di katalog, halaman, dan form XObject. */
export function stripPrivateData(doc: PDFDocument): void {
  doc.catalog.delete(N.PieceInfo);

  const pageDicts = new Set<PDFDict>();
  try {
    for (const page of doc.getPages()) pageDicts.add(page.node);
  } catch {
    // Pohon halaman aneh: tetap lanjut dengan pencarian /Type /Page di bawah.
  }

  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    if (obj instanceof PDFDict && obj.get(N.Type) === N.Page) pageDicts.add(obj);
    else if (obj instanceof PDFStream && obj.dict.get(N.Subtype) === N.Form) obj.dict.delete(N.PieceInfo);
  }

  for (const dict of pageDicts) {
    dict.delete(N.Thumb);
    dict.delete(N.PieceInfo);
  }
}

/** Garbage collection: hapus objek tidak langsung yang tidak terjangkau dari Root/Info. */
export function removeUnreachable(doc: PDFDocument): number {
  const { context } = doc;
  const reachable = new Set<PDFRef>();
  const stack: PDFObject[] = [];

  const roots = [context.trailerInfo.Root, context.trailerInfo.Info, context.trailerInfo.Encrypt];
  for (const r of roots) if (r) stack.push(r);

  while (stack.length > 0) {
    const obj = stack.pop();
    if (obj === undefined) continue;

    if (obj instanceof PDFRef) {
      if (reachable.has(obj)) continue;
      reachable.add(obj);
      const target = context.lookup(obj);
      if (target) stack.push(target);
    } else if (obj instanceof PDFDict) {
      for (const v of obj.values()) stack.push(v);
    } else if (obj instanceof PDFArray) {
      for (const v of obj.asArray()) stack.push(v);
    } else if (obj instanceof PDFStream) {
      stack.push(obj.dict);
    } else if (obj instanceof PDFInvalidObject) {
      // Isi objek rusak tidak diparse pdf-lib; cari pola "n g R" secara konservatif.
      for (const ref of refsInRawBytes(obj)) stack.push(ref);
    }
  }

  let removed = 0;
  for (const [ref] of context.enumerateIndirectObjects()) {
    if (!reachable.has(ref)) {
      context.delete(ref);
      removed++;
    }
  }
  return removed;
}

function refsInRawBytes(obj: PDFInvalidObject): PDFRef[] {
  const buf = new Uint8Array(obj.sizeInBytes());
  obj.copyBytesInto(buf, 0);
  let text = "";
  for (let i = 0; i < buf.length; i++) text += String.fromCharCode(buf[i]);
  const refs: PDFRef[] = [];
  const re = /(\d+)\s+(\d+)\s+R\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) refs.push(PDFRef.of(Number(m[1]), Number(m[2])));
  return refs;
}

/** Kompres (Flate) stream tanpa filter yang > 1 KB. Hanya diganti bila lebih kecil. */
export async function flateUncompressedStreams(doc: PDFDocument): Promise<number> {
  const { context } = doc;
  let count = 0;
  for (const [ref, obj] of context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFRawStream)) continue;
    const dict = obj.dict;
    if (dict.has(N.Filter)) continue;
    const type = dict.get(N.Type);
    // XMP metadata sengaja dibiarkan polos (dibaca tool lain / syarat PDF/A).
    if (type === N.Metadata || type === N.XRef || type === N.ObjStm) continue;
    if (obj.contents.length <= MIN_FLATE_BYTES) continue;

    const packed = await deflateBytes(obj.contents);
    if (packed.length >= obj.contents.length * 0.95) continue;

    const newDict = dict.clone(context);
    newDict.set(N.Filter, N.FlateDecode);
    newDict.delete(N.DecodeParms);
    context.assign(ref, PDFRawStream.of(newDict, packed));
    count++;
  }
  return count;
}
