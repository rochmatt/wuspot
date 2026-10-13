import type { Metadata, Viewport } from "next";
import { Caveat, IBM_Plex_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { SITE } from "@/lib/site";
import { THEME_COLORS, THEME_SCRIPT } from "@/lib/theme";
import "./globals.css";

// Plus Jakarta Sans: huruf utama (UI + judul). Satu-satunya yang di-preload.
const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

// Angka, kode, ukuran file, garis titik-titik di tanda terima.
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-mono",
  display: "swap",
  preload: false,
});

// Tulisan tangan pulpen. Dipakai paling banyak dua kali per halaman.
const hand = Caveat({
  subsets: ["latin"],
  weight: "600",
  variable: "--font-hand",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: "wuspot — Alat online gratis buat beresin berkas",
    template: "%s · wuspot",
  },
  description:
    "Kompres PDF sampai ukuran KB yang diminta formulir, langsung di HP atau laptopmu. Gratis, tanpa daftar, file nggak di-upload.",
  applicationName: SITE.name,
  formatDetection: { telephone: false, email: false, address: false },
  openGraph: { type: "website", locale: SITE.locale, siteName: SITE.name },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: THEME_COLORS.light },
    { media: "(prefers-color-scheme: dark)", color: THEME_COLORS.dark },
  ],
  colorScheme: "light dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      className={`${sans.variable} ${mono.variable} ${hand.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Tema dipasang sebelum halaman digambar, supaya tidak berkedip. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
