// Membalik predictor PNG (10-15) dan TIFF (2) pada data hasil FlateDecode.
// Modul murni: tidak menyentuh DOM, jadi bisa diuji langsung di node.

export interface PredictorOptions {
  predictor: number;
  colors: number;
  bitsPerComponent: number;
  columns: number;
}

/** Jumlah byte per baris piksel tanpa byte filter PNG. */
export function rowBytes(opts: { colors: number; bitsPerComponent: number; columns: number }): number {
  return Math.ceil((opts.colors * opts.bitsPerComponent * opts.columns) / 8);
}

export function undoPredictor(data: Uint8Array, opts: PredictorOptions): Uint8Array {
  const { predictor } = opts;
  if (!Number.isFinite(predictor) || predictor <= 1) return data;

  const colors = opts.colors || 1;
  const bpc = opts.bitsPerComponent || 8;
  const columns = opts.columns || 1;
  if (colors < 1 || columns < 1 || ![1, 2, 4, 8, 16].includes(bpc)) {
    throw new Error(`Predictor: parameter tidak valid (colors=${colors}, bpc=${bpc}, columns=${columns})`);
  }

  if (predictor === 2) return undoTiff(data, colors, bpc, columns);
  if (predictor >= 10 && predictor <= 15) return undoPng(data, colors, bpc, columns);
  throw new Error(`Predictor ${predictor} tidak didukung`);
}

function undoPng(data: Uint8Array, colors: number, bpc: number, columns: number): Uint8Array {
  const rowLen = rowBytes({ colors, bitsPerComponent: bpc, columns });
  const bpp = Math.max(1, Math.ceil((colors * bpc) / 8));
  const rows = Math.floor(data.length / (rowLen + 1));
  const out = new Uint8Array(rows * rowLen);

  for (let r = 0; r < rows; r++) {
    const src = r * (rowLen + 1);
    const filter = data[src];
    const dst = r * rowLen;
    const prev = dst - rowLen; // baris sebelumnya di `out` (negatif = tidak ada)

    switch (filter) {
      case 0: // None
        out.set(data.subarray(src + 1, src + 1 + rowLen), dst);
        break;
      case 1: // Sub
        for (let i = 0; i < rowLen; i++) {
          const left = i >= bpp ? out[dst + i - bpp] : 0;
          out[dst + i] = (data[src + 1 + i] + left) & 0xff;
        }
        break;
      case 2: // Up
        for (let i = 0; i < rowLen; i++) {
          const up = r > 0 ? out[prev + i] : 0;
          out[dst + i] = (data[src + 1 + i] + up) & 0xff;
        }
        break;
      case 3: // Average
        for (let i = 0; i < rowLen; i++) {
          const left = i >= bpp ? out[dst + i - bpp] : 0;
          const up = r > 0 ? out[prev + i] : 0;
          out[dst + i] = (data[src + 1 + i] + ((left + up) >> 1)) & 0xff;
        }
        break;
      case 4: // Paeth
        for (let i = 0; i < rowLen; i++) {
          const a = i >= bpp ? out[dst + i - bpp] : 0;
          const b = r > 0 ? out[prev + i] : 0;
          const c = r > 0 && i >= bpp ? out[prev + i - bpp] : 0;
          out[dst + i] = (data[src + 1 + i] + paeth(a, b, c)) & 0xff;
        }
        break;
      default:
        throw new Error(`Filter PNG ${filter} di baris ${r} tidak dikenal`);
    }
  }
  return out;
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function undoTiff(data: Uint8Array, colors: number, bpc: number, columns: number): Uint8Array {
  const rowLen = rowBytes({ colors, bitsPerComponent: bpc, columns });
  const rows = Math.floor(data.length / rowLen);
  const out = data.slice(0, rows * rowLen);

  for (let r = 0; r < rows; r++) {
    const start = r * rowLen;
    if (bpc === 8) {
      for (let i = colors; i < rowLen; i++) {
        out[start + i] = (out[start + i] + out[start + i - colors]) & 0xff;
      }
    } else if (bpc === 16) {
      const step = colors * 2;
      for (let i = step; i + 1 < rowLen; i += 2) {
        const cur = (out[start + i] << 8) | out[start + i + 1];
        const left = (out[start + i - step] << 8) | out[start + i - step + 1];
        const sum = (cur + left) & 0xffff;
        out[start + i] = sum >> 8;
        out[start + i + 1] = sum & 0xff;
      }
    } else {
      undoTiffSubByteRow(out, start, colors, bpc, columns);
    }
  }
  return out;
}

// bpc 1/2/4: sampel dikemas dalam byte, prediksi per komponen.
function undoTiffSubByteRow(buf: Uint8Array, start: number, colors: number, bpc: number, columns: number): void {
  const mask = (1 << bpc) - 1;
  const read = (idx: number): number => {
    const bit = idx * bpc;
    const byte = buf[start + (bit >> 3)];
    const shift = 8 - bpc - (bit & 7);
    return (byte >> shift) & mask;
  };
  const write = (idx: number, v: number): void => {
    const bit = idx * bpc;
    const pos = start + (bit >> 3);
    const shift = 8 - bpc - (bit & 7);
    buf[pos] = (buf[pos] & ~(mask << shift)) | ((v & mask) << shift);
  };
  const samples = colors * columns;
  for (let s = colors; s < samples; s++) {
    write(s, read(s) + read(s - colors));
  }
}
