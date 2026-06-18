import type { CanvasFlowNode } from "./types";
import { isGroupNode } from "./types";

/** LibTV 浮动 Dock · 唯一选中节点（排除 group） */
export function resolveLibtvFloatingDockSelection(
  nodes: { id: string; type?: string; selected?: boolean }[],
): { nodeId: string; nodeType: string } | null {
  let found: { nodeId: string; nodeType: string } | null = null;
  let count = 0;
  for (const n of nodes) {
    if (!n.selected || !n.type || isGroupNode(n.type)) continue;
    count += 1;
    found = { nodeId: n.id, nodeType: n.type };
    if (count > 1) return null;
  }
  return count === 1 ? found : null;
}
