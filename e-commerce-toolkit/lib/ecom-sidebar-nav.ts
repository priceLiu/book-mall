"use client";

import type { LucideIcon } from "lucide-react";
import {
  Clapperboard,
  Copy,
  Film,
  Hammer,
  LayoutGrid,
  Megaphone,
  Package,
  Rocket,
  Settings,
  Shirt,
  ShoppingBag,
  UserCircle,
  Sparkles,
  Target,
  Wrench,
  Boxes,
} from "lucide-react";
import {
  buildPortalNavItems,
  type PortalKey,
} from "@private/federated-portal-nav";
import { ECOM_MODULES } from "@/lib/modules/registry";

export type EcomSidebarNavLink = {
  type: "link";
  label: string;
  href: string;
  icon: LucideIcon;
  external?: boolean;
  /** 本应用内门户项（如电商工具箱）始终高亮 */
  activeAlways?: boolean;
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
  if (id === "product-creation") return LayoutGrid;
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

const PORTAL_ICONS: Record<PortalKey, LucideIcon> = {
  "common-tools": Wrench,
  canvas: LayoutGrid,
  "e-commerce": ShoppingBag,
  "quick-replica": Copy,
  publisher: Rocket,
  story: Clapperboard,
  tool: Hammer,
};

/** 侧栏导航：跨门户一级菜单 + 本应用模块 */
export function buildEcomSidebarNavItems(bookOrigin: string): EcomSidebarNavItem[] {
  const portalLinks: EcomSidebarNavLink[] = buildPortalNavItems(bookOrigin)
    .filter(
      (item): item is typeof item & { href: string } =>
        Boolean(item.href) && item.key !== "e-commerce",
    )
    .map((item) => ({
      type: "link" as const,
      label: item.label,
      href: item.href,
      icon: PORTAL_ICONS[item.key],
      external: true,
    }));
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
    link("个人中心", `${bookOrigin}/account`, UserCircle, { external: true }),
    group("电商", ShoppingBag, ecomChildren),
    group("营销", Target, marketingChildren),
    group("应用", Boxes, portalLinks),
    link("我的资产", "/library", Package),
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
