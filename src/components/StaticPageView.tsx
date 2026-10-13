import type { Metadata } from "next";
import type { StaticPage } from "@/content/pages";
import { pageMetadata } from "@/lib/seo";
import { Breadcrumb } from "@/components/site/Breadcrumb";
import { Emph } from "@/components/site/Emph";
import { KabarWuspot } from "@/components/site/Widgets";
import styles from "./StaticPageView.module.css";

export function staticMetadata(page: StaticPage): Metadata {
  return pageMetadata({
    path: `/${page.slug}`,
    title: page.metaTitle,
    description: page.metaDescription,
    // "Tentang wuspot" tidak perlu jadi "Tentang wuspot · wuspot".
    absoluteTitle: page.metaTitle.toLowerCase().includes("wuspot"),
  });
}

const BULAN = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

/** "2026-10-07" -> "7 Oktober 2026" (tanpa Intl, supaya sama di server & browser). */
function tanggal(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${BULAN[m - 1]} ${y}`;
}

/**
 * Halaman dokumen (Tentang, Privasi, Syarat, Kontak): selembar kertas folio
 * dengan nomor bagian di margin merah. `children` muncul setelah pembuka.
 * Kolom samping (≥1060px) berisi Kabar wuspot kalau tidak diisi lain, supaya
 * semua halaman dokumen punya tata letak yang sama.
 */
export function StaticPageView({
  page,
  children,
  aside,
}: {
  page: StaticPage;
  children?: React.ReactNode;
  aside?: React.ReactNode;
}) {
  const side = aside ?? <KabarWuspot />;
  const numbered = page.sections.filter((s) => s.heading).length > 1;
  // Nomor bagian (01, 02, …) hanya untuk bagian yang berjudul.
  const numbers = page.sections.map((_, i) => page.sections.slice(0, i + 1).filter((s) => s.heading).length);
  return (
    <div className={`wrap ${styles.page}`}>
      <Breadcrumb items={[{ name: "Beranda", href: "/" }, { name: page.h1 }]} />
      <div className={styles.layout}>
        <article className={styles.doc}>
          <header className={styles.head}>
            <h1 className={styles.h1}>{page.h1}</h1>
            {page.lead && <p className={styles.lead}>{page.lead}</p>}
            {page.updated && (
              <p className={styles.updated}>
                Terakhir diperbarui <time dateTime={page.updated}>{tanggal(page.updated)}</time>
              </p>
            )}
          </header>

          {children}

          {page.sections.map((s, i) => {
            return (
              <section key={i} className={styles.section}>
                {s.heading && (
                  <h2 className={styles.h2}>
                    {numbered && (
                      <>
                        <span className={styles.num} aria-hidden="true">
                          {String(numbers[i]).padStart(2, "0")}
                        </span>{" "}
                      </>
                    )}
                    {s.heading}
                  </h2>
                )}
                {s.paragraphs.map((p, j) => (
                  <p key={j}>
                    <Emph text={p} />
                  </p>
                ))}
                {s.list && (
                  <ol className={styles.list}>
                    {s.list.map((li) => (
                      <li key={li}>
                        <Emph text={li} />
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            );
          })}
        </article>
        <aside className={styles.aside} aria-label="Catatan samping">
          {side}
        </aside>
      </div>
    </div>
  );
}
