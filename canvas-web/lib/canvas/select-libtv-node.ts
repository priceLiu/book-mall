"use client";

import type { Node } from "@xyflow/react";
import { useCanvasStore } from "./store";

/** LibTV 画布复制/生成后选中：同步 RF 选中态 + 浮动 Dock 锚点（store 选中在 LibTV 下不写 undo） */
export function selectLibtvNodeAfterDuplicate(
  rfSetNodes: (payload: Node[] | ((nodes: Node[]) => Node[])) => void,
  nodeId: string,
  nodeType: string,
): void {
  rfSetNodes((prev) =>
    prev.map((n) => ({ ...n, selected: n.id === nodeId })),
  );
  useCanvasStore.getState().setLibtvFloatingDockSelection(nodeId, nodeType);
}
