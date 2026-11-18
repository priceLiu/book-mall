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

/** 登录左栏：每次随机一条门户精选成片（优先视频） */
export function pickAuthShowcaseHero(
  items: PortalFilmShowcaseMedia[],
): PortalFilmShowcaseMedia | null {
  const videos = items.filter((i) => i.kind === "video" && i.url?.trim());
  const pool = videos.length > 0 ? videos : items.filter((i) => i.url?.trim());
  if (pool.length === 0) return null;
  return shufflePortalShowcase(pool)[0] ?? null;
}