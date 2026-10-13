"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { targetBytesFromKb } from "@/content/kompres-pdf";
import { formatBytes, savedPercent } from "@/lib/pdf-compress/format";
import type { CompressResult } from "@/lib/pdf-compress/types";
import { BeresStamp } from "@/components/site/Stamp";
import type { FileInfo } from "./KompresTool";
import type { KompresStatus, ModeChoice } from "./useKompres";
import { STAGE_LABEL, isVerdictNote, kbLabel, levelName, modeLabel } from "./labels";
import {
  ArrowRight,
  DownloadIcon,
  LockIcon,
  NoticeIcon,
  Paperclip,
  PdfDocIcon,
  ShareIcon,
} from "./icons";
import styles from "./ResultPanel.module.css";

interface Props {
  ref?: React.Ref<HTMLElement>;
  status: KompresStatus;
  file: FileInfo | null;
  /** Pilihan yang sedang aktif (untuk contoh hasil). Hasil jadi memakai status.mode. */
  mode: ModeChoice;
  onCancel: () => void;
  onAdjust: () => void;
  onTrySmaller: (() => void) | null;
  onAnother: () => void;
  onPickFile: () => void;
  onPassword: (pw: string) => void;
}

function liveText(status: KompresStatus): string {
  switch (status.name) {
    case "idle":
      return status.cancelled ? "Dibatalkan." : "";
    case "working":
      // Tahapnya saja; rincian per halaman ada di progressbar (aria-valuetext).
      return STAGE_LABEL[status.progress.stage];
    case "needs-password":
      return status.wrong ? "Password-nya belum cocok. Coba lagi." : "PDF ini dikunci. Masukkan password-nya.";
    case "done": {
      const r = status.result;
      const out = formatBytes(r.outputBytes);
      if (r.targetMet === false && status.mode.kind === "target")
        return `Target ${kbLabel(status.mode.kb)} belum tercapai. Hasil terkecil ${out}.`;
      if (r.outputBytes >= r.originalBytes)
        return status.mode.kind === "target"
          ? `Selesai. File-nya sudah di bawah target, jadi nggak diubah (${out}).`
          : `Selesai. File-nya sudah ringkas, jadi nggak diubah (${out}).`;
      return `Selesai. Hasilnya ${out}, hemat ${savedPercent(r.originalBytes, r.outputBytes)} persen.`;
    }
    case "error":
      return status.message;
  }
}

/**
 * Teks untuk wilayah aria-live, paling sering sekali tiap `ms` milidetik
 * (nilai terakhir selalu tetap diumumkan). ms = 0: langsung.
 */
function useThrottled(text: string, ms: number): string {
  const [shown, setShown] = useState(text);
  const last = useRef(0);
  useEffect(() => {
    if (text === shown) return;
    const wait = Math.max(0, last.current + ms - Date.now());
    const t = setTimeout(() => {
      last.current = Date.now();
      setShown(text);
    }, wait);
    return () => clearTimeout(t);
  }, [text, shown, ms]);
  return shown;
}

