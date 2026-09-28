import type { CanvasFlowNode } from "./types";

/**
 * 资产节点 Dock 提示词与剧本创作双向同步后置 pinned：
 * 行表 → 节点的批量同步（按表字段组装 dockInput）不得再覆盖。
 */
export function isPro2DockInputPinned(
  node: Pick<CanvasFlowNode, "data"> | undefined,
): boolean {
  return (node?.data as { pro2DockInputPinned?: boolean } | undefined)
    ?.pro2DockInputPinned === true;
}

export function omitPinnedDockInput<T extends Record<string, unknown>>(
  node: Pick<CanvasFlowNode, "data"> | undefined,
  patch: T,
): T {
  if (!isPro2DockInputPinned(node) || !("dockInput" in patch)) return patch;
  const next = { ...patch };
  delete next.dockInput;
  return next;
}
