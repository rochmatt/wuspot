import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getKompresPage } from "@/content/kompres-pdf";
import { breadcrumbLd, faqLd, jsonLdString, pageMetadata, webAppLd } from "@/lib/seo";
import { SITE, TOOLS } from "@/lib/site";
import { AdSlot } from "@/components/site/AdSlot";
import { Breadcrumb } from "@/components/site/Breadcrumb";
import { Emph } from "@/components/site/Emph";
import { FaqList } from "@/components/site/FaqList";
import { PrivacyBand } from "@/components/site/PrivacyBand";
import { RoundStamp } from "@/components/site/Stamp";
import { ToolFolders } from "@/components/site/ToolFolders";
import { KabarWuspot, PatokanCepat, UkuranLain } from "@/components/site/Widgets";
import { kern } from "@/components/site/kern";
import { KompresTool } from "./KompresTool";
import { kbLabel } from "./labels";
import styles from "./KompresPdfPage.module.css";

export function kompresMetadata(slug: string): Metadata {
  const page = getKompresPage(slug);
  if (!page) return {};
  return pageMetadata({ path: `/${page.slug}`, title: page.metaTitle, description: page.metaDescription });
}

export function KompresPdfPage({ slug }: { slug: string }) {
  const page = getKompresPage(slug);
  if (!page) notFound();

  const preset = page.presetKb;
  const crumbs = [
    { name: "Beranda", href: "/" },
    { name: "PDF", href: "/#alat-pdf" },
    preset ? { name: "Kompres PDF", href: "/kompres-pdf" } : { name: "Kompres PDF" },
    ...(preset ? [{ name: kbLabel(preset) }] : []),
  ];
  const ldCrumbs = [
    { name: "Beranda", path: "/" },
    { name: "Kompres PDF", path: "/kompres-pdf" },
    ...(preset ? [{ name: page.h1, path: `/${page.slug}` }] : []),
  ];
  const others = TOOLS.filter((t) => t.slug !== "kompres-pdf");
  const howTitle = preset ? `Cara kompres PDF ke ${kbLabel(preset)}` : "Cara kompres PDF";

  return (
    <>
      <div className="wrap">
        <div className={styles.page}>
          {/* Kepala halaman satu baris penuh, supaya kolom samping selalu mulai
              sejajar tab map, berapa pun panjang judul dan pembukanya. */}
          <div className={styles.head}>
            <Breadcrumb items={crumbs} />
            <header className={styles.hero}>
              <RoundStamp className={styles.stamp} />
              <h1 className={styles.h1}>{kern(page.h1)}</h1>
              <p className={styles.lede}>
                <Emph text={page.lead} />
              </p>
            </header>
          </div>

          <div className={styles.main}>
            <div className={styles.tool}>
              <KompresTool presetKb={preset} />
            </div>

            <section className={`${styles.block} ${styles.intro}`} aria-labelledby="pembuka-h">
              <h2 id="pembuka-h" className={styles.h2}>
                {kern(page.introTitle)}
              </h2>
              {page.intro.map((p) => (
                <p key={p}>
                  <Emph text={p} />
                </p>
              ))}
            </section>

            <section className={`${styles.block} ${styles.how}`} aria-labelledby="petunjuk-h">
              <h2 id="petunjuk-h" className={styles.h2}>
                Petunjuk pengisian<span className="sr-only">:</span>{" "}
                <span className={styles.h2Sub}>{howTitle}</span>
              </h2>
              <ol className={styles.steps}>
                {page.steps.map((s, i) => (
                  <li key={s.title}>
                    <span className={styles.stepNum} aria-hidden="true">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <h3>{s.title}</h3>
                      <p>
                        <Emph text={s.body} />
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            <section className={`${styles.block} ${styles.notes}`} aria-labelledby="catatan-h">
              <h2 id="catatan-h" className={styles.h3}>
                {page.notes.title}
              </h2>
              <ul>
                {page.notes.items.map((it) => (
                  <li key={it}>{it}</li>
                ))}
              </ul>
            </section>
          </div>

          <aside className={styles.side} aria-label="Catatan samping">
            <PatokanCepat className={styles.patokan} />
            <UkuranLain current={preset} className={styles.ukuran} />
            {/* Kabar + iklan samping ikut menempel saat halaman digulir (≥1060px),
                tapi berhenti di akhir catatan: tidak bersebelahan dengan iklan konten. */}
            <div className={styles.stick}>
              <KabarWuspot className={styles.kabar} />
              <AdSlot name="samping" className={styles.adSide} />
            </div>
          </aside>

          <AdSlot name="konten" className={styles.adInline} />
        </div>
      </div>

      <PrivacyBand />

      <div className="wrap">
        <section className={styles.faq} aria-labelledby="faq-h">
          <div className={styles.faqHead}>
            <h2 id="faq-h" className={styles.h2}>
              Yang sering ditanyain
            </h2>
            <p>
              Belum kejawab? Tulis ke{" "}
              <a className="pen-link" href={`mailto:${SITE.email}`}>
                {SITE.email}
              </a>
              , dibalas manusia.
            </p>
            {preset ? (
              <p>
                Pertanyaan umum lainnya ada di halaman{" "}
                <Link href="/kompres-pdf#faq-h" className="pen-link">
                  Kompres PDF
                </Link>
                .
              </p>
            ) : null}
          </div>
          <FaqList items={page.faq} />
        </section>

        <section className={styles.more} aria-labelledby="lain-h">
          <div className={styles.moreHead}>
            <div>
              <h2 id="lain-h" className={styles.h2}>
                Alat lain
              </h2>
              <p>Lagi disiapin satu-satu. Yang paling sering diminta duluan.</p>
            </div>
            <Link href="/#alat" className="pen-link">
              Lihat semua alat
            </Link>
          </div>
          <ToolFolders tools={others.slice(0, 4)} />
        </section>
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdString([
            webAppLd({ name: page.h1, path: `/${page.slug}`, description: page.metaDescription }),
            breadcrumbLd(ldCrumbs),
            faqLd(page.faq),
          ]),
        }}
      />
    </>
  );
}
