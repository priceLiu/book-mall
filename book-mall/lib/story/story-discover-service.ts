import { prisma } from "@/lib/prisma";
import { getStoryWebOrigin } from "@/lib/app-web-origins";
import {
  serializeProjectListItem,
  type StoryProjectListDto,
} from "@/lib/story/story-project-service";

export type StoryDiscoverListDto = StoryProjectListDto & {
  /** 门户卡片悬停预览（精选兜底项；DB 公开项暂无则省略） */
  previewVideoUrl?: string;
};

const SHOWCASE_TITLES_16_9 = [
  "星尘旅人",
  "阿楠去面馆吃面",
  "霓虹回声",
  "旧城档案",
  "雾都追光",
  "逆鳞",
  "云端牧歌",
  "时隙旅社",
] as const;

const SHOWCASE_TITLES_9_16 = [
  "深海信标",
  "量子花火",
  "月面残响",
  "零号剧场",
  "琥珀黎明",
  "无名航线",
  "碎镜王国",
  "最后一帧",
] as const;

const OSS_PREVIEW_VIDEO_BASE =
  "https://tool-mall.oss-cn-guangzhou.aliyuncs.com/story-web/landing/video";

function discoverPreviewVideoUrl(index: number): string {
  const n = (index % 51) + 1;
  return `${OSS_PREVIEW_VIDEO_BASE}/demo-${n}.mp4`;
}

function storyCoverUrl(index: number): string {
  const origin = getStoryWebOrigin().replace(/\/$/, "");
  const n = (index % 15) + 1;
  return `${origin}/imgs/covers/cover-${n}.png`;
}

function buildShowcaseFallbackProjects(): StoryDiscoverListDto[] {
  const now = Date.now();
  const items: StoryDiscoverListDto[] = [];
  let videoIndex = 0;

  SHOWCASE_TITLES_16_9.forEach((name, i) => {
    items.push({
      id: `discover:showcase-16x9-${i + 1}`,
      name,
      description: "",
      aspectRatio: "16:9",
      styleId: 1,
      status: i === 0 ? "INITIALIZING" : "READY",
      storyOutline: "",
      coverImageUrl: storyCoverUrl(i),
      styleFallbackUrl: storyCoverUrl(i),
      previewVideoUrl: discoverPreviewVideoUrl(videoIndex++),
      createdAt: new Date(now - (i + 1) * 86_400_000).toISOString(),
      updatedAt: new Date(now - i * 3_600_000).toISOString(),
    });
  });

  SHOWCASE_TITLES_9_16.forEach((name, i) => {
    items.push({
      id: `discover:showcase-9x16-${i + 1}`,
      name,
      description: "",
      aspectRatio: "9:16",
      styleId: 1,
      status: "READY",
      storyOutline: "",
      coverImageUrl: storyCoverUrl(i + 4),
      styleFallbackUrl: storyCoverUrl(i + 4),
      previewVideoUrl: discoverPreviewVideoUrl(videoIndex++),
      createdAt: new Date(now - (i + 5) * 86_400_000).toISOString(),
      updatedAt: new Date(now - (i + 1) * 7_200_000).toISOString(),
    });
  });

  // 扩充至与 landing 视频库同量级，供首页滚动懒加载
  for (let round = 0; round < 3; round++) {
    SHOWCASE_TITLES_16_9.forEach((name, i) => {
      const suffix = round * SHOWCASE_TITLES_16_9.length + i + 1;
      items.push({
        id: `discover:showcase-16x9-x${suffix}`,
        name: round === 0 ? name : `${name} · ${round + 1}`,
        description: "",
        aspectRatio: "16:9",
        styleId: 1 + (suffix % 5),
        status: "READY",
        storyOutline: "",
        coverImageUrl: storyCoverUrl(suffix),
        styleFallbackUrl: storyCoverUrl(suffix),
        previewVideoUrl: discoverPreviewVideoUrl(videoIndex++),
        createdAt: new Date(now - (suffix + 1) * 43_200_000).toISOString(),
        updatedAt: new Date(now - suffix * 1_800_000).toISOString(),
      });
    });
    SHOWCASE_TITLES_9_16.forEach((name, i) => {
      const suffix = round * SHOWCASE_TITLES_9_16.length + i + 1;
      items.push({
        id: `discover:showcase-9x16-x${suffix}`,
        name: round === 0 ? name : `${name} · ${round + 1}`,
        description: "",
        aspectRatio: "9:16",
        styleId: 1 + (suffix % 5),
        status: "READY",
        storyOutline: "",
        coverImageUrl: storyCoverUrl(suffix + 3),
        styleFallbackUrl: storyCoverUrl(suffix + 3),
        previewVideoUrl: discoverPreviewVideoUrl(videoIndex++),
        createdAt: new Date(now - (suffix + 6) * 43_200_000).toISOString(),
        updatedAt: new Date(now - suffix * 2_400_000).toISOString(),
      });
    });
  }

  return items;
}

async function buildFullDiscoverCatalog(): Promise<StoryDiscoverListDto[]> {
  let fromDb: StoryDiscoverListDto[] = [];
  try {
    const publicRows = await prisma.storyProject.findMany({
      where: {
        deletedAt: null,
        visibility: "TEAM_PUBLIC",
        NOT: { coverImageUrl: "" },
      },
      orderBy: { updatedAt: "desc" },
      take: 120,
    });
    fromDb = publicRows.map((row, index) => ({
      ...serializeProjectListItem(row),
      previewVideoUrl: discoverPreviewVideoUrl(index),
    }));
  } catch {
    return buildShowcaseFallbackProjects();
  }

  const fallbacks = buildShowcaseFallbackProjects();
  if (fromDb.length >= 8) {
    const seen = new Set(fromDb.map((p) => p.id));
    for (const item of fallbacks) {
      if (fromDb.length >= fallbacks.length) break;
      if (seen.has(item.id)) continue;
      fromDb.push(item);
      seen.add(item.id);
    }
    return fromDb;
  }

  const seen = new Set(fromDb.map((p) => p.name));
  const merged = [...fromDb];
  for (const item of fallbacks) {
    if (seen.has(item.name) && !item.id.startsWith("discover:showcase-")) continue;
    if (merged.some((m) => m.id === item.id)) continue;
    merged.push(item);
    seen.add(item.name);
  }
  return merged;
}

export type StoryDiscoverPage = {
  projects: StoryDiscoverListDto[];
  total: number;
  hasMore: boolean;
  nextOffset: number | null;
};

/** 门户首页 · 分页公开作品（无需登录） */
export async function listStoryDiscoverProjectsPage(
  offsetRaw: number,
  limitRaw: number,
): Promise<StoryDiscoverPage> {
  const offset = Math.max(0, Math.floor(offsetRaw));
  const limit = Math.min(24, Math.max(1, Math.floor(limitRaw)));
  const catalog = await buildFullDiscoverCatalog();
  const projects = catalog.slice(offset, offset + limit);
  const nextOffset = offset + limit < catalog.length ? offset + limit : null;
  return {
    projects,
    total: catalog.length,
    hasMore: nextOffset !== null,
    nextOffset,
  };
}

/** @deprecated 使用 listStoryDiscoverProjectsPage */
export async function listStoryDiscoverProjects(): Promise<StoryProjectListDto[]> {
  const page = await listStoryDiscoverProjectsPage(0, 120);
  return page.projects;
}

export { buildShowcaseFallbackProjects as storyDiscoverShowcaseFallback };
