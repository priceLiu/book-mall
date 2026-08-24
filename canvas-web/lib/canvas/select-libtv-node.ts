"use client";

import type { Node } from "@xyflow/react";
import { useCanvasStore } from "./store";

/** LibTV 画布 · 立即写入 RF 单选 + Dock 锚点（避免 store 同步 guard 吞 select） */
export function commitLibtvRfNodeSelection(
  rfSetNodes: (payload: Node[] | ((nodes: Node[]) => Node[])) => void,
  nodeId: string,
  nodeType: string | null | undefined,
): void {
  rfSetNodes((prev) => {
    const alreadySole =
      prev.find((n) => n.id === nodeId)?.selected &&
      prev.filter((n) => n.selected).length === 1;
    if (alreadySole) return prev;
    return prev.map((n) => ({ ...n, selected: n.id === nodeId }));
  });
  useCanvasStore.getState().setLibtvFloatingDockSelection(
    nodeId,
    nodeType ?? null,
  );
}

/** LibTV 画布复制/生成后选中：同步 RF 选中态 + 浮动 Dock 锚点（store 选中在 LibTV 下不写 undo） */
export function selectLibtvNodeAfterDuplicate(
  rfSetNodes: (payload: Node[] | ((nodes: Node[]) => Node[])) => void,
  nodeId: string,
  nodeType: string,
): void {
  commitLibtvRfNodeSelection(rfSetNodes, nodeId, nodeType);
}
