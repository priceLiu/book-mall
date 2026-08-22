import type { PortalKey } from "@private/federated-portal-nav";

import { getStoryWebOrigin } from "@/lib/app-web-origins";
import {
  buildBookPortalNavItems,
  resolveBookOrigin,
  type BookPortalNavItem,
} from "@/lib/portal-nav";
import {
  platformAppMediaFor,
  type PlatformAppMedia,
} from "@/lib/site-home/platform-app-media";

export type SiteHomePlatformAppKey = PortalKey | "prompt-optimizer" | "director";

export type SiteHomePlatformApp = {
  key: SiteHomePlatformAppKey;
  label: string;
  tagline: string;
  href: string;
  posterUrl: string;
  videoUrl: string | null;
};

const PLATFORM_APP_DEFS: Array<{
  key: SiteHomePlatformAppKey;
  label: string;
  tagline: string;
}> = [
  {
    key: "canvas",
    label: "AI 画布",
    tagline: "无限画布 + 节点工作流，海报与影视 Pro2 分镜一条龙",
  },
  {
    key: "story",
    label: "漫剧空间",
    tagline: "漫剧 / 短剧从剧本到分镜影像的个人创作空间",
  },
  {
    key: "e-commerce",
    label: "电商工具箱",
    tagline: "商品主图、详情页、带货视频等电商视觉素材",
  },
  {
    key: "tool",
    label: "工具站",
    tagline: "试衣、文生图、图生视频等单点即用 AI 工具",
  },
  {
    key: "quick-replica",
    label: "快速复刻",
    tagline: "选模板传素材，一键复刻同款图像 / 视频",
  },
  {
    key: "common-tools",
    label: "常用工具",
    tagline: "修图、扩图、抠图、表情包等图像小工具合集",
  },
  {
    key: "publisher",
    label: "一键发布",
    tagline: "图文 / 视频分发到小红书、抖音、B 站等平台",
  },
  {
    key: "prompt-optimizer",
    label: "提示词优化器",
    tagline: "把粗略想法打磨成高质量、可复用提示词",
  },
  {
    key: "director",
    label: "3D 导演台",
    tagline: "3D 摆位与机位运镜，产出分镜参考图",
  },
];

const APP_DEFAULT_REDIRECT: Partial<Record<SiteHomePlatformAppKey, string>> = {
  canvas: "/projects",
  tool: "/fitting-room",
};

/** 相对路径：快照与 SSR 不绑定生成环境 origin，避免本地快照写入 localhost。 */
function bookReEnterHref(app: SiteHomePlatformAppKey | PortalKey, redirect: string): string {
  const params = new URLSearchParams({ redirect });
  if (app !== "tool") params.set("app", app);
  return `/api/sso/tools/re-enter?${params.toString()}`;
}

function resolvePlatformAppHref(
  key: SiteHomePlatformAppKey,
  portalByKey: Map<PortalKey, BookPortalNavItem>,
): string | null {
  if (!portalByKey.has(key as PortalKey) && key !== "prompt-optimizer" && key !== "director") {
    return null;
  }
  const redirect = APP_DEFAULT_REDIRECT[key] ?? "/";
  return bookReEnterHref(key, redirect);
}

function resolvePlatformAppMedia(key: SiteHomePlatformAppKey): PlatformAppMedia {
  const media = platformAppMediaFor(key);
  if (key === "story") {
    const origin = getStoryWebOrigin().replace(/\/$/, "");
    return { ...media, posterUrl: `${origin}/imgs/covers/cover-1.png` };
  }
  return media;
}

function withMedia(
  def: (typeof PLATFORM_APP_DEFS)[number],
  href: string,
): SiteHomePlatformApp {
  const media = resolvePlatformAppMedia(def.key);
  return {
    key: def.key,
    label: def.label,
    tagline: def.tagline,
    href,
    posterUrl: media.posterUrl,
    videoUrl: media.videoUrl,
  };
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
    const href = resolvePlatformAppHref(def.key, portalByKey);
    if (!href) continue;
    apps.push(withMedia(def, href));
  }
  return apps;
}
