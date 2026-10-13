"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { NAV } from "@/lib/site";
import styles from "./NavTabs.module.css";

/**
 * Menu kategori. "bar" = di dalam kepala halaman (layar lebar),
 * "tabs" = baris tab map di bawah kepala halaman (HP/tablet), bisa digeser.
 * Hanya satu yang tampil di tiap ukuran layar (yang lain display:none).
 */
export function NavTabs({ variant }: { variant: "bar" | "tabs" }) {
  const pathname = usePathname() ?? "";
  const listRef = useRef<HTMLUListElement>(null);

  // Tab aktif digeser supaya kelihatan di HP.
  useEffect(() => {
    if (variant !== "tabs") return;
    const list = listRef.current;
    const active = list?.querySelector<HTMLElement>("[aria-current]");
    if (!list || !active) return;
    const left = active.offsetLeft - 16;
    if (left + active.offsetWidth > list.clientWidth) list.scrollLeft = left;
  }, [variant, pathname]);

  return (
    <nav
      className={variant === "bar" ? styles.bar : styles.tabsNav}
      aria-label="Kategori alat"
    >
      <ul ref={listRef} className={variant === "bar" ? styles.barList : styles.tabList}>
        {NAV.map((item) => {
          const active = item.match(pathname);
          return (
            <li key={item.href}>
              <Link href={item.href} aria-current={active ? "page" : undefined}>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
