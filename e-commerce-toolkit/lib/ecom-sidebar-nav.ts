"use client";

import type { LucideIcon } from "lucide-react";
import {
  Clapperboard,
  Copy,
  Film,
  FolderKanban,
  Video,
  Hammer,
  LayoutGrid,
  LayoutTemplate,
  Megaphone,
  Package,
  Rocket,
  ScrollText,
  ScanSearch,
  Settings,
  Shirt,
  ShoppingBag,
  UserCircle,
  Users,
  Sparkles,
  Target,
  Wrench,
  Blocks,
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
  /** 图标轨点击：仅跳转/外链，不切换右侧详情面板 */
  directOpen?: boolean;
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
  opts?: { external?: boolean; directOpen?: boolean },
): EcomSidebarNavLink {
  return { type: "link", label, href, icon, ...opts };
}

function bookAccountHref(bookOrigin: string, path: string): string {
  return `${bookOrigin.replace(/\/$/, "")}${path}`;
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

/** 同一 href 只保留一项，避免 React key 冲突导致侧栏导航异常 */
function dedupeNavLinks(items: EcomSidebarNavLink[]): EcomSidebarNavLink[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.href)) return false;
    seen.add(item.href);
    return true;
  });
}

function imageModuleIcon(id: string): LucideIcon {
  if (id === "product-creation") return LayoutGrid;
  if (id === "detail-page-creation") return ScrollText;
  if (id === "seed-video") return Video;
  if (id === "hand-craft") return Blocks;
  if (id === "media-decompose") return ScanSearch;
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
    (m) =>
      m.kind === "image" &&
      m.href.startsWith("/ecom/") &&
      m.id !== "hand-craft" &&
      m.id !== "media-decompose",
  );
  const videoMods = ECOM_MODULES.filter(
    (m) =>
      m.kind === "video" &&
      m.href.startsWith("/ecom/") &&
      m.id !== "seed-video" &&
      !MARKETING_ECOM_VIDEO_IDS.has(m.id),
  );

  const seedVideoMod = ECOM_MODULES.find((m) => m.id === "seed-video");
  const mediaDecomposeMod = ECOM_MODULES.find((m) => m.id === "media-decompose");
  const imageModLinks = imageMods.map((m) => link(m.title, m.href, imageModuleIcon(m.id)));
  const detailIdx = imageModLinks.findIndex((l) => l.href === "/ecom/detail-page-creation");
  if (seedVideoMod && detailIdx >= 0) {
    imageModLinks.splice(
      detailIdx + 1,
      0,
      link(seedVideoMod.title, seedVideoMod.href, Video),
    );
  } else if (seedVideoMod) {
    imageModLinks.push(link(seedVideoMod.title, seedVideoMod.href, Video));
  }
  if (mediaDecomposeMod) {
    const seedIdx = imageModLinks.findIndex((l) => l.href === "/ecom/seed-video");
    const insertAt = seedIdx >= 0 ? seedIdx + 1 : imageModLinks.length;
    imageModLinks.splice(
      insertAt,
      0,
      link(mediaDecomposeMod.title, mediaDecomposeMod.href, ScanSearch),
    );
  }

  const ecomChildren: EcomSidebarNavLink[] = dedupeNavLinks([
    ...imageModLinks,
    link("模特库", "/ecom/model-library", Users),
    link("模板区", "/ecom/template-gallery", LayoutTemplate),
    ...videoMods.map((m) => link(m.title, m.href, videoModuleIcon(m.id))),
  ]);

  const marketingOrder = [
    "storyboard-micro-drama",
    "hand-craft",
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
    link("个人中心", bookAccountHref(bookOrigin, "/account"), UserCircle, {
      external: true,
      directOpen: true,
    }),
    group("电商", ShoppingBag, ecomChildren),
    group("营销", Target, marketingChildren),
    group("应用", Boxes, portalLinks),
    link("我的工作流", "/workflows/drafts", FolderKanban),
    link("我的资产", "/library", Package),
    sep(),
    link("计费与账户", bookAccountHref(bookOrigin, "/account/billing"), Settings, {
      external: true,
      directOpen: true,
    }),
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
