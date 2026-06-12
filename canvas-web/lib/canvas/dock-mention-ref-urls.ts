import { parseReferencedIds } from "@/components/canvas/mentions/MentionsTextarea";

export type DockMentionRef = {
  id: string;
  url?: string;
};

/** prompt 中 @ 引用的 ref id（存储形态 @<id>） */
export function dockActiveRefIdsFromPrompt(prompt: string): string[] {
  return parseReferencedIds(prompt);
}

/**
 * 按 prompt 内 @ 引用解析参考图 URL；有 @ 时仅传被引用项（顺序与 @ 一致），否则传 catalog 全部。
 */
export function dockMentionRefUrlsForPrompt(
  prompt: string,
  catalog: DockMentionRef[],
): string[] {
  const byId = new Map(
    catalog
      .filter((r) => r.url && /^https?:\/\//.test(r.url))
      .map((r) => [r.id, r.url!]),
  );
  const fromMentions = parseReferencedIds(prompt)
    .map((id) => byId.get(id))
    .filter((u): u is string => Boolean(u));
  if (fromMentions.length) return fromMentions;
  return Array.from(byId.values());
}
