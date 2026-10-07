"use client";

// Halaman uji mesin (khusus pengembangan). Dipakai Playwright lewat
// window.__wuspotCompress, dan bisa juga dicoba manual lewat form di bawah.

import { useEffect, useRef, useState } from "react";
import type { CompressLevel, CompressMode, CompressProgress, CompressResult } from "@/lib/pdf-compress/types";

type Engine = typeof import("@/lib/pdf-compress");

/** Byte PDF: base64, array angka, atau buffer. */
export type HarnessInput = string | number[] | ArrayBuffer | Uint8Array;

export interface HarnessOptions {
  mode: CompressMode;
  grayscale?: boolean;
  password?: string;
  /** Nama file yang diberikan ke mesin (default "uji.pdf"). */
  fileName?: string;
  /** Untuk menguji pembatalan: abort() setelah sekian milidetik. */
  abortAfterMs?: number;
}

export type HarnessResult = Omit<CompressResult, "blob">;

interface HarnessCommon {
  progress: CompressProgress[];
  elapsedMs: number;
}

export type HarnessResponse =
  | (HarnessCommon & {
      ok: true;
      bytesBase64: string;
      result: HarnessResult;
      blobSize: number;
      blobType: string;
    })
  | (HarnessCommon & { ok: false; code: string; message: string });

declare global {
  interface Window {
    __wuspotCompress?: (input: HarnessInput, options: HarnessOptions) => Promise<HarnessResponse>;
    __wuspotReady?: boolean;
    __wuspotLoadError?: string;
  }
}

