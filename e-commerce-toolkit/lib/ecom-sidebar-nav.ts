"use client";

import type { LucideIcon } from "lucide-react";
import {
  Clapperboard,
  Film,
  Home,
  ImageIcon,
  LayoutGrid,
  Megaphone,
  Package,
  Settings,
  Shirt,
  Sparkles,
} from "lucide-react";
import { ECOM_MODULES } from "@/lib/modules/registry";

export type EcomSidebarNavItem = {
  icon?: LucideIcon;
  label?: string;
  href?: string;
  isSeparator?: boolean;
  external?: boolean;
};

function item(
  label: string,
  href: string,
  icon: LucideIcon,
  opts?: { isSeparator?: boolean; external?: boolean },
): EcomSidebarNavItem {
  return { label, href, icon, ...opts };
}

function sep(): EcomSidebarNavItem {
  return { isSeparator: true };
}

/** 侧栏导航：分组对齐 registry */
export function buildEcomSidebarNavItems(bookOrigin: string): EcomSidebarNavItem[] {
  const imageMods = ECOM_MODULES.filter(
    (m) => m.kind === "image" && m.href.startsWith("/ecom/"),
  );
  const videoMods = ECOM_MODULES.filter((m) => m.kind === "video");
  const brandMods = ECOM_MODULES.filter((m) => m.href.startsWith("/brand/"));

  const rows: EcomSidebarNavItem[] = [
    item("工作台", "/", Home),
    item("我的资产", "/library", Package),
    sep(),
  ];

  imageMods.forEach((m, i) => {
    const icon =
      m.id === "main-image"
        ? ImageIcon
        : m.id === "detail-page"
          ? LayoutGrid
          : Shirt;
    rows.push(item(m.title, m.href, icon, i === 0 ? { isSeparator: false } : undefined));
  });

  rows.push(sep());
  for (const m of videoMods) {
    const icon = m.id === "storyboard-micro-drama" ? Clapperboard : Film;
    rows.push(item(m.title, m.href, icon));
  }

  rows.push(sep());
  for (const m of brandMods) {
    const icon =
      m.id === "promo" || m.id === "ad"
        ? Clapperboard
        : m.id === "poster"
          ? Megaphone
          : Sparkles;
    rows.push(item(m.title, m.href, icon));
  }

  rows.push(
    item("计费与账户", `${bookOrigin}/account`, Settings, {
      isSeparator: true,
      external: true,
    }),
  );

  return rows;
}
