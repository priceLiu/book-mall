import type { Connection } from "@xyflow/react";
import type { CanvasFlowNode } from "./types";

function pro2InboundTargetHandle(nodeType: string | undefined): string {
  if (nodeType === "jianying-export-pro2") return "in_video";
  if (
    nodeType === "story-pro2-image" ||
    nodeType === "story-pro2-three-view"
  ) {
    return "in_image";
  }
  return "in_text";
}

function pro2PlusLeftOutboundHandle(
  targetNode: CanvasFlowNode | undefined,
  targetHandle: string | null | undefined,
): string | undefined {
  if (targetHandle) return targetHandle;
  const t = targetNode?.type;
  if (t === "sbv1-video-engine") return "out_video";
  if (t === "sbv1-image" || t === "story-pro2-image" || t === "story-pro2-three-view") {
    return "image";
  }
  if (t === "story-pro2-starter" || t === "story-pro2-script-hub") return "text";
  return undefined;
}

/** 左侧 + 拖出时语义为上游输入，翻转连线方向 */
export function normalizePro2PlusLeftConnection(
  connection: Connection,
  nodes: CanvasFlowNode[],
): Connection {
  if (connection.sourceHandle !== "plus_left") return connection;
  if (!connection.source || !connection.target) return connection;
  const inboundNode = nodes.find((n) => n.id === connection.source);
  const outboundNode = nodes.find((n) => n.id === connection.target);
  return {
    source: connection.target,
    target: connection.source,
    sourceHandle: pro2PlusLeftOutboundHandle(outboundNode, connection.targetHandle),
    targetHandle: pro2InboundTargetHandle(inboundNode?.type),
  };
}
