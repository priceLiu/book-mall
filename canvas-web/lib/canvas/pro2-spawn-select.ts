import type { CanvasFlowNode } from "./types";
import { ensureNodeDragHandles } from "./normalize-graph-nodes";

/** + 菜单生成节点后选中并确保 Pro2 整卡可拖 */
export function selectPro2NodeAfterSpawn(
  setNodes: (fn: (nodes: CanvasFlowNode[]) => CanvasFlowNode[]) => void,
  nodeId: string,
): void {
  if (!nodeId) return;
  setNodes((prev) =>
    ensureNodeDragHandles(
      prev.map((n) => ({ ...n, selected: n.id === nodeId })),
    ),
  );
}
