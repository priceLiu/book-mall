/**
 * 画布增量落盘 · 对比 lastPersisted 与 current strip graph，生成 canvasDelta。
 */
import type { CanvasFlowEdge, CanvasFlowNode, CanvasGraph } from "./types";

export type CanvasDeltaPatch = {
  baseUpdatedAt?: string;
  upsertNodes?: CanvasFlowNode[];
  removeNodeIds?: string[];
  upsertEdges?: CanvasFlowEdge[];
  removeEdgeIds?: string[];
  viewport?: { x: number; y: number; zoom: number };
  meta?: CanvasGraph["meta"];
};

/** 超过此节点数时 autosave 仍走整图 PATCH（避免 diff CPU） */
export const CANVAS_DELTA_MAX_NODES = 500;

function stableJson(value: unknown): string {
  return JSON.stringify(value);
}

export function shouldUseFullCanvasPersist(graph: CanvasGraph): boolean {
  return graph.nodes.length > CANVAS_DELTA_MAX_NODES;
}

export function parsePersistedCanvasGraph(json: string): CanvasGraph | null {
  try {
    return JSON.parse(json) as CanvasGraph;
  } catch {
    return null;
  }
}

/** 对比两版 strip graph；无变化返回 null。 */
export function buildCanvasPersistDelta(
  lastGraph: CanvasGraph,
  currentGraph: CanvasGraph,
): CanvasDeltaPatch | null {
  const delta: CanvasDeltaPatch = {};

  const lastNodeById = new Map(lastGraph.nodes.map((n) => [n.id, n]));
  const currentNodeById = new Map(currentGraph.nodes.map((n) => [n.id, n]));

  const removeNodeIds: string[] = [];
  for (const id of lastNodeById.keys()) {
    if (!currentNodeById.has(id)) removeNodeIds.push(id);
  }
  if (removeNodeIds.length > 0) delta.removeNodeIds = removeNodeIds;

  const upsertNodes: CanvasFlowNode[] = [];
  for (const node of currentGraph.nodes) {
    const prev = lastNodeById.get(node.id);
    if (!prev || stableJson(prev) !== stableJson(node)) {
      upsertNodes.push(node);
    }
  }
  if (upsertNodes.length > 0) delta.upsertNodes = upsertNodes;

  const lastEdgeById = new Map(lastGraph.edges.map((e) => [e.id, e]));
  const currentEdgeById = new Map(currentGraph.edges.map((e) => [e.id, e]));

  const removeEdgeIds: string[] = [];
  for (const id of lastEdgeById.keys()) {
    if (!currentEdgeById.has(id)) removeEdgeIds.push(id);
  }
  if (removeEdgeIds.length > 0) delta.removeEdgeIds = removeEdgeIds;

  const upsertEdges: CanvasFlowEdge[] = [];
  for (const edge of currentGraph.edges) {
    const prev = lastEdgeById.get(edge.id);
    if (!prev || stableJson(prev) !== stableJson(edge)) {
      upsertEdges.push(edge);
    }
  }
  if (upsertEdges.length > 0) delta.upsertEdges = upsertEdges;

  const lastVp = stableJson(lastGraph.viewport ?? null);
  const curVp = stableJson(currentGraph.viewport ?? null);
  if (lastVp !== curVp && currentGraph.viewport) {
    delta.viewport = currentGraph.viewport;
  }

  const lastMeta = stableJson(lastGraph.meta ?? null);
  const curMeta = stableJson(currentGraph.meta ?? null);
  if (lastMeta !== curMeta && currentGraph.meta) {
    delta.meta = currentGraph.meta;
  }

  if (
    !delta.upsertNodes?.length &&
    !delta.removeNodeIds?.length &&
    !delta.upsertEdges?.length &&
    !delta.removeEdgeIds?.length &&
    !delta.viewport &&
    !delta.meta
  ) {
    return null;
  }
  return delta;
}

/** OSS 上传 drain：对指定节点发送 strip 后整节点 upsert（新粘贴节点可能尚未落库）。 */
export function buildCanvasUploadPersistDelta(
  nodeIds: string[],
  currentGraph: CanvasGraph,
): CanvasDeltaPatch | null {
  const byId = new Map(currentGraph.nodes.map((n) => [n.id, n]));
  const upsertNodes: CanvasFlowNode[] = [];
  for (const id of nodeIds) {
    const node = byId.get(id);
    if (!node) continue;
    const data = node.data as { ossUrl?: string };
    if (!data?.ossUrl?.trim()) continue;
    upsertNodes.push(node);
  }
  if (upsertNodes.length === 0) return null;
  return { upsertNodes };
}
