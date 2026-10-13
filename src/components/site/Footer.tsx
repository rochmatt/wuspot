import Link from "next/link";
import { SITE } from "@/lib/site";
import { Wordmark } from "./Wordmark";
import styles from "./Footer.module.css";

/** Kaki halaman = sampul belakang map. */
export function Footer() {
  return (
    <footer className={styles.foot}>
      <span className={styles.tab} aria-hidden="true">
        wuspot.com
      </span>
      <div className={`wrap ${styles.inner}`}>
        <div className={styles.about}>
          <Link href="/" className={styles.logo} aria-label="wuspot, ke beranda">
            <Wordmark size="lg" />
          </Link>
          <p className={styles.line}>
            Alat gratis buat beresin berkas, langsung di HP atau laptopmu. Nama lama, wajah baru.
          </p>
          <p className={styles.ask}>
            Butuh alat yang belum ada?{" "}
            <Link href="/kontak" className={styles.askLink}>
              Bilang aja
            </Link>
            .
          </p>
        </div>

        <nav className={styles.nav} aria-label="Tentang situs">
          <ul>
            <li>
              <Link href="/kompres-pdf">Kompres PDF</Link>
            </li>
            <li>
              <Link href="/tentang">Tentang</Link>
            </li>
            <li>
              <Link href="/kontak">Kontak</Link>
            </li>
            <li>
              <Link href="/privasi">Privasi</Link>
            </li>
            <li>
              <Link href="/syarat">Syarat</Link>
            </li>
          </ul>
        </nav>

        <div className={styles.bottom}>
          <span>© 2026 {SITE.name}.com · Dibuat di Indonesia</span>
          <span>Berkas beres tanpa antre fotokopi.</span>
        </div>
      </div>
    </footer>
  );
}
