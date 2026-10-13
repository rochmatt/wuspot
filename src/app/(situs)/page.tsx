import type { Metadata } from "next";
import Link from "next/link";
import { KOMPRES_PRESETS } from "@/content/kompres-pdf";
import { OG_IMAGE, jsonLdString, websiteLd } from "@/lib/seo";
import { SHELVES, SITE, TOOLS } from "@/lib/site";
import { PrivacyBand } from "@/components/site/PrivacyBand";
import { BeresStamp } from "@/components/site/Stamp";
import { ToolFolders } from "@/components/site/ToolFolders";
import { KabarWuspot } from "@/components/site/Widgets";
import { kern } from "@/components/site/kern";
import styles from "./home.module.css";

export const metadata: Metadata = {
  title: { absolute: "wuspot — Alat online gratis buat beresin berkas" },
  description:
    "Kompres PDF sampai ukuran KB yang diminta formulir CPNS, lamaran kerja, atau pendaftaran sekolah. Gratis, tanpa daftar, file nggak di-upload.",
  alternates: { canonical: SITE.url + "/" },
  openGraph: {
    type: "website",
    locale: SITE.locale,
    siteName: SITE.name,
    url: SITE.url + "/",
    title: "wuspot — Alat online gratis buat beresin berkas",
    description:
      "Kompres PDF sampai ukuran KB yang diminta formulir CPNS, lamaran kerja, atau pendaftaran sekolah. Gratis, tanpa daftar, file nggak di-upload.",
    images: [OG_IMAGE],
  },
  twitter: { card: "summary_large_image", images: [OG_IMAGE.url] },
};

const sizeLabel = (kb: number) => (kb >= 1000 ? `${kb / 1000} MB` : `${kb} KB`);

export default function Home() {
  const ready = TOOLS.filter((t) => t.ready).length;
  return (
    <>
      <div className="wrap">
        <section className={styles.hero} aria-labelledby="beranda-h">
          <div className={styles.heroText}>
            <h1 id="beranda-h" className={styles.h1}>
              {kern("Berkas kebesaran? Kecilkan di sini, langsung dari HP.")}
            </h1>
            <p className={styles.lede}>
              Kompres PDF sampai ukuran KB yang diminta portal CPNS, lamaran kerja, atau pendaftaran sekolah. Gratis,
              tanpa daftar, dan <b>file kamu nggak <span className="nw">di-upload</span> ke mana-mana.</b>
            </p>
            <div className={styles.cta}>
              <Link href="/kompres-pdf" className="btn btn-primary btn-lg">
                Buka Kompres PDF
                <svg width="22" height="14" viewBox="0 0 22 14" aria-hidden="true">
                  <path d="M1 7h19m-6-6 6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            </div>

            <nav className={styles.sizes} aria-labelledby="ukuran-h">
              <p id="ukuran-h" className={styles.sizesLabel}>
                Sudah tahu batasnya? Langsung ke:
              </p>
              <ul>
                {KOMPRES_PRESETS.map((p) => (
                  <li key={p.slug}>
                    <Link href={`/${p.slug}`}>
                      <span className="sr-only">Kompres PDF ke </span>
                      {sizeLabel(p.presetKb as number)}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          {/* map coklat berisi formulir yang sudah beres */}
          <Link href="/kompres-pdf" className={styles.folder} aria-label="Buka alatnya: Kompres PDF">
            <span className={styles.folderTab} aria-hidden="true">
              <b>Map 01</b> Kompres PDF
            </span>
            <span className={styles.sheet} aria-hidden="true">
              <span className={styles.sheetHead}>
                <span className={styles.hideNarrow}>Diproses di HP kamu · </span>0 byte ke server
              </span>
              <span className={styles.row}>
                <i>01</i>
                <span>File PDF</span>
                <em>ijazah_depan.pdf</em>
              </span>
              <span className={styles.row}>
                <i>02</i>
                <span>Ukuran hasil</span>
                <em>
                  <u /> 200 KB
                </em>
              </span>
              <span className={`${styles.row} ${styles.hideNarrowRow}`}>
                <i>03</i>
                <span>Hitam-putih</span>
                <em>mati</em>
              </span>
              <span className={`${styles.row} ${styles.rowResult}`}>
                <i />
                <span>Hasil</span>
                <em>
                  <s>2,4 MB</s> 187 KB
                </em>
              </span>
              <BeresStamp note="hemat 92%" className={styles.beres} />
            </span>
            <span className={styles.flap} aria-hidden="true">
              <span>Buka alatnya</span>
              <svg width="22" height="14" viewBox="0 0 22 14">
                <path d="M1 7h19m-6-6 6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </Link>
        </section>
      </div>

      <section id="alat" className={styles.directory} aria-labelledby="alat-h">
        <div className="wrap">
          <div className={styles.dirHead}>
            <h2 id="alat-h" className={styles.h2}>
              Daftar alat
            </h2>
            <p>
              {ready} alat sudah siap, sisanya lagi disiapin satu-satu. Map yang masih tertutup belum bisa dibuka.
            </p>
          </div>
          <div className={styles.shelves}>
            {SHELVES.map((shelf) => {
              const tools = TOOLS.filter((t) => shelf.categories.includes(t.category));
              const wide = tools.length > 2;
              return (
                <div key={shelf.id} id={shelf.id} className={`${styles.shelf} ${wide ? styles.shelfWide : ""}`}>
                  <h3 className={styles.shelfTitle}>
                    {shelf.label} <span>{tools.length} alat</span>
                  </h3>
                  <ToolFolders tools={tools} columns={wide ? 4 : 2} />
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <PrivacyBand />

      <div className="wrap">
        <div className={styles.closing}>
          <KabarWuspot className={styles.kabar} />
          {/* teks biasa, bukan kotak kedua: kartu Kabar sudah cukup jadi "kartu" di baris ini */}
          <section className={styles.ask} aria-labelledby="minta-h">
            <h2 id="minta-h" className={styles.h3}>
              Alat berikutnya
            </h2>
            <p>
              Kami pilih dari yang paling sering diminta: gabung PDF, foto ke PDF, atau pas foto 3x4. Kalau yang kamu
              butuhkan belum ada di daftar, tulis saja lewat{" "}
              <Link href="/kontak" className="pen-link">
                halaman Kontak
              </Link>
              .
            </p>
          </section>
        </div>
      </div>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(websiteLd()) }} />
    </>
  );
}
