import Link from "next/link";
import { KABAR } from "@/lib/site";
import { KOMPRES_PRESETS } from "@/content/kompres-pdf";
import { Emph } from "./Emph";
import styles from "./Widgets.module.css";

/** Kartu indeks: garis merah tipis di bawah judul, garis biru tipis di isinya. */
export function IndexCard({
  title,
  id,
  children,
  className,
}: {
  title: string;
  id: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`${styles.card} ${className ?? ""}`} aria-labelledby={id}>
      <h2 id={id} className={styles.title}>
        {title}
      </h2>
      {children}
    </section>
  );
}

const PATOKAN: [string, string][] = [
  ["Scan KTP / KK", "Sedang"],
  ["Ijazah, transkrip", "Sedang"],
  ["Surat lamaran, CV", "Ringan"],
  ["Scan banyak halaman", "Kuat"],
];

export function PatokanCepat({ className }: { className?: string }) {
  return (
    <IndexCard title="Patokan cepat" id="patokan-h" className={className}>
      <p className={styles.lead}>Formulirnya nggak menyebut batas? Biasanya ini sudah pas.</p>
      <ul className={styles.leaders}>
        {PATOKAN.map(([doc, lvl]) => (
          <li key={doc}>
            <span>{doc}</span>
            <b>{lvl}</b>
          </li>
        ))}
      </ul>
      <p className={styles.tip}>
        <span className={styles.pencil} aria-hidden="true">
          ✎
        </span>
        <span>
          <b>Batasnya maks. 200 KB?</b> Pilih 200 KB. wuspot sudah menyisakan sedikit ruang, jadi hasilnya tetap
          lolos walau portalnya menghitung KB dengan cara berbeda.
        </span>
      </p>
    </IndexCard>
  );
}

export function KabarWuspot({ className }: { className?: string }) {
  return (
    <IndexCard title="Kabar wuspot" id="kabar-h" className={className}>
      <ol className={styles.log}>
        {KABAR.map((k, i) => (
          <li key={i} className={k.date ? styles.done : undefined}>
            <span className={styles.when}>{k.date ? <time dateTime={k.date}>{k.when}</time> : k.when}</span>
            <span className={styles.what}>
              <b>{k.title}</b>
              {k.body ? (
                <>
                  {" "}
                  <Emph text={k.body} />
                </>
              ) : null}
            </span>
          </li>
        ))}
      </ol>
    </IndexCard>
  );
}

const SIZE_LABEL = (kb: number) => (kb >= 1000 ? `${kb / 1000} MB` : `${kb} KB`);

/** Tautan ke halaman ukuran lain, bentuknya tab indeks. */
export function UkuranLain({ current, className }: { current: number | null; className?: string }) {
  return (
    <IndexCard title="Ukuran lain" id="ukuran-h" className={className}>
      <p className={styles.lead}>Halaman yang targetnya sudah dipilihkan:</p>
      <ul className={styles.sizes}>
        {KOMPRES_PRESETS.map((p) => {
          const kb = p.presetKb as number;
          const here = current === kb;
          return (
            <li key={p.slug}>
              <Link href={`/${p.slug}`} aria-current={here ? "page" : undefined}>
                <span className="sr-only">Kompres PDF ke </span>
                {SIZE_LABEL(kb)}
              </Link>
            </li>
          );
        })}
        <li>
          <Link href="/kompres-pdf" aria-current={current === null ? "page" : undefined}>
            Pilih sendiri<span className="sr-only"> ukurannya</span>
          </Link>
        </li>
      </ul>
    </IndexCard>
  );
}
