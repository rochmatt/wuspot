import { renderOgImage } from "@/lib/og-image";

export const alt = "wuspot: kompres PDF ke 500 KB, langsung di HP";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return renderOgImage({ title: ["Kompres PDF", "ke 500 KB."], after: "468 KB" });
}
