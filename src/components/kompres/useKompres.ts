"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  CompressLevel,
  CompressProgress,
  CompressResult,
  CompressErrorCode,
} from "@/lib/pdf-compress/types";
import { targetBytesFromKb } from "@/content/kompres-pdf";

export type ModeChoice =
  | { kind: "target"; kb: number }
  | { kind: "level"; level: CompressLevel };

export type KompresStatus =
  | { name: "idle" }
  | { name: "working"; progress: CompressProgress }
  | { name: "needs-password"; wrong: boolean }
  | { name: "done"; result: CompressResult; url: string; fileName: string }
  | { name: "error"; code: CompressErrorCode | "unknown"; message: string };

const PREF_KEY = "wuspot:kompres-pdf";

interface StoredPref {
  mode: ModeChoice;
  grayscale: boolean;
}

function readPref(): StoredPref | null {
  try {
    const raw = window.localStorage.getItem(PREF_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as StoredPref;
    if (p.mode?.kind === "target" && typeof p.mode.kb === "number") return p;
    if (p.mode?.kind === "level" && ["ringan", "sedang", "kuat"].includes(p.mode.level)) return p;
  } catch {
    // localStorage bisa diblokir (mode privat, WebView tertentu) — abaikan.
  }
  return null;
}

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

function outputName(inputName: string): string {
  const base = inputName.replace(/\.pdf$/i, "").trim() || "dokumen";
  return `${base}-kompres.pdf`;
}

const MESSAGES: Record<CompressErrorCode | "unknown", string> = {
  "not-pdf": "File ini bukan PDF. Pilih file yang namanya berakhiran .pdf.",
  "needs-password": "PDF ini dikunci password.",
  "wrong-password": "Password-nya belum cocok.",
  corrupt: "PDF ini rusak atau tidak lengkap, jadi tidak bisa dibuka. Coba unduh atau simpan ulang file aslinya.",
  "too-large": "File ini terlalu besar untuk diproses di browser (maksimal 150 MB).",
  aborted: "Dibatalkan.",
  unsupported: "Browser ini belum mendukung fitur yang dibutuhkan. Coba pakai Chrome atau Firefox versi terbaru.",
  "out-of-memory": "Memori perangkat tidak cukup untuk file sebesar ini. Tutup aplikasi lain atau coba di laptop.",
  unknown: "Ada yang tidak beres saat memproses file ini. Coba sekali lagi, atau pakai browser lain.",
};

export function useKompres(presetKb: number | null) {
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<ModeChoice>(
    presetKb ? { kind: "target", kb: presetKb } : { kind: "level", level: "sedang" },
  );
  const [grayscale, setGrayscale] = useState(false);
  const [status, setStatus] = useState<KompresStatus>({ name: "idle" });
  const abortRef = useRef<AbortController | null>(null);
  const urlRef = useRef<string | null>(null);
  const passwordRef = useRef<string | undefined>(undefined);

  // Halaman preset (mis. /kompres-pdf-200kb) selalu mulai dari target-nya sendiri;
  // halaman utama memakai pilihan terakhir pengguna.
  useEffect(() => {
    if (presetKb) return;
    const p = readPref();
    if (p) {
      setMode(p.mode);
      setGrayscale(p.grayscale);
    }
  }, [presetKb]);

  // Muat mesin di waktu senggang supaya tombol "Kompres" terasa instan.
  useEffect(() => {
    const w = window as Window & { requestIdleCallback?: (cb: () => void) => number };
    const kick = () => void loadEngine().catch(() => {});
    if (w.requestIdleCallback) w.requestIdleCallback(kick);
    else setTimeout(kick, 1500);
  }, []);

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
        setStatus({ name: "done", result, url, fileName: outputName(f.name) });
      } catch (err) {
        if (ac.signal.aborted) {
          setStatus({ name: "idle" });
          return;
        }
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
    setStatus({ name: "idle" });
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
