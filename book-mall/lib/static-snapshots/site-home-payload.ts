import type { MarketShowcaseItem } from "@/lib/gateway/market-catalog";
import type { StoryHeroBackground, StoryHeroClip } from "@/lib/story-theater-videos";

export const SITE_HOME_PAGE_KEY = "site-home" as const;

export type SiteHomeShowcaseItem = {
  id: string;
  title: string;
  posterUrl: string;
  videoUrl: string | null;
};

export type SiteHomePlatformAppSnapshot = {
  key: string;
  label: string;
  tagline: string;
  href: string;
  showcase: SiteHomeShowcaseItem[];
};

export type SiteHomeSnapshotPayload = {
  version: 1;
  hero: {
    background: StoryHeroBackground;
    clips: StoryHeroClip[];
  };
  platformApps: SiteHomePlatformAppSnapshot[];
  gatewayModels: MarketShowcaseItem[];
  gatewayOrigin: string | null;
};

export type SiteHomeSnapshotSummary = {
  platformAppCount: number;
  showcaseItemCount: number;
  gatewayModelCount: number;
  heroClipCount: number;
};

export function summarizeSiteHomePayload(payload: SiteHomeSnapshotPayload): SiteHomeSnapshotSummary {
  return {
    platformAppCount: payload.platformApps.length,
    showcaseItemCount: payload.platformApps.reduce((s, a) => s + a.showcase.length, 0),
    gatewayModelCount: payload.gatewayModels.length,
    heroClipCount: payload.hero.clips.length,
  };
}

export function isSiteHomeSnapshotPayload(value: unknown): value is SiteHomeSnapshotPayload {
  if (!value || typeof value !== "object") return false;
  const v = value as SiteHomeSnapshotPayload;
  return v.version === 1 && Array.isArray(v.platformApps) && Array.isArray(v.gatewayModels);
}

/** 将历史快照中的绝对 re-enter URL（含 localhost）规范为相对路径。 */
export function normalizePlatformAppReEnterHref(href: string): string {
  const trimmed = href.trim();
  if (!trimmed) return href;
  if (trimmed.startsWith("/api/sso/tools/re-enter")) return trimmed;
  try {
    const u = new URL(trimmed);
    if (u.pathname === "/api/sso/tools/re-enter") {
      return `${u.pathname}${u.search}`;
    }
  } catch {
    /* keep as-is */
  }
  return href;
}

/** 读取/渲染前修正快照内平台应用链接（兼容本地生成的旧快照）。 */
export function normalizeSiteHomeSnapshotPayload(
  payload: SiteHomeSnapshotPayload,
): SiteHomeSnapshotPayload {
  return {
    ...payload,
    platformApps: payload.platformApps.map((app) => ({
      ...app,
      href: normalizePlatformAppReEnterHref(app.href),
    })),
  };
}
