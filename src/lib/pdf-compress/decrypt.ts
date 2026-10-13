// Membuka PDF terenkripsi (Standard security handler) supaya bisa diolah
// pdf-lib, yang sendiri tidak bisa mendekripsi. Dipakai untuk PDF yang dikunci
// password pembuka (pengguna sudah memasukkannya) maupun yang hanya diproteksi
// password pemilik (bisa dibuka tanpa password, tapi salin/edit dibatasi).
//
// Didukung: RC4 40-128 bit (R2-R4), AES-128 (R4, AESV2), AES-256 (R5/R6, AESV3),
// dengan atau tanpa object stream. Yang tidak didukung (handler non-Standard,
// crypt filter per stream, dsb.) menghasilkan `null`, dan orkestrator kembali
// ke rasterize seperti biasa.
//
// Cara kerja: parser pdf-lib dipakai apa adanya, hanya `parseIndirectObject`
// pada instance parser diganti supaya setiap objek didekripsi tepat setelah
// dibaca (dan object stream didekripsi sebelum isinya diurai). Ini memakai
// bagian internal pdf-lib 1.17 (versinya dikunci di package.json).

import {
  decodePDFRawStream,
  PDFArray,
  PDFContext,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFNumber,
  PDFObject,
  PDFObjectStreamParser,
  PDFParser,
  PDFRawStream,
  PDFRef,
  PDFStream,
  PDFString,
  PDFXRefStreamParser,
} from "pdf-lib";
import "./pdflib-patches";

// ---------------------------------------------------------------------------
// Primitif kripto. MD5 & RC4 tidak ada di WebCrypto, jadi ditulis sendiri;
// SHA-2 dan AES memakai crypto.subtle.

const MD5_S = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 4,
  11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
];
const MD5_K = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0);

export function md5(data: Uint8Array): Uint8Array {
  const bitLen = data.length * 8;
  const padded = new Uint8Array((((data.length + 8) >> 6) + 1) << 6);
  padded.set(data);
  padded[data.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, bitLen >>> 0, true);
  view.setUint32(padded.length - 4, Math.floor(bitLen / 2 ** 32), true);

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;
  const m = new Uint32Array(16);
  for (let off = 0; off < padded.length; off += 64) {
    for (let i = 0; i < 16; i++) m[i] = view.getUint32(off + i * 4, true);
    let a = a0;
    let b = b0;
    let c = c0;
    let d = d0;
    for (let i = 0; i < 64; i++) {
      let f: number;
      let g: number;
      if (i < 16) {
        f = (b & c) | (~b & d);
        g = i;
      } else if (i < 32) {
        f = (d & b) | (~d & c);
        g = (5 * i + 1) & 15;
      } else if (i < 48) {
        f = b ^ c ^ d;
        g = (3 * i + 5) & 15;
      } else {
        f = c ^ (b | ~d);
        g = (7 * i) & 15;
      }
      const tmp = d;
      d = c;
      c = b;
      const x = (a + f + MD5_K[i] + m[g]) >>> 0;
      b = (b + ((x << MD5_S[i]) | (x >>> (32 - MD5_S[i])))) >>> 0;
      a = tmp;
    }
    a0 = (a0 + a) >>> 0;
    b0 = (b0 + b) >>> 0;
    c0 = (c0 + c) >>> 0;
    d0 = (d0 + d) >>> 0;
  }
  const out = new Uint8Array(16);
  const ov = new DataView(out.buffer);
  ov.setUint32(0, a0, true);
  ov.setUint32(4, b0, true);
  ov.setUint32(8, c0, true);
  ov.setUint32(12, d0, true);
  return out;
}

export function rc4(key: Uint8Array, data: Uint8Array): Uint8Array {
  const s = new Uint8Array(256);
  for (let i = 0; i < 256; i++) s[i] = i;
  for (let i = 0, j = 0; i < 256; i++) {
    j = (j + s[i] + key[i % key.length]) & 255;
    const t = s[i];
    s[i] = s[j];
    s[j] = t;
  }
  const out = new Uint8Array(data.length);
  for (let k = 0, i = 0, j = 0; k < data.length; k++) {
    i = (i + 1) & 255;
    j = (j + s[i]) & 255;
    const t = s[i];
    s[i] = s[j];
    s[j] = t;
    out[k] = data[k] ^ s[(s[i] + s[j]) & 255];
  }
  return out;
}

