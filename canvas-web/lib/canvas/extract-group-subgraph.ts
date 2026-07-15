/**
 * 从当前画布提取「组 + 子节点 + 组内边」为独立 CanvasGraph，供分享为工作流模板。
 */
import type { CanvasFlowEdge, CanvasFlowNode, CanvasGraph } from "./types";
import { CANVAS_SCHEMA_VERSION, isGroupNode } from "./types";

export function extractGroupSubgraph(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  groupId: string,
  meta?: CanvasGraph["meta"],
): CanvasGraph | null {
  const group = nodes.find((n) => n.id === groupId && isGroupNode(n.type));
  if (!group) return null;

  const memberIds = new Set<string>([groupId]);
  for (const n of nodes) {
    if (n.parentId === groupId) memberIds.add(n.id);
  }

  const subNodes = nodes
    .filter((n) => memberIds.has(n.id))
    .map((n) => {
      if (n.id !== groupId) return n;
      return {
        ...n,
        position: { x: 0, y: 0 },
        parentId: undefined,
        extent: undefined as typeof n.extent,
      };
    });

  const subEdges = edges.filter(
    (e) => memberIds.has(e.source) && memberIds.has(e.target),
  );

  return {
    schemaVersion: CANVAS_SCHEMA_VERSION,
    nodes: subNodes,
    edges: subEdges,
    meta: meta ? { ...meta } : undefined,
  };
}
