import imageGallery from "@/content/quick-replica/builtin-image-gallery.json";
import motionSyncGallery from "@/content/quick-replica/builtin-motion-sync-gallery.json";
import videoGallery from "@/content/quick-replica/builtin-video-gallery.json";
import { getStoryWebOrigin } from "@/lib/app-web-origins";
import storyManifest from "@/lib/story-theater-videos.manifest.json";

export type ToolWorkShowcaseItem = {
  id: string;
  imageUrl: string;
  title: string;
  categoryLabel: string;
  productHref: string | null;
};

export type ToolWorkShowcaseLimits = {
  /** 工具站作品总条数上限（不含推荐产品本身） */
  maxItems: number;
  /** 来自快速复制图库的作品上限 */
  quickReplicaMax: number;
};

type GalleryEntry = {
  id: string;
  title: string;
  thumbnailUrl: string;
};

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

function productHrefForNavKey(
  navKey: string,
  productSlugByNavKey: Map<string, string>,
): string | null {
  const slug = productSlugByNavKey.get(navKey);
  return slug ? `/products/${slug}` : null;
}

function pickGalleryEntries(
  entries: GalleryEntry[],
  count: number,
  step: number,
): GalleryEntry[] {
  const out: GalleryEntry[] = [];
  for (let i = 0; i < entries.length && out.length < count; i += step) {
    const entry = entries[i];
    if (entry?.thumbnailUrl) out.push(entry);
  }
  return out;
}

function listToolStationShowcaseItems(
  productSlugByNavKey: Map<string, string>,
  limit: number,
): ToolWorkShowcaseItem[] {
  if (limit <= 0) return [];

  const items: ToolWorkShowcaseItem[] = [];
  const storyOrigin = getStoryWebOrigin();
  const storyVideos = storyManifest.videos ?? [];

  for (let i = 0; i < storyVideos.length && items.length < limit; i++) {
    const video = storyVideos[i]!;
    items.push({
      id: `story-${video.id}`,
      imageUrl: `${storyOrigin}/imgs/covers/cover-${(i % 15) + 1}.png`,
      title: STORY_THEATER_TITLES[i % STORY_THEATER_TITLES.length] ?? video.id,
      categoryLabel: "漫剧剧场",
      productHref: productHrefForNavKey("story-theater", productSlugByNavKey),
    });
  }

  return items;
}

/** 快速复制内置图库（文生图 / 图生视频 / 运动同步样例） */
function listQuickReplicaShowcaseItems(
  productSlugByNavKey: Map<string, string>,
  limit: number,
): ToolWorkShowcaseItem[] {
  if (limit <= 0) return [];

  const pools: {
    entries: GalleryEntry[];
    categoryLabel: string;
    navKey: string | null;
  }[] = [
    {
      entries: pickGalleryEntries(imageGallery as GalleryEntry[], limit, 2),
      categoryLabel: "文生图",
      navKey: "text-to-image",
    },
    {
      entries: pickGalleryEntries(videoGallery as GalleryEntry[], limit, 2),
      categoryLabel: "图生视频",
      navKey: "image-to-video",
    },
    {
      entries: pickGalleryEntries(motionSyncGallery as GalleryEntry[], limit, 3),
      categoryLabel: "运动同步",
      navKey: null,
    },
  ];

  const items: ToolWorkShowcaseItem[] = [];
  let round = 0;
  while (items.length < limit && round < limit) {
    for (const pool of pools) {
      const entry = pool.entries[round];
      if (!entry) continue;
      items.push({
        id: entry.id,
        imageUrl: entry.thumbnailUrl,
        title: entry.title,
        categoryLabel: pool.categoryLabel,
        productHref: pool.navKey
          ? productHrefForNavKey(pool.navKey, productSlugByNavKey)
          : null,
      });
      if (items.length >= limit) break;
    }
    round += 1;
  }

  return items;
}

/**
 * 首页推荐产品区 · 工具站作品（漫剧剧场等）+ 快速复制样例。
 * 优先展示工具站作品；快速复制合计不超过 quickReplicaMax。
 */
export function listToolWorkShowcaseItems(
  productSlugByNavKey: Map<string, string>,
  limits: ToolWorkShowcaseLimits,
): ToolWorkShowcaseItem[] {
  const maxItems = Math.max(0, limits.maxItems);
  const quickReplicaMax = Math.min(Math.max(0, limits.quickReplicaMax), maxItems);

  const quickReplica = listQuickReplicaShowcaseItems(
    productSlugByNavKey,
    quickReplicaMax,
  );
  const toolStation = listToolStationShowcaseItems(
    productSlugByNavKey,
    maxItems - quickReplica.length,
  );

  return [...toolStation, ...quickReplica];
}
