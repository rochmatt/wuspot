import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";
import { THEME_COLORS } from "@/lib/theme";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "wuspot — alat gratis buat beresin berkas",
    short_name: SITE.name,
    description: "Kompres PDF sampai ukuran KB yang kamu mau, langsung di HP. File nggak di-upload.",
    lang: "id",
    start_url: "/",
    display: "standalone",
    background_color: THEME_COLORS.light,
    theme_color: THEME_COLORS.light,
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
