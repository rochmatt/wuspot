import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Harness } from "./harness";

export const metadata: Metadata = {
  title: { absolute: "Uji mesin kompres (dev)" },
  robots: { index: false, follow: false },
};

/** Halaman uji untuk Playwright & pengembang. Di produksi selalu 404. */
export default function UjiMesinPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <Harness />;
}
