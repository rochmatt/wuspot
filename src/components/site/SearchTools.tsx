"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { CATEGORY_LABEL, TOOLS, type ToolEntry } from "@/lib/site";
import styles from "./SearchTools.module.css";

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function haystack(t: ToolEntry): string {
  return norm([t.name, t.blurb, CATEGORY_LABEL[t.category], ...(t.keywords ?? [])].join(" "));
}

const INDEX = TOOLS.map((t) => ({ tool: t, text: haystack(t) }));

// Kata yang hampir selalu ikut diketik tapi tidak membedakan alat.
const STOPWORDS = new Set(
  "cara online gratis file ukuran yang di ke dari untuk buat jadi dengan agar supaya biar bisa tanpa aplikasi situs web".split(
    " ",
  ),
);

/**
 * Imbuhan sederhana: "mengecilkan" → "ecil" (tetap cocok dengan "kecil"),
 * "kecilin" → "kecil", "perkecil" → "kecil". Cukup untuk mencocokkan kata.
 */
function stem(w: string): string {
  let s = w;
  const suf = s.match(/^(.{4,}?)(kan|in|nya|an)$/);
  if (suf) s = suf[1];
  const pre = s.match(/^(meng|mem|men|me|per|di|ter)(.{4,})$/);
  if (pre) s = pre[2];
  return s;
}

/**
 * Tiap kata dicocokkan (utuh atau bentuk dasarnya). Alat diurutkan menurut
 * jumlah kata yang cocok; yang ditampilkan hanya yang skornya tertinggi,
 * frasa utuh yang cocok didahulukan, lalu alat yang sudah siap.
 */
function search(q: string): ToolEntry[] {
  const all = norm(q).split(" ").filter(Boolean);
  if (all.length === 0) return TOOLS;
  const words = all.filter((w) => !STOPWORDS.has(w));
  const use = words.length > 0 ? words : all;
  const phrase = norm(q);
  const scored = INDEX.map(({ tool, text }) => ({
    tool,
    score: use.filter((w) => text.includes(w) || text.includes(stem(w))).length,
    phrase: text.includes(phrase),
  }));
  const best = Math.max(...scored.map((x) => x.score));
  if (best === 0) return [];
  return scored
    .filter((x) => x.score === best)
    .sort((a, b) => Number(b.phrase) - Number(a.phrase) || Number(b.tool.ready) - Number(a.tool.ready))
    .map((x) => x.tool);
}

/** Cari alat. Di layar lebar berupa kolom; di HP berupa tombol yang membuka panel. */
export function SearchTools() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false); // panel HP
  const [listOpen, setListOpen] = useState(false); // daftar hasil (layar lebar)
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const results = useMemo(() => search(q), [q]);
  const showList = listOpen || open;

  useEffect(() => {
    if (!showList) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setListOpen(false);
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [showList]);

  const close = () => {
    setListOpen(false);
    setOpen(false);
  };

  const links = () => Array.from(rootRef.current?.querySelectorAll<HTMLElement>(`#${CSS.escape(listId)} a`) ?? []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      // Panel HP: tutup dan kembalikan fokus ke tombolnya. Layar lebar: tutup
      // daftarnya saja, fokus tetap di kolom cari.
      if (open) {
        setOpen(false);
        setListOpen(false);
        toggleRef.current?.focus();
      } else {
        setListOpen(false);
        inputRef.current?.focus();
      }
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      const items = links();
      if (items.length === 0) return;
      const i = items.indexOf(document.activeElement as HTMLElement);
      e.preventDefault();
      if (e.key === "ArrowDown") (items[i + 1] ?? items[i] ?? items[0]).focus();
      else if (i <= 0) inputRef.current?.focus();
      else items[i - 1].focus();
    }
  };

  const onBlurWithin = (e: React.FocusEvent) => {
    if (!rootRef.current?.contains(e.relatedTarget as Node)) close();
  };

  return (
    <div
      ref={rootRef}
      className={styles.root}
      data-open={open || undefined}
      onKeyDown={onKeyDown}
      onBlur={onBlurWithin}
    >
      <button
        ref={toggleRef}
        type="button"
        className={styles.toggle}
        aria-expanded={open}
        aria-controls={`${listId}-panel`}
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next) requestAnimationFrame(() => inputRef.current?.focus());
        }}
      >
        <SearchIcon />
        <span className="sr-only">{open ? "Tutup pencarian" : "Cari alat"}</span>
      </button>

      <div className={styles.panel} id={`${listId}-panel`}>
        <form
          role="search"
          className={styles.form}
          onSubmit={(e) => {
            e.preventDefault();
            const first = results.find((t) => t.ready);
            const link = first && rootRef.current?.querySelector<HTMLAnchorElement>(`a[data-slug="${first.slug}"]`);
            link?.click();
          }}
        >
          <SearchIcon />
          <label htmlFor={`${listId}-q`} className="sr-only">
            Cari alat
          </label>
          <input
            ref={inputRef}
            id={`${listId}-q`}
            type="search"
            value={q}
            placeholder="Cari alat, misal: kecilkan PDF"
            autoComplete="off"
            enterKeyHint="search"
            onChange={(e) => {
              setQ(e.target.value);
              setListOpen(true);
            }}
            onFocus={() => setListOpen(true)}
          />
        </form>

        {showList && (
          <div className={styles.results}>
            <p className={styles.count} aria-live="polite">
              {q.trim() === ""
                ? "Semua alat di wuspot"
                : results.length === 0
                  ? "Belum ada alat yang cocok."
                  : `${results.length} alat cocok`}
            </p>
            <ul id={listId} className={styles.list}>
              {results.map((t) => (
                <li key={t.slug}>
                  {t.ready ? (
                    <Link href={`/${t.slug}`} data-slug={t.slug} className={styles.item} onClick={close}>
                      <span className={styles.name}>{t.name}</span>
                      <span className={styles.blurb}>{t.blurb}</span>
                      <span className={styles.cat}>{CATEGORY_LABEL[t.category]}</span>
                    </Link>
                  ) : (
                    <div className={`${styles.item} ${styles.soon}`} aria-disabled="true">
                      <span className={styles.name}>
                        {t.name}
                        <span className={styles.tag}>segera</span>
                      </span>
                      <span className={styles.blurb}>{t.blurb}</span>
                      <span className={styles.cat}>{CATEGORY_LABEL[t.category]}</span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            {q.trim() !== "" && results.length === 0 && (
              <p className={styles.empty}>
                Butuh alat ini? <Link href="/kontak" className="pen-link" onClick={close}>Bilang aja</Link>, kami catat.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.5 15.5 20.5 20.5" />
    </svg>
  );
}
