"use client";

import type { Node } from "@xyflow/react";

import type { CanvasFlowNode } from "./types";

/** React Flow `useReactFlow().setNodes` · 与 zustand `setNodes` 签名不同 */
export type LibtvRfSetNodes = (
  payload: Node[] | ((nodes: Node[]) => Node[]),
) => void;

/** 将 store 侧节点 patch 同步到 RF 本地（magic edit 会话关闭等） */
export function patchLibtvRfNodes(
  rfSetNodes: LibtvRfSetNodes | undefined,
  patch: (nodes: CanvasFlowNode[]) => CanvasFlowNode[],
): void {
  if (!rfSetNodes) return;
  rfSetNodes((prev) => patch(prev as CanvasFlowNode[]));
}
