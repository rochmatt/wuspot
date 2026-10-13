import { renderOgImage } from "@/lib/og-image";

export const alt = "wuspot: kompres PDF ke 1 MB, langsung di HP";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return renderOgImage({ title: ["Kompres PDF", "ke 1 MB."], after: "940 KB" });
}
