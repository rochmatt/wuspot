import type { MetadataRoute } from "next";
import { ALL_KOMPRES_PAGES } from "@/content/kompres-pdf";
import { STATIC_PAGES } from "@/content/pages";
import { absoluteUrl } from "@/lib/seo";
import { CONTENT_UPDATED } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: absoluteUrl("/"), lastModified: CONTENT_UPDATED, changeFrequency: "weekly", priority: 1 },
    ...ALL_KOMPRES_PAGES.map((p) => ({
      url: absoluteUrl(`/${p.slug}`),
      lastModified: CONTENT_UPDATED,
      changeFrequency: "monthly" as const,
      priority: p.presetKb === null ? 0.9 : 0.8,
    })),
    ...STATIC_PAGES.map((p) => ({
      url: absoluteUrl(`/${p.slug}`),
      lastModified: p.updated ?? CONTENT_UPDATED,
      changeFrequency: "yearly" as const,
      priority: 0.3,
    })),
    { url: absoluteUrl("/kontak"), lastModified: CONTENT_UPDATED, changeFrequency: "yearly", priority: 0.3 },
  ];
}
