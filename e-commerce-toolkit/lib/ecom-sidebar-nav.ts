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
  ShoppingBag,
  Sparkles,
  Target,
} from "lucide-react";
import { ECOM_MODULES } from "@/lib/modules/registry";

export type EcomSidebarNavLink = {
  type: "link";
  label: string;
  href: string;
  icon: LucideIcon;
  external?: boolean;
};

export type EcomSidebarNavGroup = {
  type: "group";
  label: string;
  icon: LucideIcon;
  children: EcomSidebarNavLink[];
};

export type EcomSidebarNavItem =
  | EcomSidebarNavLink
  | EcomSidebarNavGroup
  | { type: "separator" };

function link(
  label: string,
  href: string,
  icon: LucideIcon,
  opts?: { external?: boolean },
): EcomSidebarNavLink {
  return { type: "link", label, href, icon, ...opts };
}

function group(
  label: string,
  icon: LucideIcon,
  children: EcomSidebarNavLink[],
): EcomSidebarNavGroup {
  return { type: "group", label, icon, children };
}

function sep(): { type: "separator" } {
  return { type: "separator" };
}

function imageModuleIcon(id: string): LucideIcon {
  if (id === "main-image") return ImageIcon;
  if (id === "detail-page") return LayoutGrid;
  return Shirt;
}

function videoModuleIcon(id: string): LucideIcon {
  return id === "storyboard-micro-drama" ? Clapperboard : Film;
}

function brandModuleIcon(id: string): LucideIcon {
  if (id === "promo" || id === "ad") return Clapperboard;
  if (id === "poster") return Megaphone;
  return Sparkles;
}

/** 侧栏归入「营销」的 /ecom/ 视频模块（非 /brand/） */
const MARKETING_ECOM_VIDEO_IDS = new Set([
  "storyboard-micro-drama",
  "video-digital-human",
  "video-hit-product",
  "video-voiceover",
]);

/** 侧栏导航：电商 / 营销 分组 + registry 对齐 */
export function buildEcomSidebarNavItems(bookOrigin: string): EcomSidebarNavItem[] {
  const imageMods = ECOM_MODULES.filter(
    (m) => m.kind === "image" && m.href.startsWith("/ecom/"),
  );
  const videoMods = ECOM_MODULES.filter(
    (m) =>
      m.kind === "video" &&
      m.href.startsWith("/ecom/") &&
      !MARKETING_ECOM_VIDEO_IDS.has(m.id),
  );

  const ecomChildren: EcomSidebarNavLink[] = [
    ...imageMods.map((m) => link(m.title, m.href, imageModuleIcon(m.id))),
    ...videoMods.map((m) => link(m.title, m.href, videoModuleIcon(m.id))),
  ];

  const marketingOrder = [
    "storyboard-micro-drama",
    "promo",
    "ad",
    "video-digital-human",
    "video-hit-product",
    "video-voiceover",
    "ip",
    "poster",
    "vi",
  ] as const;
  const marketingMods = marketingOrder
    .map((id) => ECOM_MODULES.find((m) => m.id === id))
    .filter((m): m is (typeof ECOM_MODULES)[number] => Boolean(m));

  const marketingChildren: EcomSidebarNavLink[] = marketingMods.map((m) =>
    link(
      m.title,
      m.href,
      m.href.startsWith("/brand/") ? brandModuleIcon(m.id) : videoModuleIcon(m.id),
    ),
  );

  return [
    link("工作台", "/", Home),
    link("我的资产", "/library", Package),
    sep(),
    group("电商", ShoppingBag, ecomChildren),
    group("营销", Target, marketingChildren),
    sep(),
    link("计费与账户", `${bookOrigin}/account`, Settings, { external: true }),
  ];
}

/** @deprecated 兼容旧 flat 结构判断 */
export type EcomSidebarNavItemLegacy = {
  icon?: LucideIcon;
  label?: string;
  href?: string;
  isSeparator?: boolean;
  external?: boolean;
};
