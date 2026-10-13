import Link from "next/link";
import { NavTabs } from "./NavTabs";
import { SearchTools } from "./SearchTools";
import { ThemeToggle } from "./ThemeToggle";
import { Wordmark } from "./Wordmark";
import styles from "./Header.module.css";

export function Header() {
  return (
    <>
      <a className="skip" href="#isi">
        Langsung ke isi
      </a>
      <header className={styles.top}>
        <div className={`wrap ${styles.row}`}>
          <Link href="/" className={styles.logo} aria-label="wuspot, ke beranda">
            <Wordmark />
          </Link>
          <span className={styles.tagline}>
            alat gratis buat
            <br />
            beresin berkas
          </span>
          <NavTabs variant="bar" />
          <div className={styles.tools}>
            <SearchTools />
            <ThemeToggle />
          </div>
        </div>
      </header>
      <NavTabs variant="tabs" />
    </>
  );
}
