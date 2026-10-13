import Link from "next/link";
import type { ReactNode } from "react";

/** Kata berstrip ("di-upload", "hitam-putih") tidak dipenggal di ujung baris. */
function keepHyphenated(text: string, key: string): ReactNode[] {
  return text
    .split(/(\S+-\S+)/)
    .map((part, i) => (i % 2 === 1 ? <span key={`${key}-${i}`} className="nw">{part}</span> : part));
}

/**
 * Teks dari src/content dengan markup kecil: **tebal** dan [tautan](/alamat)
 * (hanya alamat di situs ini).
 */
export function Emph({ text }: { text: string }) {
  const out: ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|\[(.+?)\]\((\/[^)\s]*)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(...keepHyphenated(text.slice(last, m.index), `t${last}`));
    if (m[1] !== undefined) out.push(<b key={`b${m.index}`}>{keepHyphenated(m[1], `b${m.index}`)}</b>);
    else
      out.push(
        <Link key={`a${m.index}`} href={m[3]} className="pen-link">
          {m[2]}
        </Link>,
      );
    last = re.lastIndex;
  }
  if (last < text.length) out.push(...keepHyphenated(text.slice(last), `t${last}`));
  return <>{out}</>;
}

/** Versi polos untuk meta/JSON-LD. */
export function plain(text: string): string {
  return text.replaceAll("**", "").replace(/\[(.+?)\]\((\/[^)\s]*)\)/g, "$1");
}
