import type { PortalFilmShowcaseMedia } from "@/lib/canvas/sbv1-film-showcase";
import { listStoryDiscoverCatalog } from "@/lib/story/story-discover-service";

/**
 * 登录/注册左栏 · 竖屏漫剧 9:16（与 story-web 门户「精品漫剧」同源 discover 池）。
 */
export async function listAuthStoryVerticalShowcaseMedia(): Promise<
  PortalFilmShowcaseMedia[]
> {
  const catalog = await listStoryDiscoverCatalog();

  return catalog
    .filter((p) => p.aspectRatio === "9:16")
    .map((p) => {
      const videoUrl = p.previewVideoUrl?.trim() ?? "";
      const poster =
        p.coverImageUrl?.trim() || p.styleFallbackUrl?.trim() || undefined;
      const url = videoUrl || poster || "";
      if (!url) return null;

      return {
        id: `story:${p.id}`,
        url: videoUrl || poster!,
        kind: videoUrl ? ("video" as const) : ("image" as const),
        posterUrl: videoUrl ? poster : undefined,
        sourceKind: "story" as const,
        sourceId: p.id,
        projectName: p.name,
        description: p.description?.trim() || "竖屏漫剧 · 9:16",
        owner: null,
      } satisfies PortalFilmShowcaseMedia;
    })
    .filter((row): row is PortalFilmShowcaseMedia => row !== null);
}