import type { Pro2DockUpstreamLink } from "./pro2-dock-upstream-links";
import type { StoryRefImage } from "./story-ref-image";
import type { DockMentionRef } from "./dock-mention-ref-urls";

/** 上游 chip + 粘贴参考图 → @ 目录（同步到 row.refImages / run 过滤） */
export function pro2DockRefImageCatalog(
  upstreamLinks: Pro2DockUpstreamLink[],
  dockRefImages: StoryRefImage[] = [],
): StoryRefImage[] {
  const out: StoryRefImage[] = [];
  const seen = new Set<string>();

  for (const link of upstreamLinks) {
    if (link.kind !== "image" || !link.previewUrl) continue;
    if (seen.has(link.id)) continue;
    seen.add(link.id);
    out.push({ id: link.id, label: link.label, url: link.previewUrl });
  }

  for (const ref of dockRefImages) {
    if (!ref.id || seen.has(ref.id)) continue;
    seen.add(ref.id);
    out.push(ref);
  }

  return out;
}

export function pro2DockMentionRefCatalog(
  upstreamLinks: Pro2DockUpstreamLink[],
  dockRefImages: StoryRefImage[] = [],
): DockMentionRef[] {
  return pro2DockRefImageCatalog(upstreamLinks, dockRefImages).map((r) => ({
    id: r.id,
    url: r.url,
  }));
}
