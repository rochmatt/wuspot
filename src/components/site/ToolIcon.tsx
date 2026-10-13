// Ikon alat, digambar sendiri: garis 1,6, satu warna (mengikuti teks).

const P = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function ToolIcon({ slug, size = 36 }: { slug: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      {ICONS[slug] ?? ICONS["kompres-pdf"]}
    </svg>
  );
}

const ICONS: Record<string, React.ReactNode> = {
  "kompres-pdf": (
    <>
      <path {...P} d="M9 4h10l6 6v17a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" />
      <path {...P} d="M19 4v6h6" />
      <path {...P} d="M12.5 15.5 16 19l3.5-3.5M16 12v7M12 23h8" />
    </>
  ),
  "gabung-pdf": (
    <>
      <rect {...P} x="4" y="4" width="13" height="17" rx="1" />
      <rect {...P} x="13" y="11" width="13" height="17" rx="1" fill="var(--kraft-soft)" />
      <path {...P} d="M19.5 16.5v6m-3-3h6" />
    </>
  ),
  "foto-ke-pdf": (
    <>
      <rect {...P} x="3" y="8" width="12" height="11" rx="1" />
      <path {...P} d="m4 17.5 3.5-3.5 2.5 2.5 1.5-1.5 3 3" />
      <path {...P} d="M16.5 13.5h3.5m-1.6-1.8 1.8 1.8-1.8 1.8" />
      <path {...P} d="M22 6h4.5L29 8.5V25a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z" />
    </>
  ),
  "pdf-ke-gambar": (
    <>
      <path {...P} d="M4 6h5l2.5 2.5V25a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z" />
      <path {...P} d="M13 15.5h3.5m-1.6-1.8 1.8 1.8-1.8 1.8" />
      <rect {...P} x="18" y="9" width="11" height="12" rx="1" />
      <path {...P} d="m19 19.5 3-3.5 2.2 2.2 1.3-1.3 2.5 2.6" />
    </>
  ),
  "kompres-foto": (
    <>
      <rect {...P} x="8" y="9" width="16" height="14" rx="1" />
      <path {...P} d="m10 21 4.5-5 3 3 2-2 3 4" />
      <path {...P} d="M3 3l4 4m0-3.5V7H3.5M29 29l-4-4m0 3.5V25h3.5M29 3l-4 4m3.5 0H25V3.5M3 29l4-4m-3.5 0H7v3.5" />
    </>
  ),
  "pas-foto": (
    <>
      <rect {...P} x="7" y="4" width="18" height="24" rx="1" />
      <circle {...P} cx="16" cy="13" r="4" />
      <path {...P} d="M9.5 28c.8-5 3.3-7.5 6.5-7.5s5.7 2.5 6.5 7.5" />
    </>
  ),
  "video-ke-mp3": (
    <>
      <rect {...P} x="3" y="7" width="15" height="12" rx="1" />
      <path {...P} d="M9 10.5v5l4-2.5z" />
      <path {...P} d="M22 25V12l7-2v13" />
      <circle {...P} cx="20" cy="25" r="2.2" />
    </>
  ),
  "kompres-video": (
    <>
      <rect {...P} x="5" y="8" width="17" height="15" rx="1" />
      <path {...P} d="m22 13 6-3.5v12L22 18" />
      <path {...P} d="M10 13.5l2.5 2.5 2.5-2.5M12.5 11v5" />
    </>
  ),
};
