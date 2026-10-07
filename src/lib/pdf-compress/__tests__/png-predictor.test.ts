import { describe, expect, it } from "vitest";
import { rowBytes, undoPredictor } from "../png-predictor";

// Encoder referensi (kebalikan dari undoPredictor) supaya bisa uji bolak-balik.
function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function encodePng(raw: Uint8Array, rowLen: number, bpp: number, filters: number[]): Uint8Array {
  const rows = raw.length / rowLen;
  const out = new Uint8Array(rows * (rowLen + 1));
  for (let r = 0; r < rows; r++) {
    const f = filters[r % filters.length];
    out[r * (rowLen + 1)] = f;
    for (let i = 0; i < rowLen; i++) {
      const x = raw[r * rowLen + i];
      const a = i >= bpp ? raw[r * rowLen + i - bpp] : 0;
      const b = r > 0 ? raw[(r - 1) * rowLen + i] : 0;
      const c = r > 0 && i >= bpp ? raw[(r - 1) * rowLen + i - bpp] : 0;
      let pred = 0;
      if (f === 1) pred = a;
      else if (f === 2) pred = b;
      else if (f === 3) pred = (a + b) >> 1;
      else if (f === 4) pred = paeth(a, b, c);
      out[r * (rowLen + 1) + 1 + i] = (x - pred) & 0xff;
    }
  }
  return out;
}

function encodeTiff8(raw: Uint8Array, rowLen: number, colors: number): Uint8Array {
  const out = raw.slice();
  for (let start = 0; start < raw.length; start += rowLen) {
    for (let i = colors; i < rowLen; i++) {
      out[start + i] = (raw[start + i] - raw[start + i - colors]) & 0xff;
    }
  }
  return out;
}

function pseudoRandom(n: number, seed = 1): Uint8Array {
  const out = new Uint8Array(n);
  let s = seed;
  for (let i = 0; i < n; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    // campuran gradasi + noise supaya semua cabang paeth terpakai
    out[i] = ((i * 7) ^ (s >> 16)) & 0xff;
  }
  return out;
}

describe("undoPredictor", () => {
  it("mengembalikan data apa adanya untuk predictor 1", () => {
    const data = new Uint8Array([1, 2, 3]);
    expect(undoPredictor(data, { predictor: 1, colors: 1, bitsPerComponent: 8, columns: 3 })).toBe(data);
  });

  it("membalik contoh kecil yang dihitung manual", () => {
    // 2 baris x 3 piksel, gray 8-bit. Baris 0 filter Sub, baris 1 filter Up.
    const encoded = new Uint8Array([1, 10, 5, 5, 2, 1, 1, 1]);
    const out = undoPredictor(encoded, { predictor: 15, colors: 1, bitsPerComponent: 8, columns: 3 });
    expect(Array.from(out)).toEqual([10, 15, 20, 11, 16, 21]);
  });

  for (const colors of [1, 3, 4]) {
    for (const filter of [0, 1, 2, 3, 4]) {
      it(`PNG filter ${filter}, ${colors} komponen, bolak-balik`, () => {
        const columns = 37;
        const rows = 11;
        const rowLen = rowBytes({ colors, bitsPerComponent: 8, columns });
        const raw = pseudoRandom(rowLen * rows, colors * 10 + filter);
        const encoded = encodePng(raw, rowLen, colors, [filter]);
        const out = undoPredictor(encoded, { predictor: 10 + filter, colors, bitsPerComponent: 8, columns });
        expect(out).toEqual(raw);
      });
    }
  }

  it("PNG dengan filter campuran per baris (predictor 15)", () => {
    const columns = 64;
    const rowLen = rowBytes({ colors: 3, bitsPerComponent: 8, columns });
    const raw = pseudoRandom(rowLen * 20, 99);
    const encoded = encodePng(raw, rowLen, 3, [4, 0, 1, 2, 3, 4, 4, 2]);
    expect(undoPredictor(encoded, { predictor: 15, colors: 3, bitsPerComponent: 8, columns })).toEqual(raw);
  });

  it("PNG 16-bit memakai bpp 2 per komponen", () => {
    const columns = 9;
    const rowLen = rowBytes({ colors: 1, bitsPerComponent: 16, columns });
    expect(rowLen).toBe(18);
    const raw = pseudoRandom(rowLen * 5, 5);
    const encoded = encodePng(raw, rowLen, 2, [1, 4, 3]);
    expect(undoPredictor(encoded, { predictor: 12, colors: 1, bitsPerComponent: 16, columns })).toEqual(raw);
  });

  it("mengabaikan baris terakhir yang terpotong", () => {
    const columns = 4;
    const raw = pseudoRandom(4 * 3, 3);
    const encoded = encodePng(raw, 4, 1, [2]);
    const truncated = encoded.subarray(0, encoded.length - 2);
    const out = undoPredictor(truncated, { predictor: 12, colors: 1, bitsPerComponent: 8, columns });
    expect(out).toEqual(raw.subarray(0, 8));
  });

  it("melempar error untuk tipe filter PNG yang tidak dikenal", () => {
    const encoded = new Uint8Array([7, 1, 2, 3]);
    expect(() => undoPredictor(encoded, { predictor: 15, colors: 1, bitsPerComponent: 8, columns: 3 })).toThrow();
  });

  it("TIFF predictor 2, RGB 8-bit, bolak-balik", () => {
    const columns = 25;
    const rowLen = rowBytes({ colors: 3, bitsPerComponent: 8, columns });
    const raw = pseudoRandom(rowLen * 7, 42);
    const encoded = encodeTiff8(raw, rowLen, 3);
    expect(undoPredictor(encoded, { predictor: 2, colors: 3, bitsPerComponent: 8, columns })).toEqual(raw);
  });

  it("TIFF predictor 2 tidak mengubah buffer input", () => {
    const encoded = new Uint8Array([1, 1, 1, 1]);
    const copy = encoded.slice();
    const out = undoPredictor(encoded, { predictor: 2, colors: 1, bitsPerComponent: 8, columns: 4 });
    expect(Array.from(out)).toEqual([1, 2, 3, 4]);
    expect(encoded).toEqual(copy);
  });

  it("TIFF predictor 2, 4-bit gray", () => {
    // sampel asli 1,2,3,4 -> beda 1,1,1,1 -> dikemas 0x11 0x11
    const out = undoPredictor(new Uint8Array([0x11, 0x11]), { predictor: 2, colors: 1, bitsPerComponent: 4, columns: 4 });
    expect(Array.from(out)).toEqual([0x12, 0x34]);
  });

  it("menolak predictor yang tidak dikenal", () => {
    expect(() => undoPredictor(new Uint8Array(4), { predictor: 7, colors: 1, bitsPerComponent: 8, columns: 4 })).toThrow();
  });
});
