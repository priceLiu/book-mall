import type { EdgeChange } from "@xyflow/react";

type GuardEdge = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
};

type GuardNode = {
  id: string;
};

/**
 * React Flow 在节点尺寸/布局同步后，handle 尚未重测时会误发 edge remove。
 * 两端节点仍在画布上时，忽略这些 remove（用户剪线走 setEdges · 删节点走 onNodesChange）。
 */
export function filterSpuriousRfEdgeRemoves<
  E extends GuardEdge,
  N extends GuardNode,
>(
  changes: EdgeChange[],
  edges: E[],
  nodes: N[],
): { changes: EdgeChange[]; blockedRemoves: boolean } {
  if (!changes.some((c) => c.type === "remove")) {
    return { changes, blockedRemoves: false };
  }
  const nodeIds = new Set(nodes.map((n) => n.id));
  const edgeById = new Map(edges.map((e) => [e.id, e]));
  let blockedRemoves = false;
  const filtered = changes.filter((c) => {
    if (c.type !== "remove" || !("id" in c) || typeof c.id !== "string") {
      return true;
    }
    const edge = edgeById.get(c.id);
    if (!edge) return true;
    if (nodeIds.has(edge.source) && nodeIds.has(edge.target)) {
      blockedRemoves = true;
      return false;
    }
    return true;
  });
  return { changes: filtered, blockedRemoves };
}
