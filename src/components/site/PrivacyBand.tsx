import styles from "./PrivacyBand.module.css";

const STEPS = ["Membaca file", "Mengecilkan gambar", "Menyusun ulang PDF", "Menyimpan hasil"];

// Centang pulpen, sedikit beda tiap baris supaya terlihat ditulis tangan.
const TICKS = [
  "M3 13c3 2 5 4 6.5 8C13 12 19 6 27 2",
  "M3 12c3 3 5 5 6 9C14 11 19 6 27 3",
  "M3 14c3 1 5 4 7 7C13 13 18 7 27 2",
  "M4 13c2.5 2 4.5 4 6 8C13.5 12 19 6.5 26.5 2.5",
];

/** Pita "Ke mana file kamu pergi": buku catatan proses, ditutup "0 byte". */
export function PrivacyBand({ headingId = "privasi-h" }: { headingId?: string }) {
  return (
    <section className={styles.band} aria-labelledby={headingId}>
      <div className={`wrap ${styles.inner}`}>
        <div className={styles.text}>
          <h2 id={headingId}>Kenapa file kamu nggak kami upload</h2>
          <p>
            KTP, KK, ijazah, transkrip: isinya data pribadi semua. Jadi alat ini kami bikin supaya{" "}
            <b>semua prosesnya jalan di browser kamu sendiri</b>. File dibaca, dikecilkan, lalu disimpan lagi
            di HP atau laptopmu. Server kami nggak pernah melihat isinya.
          </p>
          <p>Begitu tab ini ditutup, datanya ikut hilang dari memori.</p>
        </div>

        <div className={styles.ledgerWrap}>
          <table className={styles.ledger}>
            <caption>Ke mana file kamu pergi</caption>
            <thead>
              <tr>
                <th scope="col">Proses</th>
                <th scope="col">Di perangkatmu</th>
                <th scope="col">Ke server</th>
              </tr>
            </thead>
            <tbody>
              {STEPS.map((s, i) => (
                <tr key={s}>
                  <th scope="row">{s}</th>
                  <td>
                    <svg width="24" height="19" viewBox="0 0 30 24" aria-hidden="true">
                      <path d={TICKS[i]} fill="none" stroke="var(--pen)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="sr-only">ya</span>
                  </td>
                  <td className={styles.dash}>
                    <span aria-hidden="true">—</span>
                    <span className="sr-only">tidak</span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row" colSpan={2}>
                  Isi file yang dikirim ke server
                </th>
                <td className={styles.zero}>0 byte</td>
              </tr>
            </tfoot>
          </table>
          <p className={styles.foot}>
            Byte itu satuan terkecil ukuran file. Nol byte artinya nggak ada sepotong pun isi file kamu yang
            keluar dari perangkat.
          </p>
        </div>
      </div>
    </section>
  );
}
