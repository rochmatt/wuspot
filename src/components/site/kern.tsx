import type { ReactNode } from "react";

/**
 * Judul besar (Plus Jakarta Sans 800): koma, titik, dan tanda tanya punya
 * ruang kiri yang lebar, jadi "sini ," terlihat seperti salah ketik. Tanda
 * baca dibungkus span yang ditarik sedikit ke kiri (lihat .kp/.kq di globals).
 */
export function kern(text: string): ReactNode {
  const parts = text.split(/([,.:;?!])/);
  if (parts.length === 1) return text;
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <span key={i} className={part === "?" || part === "!" ? "kq" : "kp"}>
        {part}
      </span>
    ) : (
      part
    ),
  );
}
