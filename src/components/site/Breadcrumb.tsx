import Link from "next/link";
import styles from "./Breadcrumb.module.css";

export interface Crumb {
  name: string;
  /** Tanpa href = halaman ini. */
  href?: string;
}

export function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav className={styles.crumb} aria-label="Posisi halaman">
      <ol>
        {items.map((it, i) => (
          <li key={i}>
            {it.href ? (
              <Link href={it.href}>{it.name}</Link>
            ) : (
              <span aria-current="page">{it.name}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
