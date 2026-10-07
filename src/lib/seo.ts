import type { Metadata } from "next";
import { SITE } from "./site";

export function absoluteUrl(path: string): string {
  if (path === "/" || path === "") return SITE.url + "/";
  return SITE.url + (path.startsWith("/") ? path : `/${path}`);
}

export function pageMetadata(opts: {
  path: string;
  title: string;
  description: string;
  /** true = judul dipakai apa adanya, tanpa " · wuspot". */
  absoluteTitle?: boolean;
  noindex?: boolean;
}): Metadata {
  const url = absoluteUrl(opts.path);
  return {
    title: opts.absoluteTitle ? { absolute: opts.title } : opts.title,
    description: opts.description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      locale: SITE.locale,
      siteName: SITE.name,
      url,
      title: opts.title,
      description: opts.description,
    },
    twitter: { card: "summary_large_image", title: opts.title, description: opts.description },
    robots: opts.noindex ? { index: false, follow: true } : undefined,
  };
}

type JsonLd = Record<string, unknown>;

/** Aman dimasukkan ke <script type="application/ld+json">. */
export function jsonLdString(data: JsonLd | JsonLd[]): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function breadcrumbLd(items: { name: string; path: string }[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: absoluteUrl(it.path),
    })),
  };
}

export function webAppLd(opts: { name: string; path: string; description: string }): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: opts.name,
    url: absoluteUrl(opts.path),
    description: opts.description,
    applicationCategory: "UtilitiesApplication",
    operatingSystem: "Semua (berjalan di browser)",
    inLanguage: "id",
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "IDR" },
    publisher: { "@type": "Organization", name: SITE.name, url: SITE.url },
  };
}

export function faqLd(items: { q: string; a: string }[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((it) => ({
      "@type": "Question",
      name: it.q,
      acceptedAnswer: { "@type": "Answer", text: it.a },
    })),
  };
}

export function websiteLd(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE.name,
    url: SITE.url + "/",
    inLanguage: "id",
    publisher: { "@type": "Organization", name: SITE.name, url: SITE.url, email: SITE.email },
  };
}
