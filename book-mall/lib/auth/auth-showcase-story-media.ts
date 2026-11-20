import type { PortalFilmShowcaseMedia } from "@/lib/canvas/sbv1-film-showcase";
import { listStoryDiscoverCatalog } from "@/lib/story/story-discover-service";

/**
 * 登录/注册左栏 · 竖屏漫剧 9:16（与 story-web 门户「精品漫剧」同源 discover 池）。
 */
export async function listAuthStoryVerticalShowcaseMedia(): Promise<
  PortalFilmShowcaseMedia[]
> {
  const catalog = await listStoryDiscoverCatalog();

  const out: PortalFilmShowcaseMedia[] = [];

  for (const p of catalog) {
    if (p.aspectRatio !== "9:16") continue;

    const videoUrl = p.previewVideoUrl?.trim() ?? "";
    const poster =
      p.coverImageUrl?.trim() || p.styleFallbackUrl?.trim() || undefined;
    const url = videoUrl || poster || "";
    if (!url) continue;

    out.push({
      id: `story:${p.id}`,
      url: videoUrl || url,
      kind: videoUrl ? "video" : "image",
      posterUrl: videoUrl ? poster : undefined,
      sourceKind: "story",
      sourceId: p.id,
      projectName: p.name,
      description: p.description?.trim() || "竖屏漫剧 · 9:16",
      owner: null,
    });
  }

  return out;
}