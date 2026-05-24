import dagre from "dagre";
import type { CanvasFlowEdge, CanvasFlowNode } from "./types";
import { isGroupNode } from "./types";
import { nodeMeasuredSize, sortNodesForReactFlow } from "./normalize-graph-nodes";

const ORIGIN = { x: 80, y: 80 };

/** 是否为漫剧全链路画布（启动节点或三文案引擎）。 */
export function hasStoryComicPipeline(nodes: CanvasFlowNode[]): boolean {
  const types = new Set(nodes.map((n) => n.type));
  if (types.has("story-comic-starter")) return true;
  return (
    types.has("story-outline-engine") &&
    types.has("character-engine") &&
    types.has("storyboard-engine")
  );
}

/** 漫剧画布 · 按连线拓扑 dagre 重排（LR），间距按节点真实尺寸计算。 */
export function reflowStoryComicFlat(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[] = [],
): CanvasFlowNode[] {
  if (!hasStoryComicPipeline(nodes)) return nodes;

  const contentNodes = nodes
    .filter((n) => !isGroupNode(n.type))
    .map(
      (n) =>
        ({
          ...n,
          parentId: undefined,
          extent: undefined,
        }) as CanvasFlowNode,
    );

  if (contentNodes.length === 0) return nodes;

  const idSet = new Set(contentNodes.map((n) => n.id));
  const layoutEdges = edges.filter(
    (e) => idSet.has(e.source) && idSet.has(e.target),
  );

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: "LR",
    align: "UL",
    nodesep: 120,
    ranksep: 200,
    marginx: ORIGIN.x,
    marginy: ORIGIN.y,
  });

  for (const n of contentNodes) {
    const { w, h } = nodeMeasuredSize(n);
    g.setNode(n.id, { width: w, height: h });
  }
  for (const e of layoutEdges) {
    g.setEdge(e.source, e.target);
  }

  if (contentNodes.length >= 2) {
    dagre.layout(g);
  }

  let minX = Infinity;
  let minY = Infinity;
  const positioned = contentNodes.map((n) => {
    const { w, h } = nodeMeasuredSize(n);
    let x = n.position.x;
    let y = n.position.y;
    if (g.hasNode(n.id)) {
      const r = g.node(n.id);
      x = r.x - w / 2;
      y = r.y - h / 2;
    }
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    return { ...n, position: { x, y } } as CanvasFlowNode;
  });

  const dx = minX < ORIGIN.x ? ORIGIN.x - minX : 0;
  const dy = minY < ORIGIN.y ? ORIGIN.y - minY : 0;
  const shifted =
    dx || dy
      ? positioned.map(
          (n) =>
            ({
              ...n,
              position: { x: n.position.x + dx, y: n.position.y + dy },
            }) as CanvasFlowNode,
        )
      : positioned;

  const groups = nodes.filter((n) => isGroupNode(n.type));
  return sortNodesForReactFlow([...groups, ...shifted]);
}

/** 重排后估算画布包围盒，供 fitView 使用。 */
export function storyComicBounds(nodes: CanvasFlowNode[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  let minX = 0;
  let minY = 0;
  let maxX = 800;
  let maxY = 600;
  for (const n of nodes) {
    if (isGroupNode(n.type)) continue;
    const { w, h } = nodeMeasuredSize(n);
    minX = Math.min(minX, n.position.x);
    minY = Math.min(minY, n.position.y);
    maxX = Math.max(maxX, n.position.x + w);
    maxY = Math.max(maxY, n.position.y + h);
  }
  return { minX, minY, maxX, maxY };
}