export function ResultPanel(props: Props) {
  const { ref, status, mode } = props;
  const headId = useId();
  const live = useThrottled(liveText(status), status.name === "working" ? 3000 : 0);
  return (
    <section ref={ref} className={styles.hasil} aria-labelledby={headId} data-state={status.name}>
      <p role="status" aria-live="polite" className="sr-only">
        {live}
      </p>
      {status.name === "idle" ? (
        <Preview headId={headId} mode={mode} />
      ) : (
        <>
          {/* tabIndex -1: fokus dipindah ke sini saat proses dimulai dari bilah bawah */}
          <h2 id={headId} className="sr-only" tabIndex={-1} data-result-head="">
            Hasil kompres
          </h2>
          {status.name === "working" && <Working {...props} status={status} />}
          {status.name === "needs-password" && <Password {...props} status={status} />}
          {status.name === "error" && <ErrorState {...props} status={status} />}
          {status.name === "done" && <Done key={status.url} {...props} status={status} />}
        </>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */

function ReceiptHead({ right }: { right: string }) {
  return (
    <div className={styles.head} aria-hidden="true">
      <span>Tanda terima</span>
      <span>{right}</span>
    </div>
  );
}

function splitSize(bytes: number): [string, string] {
  const s = formatBytes(bytes);
  const i = s.lastIndexOf(" ");
  return [s.slice(0, i), s.slice(i + 1)];
}

function Ruler({
  original,
  value,
  target,
  targetLabel,
  label,
}: {
  original: number;
  value: number;
  /** Batas dalam byte (posisi penanda). */
  target: number | null;
  /** Teks penanda, sesuai pilihan pengguna, mis. "200 KB". */
  targetLabel?: string;
  label: string;
}) {
  // Dengan target, skalanya mengikuti target (bukan ukuran asli): hemat 90%+
  // itu biasa, dan di skala 0 → 7 MB penanda 200 KB jadi tak terbaca. Ukuran
  // asli yang di luar skala ditandai potongan + panah.
  const scale = target ? Math.max(target * 1.5, value * 1.12) : Math.max(original, value);
  const offScale = original > scale * 1.02;
  const fill = Math.min(100, (value / scale) * 100);
  const tgt = target ? Math.min(100, (target / scale) * 100) : null;
  return (
    <div className={`${styles.ruler} ${offScale ? styles.rulerBroken : ""}`} role="img" aria-label={label}>
      <div className={styles.rulerBar}>
        <div className={styles.rulerFill} style={{ width: `max(${fill}%, 3px)` }} />
        {tgt !== null && (
          <div className={`${styles.rulerTgt} ${tgt > 50 ? styles.rulerTgtR : ""}`} style={{ left: `${tgt}%` }}>
            <span>target {targetLabel ?? formatBytes(target!)}</span>
          </div>
        )}
      </div>
      <div className={styles.rulerEnds} aria-hidden="true">
        <span>0</span>
        <span>{offScale ? `asli ${formatBytes(original)} →` : formatBytes(scale)}</span>
      </div>
    </div>
  );
}

/* ---------- belum ada file: contoh yang jelas-jelas contoh ---------- */

function Preview({ headId, mode }: { headId: string; mode: ModeChoice }) {
  const original = 2_516_582; // 2,4 MB: dua halaman scan dari kamera HP
  const out =
    mode.kind === "target"
      ? Math.round(Math.min(targetBytesFromKb(mode.kb), original) * 0.94)
      : { ringan: 1_020_000, sedang: 402_000, kuat: 187_000 }[mode.level];
  const target = mode.kind === "target" ? targetBytesFromKb(mode.kb) : null;
  const [num, unit] = splitSize(out);
  return (
    <>
      <div className={styles.previewLabel}>
        <h2 id={headId} className={styles.kicker}>
          Contoh hasil
        </h2>
        <span className={`hand ${styles.handNote}`} aria-hidden="true">
          nanti muncul kayak gini
        </span>
      </div>
      <p className="sr-only">Setelah file dikompres, tanda terimanya muncul di sini: ukuran sebelum dan sesudah, lalu tombol unduh.</p>
      <div className={`${styles.receipt} ${styles.preview}`} aria-hidden="true">
        <span className={styles.clip}>
          <Paperclip />
        </span>
        <ReceiptHead right="contoh" />
        <div className={styles.grid}>
          <div className={styles.colA}>
            <div className={styles.file}>
              <PdfDocIcon size={26} />
              <div>
                <p className={styles.fileName}>ijazah_depan_belakang.pdf</p>
                <p className={styles.fileMeta}>2 halaman · {modeLabel(mode)}</p>
              </div>
            </div>
            <div className={styles.sizes}>
              <div className={styles.was}>
                <span className={styles.lbl}>Sebelum</span>
                <span className={styles.v}>{formatBytes(original)}</span>
              </div>
              <ArrowRight size={24} />
              <div className={styles.now}>
                <span className={styles.lbl}>Sesudah</span>
                <span className={styles.v}>
                  {num}
                  <small>{unit}</small>
                </span>
              </div>
            </div>
            <Ruler
              original={original}
              value={out}
              target={target}
              targetLabel={mode.kind === "target" ? kbLabel(mode.kb) : undefined}
              label=""
            />
          </div>
          <div className={styles.colB}>
            <ul className={styles.leaders}>
              <li>
                <span>Ukuran berkurang</span>
                <b>{savedPercent(original, out)}%</b>
              </li>
              <li>
                <span>Jumlah halaman</span>
                <b>2, utuh</b>
              </li>
              <li>
                <span>Ongkos</span>
                <b>Rp0,-</b>
              </li>
            </ul>
            <div className={styles.ghostBtn}>
              <DownloadIcon /> Unduh PDF
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ---------- sedang bekerja ---------- */

function Working({ status, file, onCancel }: Props & { status: Extract<KompresStatus, { name: "working" }> }) {
  const p = status.progress;
  const pct = Math.round(Math.max(0, Math.min(1, p.ratio)) * 100);
  return (
    <div className={styles.receipt}>
      <ReceiptHead right="sedang diproses" />
      <div className={styles.working}>
        <div className={styles.workTop}>
          <span className={styles.spin} aria-hidden="true" />
          <div className={styles.workText}>
            <p className={styles.stage}>{STAGE_LABEL[p.stage]}</p>
            <p className={styles.detail}>{p.detail ?? file?.name ?? " "}</p>
          </div>
          <span className={styles.pct} aria-hidden="true">
            {pct}%
          </span>
        </div>
        <div
          className={styles.progress}
          role="progressbar"
          aria-label="Kemajuan kompres"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-valuetext={p.detail ? `${pct}%, ${p.detail}` : `${pct}%`}
        >
          <div className={styles.progressFill} style={{ width: `${pct}%` }} />
        </div>
        <p className={styles.wait}>
          Biarkan tab ini tetap terbuka, ya. Di HP lama, PDF yang tebal bisa makan waktu semenit lebih.
        </p>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Batal
        </button>
      </div>
    </div>
  );
}

/* ---------- PDF dikunci ---------- */

function Password({
  status,
  onPassword,
  onAnother,
}: Props & { status: Extract<KompresStatus, { name: "needs-password" }> }) {
  const id = useId();
  const [pw, setPw] = useState("");
  return (
    <div className={styles.receipt}>
      <ReceiptHead right="perlu password" />
      <form
        className={styles.pw}
        onSubmit={(e) => {
          e.preventDefault();
          if (pw) onPassword(pw);
        }}
      >
        <p className={styles.pwHead}>
          <LockIcon size={22} />
          <span>
            <b>PDF ini dikunci.</b> Masukkan password-nya.
          </span>
        </p>
        {status.wrong && (
          <p className={styles.pwWrong} id={`${id}-err`}>
            <NoticeIcon size={18} />
            <span>Password-nya belum cocok. Coba lagi, perhatikan huruf besar-kecilnya.</span>
          </p>
        )}
        <label htmlFor={`${id}-pw`} className={styles.pwLabel}>
          Password PDF
        </label>
        <div className={styles.pwRow}>
          <input
            id={`${id}-pw`}
            type="password"
            autoComplete="off"
            autoFocus
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            aria-invalid={status.wrong || undefined}
            aria-describedby={status.wrong ? `${id}-err` : `${id}-note`}
          />
          <button type="submit" className="btn btn-primary">
            Buka &amp; kompres
          </button>
        </div>
        <p className={styles.pwNote} id={`${id}-note`}>
          Password-nya cuma dipakai di perangkat ini. Hasil kompres nanti nggak dikunci lagi, jadi simpan baik-baik.
        </p>
        <button type="button" className="btn btn-quiet" onClick={onAnother}>
          Pilih file lain
        </button>
      </form>
    </div>
  );
}

/* ---------- gagal ---------- */

function ErrorState({ status, onPickFile }: Props & { status: Extract<KompresStatus, { name: "error" }> }) {
  return (
    <div className={styles.receipt}>
      <ReceiptHead right="belum bisa" />
      <div className={styles.alert}>
        <p className={styles.alertLabel} aria-hidden="true">
          Perhatian
        </p>
        <NoticeIcon size={22} />
        <div>
          <p className={styles.alertTitle}>Belum bisa diproses.</p>
          <p>{status.message}</p>
        </div>
      </div>
      <div className={styles.errActions}>
        <button type="button" className="btn btn-primary" onClick={onPickFile}>
          Pilih file lain
        </button>
      </div>
    </div>
  );
}

/* ---------- selesai ---------- */

/**
 * Baris "Teks" di tanda terima. PDF hasil scan memang tidak punya teks yang
 * bisa disalin sejak awal, jadi jangan ditulis "jadi gambar".
 */
function textState(r: CompressResult): string {
  if (r.textPreserved) return "bisa disalin";
  return r.notes.some((n) => n.startsWith("Teks di PDF ini")) ? "jadi gambar" : "hasil scan";
}

/**
 * Satu kalimat tentang apa yang dilakukan pada file. `null` bila mesin sudah
 * menjelaskannya sendiri (mis. "teks sekarang berupa gambar").
 */
function strategyNote(r: CompressResult): string | null {
  if (r.strategy === "original")
    return "File ini sudah ringkas dari sananya, jadi kami kembalikan apa adanya. Isinya nggak diubah sama sekali.";
  if (r.strategy === "optimize") return "Isinya nggak diubah, cuma struktur PDF-nya yang dirapikan.";
  if (r.strategy === "rasterize") {
    return r.notes.some((n) => n.startsWith("Teks di PDF ini"))
      ? null
      : "Tiap halaman disimpan ulang sebagai gambar JPG yang lebih ringan.";
  }
  return r.textPreserved
    ? "Teksnya tetap teks (masih bisa disalin). Yang dikecilkan cuma gambar di dalamnya."
    : "Gambar hasil scan di dalamnya dikecilkan. Tata letak halamannya tetap sama.";
}

/**
 * "Masih kegedean?" Hanya saran yang masih bisa membantu: hasil "belum
 * tercapai" berarti mesin sudah turun sampai resolusi & kualitas terendahnya,
 * jadi yang tersisa adalah mengurangi isi atau memperbaiki bahan scan-nya.
 */
function tipsFor(pages: number, grayscale: boolean): [string, string][] {
  const tips: [string, string][] = [];
  if (!grayscale)
    tips.push(["Nyalakan Hitam-putih", " kalau isinya cuma tulisan. Kadang cukup buat turun sedikit lagi."]);
  if (pages > 1) {
    tips.push(["Buang halaman yang nggak diminta,", " misalnya halaman kosong atau lampiran yang dobel."]);
    tips.push(["Pisahkan jadi beberapa file", " kalau formulirnya mengizinkan."]);
  }
  tips.push([
    "Foto atau scan ulang dengan kertas rata dan terang,",
    " lalu potong pinggiran kosongnya. Bayangan dan latar abu-abu bikin file berat.",
  ]);
  return tips;
}

function Done({
  status,
  file,
  onAdjust,
  onTrySmaller,
  onAnother,
}: Props & { status: Extract<KompresStatus, { name: "done" }> }) {
  // Semua label diambil dari setelan saat file ini dikompres (status.mode),
  // bukan dari pilihan yang mungkin sudah diubah sesudahnya.
  const { result: r, mode, grayscale } = status;
  const partial = r.targetMet === false;
  const unchanged = r.outputBytes >= r.originalBytes;
  const pct = savedPercent(r.originalBytes, r.outputBytes);
  const saved = Math.max(0, r.originalBytes - r.outputBytes);
  const [num, unit] = splitSize(r.outputBytes);
  const target = mode.kind === "target" ? targetBytesFromKb(mode.kb) : null;
  const outSize = formatBytes(r.outputBytes);
  const [stampedAt] = useState(() =>
    new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(
      new Date(),
    ),
  );

  // Tombol "Kirim" (mis. ke WhatsApp) hanya kalau browser bisa membagikan file.
  const shareFile = useMemo(
    () => new File([r.blob], status.fileName, { type: "application/pdf" }),
    [r.blob, status.fileName],
  );
  const canShare =
    typeof navigator !== "undefined" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [shareFile] });

  const share = async () => {
    try {
      await navigator.share({ files: [shareFile], title: status.fileName });
    } catch {
      // dibatalkan pengguna — tidak apa-apa
    }
  };

  const engineNotes = r.notes;
  // Catatan mesin lebih spesifik; catatan "apa adanya" kami hanya dipakai kalau mesin diam.
  const lead = r.strategy === "original" && engineNotes.length > 0 ? null : strategyNote(r);
  const notes = lead ? [lead, ...engineNotes] : engineNotes;
  // Di hasil "belum tercapai", vonis dan tips sudah ditulis di atas: jangan diulang.
  const partialNotes = engineNotes.filter((n) => !isVerdictNote(n));
  const tips = tipsFor(r.pageCount, grayscale);

  return (
    <article className={`${styles.receipt} ${partial ? styles.partial : ""}`}>
      <span className={styles.clip}>
        <Paperclip />
      </span>
      <ReceiptHead right={stampedAt} />

      {partial && mode.kind === "target" && (
        <div className={styles.verdict}>
          <NoticeIcon size={22} />
          <div>
            <p className={styles.verdictTitle}>
              Target {kbLabel(mode.kb)} belum tercapai. Hasil terkecil {outSize}.
            </p>
            <p>Kami bilang apa adanya, nggak pura-pura berhasil. Hasil ini tetap bisa diunduh, atau coba tips di bawah.</p>
          </div>
        </div>
      )}

      <div className={styles.grid}>
        <div className={styles.colA}>
          <div className={styles.file}>
            <PdfDocIcon size={26} />
            <div>
              <p className={styles.fileName} title={status.fileName}>
                {file?.name ?? status.fileName}
              </p>
              <p className={styles.fileMeta}>
                {r.pageCount} halaman · {modeLabel(mode)}
                {grayscale ? " · hitam-putih" : ""}
              </p>
            </div>
          </div>
          {saved > 0 ? (
            <div className={styles.sizes}>
              <div className={styles.was}>
                <span className={styles.lbl}>Sebelum</span>
                <span className={styles.v}>
                  <span className="sr-only">ukuran asli </span>
                  {formatBytes(r.originalBytes)}
                </span>
              </div>
              <ArrowRight size={24} />
              <div className={styles.now}>
                <span className={styles.lbl}>Sesudah</span>
                <span className={styles.v}>
                  {num}
                  <small>{unit}</small>
                </span>
              </div>
            </div>
          ) : (
            <div className={styles.sizes}>
              <div className={styles.now}>
                <span className={styles.lbl}>Ukurannya tetap</span>
                <span className={styles.v}>
                  {num}
                  <small>{unit}</small>
                </span>
              </div>
            </div>
          )}
          {!partial && (
            <BeresStamp className={styles.stamp} note={pct > 0 ? `hemat ${pct}%` : "sudah ringkas"} />
          )}
          <Ruler
            original={r.originalBytes}
            value={r.outputBytes}
            target={target}
            targetLabel={mode.kind === "target" ? kbLabel(mode.kb) : undefined}
            label={`${outSize} dari ${formatBytes(r.originalBytes)}${mode.kind === "target" ? `, target ${kbLabel(mode.kb)}` : ""}`}
          />
        </div>

        <div className={styles.colB}>
          <ul className={styles.leaders}>
            <li>
              <span>Ukuran berkurang</span>
              <b>{saved > 0 ? `${formatBytes(saved)} (${pct}%)` : "— (sudah kecil)"}</b>
            </li>
            <li>
              <span>Jumlah halaman</span>
              <b>{r.pageCount}, utuh</b>
            </li>
            {mode.kind === "target" ? (
              <li>
                <span>Target {kbLabel(mode.kb)}</span>
                <b className={partial ? styles.miss : styles.hit}>{partial ? "belum tercapai" : "tercapai"}</b>
              </li>
            ) : (
              <li>
                <span>Tingkat kompres</span>
                <b>{levelName(mode.level)}</b>
              </li>
            )}
            <li>
              <span>Teks</span>
              <b>{textState(r)}</b>
            </li>
            <li>
              <span>Ongkos</span>
              <b>Rp0,-</b>
            </li>
          </ul>

          <a className={`btn btn-primary btn-lg btn-block ${styles.dl}`} href={status.url} download={status.fileName}>
            <DownloadIcon />
            <span>
              {partial ? "Unduh hasil terkecil" : "Unduh PDF"} <span className={styles.dlSize}>({outSize})</span>
            </span>
          </a>

          <div className={styles.actions}>
            {canShare && (
              <button type="button" className="btn btn-quiet" onClick={share}>
                <ShareIcon />
                Kirim
              </button>
            )}
            {!partial && !unchanged && r.strategy !== "original" && onTrySmaller ? (
              <button type="button" className="btn btn-quiet" onClick={onTrySmaller}>
                Coba lebih kecil
              </button>
            ) : (
              <button type="button" className="btn btn-quiet" onClick={onAdjust}>
                Ganti setelan
              </button>
            )}
            <button type="button" className="btn btn-quiet" onClick={onAnother}>
              Kompres file lain
            </button>
          </div>
        </div>
      </div>

      {partial ? (
        <div className={styles.tips}>
          <h3 className={styles.tipsTitle}>Masih kegedean? Coba ini dulu</h3>
          <ol>
            {tips.map(([b, rest]) => (
              <li key={b}>
                <b>{b}</b>
                {rest}
              </li>
            ))}
          </ol>
          {partialNotes.length > 0 && (
            <div className={styles.catatan}>
              <h4>Catatan</h4>
              <ul>
                {partialNotes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <div className={styles.note}>
          <p>
            <b>Perhatian:</b> buka hasilnya dulu sebelum dikirim. Perbesar bagian yang penting (NIK, nilai, tanda
            tangan), pastikan masih terbaca.
          </p>
          <ul>
            {notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
            {target !== null && (
              <li>
                Ukuran di sini dihitung 1 KB = 1.024 byte. Pengelola file di HP Android menghitung 1 KB = 1.000
                byte, jadi file ini bisa tertulis {Math.round(r.outputBytes / 1000).toLocaleString("id-ID")} kB di
                sana. Tetap di bawah batas {mode.kind === "target" ? kbLabel(mode.kb) : ""}, kok.
              </li>
            )}
          </ul>
        </div>
      )}
    </article>
  );
}
