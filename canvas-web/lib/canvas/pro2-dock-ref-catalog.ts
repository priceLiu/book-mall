import type { Pro2DockUpstreamLink } from "./pro2-dock-upstream-links";
import type { StoryRefImage } from "./story-ref-image";
import type { DockMentionRef } from "./dock-mention-ref-urls";
import { dockActiveRefIdsFromPrompt } from "./dock-mention-ref-urls";

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

/**
 * Dock 参考图解析：有 @ 时仅选中项；无 @ 时 catalog 全部带入模型。
 * 供生图 imageInputs、脚本 merge、分镜 kickoff 等共用。
 */
export function resolveDockRefsForRun(
  prompt: string,
  upstreamLinks: Pro2DockUpstreamLink[],
  dockRefImages: StoryRefImage[] = [],
): StoryRefImage[] {
  const catalog = pro2DockRefImageCatalog(upstreamLinks, dockRefImages);
  const mentioned = dockActiveRefIdsFromPrompt(prompt);
  if (mentioned.length > 0) {
    const idSet = new Set(mentioned);
    return catalog.filter((r) => idSet.has(r.id));
  }
  return catalog;
}

export function resolveDockRefUrlsForRun(
  prompt: string,
  upstreamLinks: Pro2DockUpstreamLink[],
  dockRefImages: StoryRefImage[] = [],
): string[] {
  return resolveDockRefsForRun(prompt, upstreamLinks, dockRefImages)
    .map((r) => r.url)
    .filter((u): u is string => typeof u === "string" && /^https?:\/\//.test(u));
}
