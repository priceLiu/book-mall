/** 保存前将 React Flow 上的节点坐标写回 store（避免 RF 与 store 不一致导致跳位） */

export const CANVAS_COMMIT_NODE_POSITIONS_EVENT =
  "canvas:commit-node-positions";

export function flushCanvasNodePositions(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CANVAS_COMMIT_NODE_POSITIONS_EVENT));
}
