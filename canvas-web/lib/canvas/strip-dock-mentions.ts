import { parseReferencedIds } from "@/components/canvas/mentions/MentionsTextarea";

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** 画布节点删除后，其在上游 chip / @ 里可能出现的 id 形态 */
export function mentionIdsForRemovedCanvasNode(nodeId: string): string[] {
  return [
    nodeId,
    `up-style-${nodeId}`,
    `up-img-${nodeId}`,
    `up-outline-${nodeId}`,
    `up-text-${nodeId}`,
  ];
}

/** 从存储态 prompt 移除 `@<refId>` token（保留其余文案） */
export function stripMentionTokensFromPrompt(
  prompt: string,
  refIds: string[],
): string {
  if (!prompt || !refIds.length) return prompt;
  let s = prompt;
  for (const id of refIds) {
    if (!id) continue;
    s = s.replace(
      new RegExp(`\\s*@<${escapeRegExp(id)}>\\s*`, "g"),
      " ",
    );
  }
  return s.replace(/\s{2,}/g, " ").trim();
}

/** 删除 dock 参考图 chip 时同步更新 refs + prompt */
export function removeDockRefFromState(
  refs: { id: string }[],
  refId: string,
  prompt: string,
): { refs: { id: string }[]; prompt: string } {
  return {
    refs: refs.filter((r) => r.id !== refId),
    prompt: stripMentionTokensFromPrompt(prompt, [refId]),
  };
}

/** 按当前 mentionables 目录剔除 prompt 里已失效的 @ */
export function stripStaleMentionTokensFromPrompt(
  prompt: string,
  validRefIds: Iterable<string>,
): string {
  if (!prompt.includes("@<")) return prompt;
  const valid = new Set(validRefIds);
  const stale = parseReferencedIds(prompt).filter((id) => !valid.has(id));
  if (!stale.length) return prompt;
  return stripMentionTokensFromPrompt(prompt, stale);
}

export type DockMentionPromptField = "dockInput" | "themeInput";

const DOCK_MENTION_FIELDS: DockMentionPromptField[] = [
  "dockInput",
  "themeInput",
];

/** 某节点被删后，扫全图其余节点的 dockInput / themeInput */
export function pruneMentionsAfterNodeRemoval<
  T extends { id: string; data: Record<string, unknown> },
>(nodes: T[], removedNodeId: string): T[] {
  const idsToStrip = mentionIdsForRemovedCanvasNode(removedNodeId);
  return nodes.map((n) => {
    const d = n.data;
    const patch: Record<string, unknown> = {};
    for (const field of DOCK_MENTION_FIELDS) {
      const v = d[field];
      if (typeof v !== "string" || !v.includes("@<")) continue;
      const next = stripMentionTokensFromPrompt(v, idsToStrip);
      if (next !== v) patch[field] = next;
    }
    if (Object.keys(patch).length === 0) return n;
    return { ...n, data: { ...d, ...patch } };
  });
}