function toBytes(input: HarnessInput): Uint8Array<ArrayBuffer> {
  if (typeof input === "string") {
    const bin = atob(input);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  if (Array.isArray(input)) return Uint8Array.from(input);
  if (input instanceof Uint8Array) return new Uint8Array(input);
  return new Uint8Array(input.slice(0));
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      resolve(url.slice(url.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function errorInfo(err: unknown): { code: string; message: string } {
  const e = err as { code?: unknown; name?: unknown; message?: unknown } | null;
  const code = typeof e?.code === "string" ? e.code : "unknown";
  const name = typeof e?.name === "string" ? e.name : "Error";
  const message = typeof e?.message === "string" ? e.message : String(err);
  return { code, message: code === "unknown" ? `${name}: ${message}` : message };
}

async function runCompress(engine: Engine, input: HarnessInput, options: HarnessOptions): Promise<HarnessResponse> {
  const progress: CompressProgress[] = [];
  const bytes = toBytes(input);
  const file = new File([bytes], options.fileName ?? "uji.pdf", { type: "application/pdf" });
  const ac = new AbortController();
  const timer = options.abortAfterMs !== undefined ? setTimeout(() => ac.abort(), options.abortAfterMs) : undefined;
  const t0 = performance.now();
  try {
    const result = await engine.compressPdf(file, {
      mode: options.mode,
      grayscale: options.grayscale,
      password: options.password,
      signal: ac.signal,
      onProgress: (p: CompressProgress) => progress.push({ ...p }),
    });
    const elapsedMs = Math.round(performance.now() - t0);
    const { blob, ...rest } = result;
    return {
      ok: true,
      bytesBase64: await blobToBase64(blob),
      result: rest,
      blobSize: blob.size,
      blobType: blob.type,
      progress,
      elapsedMs,
    };
  } catch (err) {
    return { ok: false, ...errorInfo(err), progress, elapsedMs: Math.round(performance.now() - t0) };
  } finally {
    clearTimeout(timer);
  }
}

// --------------------------------------------------------------------------
// Form manual
// --------------------------------------------------------------------------

type ModeChoice = "100" | "200" | "300" | "500" | "1024" | CompressLevel;

const MODE_CHOICES: Array<{ value: ModeChoice; label: string }> = [
  { value: "100", label: "Target 100 KB" },
  { value: "200", label: "Target 200 KB" },
  { value: "300", label: "Target 300 KB" },
  { value: "500", label: "Target 500 KB" },
  { value: "1024", label: "Target 1 MB" },
  { value: "ringan", label: "Level ringan" },
  { value: "sedang", label: "Level sedang" },
  { value: "kuat", label: "Level kuat" },
];

function toMode(choice: ModeChoice): CompressMode {
  if (choice === "ringan" || choice === "sedang" || choice === "kuat") return { kind: "level", level: choice };
  return { kind: "target", targetBytes: Number(choice) * 1024 };
}

function kb(n: number): string {
  return `${(n / 1024).toFixed(1)} KB`;
}

export function Harness() {
  const engineRef = useRef<Engine | null>(null);
  const [loadState, setLoadState] = useState<"memuat" | "siap" | "gagal">("memuat");
  const [loadError, setLoadError] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<ModeChoice>("200");
  const [grayscale, setGrayscale] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastProgress, setLastProgress] = useState<CompressProgress | null>(null);
  const [output, setOutput] = useState<{ response: HarnessResponse; url?: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    import("@/lib/pdf-compress")
      .then((engine) => {
        if (cancelled) return;
        engineRef.current = engine;
        window.__wuspotCompress = (input, options) => runCompress(engine, input, options);
        window.__wuspotReady = true;
        setLoadState("siap");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const msg = errorInfo(err).message;
        window.__wuspotLoadError = msg;
        setLoadError(msg);
        setLoadState("gagal");
      });
    return () => {
      cancelled = true;
      window.__wuspotReady = false;
      delete window.__wuspotCompress;
    };
  }, []);

  useEffect(
    () => () => {
      if (output?.url) URL.revokeObjectURL(output.url);
    },
    [output],
  );

  async function runManual() {
    const engine = engineRef.current;
    if (!engine || !file) return;
    setBusy(true);
    setOutput(null);
    setLastProgress(null);
    const ac = new AbortController();
    const progress: CompressProgress[] = [];
    const t0 = performance.now();
    try {
      const result = await engine.compressPdf(file, {
        mode: toMode(mode),
        grayscale,
        password: password || undefined,
        signal: ac.signal,
        onProgress: (p: CompressProgress) => {
          progress.push({ ...p });
          setLastProgress(p);
        },
      });
      const { blob, ...rest } = result;
      setOutput({
        response: {
          ok: true,
          bytesBase64: "",
          result: rest,
          blobSize: blob.size,
          blobType: blob.type,
          progress,
          elapsedMs: Math.round(performance.now() - t0),
        },
        url: URL.createObjectURL(blob),
      });
    } catch (err) {
      setOutput({
        response: { ok: false, ...errorInfo(err), progress, elapsedMs: Math.round(performance.now() - t0) },
      });
    } finally {
      setBusy(false);
    }
  }

  const res = output?.response;
  return (
    <main style={{ maxWidth: 760, margin: "32px auto", padding: "0 16px", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 22 }}>Uji mesin kompres</h1>
      <p style={{ color: "#666", fontSize: 14 }}>
        Halaman ini hanya ada di mode pengembangan. Mesin:{" "}
        <strong data-testid="engine-state" data-ready={loadState === "siap" ? "true" : "false"}>
          {loadState}
        </strong>
        {loadError && <span style={{ color: "#b00020" }}> — {loadError}</span>}
      </p>

      <fieldset style={{ display: "grid", gap: 10, border: "1px solid #ddd", padding: 16 }} disabled={busy}>
        <label>
          File PDF{" "}
          <input type="file" accept="application/pdf,.pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
        <label>
          Mode{" "}
          <select value={mode} onChange={(e) => setMode(e.target.value as ModeChoice)}>
            {MODE_CHOICES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <input type="checkbox" checked={grayscale} onChange={(e) => setGrayscale(e.target.checked)} /> Hitam-putih
        </label>
        <label>
          Password <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <button type="button" onClick={runManual} disabled={!file || loadState !== "siap"}>
          Kompres
        </button>
      </fieldset>

      {busy && lastProgress && (
        <p>
          {lastProgress.stage} · {Math.round(lastProgress.ratio * 100)}% {lastProgress.detail ?? ""}
        </p>
      )}

      {res && (
        <section style={{ marginTop: 16 }}>
          {res.ok ? (
            <p>
              {kb(res.result.originalBytes)} → <strong>{kb(res.result.outputBytes)}</strong> ({res.result.strategy},{" "}
              {res.elapsedMs} ms){" "}
              {output?.url && (
                <a href={output.url} download={file ? file.name.replace(/\.pdf$/i, "") + "-uji.pdf" : "uji.pdf"}>
                  unduh
                </a>
              )}
            </p>
          ) : (
            <p style={{ color: "#b00020" }}>
              {res.code}: {res.message}
            </p>
          )}
          <pre style={{ fontSize: 12, background: "#f6f6f6", padding: 12, overflowX: "auto" }}>
            {JSON.stringify(res.ok ? { ...res, bytesBase64: undefined } : res, null, 2)}
          </pre>
        </section>
      )}
    </main>
  );
}
