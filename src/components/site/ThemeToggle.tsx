"use client";

import { useLayoutEffect, useSyncExternalStore } from "react";
import { applyTheme, readStoredTheme, storeTheme, systemTheme, type ThemeName } from "@/lib/theme";
import styles from "./ThemeToggle.module.css";

const EVENT = "wuspot:tema";

function subscribe(onChange: () => void) {
  const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
  // Tema diganti di tab lain: ikut ganti di sini.
  const onStorage = () => {
    applyTheme(readStoredTheme());
    onChange();
  };
  mq?.addEventListener?.("change", onChange);
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    mq?.removeEventListener?.("change", onChange);
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** Tema yang sedang tampil: pilihan pengguna, kalau tidak ada ikut sistem. */
function currentTheme(): ThemeName {
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr === "light" || attr === "dark") return attr;
  return systemTheme();
}

export function ThemeToggle() {
  // null di server: server tidak tahu tema pengguna.
  const theme = useSyncExternalStore<ThemeName | null>(subscribe, currentTheme, () => null);

  // Mode pengembangan me-remount <html> dan menghapus data-theme yang dipasang
  // skrip di <head>; pasang ulang sebelum digambar (di produksi tidak berubah apa-apa).
  useLayoutEffect(() => {
    applyTheme(readStoredTheme());
    window.dispatchEvent(new Event(EVENT));
  }, []);

  const next: ThemeName = theme === "dark" ? "light" : "dark";
  const label =
    theme === null ? "Ganti tampilan terang/gelap" : theme === "dark" ? "Pakai tampilan terang" : "Pakai tampilan gelap";

  return (
    <button
      type="button"
      className={styles.btn}
      aria-label={label}
      title={label}
      onClick={() => {
        storeTheme(next);
        applyTheme(next);
        window.dispatchEvent(new Event(EVENT));
      }}
    >
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
        <circle cx="10" cy="10" r="7.25" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M10 2.75a7.25 7.25 0 0 1 0 14.5z" fill="currentColor" />
      </svg>
    </button>
  );
}
