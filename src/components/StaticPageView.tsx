import type { Metadata } from "next";
import type { StaticPage } from "@/content/pages";
import { pageMetadata } from "@/lib/seo";

// Sementara: kerangka tanpa gaya. Diganti versi final setelah desain dipilih.
export function staticMetadata(page: StaticPage): Metadata {
  return pageMetadata({ path: `/${page.slug}`, title: page.metaTitle, description: page.metaDescription });
}

export function StaticPageView({ page }: { page: StaticPage }) {
  return (
    <main>
      <h1>{page.h1}</h1>
      {page.sections.map((s, i) => (
        <section key={i}>
          {s.heading && <h2>{s.heading}</h2>}
          {s.paragraphs.map((p, j) => (
            <p key={j}>{p}</p>
          ))}
        </section>
      ))}
    </main>
  );
}
