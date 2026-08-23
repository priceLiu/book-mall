import { prisma } from "@/lib/prisma";
import { getStoryWebOrigin } from "@/lib/app-web-origins";
import {
  serializeProjectListItem,
  type StoryProjectListDto,
} from "@/lib/story/story-project-service";

const SHOWCASE_TITLES_16_9 = [
  "星尘旅人",
  "阿楠去面馆吃面",
  "霓虹回声",
  "旧城档案",
] as const;

const SHOWCASE_TITLES_9_16 = [
  "深海信标",
  "量子花火",
  "月面残响",
  "零号剧场",
] as const;

function storyCoverUrl(index: number): string {
  const origin = getStoryWebOrigin().replace(/\/$/, "");
  const n = (index % 15) + 1;
  return `${origin}/imgs/covers/cover-${n}.png`;
}

function buildShowcaseFallbackProjects(): StoryProjectListDto[] {
  const now = Date.now();
  const items: StoryProjectListDto[] = [];

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
      createdAt: new Date(now - (i + 5) * 86_400_000).toISOString(),
      updatedAt: new Date(now - (i + 1) * 7_200_000).toISOString(),
    });
  });

  return items;
}

/** 门户首页 / 未登录创作室：公开作品列表（TEAM_PUBLIC + 精选兜底）。 */
export async function listStoryDiscoverProjects(): Promise<StoryProjectListDto[]> {
  let fromDb: StoryProjectListDto[] = [];
  try {
    const publicRows = await prisma.storyProject.findMany({
      where: {
        deletedAt: null,
        visibility: "TEAM_PUBLIC",
        NOT: { coverImageUrl: "" },
      },
      orderBy: { updatedAt: "desc" },
      take: 24,
    });
    fromDb = publicRows.map(serializeProjectListItem);
  } catch {
    return buildShowcaseFallbackProjects();
  }

  if (fromDb.length >= 4) return fromDb;

  const fallbacks = buildShowcaseFallbackProjects();
  const seen = new Set(fromDb.map((p) => p.name));
  const merged = [...fromDb];
  for (const item of fallbacks) {
    if (merged.length >= 12) break;
    if (seen.has(item.name)) continue;
    merged.push(item);
    seen.add(item.name);
  }
  return merged;
}

export { buildShowcaseFallbackProjects as storyDiscoverShowcaseFallback };