function subtle(): SubtleCrypto {
  const c = globalThis.crypto?.subtle;
  if (!c) throw new Error("WebCrypto tidak tersedia");
  return c;
}

function buf(b: Uint8Array): ArrayBuffer {
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
}

async function digest(alg: "SHA-256" | "SHA-384" | "SHA-512", data: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await subtle().digest(alg, buf(data)));
}

const aesKeyCache = new WeakMap<Uint8Array, Promise<CryptoKey>>();
function aesKey(raw: Uint8Array): Promise<CryptoKey> {
  let k = aesKeyCache.get(raw);
  if (!k) {
    k = subtle().importKey("raw", buf(raw), { name: "AES-CBC" }, false, ["encrypt", "decrypt"]);
    aesKeyCache.set(raw, k);
  }
  return k;
}

/** AES-CBC tanpa padding (panjang kelipatan 16). */
async function aesEncryptNoPad(key: Uint8Array, iv: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const out = await subtle().encrypt({ name: "AES-CBC", iv: buf(iv) }, await aesKey(key), buf(data));
  // WebCrypto selalu menambah satu blok padding; buang.
  return new Uint8Array(out, 0, data.length);
}

/**
 * Dekripsi AES-CBC tanpa memeriksa padding. WebCrypto menolak padding yang
 * tidak sah, jadi ditambahkan satu blok buatan yang dekripsinya tepat berupa
 * padding penuh (16 x 0x10), lalu blok itu dibuang oleh WebCrypto sendiri.
 */
async function aesDecryptNoPad(key: Uint8Array, iv: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  if (data.length === 0) return data;
  const last = data.subarray(data.length - 16);
  const fullPad = new Uint8Array(16).fill(16);
  const extra = await aesEncryptNoPad(key, last, fullPad);
  const joined = new Uint8Array(data.length + 16);
  joined.set(data);
  joined.set(extra, data.length);
  const out = await subtle().decrypt({ name: "AES-CBC", iv: buf(iv) }, await aesKey(key), buf(joined));
  return new Uint8Array(out);
}

/** Data PDF terenkripsi AES: 16 byte IV lalu ciphertext berpadding PKCS#5. */
async function aesDecryptPdf(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  if (data.length < 16) return new Uint8Array(0);
  const iv = data.subarray(0, 16);
  let body = data.subarray(16);
  // Data yang terpotong: buang sisa yang bukan kelipatan blok.
  if (body.length % 16 !== 0) body = body.subarray(0, body.length - (body.length % 16));
  if (body.length === 0) return new Uint8Array(0);
  try {
    const out = await subtle().decrypt({ name: "AES-CBC", iv: buf(iv) }, await aesKey(key), buf(body));
    return new Uint8Array(out);
  } catch {
    // Padding rusak (dibuat aplikasi yang ceroboh): ambil apa adanya.
    const raw = await aesDecryptNoPad(key, iv, body);
    const pad = raw[raw.length - 1];
    return pad >= 1 && pad <= 16 ? raw.subarray(0, raw.length - pad) : raw;
  }
}

// ---------------------------------------------------------------------------
// Security handler

const PASSWORD_PAD = new Uint8Array([
  0x28, 0xbf, 0x4e, 0x5e, 0x4e, 0x75, 0x8a, 0x41, 0x64, 0x00, 0x4e, 0x56, 0xff, 0xfa, 0x01, 0x08, 0x2e, 0x2e, 0x00, 0xb6,
  0xd0, 0x68, 0x3e, 0x80, 0x2f, 0x0c, 0xa9, 0xfe, 0x64, 0x53, 0x69, 0x7a,
]);

type CipherKind = "none" | "rc4" | "aes128" | "aes256";

