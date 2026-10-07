import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getKompresPage } from "@/content/kompres-pdf";
import { pageMetadata } from "@/lib/seo";

// Sementara: kerangka tanpa gaya. Diganti versi final setelah desain dipilih.
export function kompresMetadata(slug: string): Metadata {
  const page = getKompresPage(slug);
  if (!page) return {};
  return pageMetadata({ path: `/${page.slug}`, title: page.metaTitle, description: page.metaDescription });
}

export function KompresPdfPage({ slug }: { slug: string }) {
  const page = getKompresPage(slug);
  if (!page) notFound();
  return (
    <main>
      <h1>{page.h1}</h1>
      <p>{page.lead}</p>
    </main>
  );
}
