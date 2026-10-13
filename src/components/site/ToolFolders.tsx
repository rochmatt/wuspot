import Link from "next/link";
import { mapCode, type ToolEntry } from "@/lib/site";
import { ToolIcon } from "./ToolIcon";
import styles from "./ToolFolders.module.css";

/**
 * Laci map coklat. Tab tiap map berisi kode map (Map 01, Map 02, …) dan digeser
 * kiri–tengah–kanan seperti map potong sungguhan. Map yang belum siap tampil
 * "tertutup": lebih pucat, tanpa ikon, tidak ditautkan. Cap SEGERA merah hanya
 * untuk alat yang dibuka berikutnya.
 */
export function ToolFolders({ tools, columns = 4 }: { tools: ToolEntry[]; columns?: number }) {
  return (
    <ul className={styles.drawer} style={{ "--cols": columns } as React.CSSProperties}>
      {tools.map((t) => (
        <li key={t.slug} className={`${styles.folder} ${t.ready ? styles.ready : styles.closed}`}>
          <span className={styles.tab} aria-hidden="true">
            Map {mapCode(t.slug)}
          </span>
          {t.ready ? (
            <Link href={`/${t.slug}`} className={styles.body}>
              <ToolIcon slug={t.slug} />
              <span className={styles.name}>{t.name}</span>
              <span className={styles.blurb}>{t.blurb}</span>
              <span className={styles.open}>
                Buka alat
                <svg width="18" height="12" viewBox="0 0 22 14" aria-hidden="true">
                  <path d="M1 7h19m-6-6 6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </Link>
          ) : (
            <div className={styles.body} aria-disabled="true">
              <span className={styles.name}>{t.name}</span>
              <span className={styles.blurb}>{t.blurb}</span>
              {t.next ? (
                <span className={styles.stamp}>segera</span>
              ) : (
                <span className={styles.soon}>belum dibuka</span>
              )}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
