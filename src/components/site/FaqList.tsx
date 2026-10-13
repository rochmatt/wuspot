import type { FaqItem } from "@/content/kompres-pdf";
import { Emph } from "./Emph";
import styles from "./FaqList.module.css";

/** Tanya-jawab gaya "T. / J.". Pertanyaan pertama terbuka. */
export function FaqList({ items }: { items: FaqItem[] }) {
  return (
    <div className={styles.list}>
      {items.map((it, i) => (
        <details key={it.q} open={i === 0} className={styles.item}>
          <summary>
            <span className={styles.q} aria-hidden="true">
              T.
            </span>
            <span className={styles.qText}>
              <Emph text={it.q} />
            </span>
            <span className={styles.sign} aria-hidden="true" />
          </summary>
          <div className={styles.ans}>
            <span className={styles.a} aria-hidden="true">
              J.
            </span>
            <p>
              <Emph text={it.a} />
            </p>
          </div>
        </details>
      ))}
    </div>
  );
}
