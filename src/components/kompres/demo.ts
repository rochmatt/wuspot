// Data palsu untuk ?demo=… (HANYA mode pengembangan). Dipakai untuk memotret
// tiap keadaan alat tanpa file sungguhan. Tidak ikut ke build produksi.

import type { CompressResult } from "@/lib/pdf-compress/types";
import type { DemoView } from "./KompresTool";

const FILE = { name: "scan_ijazah_dan_transkrip_2024.pdf", size: 2_516_582 };

function fakeResult(out: number, extra: Partial<CompressResult>): { result: CompressResult; url: string } {
  const blob = new Blob([new Uint8Array(32)], { type: "application/pdf" });
  return {
    url: URL.createObjectURL(blob),
    result: {
      blob,
      originalBytes: FILE.size,
      outputBytes: out,
      pageCount: 12,
      strategy: "rasterize",
      textPreserved: false,
      targetMet: true,
      settings: { dpi: 110, quality: 0.62 },
      notes: [],
      ...extra,
    },
  };
}

export function makeDemo(name: string): DemoView | null {
  switch (name) {
    case "idle":
      return { file: null, status: { name: "idle" } };
    case "chosen":
      return { file: FILE, status: { name: "idle" } };
    case "working":
      return {
        file: FILE,
        status: { name: "working", progress: { stage: "mengompres", ratio: 0.42, detail: "Halaman 3 dari 12" } },
      };
    case "password":
      return { file: FILE, status: { name: "needs-password", wrong: true } };
    case "done": {
      const { result, url } = fakeResult(191_488, {
        notes: ["Halaman 4 berisi foto berwarna, jadi sedikit lebih lembut dari halaman lain."],
      });
      return {
        file: FILE,
        mode: { kind: "target", kb: 200 },
        status: {
          name: "done",
          result,
          url,
          fileName: "scan_ijazah_dan_transkrip_2024-kompres.pdf",
          mode: { kind: "target", kb: 200 },
          grayscale: false,
        },
      };
    }
    case "partial": {
      const { result, url } = fakeResult(146_022, {
        targetMet: false,
        // catatan mesin apa adanya: yang mengulang vonis disaring oleh panel hasil
        notes: [
          "Target 97 KB belum tercapai. Hasil terkecil 143 KB.",
          "Coba kirim halaman yang diminta saja atau pisahkan jadi beberapa file.",
          "Resolusinya sudah diturunkan sampai batas terendah. Perbesar dan cek dulu tulisan kecil dan angkanya masih kebaca.",
        ],
      });
      return {
        file: FILE,
        mode: { kind: "target", kb: 100 },
        status: {
          name: "done",
          result,
          url,
          fileName: "scan_ijazah_dan_transkrip_2024-kompres.pdf",
          mode: { kind: "target", kb: 100 },
          grayscale: false,
        },
      };
    }
    case "error":
      return {
        file: null,
        status: {
          name: "error",
          code: "corrupt",
          message:
            "PDF ini rusak atau nggak lengkap, jadi nggak bisa dibuka. Coba unduh atau simpan ulang file aslinya.",
        },
      };
    default:
      return null;
  }
}
