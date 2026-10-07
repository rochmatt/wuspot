// Format angka & nama file untuk tampilan (bahasa Indonesia). Murni, tanpa DOM.
// 1 KB = 1024 byte, 1 MB = 1024 KB.

const KB = 1024;
const MB = KB * 1024;
const GB = MB * 1024;

/** Angka dengan koma desimal dan titik ribuan: 1234.5 -> "1.234,5". */
function idNumber(value: number, decimals: number): string {
  const [int, frac] = value.toFixed(decimals).split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  if (!frac || /^0+$/.test(frac)) return grouped;
  return `${grouped},${frac.replace(/0+$/, "")}`;
}

/**
 * Pembulatan ke atas pada `decimals` digit. Sengaja ke atas: file 200,3 KB
 * tidak boleh tampil "200 KB" kalau batas unggahnya 200 KB.
 */
function ceilTo(bytes: number, unit: number, decimals: number): number {
  const f = 10 ** decimals;
  // bytes * f / unit tepat (unit pangkat 2), jadi tidak ada galat floating.
  return Math.ceil((bytes * f) / unit) / f;
}

/** 191488 -> "187 KB", 2516582 -> "2,4 MB", 512 -> "512 B". */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const b = Math.ceil(bytes);
  if (b < KB) return `${b} B`;

  const kb = ceilTo(b, KB, b < 10 * KB ? 1 : 0);
  if (kb < 1024) return `${idNumber(kb, 1)} KB`;

  const mbDecimals = b < 100 * MB ? 1 : 0;
  const mb = ceilTo(b, MB, mbDecimals);
  if (mb < 1024) return `${idNumber(mb, mbDecimals)} MB`;

  const gbDecimals = b < 100 * GB ? 1 : 0;
  return `${idNumber(ceilTo(b, GB, gbDecimals), gbDecimals)} GB`;
}

const UNIT_BYTES: Record<string, number> = {
  "": KB, // angka saja = KB, karena batas unggah hampir selalu ditulis dalam KB
  b: 1,
  byte: 1,
  bytes: 1,
  bita: 1,
  k: KB,
  kb: KB,
  kib: KB,
  kbyte: KB,
  kilo: KB,
  kilobyte: KB,
  kilobytes: KB,
  kilobita: KB,
  m: MB,
  mb: MB,
  mib: MB,
  mbyte: MB,
  mega: MB,
  megabyte: MB,
  megabytes: MB,
  megabita: MB,
  g: GB,
  gb: GB,
  gib: GB,
  gigabyte: GB,
};

/** "1.234.567" -> "1234567"; null bila pengelompokan ribuannya tidak wajar. */
function ungroup(intPart: string, sep: string): string | null {
  const groups = intPart.split(sep);
  if (!/^\d{1,3}$/.test(groups[0])) return null;
  if (!groups.slice(1).every((g) => /^\d{3}$/.test(g))) return null;
  return groups.join("");
}

/**
 * Tafsirkan angka berformat Indonesia atau Inggris.
 * - "1,5" / "1.5" -> 1.5
 * - "1.234,5" / "1,234.5" -> pemisah terakhir = desimal, lainnya = ribuan
 * - "1.234.567" -> 1234567
 * - "1.500" / "1,500" -> 1500 bila `preferThousands` (satuan KB/byte; 1,5 KB
 *   tidak masuk akal sebagai target), 1.5 bila tidak (MB/GB)
 */
function parseLooseNumber(raw: string, preferThousands: boolean): number | null {
  if (/^\d+$/.test(raw)) return Number(raw);
  if (!/^\d*(?:[.,]\d*)+$/.test(raw)) return null;

  const lastSep = Math.max(raw.lastIndexOf("."), raw.lastIndexOf(","));
  const sepChar = raw[lastSep];
  const otherChar = sepChar === "." ? "," : ".";
  const head = raw.slice(0, lastSep);
  const tail = raw.slice(lastSep + 1);
  const sameCount = raw.split(sepChar).length - 1;

  let intDigits: string | null;
  let fracDigits = "";
  if (head.includes(otherChar)) {
    // Dua jenis pemisah: yang terakhir desimal.
    if (sameCount > 1) return null;
    intDigits = ungroup(head, otherChar);
    fracDigits = tail;
  } else if (sameCount > 1) {
    // "1.234.567": hanya pengelompokan ribuan.
    intDigits = ungroup(raw, sepChar);
  } else {
    const grouped = preferThousands && tail.length === 3 && /^[1-9]\d{0,2}$/.test(head);
    if (grouped) {
      intDigits = head + tail;
    } else {
      intDigits = head === "" ? "0" : head;
      fracDigits = tail;
    }
  }
  if (intDigits === null || !/^\d+$/.test(intDigits) || !/^\d*$/.test(fracDigits)) return null;
  const v = Number(fracDigits ? `${intDigits}.${fracDigits}` : intDigits);
  return Number.isFinite(v) ? v : null;
}

/**
 * "200" -> 204800, "200kb" -> 204800, "1,5 MB" -> 1572864.
 * Angka tanpa satuan dianggap KB. Mengembalikan null bila tidak bisa dibaca
 * atau nilainya nol/negatif.
 */
export function parseSizeInput(input: string): number | null {
  const m = /^([\d.,]+)\s*([a-z]*)$/.exec(input.trim().toLowerCase().replace(/\s+/g, " "));
  if (!m) return null;
  const unit = UNIT_BYTES[m[2]];
  if (unit === undefined) return null;
  const value = parseLooseNumber(m[1], unit <= KB);
  if (value === null || value <= 0) return null;
  const bytes = Math.round(value * unit);
  return bytes > 0 && Number.isSafeInteger(bytes) ? bytes : null;
}

/** Persentase penghematan, dibulatkan ke bawah, 0..100. (1000, 250) -> 75. */
export function savedPercent(original: number, output: number): number {
  if (!(original > 0) || !Number.isFinite(output)) return 0;
  const pct = Math.floor(((original - output) / original) * 100);
  return Math.min(100, Math.max(0, pct));
}

const SUFFIX = "-kompres";
const MAX_BASE_LENGTH = 120;

/** "ijazah.pdf" -> "ijazah-kompres.pdf". Membuang folder & karakter terlarang. */
export function outputFileName(inputName: string): string {
  const leaf = inputName.split(/[\\/]/).pop() ?? "";
  let base = leaf
    .replace(/\.pdf\s*$/i, "")
    .replace(/\s+/g, " ")
    // Karakter yang ditolak Windows/Android saat menyimpan file.
    .replace(/[\u0000-\u001f\u007f<>:"|?*]+/g, "_")
    .trim()
    .replace(/^\.+|\.+$/g, "");
  if (base.length > MAX_BASE_LENGTH) base = base.slice(0, MAX_BASE_LENGTH).trim();
  if (!base) base = "dokumen";
  if (base.toLowerCase().endsWith(SUFFIX)) return `${base}.pdf`;
  return `${base}${SUFFIX}.pdf`;
}
