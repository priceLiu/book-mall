import { parseReferencedIds } from "@/components/canvas/mentions/MentionsTextarea";
import type { UpstreamChip } from "@/components/canvas/upstream-chips";

/**
 * 解析 prompt 里「已引用」的上游节点：
 * - `@<nodeId>` mention token
 * - 文本参数块已写入正文（模板追加 / 手贴）
 */
export function resolveReferencedNodeIds(
  prompt: string,
  chips: UpstreamChip[],
): string[] {
  const ids = new Set(parseReferencedIds(prompt));

  for (const c of chips) {
    if (c.kind !== "text") continue;
    const block = c.fullText?.trim();
    if (!block) continue;
    if (prompt.includes(block)) {
      ids.add(c.id);
    }
  }

  return Array.from(ids);
}
