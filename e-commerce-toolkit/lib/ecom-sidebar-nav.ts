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
  Layers,
  Megaphone,
  MessageSquareText,
  Package,
  Rocket,
  ScrollText,
  ScanSearch,
  Settings,
  Shirt,
  ShoppingBag,
  Palette,
  UserCircle,
  Users,
  Sparkles,
  Target,
  Wrench,
  Blocks,
  Boxes,
  History,
  BookOpen,
} from "lucide-react";
import {
  buildPortalNavItems,
  type PortalKey,
} from "@private/federated-portal-nav";
import { ECOM_MODULES } from "@/lib/modules/registry";
import {
  ECOM_FEISHU_GUIDE_BY_NAV_SUBHEADING,
  ECOM_FEISHU_GUIDE_WIKI_HUB,
  feishuGuideUrlForModuleId,
} from "@/lib/ecom-feishu-guide-urls";

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
  /** 飞书使用指南（新标签打开，不改变主 href） */
  guideHref?: string;
};

/** 分组内小标题（如营销 · IP创作） */
export type EcomSidebarNavSubheading = {
  type: "subheading";
  label: string;
  /** 「怎么选」等分组级指南 */
  guideHref?: string;
};

export type EcomSidebarNavGroupChild = EcomSidebarNavLink | EcomSidebarNavSubheading;

export type EcomSidebarNavGroup = {
  type: "group";
  label: string;
  icon: LucideIcon;
  children: EcomSidebarNavGroupChild[];
};

export type EcomSidebarNavItem =
  | EcomSidebarNavLink
  | EcomSidebarNavGroup
  | { type: "separator" };

function link(
  label: string,
  href: string,
  icon: LucideIcon,
  opts?: { external?: boolean; directOpen?: boolean; guideHref?: string },
): EcomSidebarNavLink {
  return { type: "link", label, href, icon, ...opts };
}

function bookAccountHref(bookOrigin: string, path: string): string {
  return `${bookOrigin.replace(/\/$/, "")}${path}`;
}

function group(
  label: string,
  icon: LucideIcon,
  children: EcomSidebarNavGroupChild[],
): EcomSidebarNavGroup {
  return { type: "group", label, icon, children };
}

function subheading(label: string): EcomSidebarNavSubheading {
  return {
    type: "subheading",
    label,
    guideHref: ECOM_FEISHU_GUIDE_BY_NAV_SUBHEADING[label],
  };
}

function sep(): { type: "separator" } {
  return { type: "separator" };
}

function imageModuleIcon(id: string): LucideIcon {
  if (id === "product-creation") return LayoutGrid;
  if (id === "product-image-set") return Layers;
  if (id === "ai-detail-page") return ScrollText;
  if (id === "detail-page-creation") return ScrollText;
  if (
    id === "detail-page-suite" ||
    id === "detail-page-suite-replica" ||
    id === "detail-page-suite-hit"
  )
    return LayoutTemplate;
  if (id === "seed-video") return Video;
  if (id === "hand-craft") return Blocks;
  if (id === "media-decompose") return ScanSearch;
  if (id === "film-pull") return Clapperboard;
  if (id === "model-tryon") return Sparkles;
  return Shirt;
}

function videoModuleIcon(id: string): LucideIcon {
  if (id === "storyboard-micro-drama") return Clapperboard;
  if (id === "seed-video") return Video;
  return Film;
}

function brandModuleIcon(id: string): LucideIcon {
  if (id === "promo" || id === "ad") return Clapperboard;
  if (id === "poster") return Megaphone;
  if (id === "vi") return Sparkles;
  if (id === "ip") return Palette;
  return Sparkles;
}

function ipCreationModuleIcon(id: string): LucideIcon {
  if (id === "hand-craft") return Blocks;
  if (id === "vi") return Sparkles;
  if (id === "ip") return Palette;
  return Sparkles;
}

/** 侧栏归入「营销」的 /ecom/ 视频模块（非 /brand/） */
const MARKETING_ECOM_VIDEO_IDS = new Set([
  "storyboard-micro-drama",
  "video-digital-human",
]);

type EcomNavSectionLink =
  | { kind: "module"; id: string }
  | { kind: "link"; item: EcomSidebarNavLink };

