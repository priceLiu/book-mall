import type { MentionableItem } from "@/components/canvas/mentions/MentionsTextarea";
import type { Pro2DockUpstreamLink } from "./pro2-dock-upstream-links";
import type { StoryRefImage } from "./story-ref-image";
import type { ProjectAssetRecord } from "./project-asset-types";
import { buildCameraShotMentionables } from "./camera-shot-library/mentionables";

export function isPlatformDockMentionId(id: string): boolean {
  return id.startsWith("cam:");
}

/** 输入坞 · 上游 chip + 粘贴参考图 + 项目资产 + 平台镜头描述 → @ 列表 */
export function buildPro2DockMentionables(
  upstreamLinks: Pro2DockUpstreamLink[],
  dockRefImages: StoryRefImage[] = [],
  libraryAssets: ProjectAssetRecord[] = [],
): MentionableItem[] {
  const items: MentionableItem[] = [];
  const seen = new Set<string>();

  for (const link of upstreamLinks) {
    if (seen.has(link.id)) continue;
    seen.add(link.id);
    if (
      (link.kind === "image" || link.kind === "video") &&
      link.previewUrl
    ) {
      items.push({
        id: link.id,
        label: link.label,
        kind: link.kind === "video" ? "video" : "image",
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

  for (const asset of libraryAssets) {
    const id = `asset:${asset.id}`;
    if (seen.has(id)) continue;
    seen.add(id);
    items.push({
      id,
      label: `[资产] ${asset.displayName}`,
      kind: "image",
      previewUrl: asset.thumbnailUrl || asset.refs[0]?.mediaUrl,
    });
  }

  for (const cam of buildCameraShotMentionables()) {
    if (seen.has(cam.id)) continue;
    seen.add(cam.id);
    items.push(cam);
  }

  return items;
}
