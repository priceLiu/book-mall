import { nanoid } from "nanoid";

import type { CanvasFlowEdge } from "./types";

/** Hub 文本上游 → script hub 连线（纯函数 · 单测可 import） */
export function connectScriptHubEdge(
  setEdges: (fn: (prev: CanvasFlowEdge[]) => CanvasFlowEdge[]) => void,
  sourceId: string,
  hubId: string,
  sourceHandle: string,
  targetHandle: string,
): void {
  setEdges((prev) => {
    if (
      prev.some(
        (e) =>
          e.source === sourceId &&
          e.target === hubId &&
          e.sourceHandle === sourceHandle &&
          e.targetHandle === targetHandle,
      )
    ) {
      return prev;
    }
    return [
      ...prev,
      {
        id: nanoid(),
        source: sourceId,
        target: hubId,
        sourceHandle,
        targetHandle,
      },
    ];
  });
}
