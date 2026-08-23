import type { CanvasFlowNode } from "./types";

/** 标签节点默认标题 · O(n) 单次扫描，供 zustand selector 使用 */
export function selectPro2TagNodeDefaultLabel(
  nodes: CanvasFlowNode[],
  nodeId: string,
): string {
  let ordinal = 0;
  for (const n of nodes) {
    if (n.type !== "story-pro2-tag") continue;
    ordinal += 1;
    if (n.id === nodeId) return `标签节点 ${ordinal}`;
  }
  return "标签节点";
}
