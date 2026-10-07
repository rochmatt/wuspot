import { describe, expect, it } from "vitest";
import { formatBytes, outputFileName, parseSizeInput, savedPercent } from "../format";

const KB = 1024;
const MB = 1024 * 1024;

describe("formatBytes", () => {
  it.each([
    [0, "0 B"],
    [-5, "0 B"],
    [Number.NaN, "0 B"],
    [1, "1 B"],
    [512, "512 B"],
    [1023, "1023 B"],
    [1024, "1 KB"],
    [1536, "1,5 KB"],
    [Math.floor(9.8 * KB), "9,8 KB"],
    [10 * KB, "10 KB"],
    [187 * KB, "187 KB"],
    [200 * KB, "200 KB"],
    [1023 * KB, "1.023 KB"],
    [MB, "1 MB"],
    [Math.floor(2.4 * MB), "2,4 MB"],
    [12.5 * MB, "12,5 MB"],
    [150 * MB, "150 MB"],
    [1024 * MB, "1 GB"],
  ])("%d -> %s", (bytes, expected) => {
    expect(formatBytes(bytes)).toBe(expected);
  });

  it("membulatkan ke atas supaya file yang lewat batas tidak tampak muat", () => {
    expect(formatBytes(200 * KB)).toBe("200 KB");
    expect(formatBytes(200 * KB + 1)).toBe("201 KB");
    expect(formatBytes(100 * KB - 1)).toBe("100 KB");
    expect(formatBytes(MB + 1)).toBe("1,1 MB");
    expect(formatBytes(1536 + 1)).toBe("1,6 KB");
  });

  it("tidak pernah menampilkan 1024 KB atau 1024 MB", () => {
    expect(formatBytes(MB - 1)).toBe("1 MB");
    expect(formatBytes(1024 * MB - 1)).toBe("1 GB");
  });

  it("desimal memakai koma, ribuan memakai titik", () => {
    expect(formatBytes(1000 * KB)).toBe("1.000 KB");
    expect(formatBytes(3.75 * MB)).toBe("3,8 MB");
    expect(formatBytes(3 * MB)).toBe("3 MB");
  });
});

describe("parseSizeInput", () => {
  it.each([
    ["200", 200 * KB],
    ["200kb", 200 * KB],
    ["200 KB", 200 * KB],
    [" 300 kB ", 300 * KB],
    ["200k", 200 * KB],
    ["500 kilobyte", 500 * KB],
    ["1,5 MB", 1.5 * MB],
    ["1.5mb", 1.5 * MB],
    ["1 MB", MB],
    ["1m", MB],
    ["0,5 mb", 0.5 * MB],
    [",5 mb", 0.5 * MB],
    ["2 megabyte", 2 * MB],
    ["204800 b", 204800],
    ["204.800 byte", 204800],
    ["1.500 KB", 1500 * KB],
    ["1,500 KB", 1500 * KB],
    ["1.500 MB", 1.5 * MB],
    ["1,5", Math.round(1.5 * KB)],
    ["1.234,5 kb", Math.round(1234.5 * KB)],
    ["1,234.5 kb", Math.round(1234.5 * KB)],
    ["1.234.567 b", 1234567],
    ["1 gb", 1024 * MB],
  ])("%j -> %d", (input, expected) => {
    expect(parseSizeInput(input)).toBe(expected);
  });

  it.each([
    "",
    "   ",
    "abc",
    "kb",
    "0",
    "0 kb",
    "-200",
    "200 tb",
    "200 kb lagi",
    "1.2.3",
    "1,2,3",
    "1.,5",
    "1,23.4,5",
    "2e3",
    ".",
    "200 k b",
  ])("%j -> null", (input) => {
    expect(parseSizeInput(input)).toBeNull();
  });

  it("selalu bilangan bulat byte", () => {
    for (const s of ["1,3 kb", "0,7 mb", "123,456 kb"]) {
      const v = parseSizeInput(s);
      expect(v).not.toBeNull();
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it("bolak-balik dengan formatBytes untuk target umum", () => {
    for (const label of ["100 KB", "200 KB", "300 KB", "500 KB", "1 MB"]) {
      expect(formatBytes(parseSizeInput(label)!)).toBe(label);
    }
  });
});

describe("savedPercent", () => {
  it.each([
    [1000, 250, 75],
    [1000, 1000, 0],
    [1000, 0, 100],
    [1000, 999, 0],
    [1000, 1, 99],
    [3 * MB, 190 * KB, 93],
    [1000, 1200, 0],
    [0, 0, 0],
    [-1, 0, 0],
    [1000, Number.NaN, 0],
  ])("(%d, %d) -> %d", (original, output, expected) => {
    expect(savedPercent(original, output)).toBe(expected);
  });
});

describe("outputFileName", () => {
  it.each([
    ["ijazah.pdf", "ijazah-kompres.pdf"],
    ["IJAZAH.PDF", "IJAZAH-kompres.pdf"],
    ["scan ktp.pdf", "scan ktp-kompres.pdf"],
    ["transkrip nilai", "transkrip nilai-kompres.pdf"],
    ["laporan.v2.pdf", "laporan.v2-kompres.pdf"],
    ["C:\\fakepath\\ktp.pdf", "ktp-kompres.pdf"],
    ["/home/budi/Unduhan/sertifikat.pdf", "sertifikat-kompres.pdf"],
    ["", "dokumen-kompres.pdf"],
    [".pdf", "dokumen-kompres.pdf"],
    ["   .pdf  ", "dokumen-kompres.pdf"],
    ["ijazah-kompres.pdf", "ijazah-kompres.pdf"],
    ['a<b>:c"d|e?f*g.pdf', "a_b_c_d_e_f_g-kompres.pdf"],
    ["tab\there.pdf", "tab here-kompres.pdf"],
    ["..rahasia..pdf", "rahasia-kompres.pdf"],
  ])("%j -> %j", (input, expected) => {
    expect(outputFileName(input)).toBe(expected);
  });

  it("memotong nama yang terlalu panjang", () => {
    const out = outputFileName(`${"a".repeat(300)}.pdf`);
    expect(out.endsWith("-kompres.pdf")).toBe(true);
    expect(out.length).toBeLessThanOrEqual(120 + "-kompres.pdf".length);
  });
});
