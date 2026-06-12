"use client";

import type { CanvasFlowEdge } from "./types";

/** 脚本中枢 → 媒体组容器连线（hub 右侧 text → 组左侧 in_text） */
export function ensurePro2HubToMediaGroupEdge(
  setEdges: (fn: (edges: CanvasFlowEdge[]) => CanvasFlowEdge[]) => void,
  hubNodeId: string,
  groupId: string,
): void {
  setEdges((prev) => {
    if (
      prev.some(
        (e) =>
          e.source === hubNodeId &&
          e.target === groupId &&
          e.sourceHandle === "text" &&
          e.targetHandle === "in_text",
      )
    ) {
      return prev;
    }
    return [
      ...prev,
      {
        id: `e-${hubNodeId}-${groupId}`,
        source: hubNodeId,
        target: groupId,
        sourceHandle: "text",
        targetHandle: "in_text",
      },
    ];
  });
}
