import type { CanvasFlowEdge, CanvasFlowNode } from "./types";

/** 拓扑排序：返回从根到叶的节点 id 顺序；若有环抛错。 */
export function topoSort(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
): string[] {
  const indeg = new Map<string, number>();
  const adj = new Map<string, string[]>();
  for (const n of nodes) {
    indeg.set(n.id, 0);
    adj.set(n.id, []);
  }
  for (const e of edges) {
    if (!indeg.has(e.target) || !indeg.has(e.source)) continue;
    indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1);
    adj.get(e.source)?.push(e.target);
  }
  const queue: string[] = [];
  indeg.forEach((d, id) => {
    if (d === 0) queue.push(id);
  });
  const out: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    out.push(id);
    for (const next of adj.get(id) ?? []) {
      const v = (indeg.get(next) ?? 0) - 1;
      indeg.set(next, v);
      if (v === 0) queue.push(next);
    }
  }
  if (out.length !== nodes.length) {
    throw new Error("画布存在循环依赖，无法运行");
  }
  return out;
}

/** 求节点的所有上游节点 id（递归 BFS） */
export function ancestors(
  edges: CanvasFlowEdge[],
  nodeId: string,
): Set<string> {
  const out = new Set<string>();
  const queue = [nodeId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    for (const e of edges) {
      if (e.target === id && !out.has(e.source)) {
        out.add(e.source);
        queue.push(e.source);
      }
    }
  }
  return out;
}

/** 直接前驱（一阶上游） */
export function directPredecessors(
  edges: CanvasFlowEdge[],
  nodeId: string,
): string[] {
  return edges.filter((e) => e.target === nodeId).map((e) => e.source);
}
