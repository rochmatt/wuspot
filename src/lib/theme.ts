// Tema terang/gelap. Bawaan mengikuti pengaturan HP/laptop (prefers-color-scheme);
// kalau pengguna menekan tombol tema, pilihannya disimpan di localStorage.

export type ThemeName = "light" | "dark";

export const THEME_KEY = "wuspot:tema";

/** Warna kertas tiap tema, dipakai untuk meta theme-color (bilah alamat di HP). */
export const THEME_COLORS: Record<ThemeName, string> = {
  light: "#F4EFE6",
  dark: "#171512",
};

/**
 * Skrip kecil di <head>: dijalankan sebelum halaman digambar. Hanya memasang
 * data-theme kalau pengguna pernah memilih sendiri; selebihnya CSS mengikuti
 * prefers-color-scheme.
 */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_KEY,
)});if(t==="light"||t==="dark"){document.documentElement.setAttribute("data-theme",t)}}catch(e){}})()`;

export function readStoredTheme(): ThemeName | null {
  try {
    const t = window.localStorage.getItem(THEME_KEY);
    return t === "light" || t === "dark" ? t : null;
  } catch {
    return null;
  }
}

export function systemTheme(): ThemeName {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Pasang tema di <html> + samakan meta theme-color. */
export function applyTheme(theme: ThemeName | null) {
  const root = document.documentElement;
  if (theme) root.setAttribute("data-theme", theme);
  else root.removeAttribute("data-theme");
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
    if (theme) m.content = THEME_COLORS[theme];
    else m.content = m.media.includes("dark") ? THEME_COLORS.dark : THEME_COLORS.light;
  });
}

export function storeTheme(theme: ThemeName) {
  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    // mode privat / penyimpanan diblokir: tema tetap berlaku sampai halaman ditutup
  }
}
