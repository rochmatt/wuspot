import { renderOgImage } from "@/lib/og-image";

export const alt = "wuspot: kompres PDF ke 100 KB, langsung di HP";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return renderOgImage({ title: ["Kompres PDF", "ke 100 KB."], after: "93 KB" });
}
