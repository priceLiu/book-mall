import type { Connection } from "@xyflow/react";
import { DEFAULT_HANDLE_BY_TYPE } from "./libtv-connection-snap";
import type { CanvasFlowEdge, CanvasFlowNode } from "./types";

/** 框选批量出边 · 节点 type → source handle */
export const BATCH_OUT_HANDLE_BY_TYPE: Record<string, string> = {
  "sbv1-video-engine": "out_video",
  "sbv1-image": "image",
  "story-pro2-image": "image",
  "story-pro2-three-view": "image",
  "story-pro2-starter": "text",
  "story-pro2-script-hub": "text",
};

export function nodeBatchOutHandle(node: CanvasFlowNode): string | null {
  const t = node.type ?? "";
  return BATCH_OUT_HANDLE_BY_TYPE[t] ?? null;
}

export function nodesEligibleForBatchOut(
  nodes: CanvasFlowNode[],
  ids: string[],
): CanvasFlowNode[] {
  return ids
    .map((id) => nodes.find((n) => n.id === id))
    .filter((n): n is CanvasFlowNode => !!n && !!nodeBatchOutHandle(n));
}

export function pickBatchTargetHandle(
  targetNode: CanvasFlowNode,
  sourceNode: CanvasFlowNode,
  sourceHandle: string,
): string | null {
  const defaults = DEFAULT_HANDLE_BY_TYPE[String(targetNode.type ?? "")];
  if (
    targetNode.type === "jianying-export-pro2" &&
    sourceNode.type === "sbv1-video-engine" &&
    sourceHandle === "out_video"
  ) {
    return "in_video";
  }
  if (
    targetNode.type === "sbv1-video-engine" &&
    (sourceNode.type === "story-pro2-starter" ||
      sourceNode.type === "story-pro2-script-hub")
  ) {
    return "in_text";
  }
  if (
    targetNode.type === "sbv1-video-engine" &&
    sourceNode.type === "sbv1-video-engine" &&
    sourceHandle === "out_video"
  ) {
    return "in_motion_video";
  }
  if (
    targetNode.type === "sbv1-video-engine" &&
    (sourceNode.type === "sbv1-image" ||
      sourceNode.type === "story-pro2-image" ||
      sourceNode.type === "story-pro2-three-view")
  ) {
    return "in_ref";
  }
  return defaults?.target ?? null;
}

export function buildBatchConnectEdges(
  sources: CanvasFlowNode[],
  targetId: string,
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  explicitTargetHandle?: string,
): CanvasFlowEdge[] {
  const targetNode = nodes.find((n) => n.id === targetId);
  if (!targetNode) return [];

  const out: CanvasFlowEdge[] = [];
  for (const source of sources) {
    const sourceHandle = nodeBatchOutHandle(source);
    if (!sourceHandle) continue;
    const targetHandle =
      explicitTargetHandle ??
      pickBatchTargetHandle(targetNode, source, sourceHandle);
    if (!targetHandle) continue;

    const dup = edges.some(
      (e) =>
        e.source === source.id &&
        e.target === targetId &&
        (e.sourceHandle ?? null) === sourceHandle &&
        (e.targetHandle ?? null) === targetHandle,
    );
    if (dup) continue;

    out.push({
      id: `e-batch-${source.id}-${targetId}-${sourceHandle}-${Date.now()}-${out.length}`,
      source: source.id,
      target: targetId,
      sourceHandle,
      targetHandle,
      animated: false,
    });
  }
  return out;
}

/** 将 snap 单条连线转为批量（框选 + 拖到目标） */
export function expandBatchSnapConnection(
  connection: Connection,
  batchSourceIds: string[],
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
): CanvasFlowEdge[] | null {
  if (!connection.target || batchSourceIds.length < 2) return null;
  const fromId = connection.source;
  if (!fromId || !batchSourceIds.includes(fromId)) return null;

  const sources = nodesEligibleForBatchOut(nodes, batchSourceIds);
  if (sources.length < 2) return null;

  return buildBatchConnectEdges(
    sources,
    connection.target,
    nodes,
    edges,
    connection.targetHandle ?? undefined,
  );
}
