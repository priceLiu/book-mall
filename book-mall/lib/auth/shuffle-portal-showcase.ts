import type { PortalFilmShowcaseMedia } from "@/lib/canvas/sbv1-film-showcase";

/** Fisher–Yates，每次进入登录/注册页得到不同顺序 */
export function shufflePortalShowcase<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** 每个门户案例项目至多一条：优先该项目最后一条 sbv1 成片视频（非全部分镜图展开） */
export function buildAuthShowcaseHeroPool(
  items: PortalFilmShowcaseMedia[],
): PortalFilmShowcaseMedia[] {
  const byProject = new Map<string, PortalFilmShowcaseMedia[]>();

  for (const item of items) {
    const url = item.url?.trim();
    if (!url) continue;
    const key = item.sourceId?.trim() || item.id;
    const list = byProject.get(key) ?? [];
    list.push(item);
    byProject.set(key, list);
  }

  const heroes: PortalFilmShowcaseMedia[] = [];

  for (const projectItems of byProject.values()) {
    const videos = projectItems.filter((i) => i.kind === "video");
    if (videos.length > 0) {
      heroes.push(videos[videos.length - 1]!);
      continue;
    }
    const images = projectItems.filter((i) => i.kind === "image");
    if (images.length > 0) {
      heroes.push(images[images.length - 1]!);
    }
  }

  return heroes;
}

export type PickAuthShowcaseHeroOptions = {
  /** 尽量避免与上一条相同（同会话刷新） */
  excludeUrl?: string | null;
};

function videoHeroPool(
  items: PortalFilmShowcaseMedia[],
): PortalFilmShowcaseMedia[] {
  let pool = buildAuthShowcaseHeroPool(items);
  const videos = pool.filter((i) => i.kind === "video");
  if (videos.length > 0) pool = videos;
  return pool;
}

/**
 * 登录/注册左栏：影视案例（sbv1）为主；竖屏漫剧（9:16）约 20% 概率。
 */
export function pickAuthShowcaseHero(
  items: PortalFilmShowcaseMedia[],
  options?: PickAuthShowcaseHeroOptions,
): PortalFilmShowcaseMedia | null {
  const storyItems = items.filter((i) => i.sourceKind === "story");
  const filmItems = items.filter((i) => i.sourceKind !== "story");

  const storyPool = videoHeroPool(storyItems);
  const filmPool = videoHeroPool(filmItems);

  let pool: PortalFilmShowcaseMedia[] = [];
  if (storyPool.length > 0 && filmPool.length > 0) {
    pool = Math.random() < 0.2 ? storyPool : filmPool;
  } else if (storyPool.length > 0) {
    pool = storyPool;
  } else if (filmPool.length > 0) {
    pool = filmPool;
  } else {
    pool = videoHeroPool(items);
    if (pool.length === 0) {
      pool = buildAuthShowcaseHeroPool(items);
    }
  }

  if (pool.length === 0) return null;

  const exclude = options?.excludeUrl?.trim();
  if (exclude && pool.length > 1) {
    const filtered = pool.filter((i) => i.url.trim() !== exclude);
    if (filtered.length > 0) pool = filtered;
  }

  return shufflePortalShowcase(pool)[0] ?? null;
}