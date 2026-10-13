import styles from "./Stamp.module.css";

/**
 * Stempel bundar wuspot. Murni hiasan (aria-hidden): pesan yang sama selalu ada
 * sebagai teks biasa di dekat tombol Kompres.
 */
export function RoundStamp({ className }: { className?: string }) {
  return (
    <svg className={`${styles.round} ${className ?? ""}`} viewBox="0 0 120 120" aria-hidden="true" focusable="false">
      <defs>
        <filter id="tinta-bulat" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed="11" result="n" />
          <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  2.6 0 0 0 -.38" result="a" />
          <feComposite in="SourceGraphic" in2="a" operator="in" />
        </filter>
        <path id="lingkar-stempel" d="M60 60m-44.5 0a44.5 44.5 0 1 1 89 0a44.5 44.5 0 1 1-89 0" />
      </defs>
      <g filter="url(#tinta-bulat)" fill="currentColor">
        <circle cx="60" cy="60" r="57" fill="none" stroke="currentColor" strokeWidth="3" />
        <circle cx="60" cy="60" r="34.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
        {/* Teks melingkar penuh (textLength = keliling 2π·44,5), diakhiri spasi
            tak-putus supaya sambungan "· DIPROSES" sama renggangnya dengan yang lain. */}
        <text className={styles.ring} fontSize="10.4" fontWeight="600" letterSpacing="0">
          <textPath href="#lingkar-stempel" textLength="279.6" lengthAdjust="spacing">
            {"DIPROSES DI PERANGKATMU · NGGAK DI-UPLOAD ·\u00a0"}
          </textPath>
        </text>
        {/* wusp●t: huruf o diganti titik tinta penuh, seperti logo */}
        <text x="31" y="58" className={styles.word} fontSize="16" fontWeight="800">
          wusp
        </text>
        <circle cx="77.1" cy="54" r="3.9" />
        <text x="82.4" y="58" className={styles.word} fontSize="16" fontWeight="800">
          t
        </text>
        <text x="60" y="74" textAnchor="middle" className={styles.ring} fontSize="9.5" fontWeight="600" letterSpacing="2">
          AMAN
        </text>
      </g>
    </svg>
  );
}

/** Stempel kotak "BERES" di tanda terima. */
export function BeresStamp({ note, className }: { note: string; className?: string }) {
  return (
    <span className={`${styles.beres} ${className ?? ""}`}>
      <b>BERES</b>
      <span>{note}</span>
    </span>
  );
}
