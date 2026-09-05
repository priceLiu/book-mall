/**
 * 首页平台应用 showcase · 静态 gallery 聚合（Cron 写路径专用）。
 */
import videoGallery from "@/content/quick-replica/builtin-video-gallery.json";
import imageGallery from "@/content/quick-replica/builtin-image-gallery.json";
import manifest from "@/lib/story-theater-videos.manifest.json";
import { platformAppMediaFor } from "@/lib/site-home/platform-app-media";
import type { SiteHomePlatformAppKey } from "@/lib/site-home/platform-apps";
import { posterForStoryVideoUrl } from "@/lib/story-theater-videos";
import { hashDateKeySeed, seededShuffle } from "@/lib/static-snapshots/cst-date";
import type { SiteHomeShowcaseItem } from "@/lib/static-snapshots/site-home-payload";

const STORY_THEATER_TITLES = [
  "星尘旅人",
  "霓虹回声",
  "深海信标",
  "旧城档案",
  "量子花火",
  "月面残响",
  "零号剧场",
  "雾都追光",
] as const;

type GalleryEntry = {
  id: string;
  title: string;
  thumbnailUrl: string;
  output?: { mediaType?: string; url?: string };
};

const SHOWCASE_PER_APP = 5;

function fromQrVideoGallery(limit: number): SiteHomeShowcaseItem[] {
  return (videoGallery as GalleryEntry[]).slice(0, limit).map((e) => ({
    id: e.id,
    title: e.title,
    posterUrl: e.thumbnailUrl,
    videoUrl: e.output?.url ?? null,
  }));
}

function fromQrImageGallery(limit: number): SiteHomeShowcaseItem[] {
  return (imageGallery as GalleryEntry[]).slice(0, limit).map((e) => ({
    id: e.id,
    title: e.title,
    posterUrl: e.thumbnailUrl,
    videoUrl: null,
  }));
}

function fromStoryManifest(limit: number, dateKey: string): SiteHomeShowcaseItem[] {
  const videos = manifest.videos ?? [];
  const shuffled = seededShuffle(videos, dateKey, "story-manifest");
  return shuffled.slice(0, limit).map((v, i) => ({
    id: v.id,
    title: STORY_THEATER_TITLES[i % STORY_THEATER_TITLES.length] ?? v.id,
    posterUrl: posterForStoryVideoUrl(v.url),
    videoUrl: v.url,
  }));
}

function fromPlatformMedia(key: SiteHomePlatformAppKey): SiteHomeShowcaseItem[] {
  const media = platformAppMediaFor(key);
  return [
    {
      id: `${key}-default`,
      title: media.posterUrl.split("/").pop() ?? key,
      posterUrl: media.posterUrl,
      videoUrl: media.videoUrl,
    },
  ];
}

function poolForApp(key: SiteHomePlatformAppKey, dateKey: string): SiteHomeShowcaseItem[] {
  switch (key) {
    case "story":
      return fromStoryManifest(SHOWCASE_PER_APP + 2, dateKey);
    case "tool":
    case "quick-replica":
      return fromQrVideoGallery(SHOWCASE_PER_APP + 2);
    case "common-tools":
      return fromQrImageGallery(SHOWCASE_PER_APP + 2);
    case "canvas":
    case "e-commerce":
    case "publisher":
    case "prompt-optimizer":
    case "director":
      return [
        ...fromPlatformMedia(key),
        ...fromQrVideoGallery(3),
        ...fromStoryManifest(2, `${dateKey}:${key}`),
      ];
    default:
      return fromPlatformMedia(key);
  }
}

export function buildShowcaseForApp(
  key: SiteHomePlatformAppKey,
  dateKey: string,
): SiteHomeShowcaseItem[] {
  const pool = poolForApp(key, dateKey);
  const unique = new Map<string, SiteHomeShowcaseItem>();
  for (const item of pool) {
    if (!item.posterUrl) continue;
    unique.set(item.id, item);
  }
  const items = Array.from(unique.values());
  const shuffled = seededShuffle(items, dateKey, `app:${key}`);
  const offset = hashDateKeySeed(dateKey, `offset:${key}`, Math.max(1, shuffled.length));
  const rotated = [...shuffled.slice(offset), ...shuffled.slice(0, offset)];
  return rotated.slice(0, SHOWCASE_PER_APP);
}
