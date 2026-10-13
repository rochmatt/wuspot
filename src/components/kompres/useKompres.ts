"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type {
  CompressLevel,
  CompressProgress,
  CompressResult,
  CompressErrorCode,
} from "@/lib/pdf-compress/types";
import { outputFileName } from "@/lib/pdf-compress/format";
import { targetBytesFromKb } from "@/content/kompres-pdf";

export type ModeChoice =
  | { kind: "target"; kb: number }
  | { kind: "level"; level: CompressLevel };

export type KompresStatus =
  /** `cancelled`: baru saja dibatalkan (diumumkan sekali ke pembaca layar). */
  | { name: "idle"; cancelled?: boolean }
  | { name: "working"; progress: CompressProgress }
  | { name: "needs-password"; wrong: boolean }
  /** `mode` + `grayscale` = setelan saat file ini dikompres, bukan pilihan yang sedang aktif. */
  | { name: "done"; result: CompressResult; url: string; fileName: string; mode: ModeChoice; grayscale: boolean }
  | { name: "error"; code: CompressErrorCode | "unknown"; message: string };

const PREF_KEY = "wuspot:kompres-pdf";

interface StoredPref {
  mode: ModeChoice;
  grayscale: boolean;
}

function parsePref(raw: string | null): StoredPref | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as StoredPref;
    if (p.mode?.kind === "target" && typeof p.mode.kb === "number" && p.mode.kb > 0) return p;
    if (p.mode?.kind === "level" && ["ringan", "sedang", "kuat"].includes(p.mode.level)) return p;
  } catch {
    // isi rusak — abaikan
  }
  return null;
}

// Pilihan terakhir dibaca sebagai "toko luar" (useSyncExternalStore): saat
// hidrasi React memakai nilai server (null), lalu langsung memakai isi
// localStorage tanpa setState di dalam effect. Hasil parse di-cache per string
// supaya snapshot-nya stabil.
let prefCache: { raw: string | null; value: StoredPref | null } = { raw: null, value: null };
function readPref(): StoredPref | null {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(PREF_KEY);
  } catch {
    // localStorage bisa diblokir (mode privat, WebView tertentu) — abaikan.
  }
  if (raw !== prefCache.raw) prefCache = { raw, value: parsePref(raw) };
  return prefCache.value;
}
const subscribePref = () => () => {};
const serverPref = () => null;

function writePref(p: StoredPref) {
  try {
    window.localStorage.setItem(PREF_KEY, JSON.stringify(p));
  } catch {
    // abaikan
  }
}

type Engine = typeof import("@/lib/pdf-compress");
let enginePromise: Promise<Engine> | null = null;
export function loadEngine(): Promise<Engine> {
  enginePromise ??= import("@/lib/pdf-compress").catch((e) => {
    enginePromise = null; // izinkan coba lagi kalau gagal karena koneksi
    throw e;
  });
  return enginePromise;
}

/**
 * Mesin (±185 KB, plus pembaca PDF) baru dimuat saat pengguna menunjukkan niat: menyentuh atau
 * memfokuskan tombol "Pilih file", menyeret file, atau sudah memilih file.
 * Pembaca yang cuma membaca halaman tidak ikut mengunduhnya. Di mode hemat
 * data / koneksi 2G–3G, tunggu sampai file benar-benar dipilih.
 */
export function warmEngine(force = false) {
  if (!force) {
    const c = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    if (c?.saveData || /(^|-)(2g|3g)$/.test(c?.effectiveType ?? "")) return;
  }
  // warmUp ikut memuat pdf.js sekarang, di luar alur kompres yang memegang isi
  // file (lihat src/lib/pdf-compress/pdfjs.ts soal memori).
  void loadEngine()
    .then((engine) => engine.warmUp())
    .catch(() => {});
}

const MESSAGES: Record<CompressErrorCode | "unknown", string> = {
  "not-pdf": "File ini bukan PDF. Pilih file yang namanya berakhiran .pdf.",
  "needs-password": "PDF ini dikunci password.",
  "wrong-password": "Password-nya belum cocok.",
  corrupt: "PDF ini rusak atau nggak lengkap, jadi nggak bisa dibuka. Coba unduh atau simpan ulang file aslinya.",
  "too-large": "File ini terlalu besar untuk diproses di browser (maksimal 150 MB).",
  aborted: "Dibatalkan.",
  unsupported: "Browser ini belum punya fitur yang dibutuhkan. Coba pakai Chrome atau Firefox versi terbaru.",
  "out-of-memory": "Memori HP atau laptopmu nggak cukup untuk file sebesar ini. Tutup aplikasi lain dulu, atau coba di laptop.",
  unknown: "Ada yang nggak beres waktu memproses file ini. Coba sekali lagi, atau pakai browser lain.",
};

