// Ikon kecil untuk alat kompres. Semua aria-hidden; artinya selalu ada di teks.

export function PdfDocIcon({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={(size * 58) / 48} viewBox="0 0 48 58" aria-hidden="true" focusable="false">
      <path d="M9 5h21l11 11v35a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" fill="var(--sheet)" stroke="var(--ink)" strokeWidth="1.6" />
      <path d="M30 5v11h11" fill="none" stroke="var(--ink)" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M14 25h20M14 31h20M14 37h13" stroke="var(--rule-2)" strokeWidth="1.6" />
      <rect x="3" y="41" width="25" height="12" rx="1.5" fill="var(--ink)" />
      <path d="M9.2 44.4v6.2m0-6.2h2.3a1.7 1.7 0 0 1 0 3.4H9.2m6.3-3.4v6.2h1.6a2.4 2.4 0 0 0 2.4-2.4v-1.4a2.4 2.4 0 0 0-2.4-2.4zm6.4 0v6.2m0-6.2h3.4m-3.4 3h2.8" fill="none" stroke="var(--sheet)" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M36 1.5v15a3 3 0 0 0 6 0V5a4.5 4.5 0 0 0-9 0v13" fill="none" stroke="var(--muted)" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function ArrowRight({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={(size * 14) / 22} viewBox="0 0 22 14" aria-hidden="true" focusable="false">
      <path d="M1 7h19m-6-6 6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function DownloadIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
      <path d="M9 1.5v10m-4.5-4.5L9 11.5 13.5 7M2 16h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function LockIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4.5" y="10.5" width="15" height="10.5" rx="1.5" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
      <path d="M12 14.5v2.5" />
    </svg>
  );
}

export function DeviceIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
      <path d="M10.5 18.5h3" />
      <circle cx="12" cy="10.5" r="2.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function ShareIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v12M7.5 7.5 12 3l4.5 4.5" />
      <path d="M5 12v7.5A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V12" />
    </svg>
  );
}

/** Tanda perhatian: lingkaran + tanda seru. Warna mengikuti teks. */
export function NoticeIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <circle cx="10" cy="10" r="8.6" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M10 5.4v6" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
      <circle cx="10" cy="14.4" r="1.25" fill="currentColor" />
    </svg>
  );
}

export function WarnTriangle({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M10 2.6 18.4 17H1.6z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M10 8v4.2" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <circle cx="10" cy="14.6" r="1.05" fill="currentColor" />
    </svg>
  );
}

export function Paperclip() {
  return (
    <svg width="20" height="58" viewBox="0 0 20 58" aria-hidden="true" focusable="false">
      <path d="M6 20v26a4 4 0 0 0 8 0V10a6 6 0 0 0-12 0v38a8 8 0 0 0 16 0V20" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
