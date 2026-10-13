import styles from "./Wordmark.module.css";

/** "wusp●t": huruf o diganti titik tinta stempel merah. */
export function Wordmark({ size = "md" }: { size?: "md" | "lg" }) {
  return (
    <span className={`${styles.mark} ${size === "lg" ? styles.lg : ""}`} aria-hidden="true">
      wusp<i className={styles.dot} />t
    </span>
  );
}
