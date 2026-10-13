"use client";

import { useEffect } from "react";

/** Minta AdSense mengisi <ins class="adsbygoogle"> tepat di atasnya. */
export function AdPush() {
  useEffect(() => {
    try {
      const w = window as Window & { adsbygoogle?: unknown[] };
      (w.adsbygoogle = w.adsbygoogle || []).push({});
    } catch {
      // pemblokir iklan / skrip belum dimuat — biarkan kosong
    }
  }, []);
  return null;
}
