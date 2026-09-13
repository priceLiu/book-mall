import { parseReferencedIds } from "@/lib/canvas/dock-mention-parse";

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
  const fromMentions = parseReferencedIds(prompt)
    .map((id) => byId.get(id))
    .filter((u): u is string => Boolean(u));
  if (fromMentions.length) return fromMentions;
  return Array.from(byId.values());
}
