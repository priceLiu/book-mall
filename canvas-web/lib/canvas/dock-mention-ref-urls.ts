import { parseReferencedIds } from "@/lib/canvas/dock-mention-parse";
import type { Pro2DockUpstreamLink } from "./pro2-dock-upstream-links";
import type { StoryRefImage } from "./story-ref-image";
import { pro2DockMentionRefCatalog } from "./pro2-dock-ref-catalog";

export type DockMentionRef = {
  id: string;
  url?: string;
};

/** 可进生图 imageInputs 的参考图（https 直传；blob/data 提交前再落 OSS） */
export function isDockRefRunnableUrl(url: string | undefined): url is string {
  const u = url?.trim() ?? "";
  return (
    /^https?:\/\//.test(u) || u.startsWith("blob:") || u.startsWith("data:")
  );
}

/** prompt 中 @ 引用的 ref id（存储形态 @<id>） */
export function dockActiveRefIdsFromPrompt(prompt: string): string[] {
  return parseReferencedIds(prompt);
}

/** 该 @ id 是否指向图片/风格参考（非文本/大纲/视频 @） */
export function isDockImageRefMentionId(
  id: string,
  imageCatalogIds: ReadonlySet<string>,
): boolean {
  if (imageCatalogIds.has(id)) return true;
  if (
    id.startsWith("up-text-") ||
    id.startsWith("up-outline-") ||
    id.startsWith("up-script-") ||
    id.startsWith("up-tag-") ||
    id.startsWith("sbv1-text-")
  ) {
    return false;
  }
  if (id.startsWith("up-video-") || id.startsWith("sbv1-motion-")) {
    return false;
  }
  return (
    id.startsWith("up-img-") ||
    id.startsWith("up-style-") ||
    id.startsWith("sbv1-ref-") ||
    id.startsWith("asset:") ||
    id.startsWith("hd-ref-") ||
    id.startsWith("paste") ||
    id.startsWith("ref-") ||
    id.startsWith("wiz-")
  );
}

function labelForDockImageMentionId(
  id: string,
  upstreamLinks: Pro2DockUpstreamLink[],
  dockRefImages: StoryRefImage[],
): string {
  return (
    dockRefImages.find((r) => r.id === id)?.label?.trim() ||
    upstreamLinks.find((l) => l.id === id)?.label?.trim() ||
    id
  );
}

/**
 * 生图前校验：prompt 里 @ 到的图片参考须已有可提交 URL。
 * 避免「Dock 有缩略图 / 写了 @，但 imageInputs 为空或只带了部分图」 silently 退化成纯文生图。
 */
export function listDockImageMentionRunIssues(
  prompt: string,
  upstreamLinks: Pro2DockUpstreamLink[],
  dockRefImages: StoryRefImage[] = [],
): string[] {
  const catalog = pro2DockMentionRefCatalog(upstreamLinks, dockRefImages);
  const catalogIds = new Set(catalog.map((c) => c.id));
  for (const r of dockRefImages) {
    if (r.id?.trim()) catalogIds.add(r.id.trim());
  }
  const byUrl = new Map(
    catalog
      .filter((c) => isDockRefRunnableUrl(c.url))
      .map((c) => [c.id, c.url!.trim()]),
  );

  const issues: string[] = [];
  for (const id of parseReferencedIds(prompt)) {
    if (!isDockImageRefMentionId(id, catalogIds)) continue;
    if (byUrl.has(id)) continue;
    const label = labelForDockImageMentionId(id, upstreamLinks, dockRefImages);
    issues.push(
      `「${label}」参考图尚未就绪（请等待上游出图完成、重新连线，或去掉该 @ 后再生成）`,
    );
  }
  return issues;
}

/**
 * 按 prompt 内 @ 引用解析参考图 URL；有 @ 时仅传被引用项（顺序与 @ 一致），否则传 catalog 全部。
 * 须包含 blob:/data:，否则 Dock 能看到缩略图但生图 imageInputs 被滤空。
 */
export function dockMentionRefUrlsForPrompt(
  prompt: string,
  catalog: DockMentionRef[],
): string[] {
  const byId = new Map(
    catalog
      .filter((r) => isDockRefRunnableUrl(r.url))
      .map((r) => [r.id, r.url!.trim()]),
  );
  const mentionedIds = parseReferencedIds(prompt);
  const catalogIds = new Set(catalog.map((c) => c.id));
  const imageMentionIds = mentionedIds.filter((id) =>
    isDockImageRefMentionId(id, catalogIds),
  );

  if (imageMentionIds.length > 0) {
    const urls: string[] = [];
    for (const id of imageMentionIds) {
      const url = byId.get(id);
      if (url) urls.push(url);
    }
    return urls;
  }

  if (mentionedIds.length === 0) {
    return Array.from(byId.values());
  }

  // 仅 @ 文本/大纲：仍带入全部已连接图片参考（与历史行为一致）
  return Array.from(byId.values());
}
