import { randomUUID } from "crypto";

function newNodeId(): string {
  return `n_${randomUUID().replace(/-/g, "").slice(0, 8)}`;
}

function newEdgeId(): string {
  return `e_${randomUUID().replace(/-/g, "").slice(0, 8)}`;
}

/** 复制画布 JSON：重分配 id，保留媒体；清理进行中的任务态。 */
export function cloneCanvasGraphForDuplicate(src: unknown): unknown {
  if (!src || typeof src !== "object") return src;
  const graph = src as {
    nodes?: unknown[];
    edges?: unknown[];
    [key: string]: unknown;
  };
  const nodesRaw = Array.isArray(graph.nodes) ? graph.nodes : [];
  const idMap = new Map<string, string>();

  const nodes = nodesRaw
    .map((raw) => {
      const node = raw as {
        id: string;
        parentId?: string;
        extent?: unknown;
        data?: Record<string, unknown>;
        [key: string]: unknown;
      };
      const newId = newNodeId();
      idMap.set(node.id, newId);
      const data = node.data ? { ...node.data } : {};
      delete data.activeTaskId;
      const rt = data.runtime as
        | { status?: string; taskId?: string; [key: string]: unknown }
        | undefined;
      if (rt && (rt.status === "running" || rt.status === "pending")) {
        const nextRt = { ...rt, status: "idle" as const };
        delete nextRt.taskId;
        data.runtime = nextRt;
      }
      return { ...node, id: newId, data };
    })
    .map((node) => {
      if (!node.parentId) return node;
      const parentId = idMap.get(node.parentId);
      if (!parentId) {
        return { ...node, parentId: undefined, extent: undefined };
      }
      return { ...node, parentId };
    });

  const edgesRaw = Array.isArray(graph.edges) ? graph.edges : [];
  const edges = edgesRaw.map((raw) => {
    const edge = raw as { id: string; source: string; target: string };
    return {
      ...edge,
      id: newEdgeId(),
      source: idMap.get(edge.source) ?? edge.source,
      target: idMap.get(edge.target) ?? edge.target,
    };
  });

  return { ...graph, nodes, edges };
}
