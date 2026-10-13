import { AdPush } from "./AdPush";
import styles from "./AdSlot.module.css";

// Nomor slot AdSense per penempatan (opsional). Ditulis satu per satu supaya
// Next bisa menanamkan nilainya saat build.
const SLOT_IDS: Record<AdName, string | undefined> = {
  konten: process.env.NEXT_PUBLIC_ADSENSE_SLOT_KONTEN,
  samping: process.env.NEXT_PUBLIC_ADSENSE_SLOT_SAMPING,
};

export type AdName = "konten" | "samping";

/**
 * Ruang iklan. Tidak merender apa pun sampai NEXT_PUBLIC_ADSENSE_CLIENT diisi.
 * Di mode pengembangan muncul kotak arsir berlabel supaya tata letak bisa dinilai.
 * Aturan penempatan: tidak menempel ke kotak file, tombol Kompres, atau tombol Unduh,
 * dan tidak ada iklan menempel (sticky) di HP.
 */
export function AdSlot({ name, className }: { name: AdName; className?: string }) {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
  const cls = `${styles.slot} ${name === "samping" ? styles.side : styles.inline} ${className ?? ""}`;

  if (!client) {
    if (process.env.NODE_ENV === "production") return null;
    return (
      <div className={cls} data-ad={name}>
        <span className={styles.label}>Iklan</span>
        <div className={styles.placeholder}>
          ruang iklan · {name === "samping" ? "300 × 250, menempel di kolom samping" : "responsif"}
        </div>
      </div>
    );
  }

  const slot = SLOT_IDS[name];
  return (
    <aside className={cls} aria-label="Iklan" data-ad={name}>
      <span className={styles.label}>Iklan</span>
      <ins
        className={`adsbygoogle ${styles.ins}`}
        style={{ display: "block" }}
        data-ad-client={client}
        {...(slot ? { "data-ad-slot": slot } : {})}
        data-ad-format={name === "samping" ? "rectangle" : "auto"}
        data-full-width-responsive={name === "samping" ? "false" : "true"}
      />
      <AdPush />
    </aside>
  );
}
