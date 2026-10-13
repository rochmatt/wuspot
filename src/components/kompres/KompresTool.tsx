"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { formatBytes } from "@/lib/pdf-compress/format";
import { MAX_INPUT_BYTES } from "@/lib/pdf-compress/types";
import { useKompres, warmEngine, type KompresStatus, type ModeChoice } from "./useKompres";
import {
  CUSTOM_MAX_KB,
  CUSTOM_MIN_KB,
  LEVELS,
  TARGET_CHIPS,
  modeLabel,
} from "./labels";
import { ResultPanel } from "./ResultPanel";
import { ArrowRight, DeviceIcon, LockIcon, PdfDocIcon, WarnTriangle } from "./icons";
import styles from "./KompresTool.module.css";

export interface FileInfo {
  name: string;
  size: number;
}

export interface DemoView {
  file: FileInfo | null;
  status: KompresStatus;
  mode?: ModeChoice;
}

// ?demo=… hanya ada di mode pengembangan; di build produksi cabang ini
// (termasuk import ./demo) dibuang seluruhnya.
const useDevDemo: (setMode: (m: ModeChoice) => void) => DemoView | null =
  process.env.NODE_ENV === "production"
    ? () => null
    : function useDevDemoImpl(setMode) {
        const [demo, setDemo] = useState<DemoView | null>(null);
        useEffect(() => {
          const name = new URLSearchParams(window.location.search).get("demo");
          if (!name) return;
          let alive = true;
          void import("./demo").then((m) => {
            const d = m.makeDemo(name);
            if (!alive) return;
            if (d?.mode) setMode(d.mode);
            setDemo(d);
          });
          return () => {
            alive = false;
          };
        }, [setMode]);
        return demo;
      };

function smallerMode(mode: ModeChoice): ModeChoice | null {
  if (mode.kind === "level") {
    if (mode.level === "ringan") return { kind: "level", level: "sedang" };
    if (mode.level === "sedang") return { kind: "level", level: "kuat" };
    return null;
  }
  const lower = [...TARGET_CHIPS].reverse().find((kb) => kb < mode.kb);
  return lower ? { kind: "target", kb: lower } : null;
}

