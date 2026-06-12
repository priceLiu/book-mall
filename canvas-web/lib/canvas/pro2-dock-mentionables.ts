import type { MentionableItem } from "@/components/canvas/mentions/MentionsTextarea";
import type { Pro2DockUpstreamLink } from "./pro2-dock-upstream-links";
import type { StoryRefImage } from "./story-ref-image";

/** 输入坞 · 上游 chip + 粘贴参考图 → @ 列表 */
export function buildPro2DockMentionables(
  upstreamLinks: Pro2DockUpstreamLink[],
  dockRefImages: StoryRefImage[] = [],
): MentionableItem[] {
  const items: MentionableItem[] = [];
  const seen = new Set<string>();

  for (const link of upstreamLinks) {
    if (seen.has(link.id)) continue;
    seen.add(link.id);
    if (link.kind === "image" && link.previewUrl) {
      items.push({
        id: link.id,
        label: link.label,
        kind: "image",
        previewUrl: link.previewUrl,
      });
    } else {
      items.push({
        id: link.id,
        label: link.label,
        kind: link.kind,
      });
    }
  }

  for (const ref of dockRefImages) {
    if (!ref.id || seen.has(ref.id)) continue;
    seen.add(ref.id);
    items.push({
      id: ref.id,
      label: ref.label || "参考图",
      kind: "image",
      previewUrl: ref.url,
    });
  }

  return items;
}
