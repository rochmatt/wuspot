import type { MetadataRoute } from "next";
import { ALL_KOMPRES_PAGES } from "@/content/kompres-pdf";
import { STATIC_PAGES } from "@/content/pages";
import { absoluteUrl } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: absoluteUrl("/"), changeFrequency: "weekly", priority: 1 },
    ...ALL_KOMPRES_PAGES.map((p) => ({
      url: absoluteUrl(`/${p.slug}`),
      changeFrequency: "monthly" as const,
      priority: p.presetKb === null ? 0.9 : 0.8,
    })),
    ...STATIC_PAGES.map((p) => ({
      url: absoluteUrl(`/${p.slug}`),
      changeFrequency: "yearly" as const,
      priority: 0.3,
    })),
    { url: absoluteUrl("/kontak"), changeFrequency: "yearly", priority: 0.3 },
  ];
}
