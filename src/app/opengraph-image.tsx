import { renderOgImage } from "@/lib/og-image";

export const alt = "wuspot: kompres PDF sampai ukuran KB yang kamu mau";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return renderOgImage();
}
