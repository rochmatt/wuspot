import { StaticPageView, staticMetadata } from "@/components/StaticPageView";
import { KONTAK } from "@/content/pages";
import { SITE } from "@/lib/site";
import styles from "./kontak.module.css";

export const metadata = staticMetadata(KONTAK);

export default function Page() {
  return (
    <StaticPageView page={KONTAK}>
      {/* lembar disposisi: kepada, perihal, kapan dibalas. Satu ajakan saja: alamatnya. */}
      <div className={styles.slip}>
        <dl className={styles.rows}>
          <div className={styles.row}>
            <dt>Kepada</dt>
            <dd>
              <a className={styles.email} href={`mailto:${SITE.email}`}>
                {SITE.email}
              </a>
            </dd>
          </div>
          <div className={styles.row}>
            <dt>Perihal</dt>
            <dd>saran alat, laporan bug, atau pertanyaan</dd>
          </div>
          <div className={styles.row}>
            <dt>Dibalas</dt>
            <dd>oleh manusia, biasanya dalam beberapa hari</dd>
          </div>
        </dl>
        <p className={styles.note}>
          Ketuk alamatnya untuk membuka aplikasi email. Sengaja belum ada formulir di sini, biar kamu tahu persis
          pesanmu dikirim ke mana.
        </p>
      </div>
    </StaticPageView>
  );
}
