import type { Connection } from "@xyflow/react";
import type { CanvasFlowNode } from "./types";

function pro2InboundTargetHandle(nodeType: string | undefined): string {
  if (
    nodeType === "story-pro2-image" ||
    nodeType === "story-pro2-three-view"
  ) {
    return "in_image";
  }
  return "in_text";
}

/** 左侧 + 拖出时语义为上游输入，翻转连线方向 */
export function normalizePro2PlusLeftConnection(
  connection: Connection,
  nodes: CanvasFlowNode[],
): Connection {
  if (connection.sourceHandle !== "plus_left") return connection;
  if (!connection.source || !connection.target) return connection;
  const inboundNode = nodes.find((n) => n.id === connection.source);
  return {
    source: connection.target,
    target: connection.source,
    sourceHandle: connection.targetHandle,
    targetHandle: pro2InboundTargetHandle(inboundNode?.type),
  };
}