/** 「电商」分组内小标题与顺序（SSOT；勿再按 registry 数组顺序平铺） */
const ECOM_NAV_SECTIONS: ReadonlyArray<{
  subheading: string;
  links: readonly EcomNavSectionLink[];
}> = [
  {
    subheading: "主图与套图",
    links: [
      { kind: "module", id: "product-creation" },
      { kind: "module", id: "product-image-set" },
    ],
  },
  {
    subheading: "详情页",
    links: [
      { kind: "module", id: "ai-detail-page" },
      { kind: "module", id: "detail-page-creation" },
      { kind: "module", id: "detail-page-suite" },
      { kind: "module", id: "detail-page-suite-replica" },
      { kind: "module", id: "detail-page-suite-hit" },
    ],
  },
  {
    subheading: "拆解与拉片",
    links: [
      { kind: "module", id: "media-decompose" },
      { kind: "module", id: "film-pull" },
    ],
  },
  {
    subheading: "模特与修图",
    links: [
      { kind: "module", id: "image-layer" },
      { kind: "module", id: "model-shot" },
      { kind: "module", id: "model-tryon" },
      {
        kind: "link",
        item: link("模特库", "/ecom/model-library", Users),
      },
      {
        kind: "link",
        item: link("模板区", "/ecom/template-gallery", LayoutTemplate),
      },
    ],
  },
];

function moduleNavLink(id: string): EcomSidebarNavLink | null {
  const m = ECOM_MODULES.find((x) => x.id === id);
  if (!m) return null;
  const guideHref = feishuGuideUrlForModuleId(id);
  if (id === "film-pull") {
    return link(m.title, m.href, Clapperboard, { guideHref });
  }
  const icon = m.kind === "video" ? videoModuleIcon(id) : imageModuleIcon(id);
  return link(m.title, m.href, icon, { guideHref });
}

function buildEcomGroupChildren(): EcomSidebarNavGroupChild[] {
  const children: EcomSidebarNavGroupChild[] = [];
  for (const section of ECOM_NAV_SECTIONS) {
    children.push(subheading(section.subheading));
    for (const entry of section.links) {
      if (entry.kind === "link") {
        children.push(entry.item);
        continue;
      }
      const navLink = moduleNavLink(entry.id);
      if (navLink) children.push(navLink);
    }
  }

  const videoMods = ECOM_MODULES.filter(
    (m) =>
      m.kind === "video" &&
      m.href.startsWith("/ecom/") &&
      m.id !== "seed-video" &&
      m.id !== "film-pull" &&
      !MARKETING_ECOM_VIDEO_IDS.has(m.id),
  );
  if (videoMods.length > 0) {
    children.push(subheading("短视频"));
    for (const m of videoMods) {
      children.push(
        link(m.title, m.href, videoModuleIcon(m.id), {
          guideHref: feishuGuideUrlForModuleId(m.id),
        }),
      );
    }
  }

  return children;
}

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
  const ecomChildren = buildEcomGroupChildren();

  const marketingOrder = [
    "storyboard-micro-drama",
    "image-layer",
    "seed-video",
    "video-digital-human",
    "promo",
    "ad",
    "poster",
  ] as const;
  const marketingMods = marketingOrder
    .map((id) => ECOM_MODULES.find((m) => m.id === id))
    .filter((m): m is (typeof ECOM_MODULES)[number] => Boolean(m));

  const ipCreationIds = ["ip", "hand-craft", "vi"] as const;
  const ipCreationMods = ipCreationIds
    .map((id) => ECOM_MODULES.find((m) => m.id === id))
    .filter((m): m is (typeof ECOM_MODULES)[number] => Boolean(m));

  const marketingChildren: EcomSidebarNavGroupChild[] = [
    ...marketingMods.map((m) =>
      link(
        m.title,
        m.href,
        m.href.startsWith("/brand/") ? brandModuleIcon(m.id) : videoModuleIcon(m.id),
        { guideHref: feishuGuideUrlForModuleId(m.id) },
      ),
    ),
    subheading("IP创作"),
    ...ipCreationMods.map((m) =>
      link(m.title, m.href, ipCreationModuleIcon(m.id), {
        guideHref: feishuGuideUrlForModuleId(m.id),
      }),
    ),
  ];

  return [
    link("个人中心", bookAccountHref(bookOrigin, "/account"), UserCircle, {
      external: true,
      directOpen: true,
    }),
    group("电商", ShoppingBag, ecomChildren),
    group("营销", Target, marketingChildren),
    group("应用", Boxes, portalLinks),
    link("我的工作流", "/workflows/drafts", FolderKanban),
    group("我的资产", Package, [
      link("成图与视频", "/library", Package),
      link("提示词库", "/library/prompts", MessageSquareText),
      link("试衣库", "/library/tryon", Shirt),
      link("姿势·场景·道具库", "/ecom/shoot-catalog", Sparkles),
      link("剧情故事", "/ecom/story-theater-catalog", ScrollText),
      link("我的模特", "/library/models", Users),
      link("生成记录", "/library/generation-records", History),
    ]),
    sep(),
    link("使用指南", ECOM_FEISHU_GUIDE_WIKI_HUB, BookOpen, {
      external: true,
      directOpen: true,
    }),
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
