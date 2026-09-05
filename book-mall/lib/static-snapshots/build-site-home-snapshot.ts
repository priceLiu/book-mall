/**
 * 首页静态快照 · 构建 payload（Cron / 管理后台写路径）。
 */
import { listPublicMarketShowcaseModels } from "@/lib/gateway/market-catalog";
import { getGatewayPublicOrigin } from "@/lib/gateway/env";
import { buildSiteHomePlatformApps } from "@/lib/site-home/platform-apps";
import { buildShowcaseForApp } from "@/lib/static-snapshots/platform-app-showcase-sources";
import type { SiteHomePlatformAppKey } from "@/lib/site-home/platform-apps";
import { hashDateKeySeed, seededShuffle } from "@/lib/static-snapshots/cst-date";
import type { SiteHomeSnapshotPayload } from "@/lib/static-snapshots/site-home-payload";
import {
  getStoryTheaterVideoPool,
  posterForStoryVideoUrl,
  storyHeroFallbackBackground,
  type StoryHeroClip,
} from "@/lib/story-theater-videos";

function pickDeterministicHeroBackground(dateKey: string) {
  const pool = getStoryTheaterVideoPool().filter((url) => /demo-\d+\.mp4/i.test(url));
  if (pool.length === 0) return storyHeroFallbackBackground();
  const idx = hashDateKeySeed(dateKey, "hero-bg", pool.length);
  const url = pool[idx]!;
  return { url, poster: posterForStoryVideoUrl(url) };
}

function pickDeterministicHeroClips(dateKey: string, count: number): StoryHeroClip[] {
  const pool = getStoryTheaterVideoPool();
  const shuffled = seededShuffle(pool, dateKey, "hero-clips");
  return shuffled.slice(0, Math.min(count, shuffled.length)).map((url) => ({
    url,
    poster: posterForStoryVideoUrl(url),
  }));
}

export async function buildSiteHomeSnapshot(dateKey: string): Promise<SiteHomeSnapshotPayload> {
  const apps = buildSiteHomePlatformApps();
  const platformApps = apps.map((app) => ({
    key: app.key,
    label: app.label,
    tagline: app.tagline,
    href: app.href,
    showcase: buildShowcaseForApp(app.key as SiteHomePlatformAppKey, dateKey),
  }));

  const [gatewayModels] = await Promise.all([listPublicMarketShowcaseModels()]);
  const gatewayOrigin = getGatewayPublicOrigin();

  return {
    version: 1,
    hero: {
      background: pickDeterministicHeroBackground(dateKey),
      clips: pickDeterministicHeroClips(dateKey, 3),
    },
    platformApps,
    gatewayModels,
    gatewayOrigin,
  };
}

/** 无 DB 快照时的内置 fallback（不查库） */
export function buildSiteHomeSnapshotFallback(dateKey: string): SiteHomeSnapshotPayload {
  const apps = buildSiteHomePlatformApps();
  const platformApps = apps.map((app) => ({
    key: app.key,
    label: app.label,
    tagline: app.tagline,
    href: app.href,
    showcase: buildShowcaseForApp(app.key as SiteHomePlatformAppKey, dateKey),
  }));

  return {
    version: 1,
    hero: {
      background: pickDeterministicHeroBackground(dateKey),
      clips: pickDeterministicHeroClips(dateKey, 3),
    },
    platformApps,
    gatewayModels: [],
    gatewayOrigin: getGatewayPublicOrigin(),
  };
}