interface Handler {
  /** Kunci berkas (Algorithm 2 / 2.A). */
  key: Uint8Array;
  stream: CipherKind;
  string: CipherKind;
  encryptMetadata: boolean;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function latin1(password: string): Uint8Array {
  const out: number[] = [];
  for (const ch of password) {
    const c = ch.charCodeAt(0);
    if (c < 256) out.push(c);
  }
  return new Uint8Array(out);
}

function padPassword(pw: Uint8Array): Uint8Array {
  const out = new Uint8Array(32);
  const n = Math.min(32, pw.length);
  out.set(pw.subarray(0, n));
  out.set(PASSWORD_PAD.subarray(0, 32 - n), n);
  return out;
}

function stringBytes(obj: PDFObject | undefined): Uint8Array | null {
  if (obj instanceof PDFString || obj instanceof PDFHexString) return pdfStringBytes(obj);
  return null;
}

/**
 * Byte mentah string PDF menurut ISO 32000 7.3.4. `asBytes()` milik pdf-lib
 * tidak mengabaikan spasi/baris baru di string hex dan salah membaca
 * backslash + CRLF di string literal. Untuk teks biasa itu sepele, tapi pada
 * data terenkripsi satu byte meleset membuat seluruh hasil dekripsinya sampah.
 */
export function pdfStringBytes(obj: PDFString | PDFHexString): Uint8Array {
  const raw = obj.asString();
  if (obj instanceof PDFHexString) {
    const hex = raw.replace(/[^0-9a-fA-F]/g, "");
    const even = hex.length % 2 === 1 ? `${hex}0` : hex;
    const out = new Uint8Array(even.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(even.substr(i * 2, 2), 16);
    return out;
  }
  const out: number[] = [];
  for (let i = 0; i < raw.length; i++) {
    const c = raw.charCodeAt(i);
    if (c === 0x0d) {
      // Akhir baris mentah di dalam string literal dibaca sebagai satu LF.
      out.push(0x0a);
      if (raw.charCodeAt(i + 1) === 0x0a) i++;
      continue;
    }
    if (c !== 0x5c) {
      out.push(c & 0xff);
      continue;
    }
    i++;
    if (i >= raw.length) break;
    const e = raw.charCodeAt(i);
    if (e >= 0x30 && e <= 0x37) {
      let value = e - 0x30;
      for (let k = 0; k < 2; k++) {
        const d = raw.charCodeAt(i + 1);
        if (!(d >= 0x30 && d <= 0x37)) break;
        value = value * 8 + (d - 0x30);
        i++;
      }
      out.push(value & 0xff);
      continue;
    }
    switch (e) {
      case 0x6e: out.push(0x0a); break; // \n
      case 0x72: out.push(0x0d); break; // \r
      case 0x74: out.push(0x09); break; // \t
      case 0x62: out.push(0x08); break; // \b
      case 0x66: out.push(0x0c); break; // \f
      case 0x0d: // backslash + akhir baris = sambungan, tidak menghasilkan byte
        if (raw.charCodeAt(i + 1) === 0x0a) i++;
        break;
      case 0x0a:
        break;
      default:
        out.push(e & 0xff); // \( \) \\ dan escape tak dikenal: backslash diabaikan
    }
  }
  return new Uint8Array(out);
}

function numberOf(obj: PDFObject | undefined): number | undefined {
  return obj instanceof PDFNumber ? obj.asNumber() : undefined;
}

interface EncryptParams {
  v: number;
  r: number;
  /** Panjang kunci RC4/AES-128 dalam byte (Algorithm 2). */
  n: number;
  o: Uint8Array;
  u: Uint8Array;
  oe: Uint8Array | null;
  ue: Uint8Array | null;
  p: number;
  id0: Uint8Array;
  encryptMetadata: boolean;
  stream: CipherKind;
  string: CipherKind;
}

function cryptFilterKind(dict: PDFDict, filterName: PDFObject | undefined, v: number): CipherKind | null {
  if (v < 4) return "rc4";
  const name = filterName instanceof PDFName ? filterName.asString() : "/Identity";
  if (name === "/Identity") return "none";
  const cf = dict.lookup(PDFName.of("CF"));
  const entry = cf instanceof PDFDict ? cf.lookup(PDFName.of(name.slice(1))) : undefined;
  if (!(entry instanceof PDFDict)) return null;
  const cfm = entry.lookup(PDFName.of("CFM"));
  const method = cfm instanceof PDFName ? cfm.asString() : "/None";
  if (method === "/V2") return "rc4";
  if (method === "/AESV2") return "aes128";
  if (method === "/AESV3") return "aes256";
  if (method === "/None") return "none";
  return null;
}

function readEncryptParams(dict: PDFDict, id: PDFObject | undefined): EncryptParams | null {
  const filter = dict.lookup(PDFName.of("Filter"));
  if (!(filter instanceof PDFName) || filter.asString() !== "/Standard") return null;
  const v = numberOf(dict.lookup(PDFName.of("V"))) ?? 0;
  const r = numberOf(dict.lookup(PDFName.of("R"))) ?? 0;
  const o = stringBytes(dict.lookup(PDFName.of("O")));
  const u = stringBytes(dict.lookup(PDFName.of("U")));
  const p = numberOf(dict.lookup(PDFName.of("P")));
  if (!o || !u || p === undefined || ![1, 2, 4, 5].includes(v) || r < 2 || r > 6) return null;

  const em = dict.lookup(PDFName.of("EncryptMetadata"));
  const encryptMetadata = !(em !== undefined && em.toString() === "false");
  const stream = cryptFilterKind(dict, dict.lookup(PDFName.of("StmF")), v);
  const string = cryptFilterKind(dict, dict.lookup(PDFName.of("StrF")), v);
  if (!stream || !string) return null;

  let lengthBits = numberOf(dict.lookup(PDFName.of("Length"))) ?? 40;
  if (v === 4) lengthBits = Math.max(lengthBits, 128);
  const n = v === 1 ? 5 : Math.min(16, Math.max(5, Math.floor(lengthBits / 8)));

  let id0: Uint8Array = new Uint8Array(0);
  if (id instanceof PDFArray && id.size() > 0) id0 = stringBytes(id.get(0)) ?? id0;

  return {
    v,
    r,
    n,
    o,
    u,
    oe: stringBytes(dict.lookup(PDFName.of("OE"))),
    ue: stringBytes(dict.lookup(PDFName.of("UE"))),
    p,
    id0,
    encryptMetadata,
    stream,
    string,
  };
}

/** Algorithm 2: kunci berkas dari password (sudah dipad 32 byte), R2-R4. */
function computeKeyR4(params: EncryptParams, padded: Uint8Array): Uint8Array {
  const p = new Uint8Array(4);
  new DataView(p.buffer).setUint32(0, params.p >>> 0, true);
  const parts = [padded, params.o.subarray(0, 32), p, params.id0];
  if (params.r >= 4 && !params.encryptMetadata) parts.push(new Uint8Array([0xff, 0xff, 0xff, 0xff]));
  let h = md5(concat(...parts));
  if (params.r >= 3) for (let i = 0; i < 50; i++) h = md5(h.subarray(0, params.n));
  return h.slice(0, params.r === 2 ? 5 : params.n);
}

/** Algorithm 4/5: cocokkan kunci dengan /U. */
function userKeyMatches(params: EncryptParams, key: Uint8Array): boolean {
  if (params.r === 2) return equalBytes(rc4(key, PASSWORD_PAD), params.u.subarray(0, 32));
  let x = rc4(key, md5(concat(PASSWORD_PAD, params.id0)));
  for (let i = 1; i <= 19; i++) x = rc4(key.map((b) => b ^ i), x);
  return equalBytes(x, params.u.subarray(0, 16));
}

function authenticateR4(params: EncryptParams, password: Uint8Array): Uint8Array | null {
  // Sebagai password pengguna.
  const asUser = computeKeyR4(params, padPassword(password));
  if (userKeyMatches(params, asUser)) return asUser;

  // Sebagai password pemilik (Algorithm 7): pulihkan password pengguna dari /O.
  let h = md5(padPassword(password));
  if (params.r >= 3) for (let i = 0; i < 50; i++) h = md5(h);
  const ownerKey = h.subarray(0, params.r === 2 ? 5 : params.n);
  let userPadded: Uint8Array;
  if (params.r === 2) userPadded = rc4(ownerKey, params.o.subarray(0, 32));
  else {
    userPadded = params.o.subarray(0, 32);
    for (let i = 19; i >= 0; i--) userPadded = rc4(ownerKey.map((b) => b ^ i), userPadded);
  }
  const asOwner = computeKeyR4(params, userPadded);
  return userKeyMatches(params, asOwner) ? asOwner : null;
}

/** Algorithm 2.B (R6) atau SHA-256 sederhana (R5). */
async function hashR6(r: number, password: Uint8Array, salt: Uint8Array, udata: Uint8Array): Promise<Uint8Array> {
  let k = await digest("SHA-256", concat(password, salt, udata));
  if (r === 5) return k;
  for (let i = 0; ; i++) {
    const unit = concat(password, k, udata);
    const k1 = new Uint8Array(unit.length * 64);
    for (let j = 0; j < 64; j++) k1.set(unit, j * unit.length);
    const e = await aesEncryptNoPad(k.subarray(0, 16), k.subarray(16, 32), k1);
    let sum = 0;
    for (let j = 0; j < 16; j++) sum += e[j];
    const alg = (["SHA-256", "SHA-384", "SHA-512"] as const)[sum % 3];
    k = await digest(alg, e);
    if (i >= 63 && e[e.length - 1] <= i - 31) break;
  }
  return k.subarray(0, 32);
}

async function authenticateR6(params: EncryptParams, password: string): Promise<Uint8Array | null> {
  const pw = new TextEncoder().encode(password).subarray(0, 127);
  const { u, o, ue, oe, r } = params;
  if (u.length < 48 || o.length < 48) return null;
  const zeroIv = new Uint8Array(16);

  if (equalBytes(await hashR6(r, pw, u.subarray(32, 40), new Uint8Array(0)), u.subarray(0, 32))) {
    if (!ue || ue.length < 32) return null;
    const ik = await hashR6(r, pw, u.subarray(40, 48), new Uint8Array(0));
    return aesDecryptNoPad(ik, zeroIv, ue.subarray(0, 32));
  }
  const u48 = u.subarray(0, 48);
  if (equalBytes(await hashR6(r, pw, o.subarray(32, 40), u48), o.subarray(0, 32))) {
    if (!oe || oe.length < 32) return null;
    const ik = await hashR6(r, pw, o.subarray(40, 48), u48);
    return aesDecryptNoPad(ik, zeroIv, oe.subarray(0, 32));
  }
  return null;
}

async function buildHandler(params: EncryptParams, password: string): Promise<Handler | null> {
  const key = params.v === 5 ? await authenticateR6(params, password) : authenticateR4(params, latin1(password));
  if (!key) return null;
  return { key, stream: params.stream, string: params.string, encryptMetadata: params.encryptMetadata };
}

/** Algorithm 1: kunci per objek untuk RC4 / AES-128. */
function objectKey(handler: Handler, ref: PDFRef, aes: boolean): Uint8Array {
  const { key } = handler;
  const extra = [
    ref.objectNumber & 0xff,
    (ref.objectNumber >> 8) & 0xff,
    (ref.objectNumber >> 16) & 0xff,
    ref.generationNumber & 0xff,
    (ref.generationNumber >> 8) & 0xff,
  ];
  const salt = aes ? [0x73, 0x41, 0x6c, 0x54] : [];
  return md5(concat(key, new Uint8Array(extra), new Uint8Array(salt))).subarray(0, Math.min(key.length + 5, 16));
}

async function decryptData(handler: Handler, kind: CipherKind, ref: PDFRef, data: Uint8Array): Promise<Uint8Array> {
  switch (kind) {
    case "none":
      return data;
    case "rc4":
      return rc4(objectKey(handler, ref, false), data);
    case "aes128":
      return aesDecryptPdf(objectKey(handler, ref, true), data);
    case "aes256":
      return aesDecryptPdf(handler.key, data);
  }
}

// ---------------------------------------------------------------------------
// Dekripsi objek

const N = {
  Type: PDFName.of("Type"),
  XRef: PDFName.of("XRef"),
  ObjStm: PDFName.of("ObjStm"),
  Metadata: PDFName.of("Metadata"),
  Filter: PDFName.of("Filter"),
  Crypt: PDFName.of("Crypt"),
  Length: PDFName.of("Length"),
} as const;

function toHex(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += bytes[i].toString(16).padStart(2, "0");
  return s;
}

/** Dekripsi semua string di dalam objek (rekursif). Mengembalikan objek pengganti. */
async function decryptStrings(handler: Handler, ref: PDFRef, obj: PDFObject): Promise<PDFObject> {
  if (obj instanceof PDFString || obj instanceof PDFHexString) {
    const plain = await decryptData(handler, handler.string, ref, pdfStringBytes(obj));
    return PDFHexString.of(toHex(plain));
  }
  if (obj instanceof PDFDict) {
    for (const [key, value] of obj.entries()) {
      const next = await decryptStrings(handler, ref, value);
      if (next !== value) obj.set(key, next);
    }
    return obj;
  }
  if (obj instanceof PDFArray) {
    for (let i = 0; i < obj.size(); i++) {
      const value = obj.get(i);
      const next = await decryptStrings(handler, ref, value);
      if (next !== value) obj.set(i, next);
    }
    return obj;
  }
  return obj;
}

function hasCryptFilter(dict: PDFDict): boolean {
  const f = dict.get(N.Filter);
  if (f === N.Crypt) return true;
  return f instanceof PDFArray && f.asArray().some((x) => x === N.Crypt);
}

class UnsupportedEncryption extends Error {}

async function decryptStream(handler: Handler, ref: PDFRef, stream: PDFRawStream): Promise<PDFRawStream> {
  const { dict } = stream;
  await decryptStrings(handler, ref, dict);
  // Filter /Crypt per stream (jarang sekali) tidak didukung.
  if (hasCryptFilter(dict)) throw new UnsupportedEncryption("crypt filter per stream");
  if (dict.get(N.Type) === N.Metadata && !handler.encryptMetadata) return stream;
  const plain = await decryptData(handler, handler.stream, ref, stream.contents);
  // /Length lama (bisa berupa ref) tidak lagi cocok; pdf-lib menulis ulang saat menyimpan.
  dict.delete(N.Length);
  return PDFRawStream.of(dict, plain);
}

// ---------------------------------------------------------------------------
// Parser

const YIELD_AFTER_BYTES = 1024 * 1024;

function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

const ENDOBJ = [0x65, 0x6e, 0x64, 0x6f, 0x62, 0x6a];

/** Bagian internal PDFParser yang dipakai (private di deklarasi tipe pdf-lib). */
interface ParserInternals {
  context: PDFContext;
  shouldWaitForTick: () => boolean;
  parseIndirectObjectHeader(): PDFRef;
  skipWhitespaceAndComments(): void;
  parseObject(): PDFObject;
  matchKeyword(keyword: number[]): boolean;
  parseIndirectObject: () => Promise<PDFRef>;
  parseDocument(): Promise<PDFContext>;
}

type ObjectHook = (parser: ParserInternals, ref: PDFRef, obj: PDFObject) => Promise<void>;

async function parseWith(bytes: Uint8Array, hook: ObjectHook): Promise<PDFContext> {
  const parser = PDFParser.forBytesWithOptions(bytes, 1500, false, false) as unknown as ParserInternals;
  parser.parseIndirectObject = async function (this: ParserInternals) {
    const ref = this.parseIndirectObjectHeader();
    this.skipWhitespaceAndComments();
    const obj = this.parseObject();
    this.skipWhitespaceAndComments();
    this.matchKeyword(ENDOBJ);
    if (obj instanceof PDFRawStream && obj.dict.get(N.Type) === N.XRef) {
      // Stream xref tidak pernah dienkripsi.
      PDFXRefStreamParser.forStream(obj).parseIntoContext();
      return ref;
    }
    await hook(this, ref, obj);
    return ref;
  }.bind(parser);
  return parser.parseDocument();
}

/** Kunci berkas dari dictionary /Encrypt, atau null (password salah / tidak didukung). */
async function readHandler(bytes: Uint8Array, password: string): Promise<{ handler: Handler; encryptRef?: PDFRef } | null> {
  // Lintasan 1: cukup untuk membaca trailer & /Encrypt (object stream tidak diurai).
  const ctx = await parseWith(bytes, async (parser, ref, obj) => {
    parser.context.assign(ref, obj);
  });
  const enc = ctx.trailerInfo.Encrypt;
  const dict = enc instanceof PDFRef ? ctx.lookup(enc) : enc;
  if (!(dict instanceof PDFDict)) return null;
  const params = readEncryptParams(dict, ctx.trailerInfo.ID);
  if (!params) return null;
  const handler = await buildHandler(params, password);
  if (!handler) return null;
  return { handler, encryptRef: enc instanceof PDFRef ? enc : undefined };
}

/**
 * Muat PDF terenkripsi sebagai dokumen pdf-lib tanpa enkripsi. `null` bila
 * password salah, metode enkripsinya tidak didukung, atau hasilnya tampak rusak.
 */
export async function loadDecrypted(bytes: Uint8Array, password = ""): Promise<PDFDocument | null> {
  try {
    const found = await readHandler(bytes, password);
    if (!found) return null;
    const { handler, encryptRef } = found;

    const ctx = await parseWith(bytes, async (parser, ref, obj) => {
      if (encryptRef && ref === encryptRef) {
        parser.context.assign(ref, obj);
        return;
      }
      if (obj instanceof PDFRawStream) {
        const plain = await decryptStream(handler, ref, obj);
        // Dekripsi berjalan di main thread; beri jeda setelah stream besar supaya
        // progres & tombol Batal tetap responsif di HP.
        if (obj.contents.length > YIELD_AFTER_BYTES) await yieldToBrowser();
        if (plain.dict.get(N.Type) === N.ObjStm) {
          // Objek di dalam object stream tidak dienkripsi terpisah.
          await PDFObjectStreamParser.forStream(plain, parser.shouldWaitForTick).parseIntoContext();
          return;
        }
        parser.context.assign(ref, plain);
        return;
      }
      parser.context.assign(ref, await decryptStrings(handler, ref, obj));
    });

    if (encryptRef) ctx.delete(encryptRef);
    ctx.trailerInfo.Encrypt = undefined;

    // Konstruktor PDFDocument private di tipe pdf-lib, tapi inilah yang dipakai
    // PDFDocument.load() sendiri setelah parsing.
    const Ctor = PDFDocument as unknown as new (
      context: PDFContext,
      ignoreEncryption: boolean,
      updateMetadata: boolean,
    ) => PDFDocument;
    const doc = new Ctor(ctx, false, false);
    if (doc.getPageCount() < 1 || !looksDecrypted(doc)) return null;
    return doc;
  } catch {
    return null;
  }
}

/** Uji kewarasan: content stream halaman pertama harus bisa dibaca. */
function looksDecrypted(doc: PDFDocument): boolean {
  const page = doc.getPages()[0];
  const contents = page.node.Contents();
  const streams: PDFObject[] = contents instanceof PDFArray ? contents.asArray() : contents ? [contents] : [];
  for (const s of streams) {
    const stream = s instanceof PDFRef ? doc.context.lookup(s) : s;
    if (!(stream instanceof PDFStream)) continue;
    if (!(stream instanceof PDFRawStream)) return true;
    let data: Uint8Array;
    try {
      data = decodePDFRawStream(stream).decode();
    } catch {
      return false;
    }
    if (data.length === 0) continue;
    // Operator konten PDF hampir seluruhnya ASCII; hasil dekripsi yang salah tidak.
    const sample = data.subarray(0, 512);
    let ascii = 0;
    for (const b of sample) if (b === 9 || b === 10 || b === 13 || (b >= 32 && b < 127)) ascii++;
    return ascii / sample.length > 0.9;
  }
  return true;
}
