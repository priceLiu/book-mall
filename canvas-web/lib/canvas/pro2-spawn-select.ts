import type { CanvasFlowNode } from "./types";
import { ensureNodeDragHandles } from "./normalize-graph-nodes";
import { useCanvasStore } from "./store";

/** + 菜单生成节点后选中、聚焦视口并确保 Pro2 整卡可拖 */
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
  queueMicrotask(() => {
    useCanvasStore.getState().focusCanvasNode(nodeId);
  });
}

/** @deprecated 别名 · 与 selectPro2NodeAfterSpawn 相同 */
export const focusNodeAfterSpawn = selectPro2NodeAfterSpawn;
