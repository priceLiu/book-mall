import type { PortalKey } from "@private/federated-portal-nav";

import {
  buildBookPortalNavItems,
  resolveBookOrigin,
  type BookPortalNavItem,
} from "@/lib/portal-nav";

export type SiteHomePlatformAppKey = PortalKey | "prompt-optimizer" | "director";

export type SiteHomePlatformApp = {
  key: SiteHomePlatformAppKey;
  label: string;
  tagline: string;
  icon:
    | "LayoutGrid"
    | "Clapperboard"
    | "ShoppingBag"
    | "Shirt"
    | "Copy"
    | "Image"
    | "Share2"
    | "Sparkles"
    | "Video";
  href: string;
};

const PLATFORM_APP_DEFS: Array<{
  key: SiteHomePlatformAppKey;
  label: string;
  tagline: string;
  icon: SiteHomePlatformApp["icon"];
}> = [
  {
    key: "canvas",
    label: "AI 画布",
    tagline: "无限画布 + 节点工作流，海报与影视 Pro2 分镜一条龙",
    icon: "LayoutGrid",
  },
  {
    key: "story",
    label: "漫剧空间",
    tagline: "漫剧 / 短剧从剧本到分镜影像的个人创作空间",
    icon: "Clapperboard",
  },
  {
    key: "e-commerce",
    label: "电商工具箱",
    tagline: "商品主图、详情页、带货视频等电商视觉素材",
    icon: "ShoppingBag",
  },
  {
    key: "tool",
    label: "工具站",
    tagline: "试衣、文生图、图生视频等单点即用 AI 工具",
    icon: "Shirt",
  },
  {
    key: "quick-replica",
    label: "快速复刻",
    tagline: "选模板传素材，一键复刻同款图像 / 视频",
    icon: "Copy",
  },
  {
    key: "common-tools",
    label: "常用工具",
    tagline: "修图、扩图、抠图、表情包等图像小工具合集",
    icon: "Image",
  },
  {
    key: "publisher",
    label: "一键发布",
    tagline: "图文 / 视频分发到小红书、抖音、B 站等平台",
    icon: "Share2",
  },
  {
    key: "prompt-optimizer",
    label: "提示词优化器",
    tagline: "把粗略想法打磨成高质量、可复用提示词",
    icon: "Sparkles",
  },
  {
    key: "director",
    label: "3D 导演台",
    tagline: "3D 摆位与机位运镜，产出分镜参考图",
    icon: "Video",
  },
];

function resolvePlatformAppHref(
  key: SiteHomePlatformAppKey,
  bookOrigin: string,
  portalByKey: Map<PortalKey, BookPortalNavItem>,
): string | null {
  if (key === "prompt-optimizer") {
    return `${bookOrigin}/prompt-optimizer-open?path=${encodeURIComponent("/")}`;
  }
  if (key === "director") {
    return `${bookOrigin}/director-open?path=${encodeURIComponent("/")}`;
  }
  return portalByKey.get(key)?.href ?? null;
}

/** 首页平台导航：仅返回已配置 origin / SSO 入口的应用。 */
export function buildSiteHomePlatformApps(
  bookOrigin?: string | null,
): SiteHomePlatformApp[] {
  const origin = bookOrigin ?? resolveBookOrigin();
  if (!origin) return [];

  const portalItems = buildBookPortalNavItems(origin);
  const portalByKey = new Map(portalItems.map((item) => [item.key, item]));

  const apps: SiteHomePlatformApp[] = [];
  for (const def of PLATFORM_APP_DEFS) {
    const href = resolvePlatformAppHref(def.key, origin, portalByKey);
    if (!href) continue;
    apps.push({ ...def, href });
  }
  return apps;
}
