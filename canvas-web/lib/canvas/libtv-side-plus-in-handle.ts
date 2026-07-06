import type { Connection } from "@xyflow/react";
import type { CanvasFlowNode } from "./types";

/** 侧栏 + 叠层 target handle · 供外部拖入吸附（可见 + 仍为 source） */
export function libtvSidePlusInHandleId(handleId: string): string {
  return `${handleId}__in`;
}

export function isLibtvSidePlusInHandle(
  handleId: string | null | undefined,
): boolean {
  return Boolean(handleId?.endsWith("__in"));
}

function inboundTargetForNodeType(
  targetType: string | undefined,
  sourceNode: CanvasFlowNode | undefined,
): string {
  if (targetType === "sbv1-video-engine") {
    const st = sourceNode?.type;
    if (st === "story-pro2-starter" || st === "story-pro2-script-hub") {
      return "in_text";
    }
    if (st === "sbv1-video-engine") return "in_motion_video";
    return "in_ref";
  }
  if (targetType === "jianying-export-pro2") return "in_video";
  if (targetType === "jianying-auto-render-pro2") return "in_video";
  if (
    targetType === "story-pro2-image" ||
    targetType === "story-pro2-three-view" ||
    targetType === "sbv1-image"
  ) {
    return "in_image";
  }
  return "in_text";
}

/** 将 plus_left__in 等叠层 target 解析为真实 in_* handle */
export function resolveLibtvSidePlusInTargetHandle(
  connection: Connection,
  nodes: CanvasFlowNode[],
): Connection {
  if (!isLibtvSidePlusInHandle(connection.targetHandle)) return connection;
  const targetNode = nodes.find((n) => n.id === connection.target);
  const sourceNode = nodes.find((n) => n.id === connection.source);
  if (!targetNode) return connection;
  return {
    ...connection,
    targetHandle: inboundTargetForNodeType(targetNode.type, sourceNode),
  };
}