export function KompresTool({ presetKb }: { presetKb: number | null }) {
  const k = useKompres(presetKb);
  const demo = useDevDemo(k.setMode);
  const file: FileInfo | null = demo ? demo.file : k.file;
  const status: KompresStatus = demo ? demo.status : k.status;

  const uid = useId();
  const folderRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const customRef = useRef<HTMLInputElement>(null);
  const goRef = useRef<HTMLButtonElement>(null);
  const resultRef = useRef<HTMLElement>(null);
  const field2Ref = useRef<HTMLFieldSetElement>(null);
  const customPointer = useRef(false);

  const [drag, setDrag] = useState(false);
  const [customDraft, setCustomDraft] = useState<string | null>(null);
  const [customPicked, setCustomPicked] = useState(false);
  // Pesan salah di isian "lainnya" baru muncul setelah mencoba kompres atau
  // meninggalkan isian yang sudah diisi; bukan begitu isian disentuh.
  const [customTouched, setCustomTouched] = useState(false);
  const [goVisible, setGoVisible] = useState(true);
  const [folderVisible, setFolderVisible] = useState(true);

  const { mode, setMode, grayscale, setGrayscale } = k;
  const modeIsCustom = mode.kind === "target" && !(TARGET_CHIPS as readonly number[]).includes(mode.kb);
  const customText = customDraft ?? (modeIsCustom && mode.kind === "target" ? String(mode.kb) : "");
  const customKb = /^\d+$/.test(customText) ? Number(customText) : NaN;
  const customValid = customKb >= CUSTOM_MIN_KB && customKb <= CUSTOM_MAX_KB;
  const selected = customPicked || modeIsCustom ? "custom" : mode.kind === "target" ? `t${mode.kb}` : mode.level;
  const customBad = selected === "custom" && !customValid;
  const customErr = customBad && customTouched;

  const working = status.name === "working";
  const hasFile = file !== null;
  const tooBig = hasFile && file.size > MAX_INPUT_BYTES;
  const canRun = hasFile && !working && !tooBig;
  // Setelan file yang sedang ditampilkan hasilnya (bukan pilihan yang mungkin sudah diubah).
  const runMode = status.name === "done" ? status.mode : mode;

  // Bilah "Kompres sekarang" yang menempel di bawah layar HP: muncul kalau
  // file sudah dipilih, mapnya kelihatan, tapi tombol utamanya tidak.
  useEffect(() => {
    const go = goRef.current;
    const folder = folderRef.current;
    if (!go || !folder || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.target === go) setGoVisible(e.isIntersecting);
          else setFolderVisible(e.isIntersecting);
        }
      },
      { threshold: [0, 0.2] },
    );
    io.observe(go);
    io.observe(folder);
    return () => io.disconnect();
  }, []);

  const scrollToResult = useCallback(() => {
    requestAnimationFrame(() => {
      const el = resultRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (r.top < 70 || r.top > window.innerHeight * 0.6) {
        const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        el.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
      }
    });
  }, []);

  // Fokus dipindah ke kotak file dulu, supaya kalau jendela pilih file
  // dibatalkan, fokus tidak jatuh ke <body>.
  const pickFile = useCallback(() => {
    const input = inputRef.current;
    if (!input) return;
    input.focus({ preventScroll: true });
    input.click();
  }, []);

  const run = useCallback(
    (fromSticky = false) => {
      if (!hasFile) {
        pickFile();
        return;
      }
      if (customBad) {
        setCustomTouched(true);
        customRef.current?.focus();
        return;
      }
      if (working || tooBig) return;
      k.start();
      scrollToResult();
      // Bilah bawah langsung disembunyikan (aria-hidden): fokus pindah ke judul hasil.
      if (fromSticky)
        requestAnimationFrame(() =>
          resultRef.current?.querySelector<HTMLElement>("[data-result-head]")?.focus({ preventScroll: true }),
        );
    },
    [hasFile, customBad, working, tooBig, k, pickFile, scrollToResult],
  );

  const chooseLevel = (level: (typeof LEVELS)[number]["level"]) => {
    setCustomPicked(false);
    setCustomTouched(false);
    setMode({ kind: "level", level });
  };
  const chooseTarget = (kb: number) => {
    setCustomPicked(false);
    setCustomTouched(false);
    setMode({ kind: "target", kb });
  };
  const chooseCustom = () => {
    setCustomPicked(true);
    if (customValid) setMode({ kind: "target", kb: customKb });
  };
  const onCustomText = (raw: string) => {
    const v = raw.replace(/\D/g, "").slice(0, 6);
    setCustomDraft(v);
    setCustomPicked(true);
    const n = Number(v);
    if (v && n >= CUSTOM_MIN_KB && n <= CUSTOM_MAX_KB) setMode({ kind: "target", kb: n });
  };

  /** Kembali ke pilihan ukuran: gulir ke sana dan fokus ke pilihan yang aktif. */
  const focusSettings = () => {
    requestAnimationFrame(() => {
      const fs = field2Ref.current;
      if (!fs) return;
      const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      fs.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "center" });
      fs.querySelector<HTMLInputElement>("input[type=radio]:checked")?.focus({ preventScroll: true });
    });
  };

  const trySmaller = () => {
    const next = smallerMode(runMode);
    k.adjust();
    if (next) {
      setCustomPicked(false);
      setMode(next);
    }
    focusSettings();
  };

  const adjust = () => {
    k.adjust();
    focusSettings();
  };

  const cancel = () => {
    k.cancel();
    requestAnimationFrame(() => goRef.current?.focus());
  };

  const fileAgain = () => {
    k.reset();
    pickFile();
  };

  const goLabel = working
    ? "Sedang mengompres…"
    : status.name === "done"
      ? "Kompres ulang"
      : "Kompres sekarang";
  // Satu tombol utama per keadaan: Pilih file → Kompres → Unduh.
  const goTone = canRun && status.name === "idle" ? "btn-primary" : "btn-secondary";
  const targetText = customBad ? "isi angka KB dulu" : modeLabel(mode);
  const showSticky = hasFile && status.name === "idle" && !goVisible && folderVisible && !tooBig;

  // Selama bilah bawah tampil, halaman diberi ruang di bawah supaya bilah
  // tidak menutupi elemen yang difokus atau baris terakhir kaki halaman.
  useEffect(() => {
    const root = document.documentElement;
    if (showSticky) root.setAttribute("data-sticky-bar", "");
    else root.removeAttribute("data-sticky-bar");
    return () => root.removeAttribute("data-sticky-bar");
  }, [showSticky]);

  // Catatan tangan "bingung? ini aja" hanya di halaman tanpa target bawaan dan
  // selama belum ada target dipilih: di halaman 200 KB, mengikutinya justru
  // menghapus target yang dijanjikan judulnya.
  const showHint = presetKb === null && mode.kind === "level";

  return (
    <>
      <section ref={folderRef} className={styles.folder} aria-labelledby={`${uid}-alat`}>
        <div className={styles.folderTab} aria-hidden="true">
          <b>Map 01</b> Kompres PDF
        </div>
        <h2 id={`${uid}-alat`} className="sr-only">
          Formulir kompres PDF
        </h2>

        <form
          className={styles.sheet}
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            run();
          }}
        >
          <p className={styles.trust}>
            <DeviceIcon />
            <span>
              <span className={styles.wide}>
                <b>Diproses di HP atau laptopmu sendiri.</b> File nggak <span className="nw">di-upload.</span>
              </span>
              <span className={styles.narrow}>
                <b>Diproses di HP kamu.</b> Nggak <span className="nw">di-upload.</span>
              </span>
            </span>
          </p>

          {/* 01 — file */}
          <div className={styles.field}>
            <span className={styles.num} aria-hidden="true">
              01
            </span>
            <div className={styles.fbody}>
              <div className={styles.flabel}>
                <h3 className={styles.ftitle} id={`${uid}-f1`}>
                  File PDF
                </h3>
                <small>satu file, maks. 150 MB</small>
              </div>

              <input
                ref={inputRef}
                id={`${uid}-file`}
                className={`sr-only ${styles.fileInput}`}
                type="file"
                accept="application/pdf,.pdf"
                aria-describedby={`${uid}-f1`}
                disabled={working}
                onFocus={() => warmEngine()}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) k.chooseFile(f);
                  e.target.value = "";
                }}
              />

              <div
                className={`${styles.drop} ${hasFile ? styles.dropChosen : ""} ${drag ? styles.dropOver : ""}`}
                onPointerDown={() => warmEngine()}
                onDragEnter={() => warmEngine()}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (!working) setDrag(true);
                }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDrag(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f && !working) k.chooseFile(f);
                }}
              >
                <PdfDocIcon size={hasFile ? 36 : 44} />
                {hasFile ? (
                  <div className={styles.chosen}>
                    <p className={styles.fileName} title={file.name}>
                      {file.name}
                    </p>
                    <p className={styles.fileMeta}>
                      <span className="mono">{formatBytes(file.size)}</span>
                      {tooBig ? (
                        <span className={styles.fileWarn}> · lebih dari 150 MB, terlalu besar untuk diproses di browser</span>
                      ) : (
                        <span> · siap dikompres</span>
                      )}
                    </p>
                    <label htmlFor={`${uid}-file`} className={`btn btn-quiet ${styles.change}`}>
                      Ganti file
                    </label>
                  </div>
                ) : (
                  <div className={styles.pickWrap}>
                    <label htmlFor={`${uid}-file`} className={`btn btn-primary ${styles.pick}`}>
                      Pilih file PDF
                    </label>
                    <p className={styles.dropHint}>
                      <span className={styles.wide}>atau seret file ke kotak ini</span>
                      <span className={styles.narrow}>dari Download, Drive, atau WhatsApp</span>
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 02 — ukuran */}
          <div className={styles.field}>
            <span className={styles.num} aria-hidden="true">
              02
            </span>
            <fieldset ref={field2Ref} className={`${styles.fbody} ${styles.fieldset}`} disabled={working}>
              <legend className={styles.flabel}>
                <span className={styles.ftitle}>Ukuran hasil</span>
                <small>
                  pilih salah satu: a <i>atau</i> b
                </small>
              </legend>

              <p className={styles.sub} id={`${uid}-a`}>
                <span className={styles.subKey}>a.</span>
                <span>
                  Batas ukuran<span className={styles.inKb}>, dalam KB</span>{" "}
                  <span className={`${styles.subSoft} ${styles.wide}`}>(cek syarat portal)</span>
                </span>
                <span className={styles.subHint}>hasilnya di bawah angka ini</span>
              </p>
              <div className={styles.chips}>
                {TARGET_CHIPS.map((kb) => (
                  <label key={kb} className={styles.chip}>
                    <input
                      type="radio"
                      name={`${uid}-ukuran`}
                      value={`t${kb}`}
                      checked={selected === `t${kb}`}
                      onChange={() => chooseTarget(kb)}
                      aria-describedby={`${uid}-a`}
                    />
                    <span className={styles.radio} aria-hidden="true" />
                    <span className={styles.chipVal}>
                      {kb >= 1000 ? kb / 1000 : kb}
                      <span className={`${styles.unit} ${kb >= 1000 ? "" : styles.unitKb}`}>
                        {kb >= 1000 ? "MB" : "KB"}
                      </span>
                    </span>
                  </label>
                ))}
                <label className={`${styles.chip} ${styles.custom}`}>
                  <input
                    type="radio"
                    name={`${uid}-ukuran`}
                    value="custom"
                    checked={selected === "custom"}
                    onChange={chooseCustom}
                    aria-label="Ukuran lain, isi sendiri"
                  />
                  <span className={styles.radio} aria-hidden="true" />
                  <span className={styles.customLabel} aria-hidden="true">
                    lainnya
                  </span>
                  <input
                    ref={customRef}
                    className={styles.kb}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="off"
                    maxLength={6}
                    value={customText}
                    aria-label="Ukuran lain, dalam KB"
                    aria-invalid={customErr || undefined}
                    aria-describedby={customErr ? `${uid}-kb-err` : undefined}
                    onPointerDown={() => {
                      customPointer.current = true;
                    }}
                    onFocus={() => {
                      // Diketuk/diklik = pilih "lainnya". Lewat Tab saja tidak
                      // mengubah pilihan; begitu mengetik, "lainnya" ikut terpilih.
                      if (customPointer.current) chooseCustom();
                      customPointer.current = false;
                    }}
                    onChange={(e) => onCustomText(e.target.value)}
                    onBlur={() => {
                      if (selected === "custom" && customText !== "" && !customValid) setCustomTouched(true);
                    }}
                  />
                  <span className={styles.unit} aria-hidden="true">
                    KB
                  </span>
                </label>
                <span className={styles.customHelp} aria-hidden="true">
                  ← batasnya beda? ketik angkanya, misal 150
                </span>
              </div>
              {customErr && (
                <p className={styles.kbErr} id={`${uid}-kb-err`}>
                  {customText === ""
                    ? "Isi angkanya dulu, misalnya 150."
                    : `Isi angka antara ${CUSTOM_MIN_KB} dan ${CUSTOM_MAX_KB.toLocaleString("id-ID")} KB.`}
                </p>
              )}

              <p className={`${styles.sub} ${styles.subB}`}>
                <span className={styles.subKey}>b.</span>
                <span>Atau pilih tingkat kompres</span>
              </p>
              <div className={styles.levels}>
                {showHint && (
                  <span className={`hand ${styles.handNote}`} aria-hidden="true">
                    bingung? ini aja
                    <svg width="34" height="26" viewBox="0 0 34 26">
                      <path d="M2 4c9-1 18 2 22 10 1 2 1.5 4 1.6 7m0 0-4.4-4.2m4.4 4.2 3.6-4.9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                )}
                {LEVELS.map((l) => (
                  <label key={l.level} className={styles.level}>
                    <input
                      type="radio"
                      name={`${uid}-ukuran`}
                      value={l.level}
                      checked={selected === l.level}
                      onChange={() => chooseLevel(l.level)}
                    />
                    <span className={styles.radio} aria-hidden="true" />
                    <span className={styles.levelName}>{l.name}</span>
                    <span className={styles.meter} aria-hidden="true">
                      {[1, 2, 3].map((d) => (
                        <i key={d} className={d <= l.dots ? styles.on : undefined} />
                      ))}
                    </span>
                    <span className={styles.levelSub}>{l.sub}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </div>

          {/* 03 — opsi */}
          <div className={styles.field}>
            <span className={styles.num} aria-hidden="true">
              03
            </span>
            <div className={styles.fbody}>
              <div className={styles.flabel}>
                <h3 className={styles.ftitle}>Opsi tambahan</h3>
              </div>
              <label className={styles.switch}>
                <input
                  type="checkbox"
                  role="switch"
                  checked={grayscale}
                  disabled={working}
                  onChange={(e) => setGrayscale(e.target.checked)}
                  aria-labelledby={`${uid}-bw-name`}
                  aria-describedby={`${uid}-bw`}
                />
                <span className={styles.track} aria-hidden="true">
                  <span className={styles.knob} />
                </span>
                <span className={styles.swText}>
                  <span className={styles.swHead}>
                    <b id={`${uid}-bw-name`}>Hitam-putih</b>
                    <span className={styles.swState} aria-hidden="true">
                      {grayscale ? "nyala" : "mati"}
                    </span>
                  </span>
                  <span className={styles.swDesc} id={`${uid}-bw`}>
                    Bikin file lebih kecil. Cocok buat KK, fotokopian, atau surat yang aslinya hitam-putih.{" "}
                    <span className={styles.swWarn}>
                      <WarnTriangle size={15} />
                      Jangan dinyalakan kalau portalnya minta scan berwarna.
                    </span>
                  </span>
                </span>
              </label>
            </div>
          </div>

          <div className={styles.act}>
            <button
              ref={goRef}
              type="submit"
              className={`btn btn-lg btn-block ${goTone} ${styles.go}`}
              aria-disabled={working || tooBig || undefined}
              aria-describedby={`${uid}-lock`}
            >
              <span>
                {goLabel}
                {!working && <span className={styles.goTarget}>{targetText}</span>}
              </span>
              {working ? <span className={styles.spinner} aria-hidden="true" /> : <ArrowRight />}
            </button>
            <p className={styles.lock} id={`${uid}-lock`}>
              <LockIcon />
              <span>File kamu tetap di perangkat ini. Isinya nggak dikirim ke server.</span>
            </p>
          </div>
        </form>
      </section>

      <ResultPanel
        ref={resultRef}
        status={status}
        file={file}
        mode={mode}
        onCancel={cancel}
        onAdjust={adjust}
        onTrySmaller={smallerMode(runMode) ? trySmaller : null}
        onAnother={fileAgain}
        onPickFile={pickFile}
        onPassword={k.submitPassword}
      />

      <div className={styles.sticky} data-show={showSticky || undefined} aria-hidden={!showSticky}>
        <button
          type="button"
          className={`btn btn-primary btn-block ${styles.stickyBtn}`}
          tabIndex={showSticky ? 0 : -1}
          onClick={() => run(true)}
        >
          <span>
            Kompres sekarang <span className={styles.goTarget}>{targetText}</span>
          </span>
          <ArrowRight />
        </button>
      </div>
    </>
  );
}