export function useKompres(presetKb: number | null) {
  const [file, setFile] = useState<File | null>(null);
  // null = pengguna belum memilih sendiri di kunjungan ini.
  const [modeChoice, setMode] = useState<ModeChoice | null>(null);
  const [grayChoice, setGrayscale] = useState<boolean | null>(null);
  const [status, setStatus] = useState<KompresStatus>({ name: "idle" });
  const abortRef = useRef<AbortController | null>(null);
  const urlRef = useRef<string | null>(null);
  const passwordRef = useRef<string | undefined>(undefined);

  // Halaman preset (mis. /kompres-pdf-200kb) selalu mulai dari target-nya sendiri;
  // halaman utama memakai pilihan terakhir pengguna.
  const storedPref = useSyncExternalStore(subscribePref, readPref, serverPref);
  const pref = presetKb ? null : storedPref;
  const mode = useMemo<ModeChoice>(
    () =>
      modeChoice ??
      pref?.mode ??
      (presetKb ? { kind: "target", kb: presetKb } : { kind: "level", level: "sedang" }),
    [modeChoice, pref, presetKb],
  );
  const grayscale = grayChoice ?? pref?.grayscale ?? false;

  const revoke = useCallback(() => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
  }, []);

  useEffect(() => () => {
    abortRef.current?.abort();
    revoke();
  }, [revoke]);

  const run = useCallback(
    async (f: File, m: ModeChoice, gray: boolean) => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      revoke();
      setStatus({ name: "working", progress: { stage: "membaca", ratio: 0 } });
      writePref({ mode: m, grayscale: gray });

      try {
        const engine = await loadEngine();
        const result = await engine.compressPdf(f, {
          mode: m.kind === "target"
            ? { kind: "target", targetBytes: targetBytesFromKb(m.kb) }
            : { kind: "level", level: m.level },
          grayscale: gray,
          password: passwordRef.current,
          signal: ac.signal,
          onProgress: (progress) => {
            if (!ac.signal.aborted) setStatus({ name: "working", progress });
          },
        });
        if (ac.signal.aborted) return;
        const url = URL.createObjectURL(result.blob);
        urlRef.current = url;
        setStatus({ name: "done", result, url, fileName: outputFileName(f.name), mode: m, grayscale: gray });
      } catch (err) {
        // Yang membatalkan (Batal, ganti file, kompres ulang) sudah memasang status barunya.
        if (ac.signal.aborted) return;
        const code = (err as { code?: CompressErrorCode }).code;
        if (code === "needs-password" || code === "wrong-password") {
          setStatus({ name: "needs-password", wrong: code === "wrong-password" });
          return;
        }
        if (process.env.NODE_ENV !== "production") console.error(err);
        const key = code && code in MESSAGES ? code : "unknown";
        setStatus({ name: "error", code: key, message: MESSAGES[key] });
      }
    },
    [revoke],
  );

  const chooseFile = useCallback(
    (f: File | null) => {
      abortRef.current?.abort();
      revoke();
      passwordRef.current = undefined;
      if (!f) {
        setFile(null);
        setStatus({ name: "idle" });
        return;
      }
      const looksPdf = f.type === "application/pdf" || /\.pdf$/i.test(f.name);
      if (!looksPdf) {
        setFile(null);
        setStatus({ name: "error", code: "not-pdf", message: MESSAGES["not-pdf"] });
        return;
      }
      setFile(f);
      setStatus({ name: "idle" });
      warmEngine(true);
    },
    [revoke],
  );

  const start = useCallback(() => {
    if (file) void run(file, mode, grayscale);
  }, [file, mode, grayscale, run]);

  const submitPassword = useCallback(
    (pw: string) => {
      passwordRef.current = pw;
      if (file) void run(file, mode, grayscale);
    },
    [file, mode, grayscale, run],
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setStatus({ name: "idle", cancelled: true });
  }, []);

  /** Kembali ke pengaturan dengan file yang sama (mis. mau coba target lain). */
  const adjust = useCallback(() => {
    revoke();
    setStatus({ name: "idle" });
  }, [revoke]);

  const reset = useCallback(() => chooseFile(null), [chooseFile]);

  return {
    file,
    mode,
    setMode,
    grayscale,
    setGrayscale,
    status,
    chooseFile,
    start,
    cancel,
    adjust,
    reset,
    submitPassword,
  };
}
