import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/site/Footer";
import { Header } from "@/components/site/Header";
import { kern } from "@/components/site/kern";
import styles from "./not-found.module.css";

// Next sudah memasang robots noindex untuk halaman 404.
export const metadata: Metadata = {
  title: "Halaman nggak ketemu",
};

// Dirender di luar grup (situs), jadi kepala & kaki halaman dipasang langsung.
export default function NotFound() {
  return (
    <>
      <Header />
      <main id="isi" tabIndex={-1} className={`wrap ${styles.page}`}>
        <div className={styles.folder} aria-hidden="true">
          <span className={styles.tab}>
            <b>Map 404</b> kosong
          </span>
          <span className={styles.inside}>
            <span className={styles.slip}>isi map ini nggak ada</span>
          </span>
        </div>
        <div className={styles.text}>
          <p className={styles.code}>404</p>
          <h1 className={styles.h1}>{kern("Halamannya nggak ketemu.")}</h1>
          <p className={styles.lede}>
            Kayaknya berkas ini keselip, atau alamatnya salah ketik. Tenang, file kamu nggak ke mana-mana: semuanya
            memang cuma ada di perangkatmu.
          </p>
          <ul className={styles.links}>
            <li>
              <Link href="/kompres-pdf" className="btn btn-primary">
                Buka Kompres PDF
              </Link>
            </li>
            <li>
              <Link href="/#alat" className="btn btn-secondary">
                Lihat semua alat
              </Link>
            </li>
          </ul>
          <p className={styles.home}>
            atau{" "}
            <Link href="/" className="pen-link">
              kembali ke beranda
            </Link>
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
