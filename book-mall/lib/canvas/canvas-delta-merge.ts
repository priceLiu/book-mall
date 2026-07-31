/**
 * 画布增量 PATCH · 将 canvasDelta 合并进现有 canvas JSON。
 */
import { CanvasProjectError } from "@/lib/canvas/canvas-project-service";

export type CanvasDeltaPatch = {
  /** 乐观锁：上次成功 PATCH 返回的 project.updatedAt ISO */
  baseUpdatedAt?: string;
  upsertNodes?: CanvasDeltaNodePatch[];
  removeNodeIds?: string[];
  upsertEdges?: CanvasDeltaEdgePatch[];
  removeEdgeIds?: string[];
  viewport?: { x: number; y: number; zoom: number };
  meta?: Record<string, unknown>;
};

export type CanvasDeltaNodePatch = {
  id: string;
  type?: string;
  position?: { x: number; y: number };
  width?: number;
  height?: number;
  selected?: boolean;
  dragging?: boolean;
  parentId?: string;
  extent?: string;
  expandParent?: boolean;
  data?: Record<string, unknown>;
  [key: string]: unknown;
};

export type CanvasDeltaEdgePatch = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  type?: string;
  selected?: boolean;
  data?: Record<string, unknown>;
  [key: string]: unknown;
};

type CanvasGraphShape = {
  schemaVersion?: number;
  nodes?: CanvasDeltaNodePatch[];
  edges?: CanvasDeltaEdgePatch[];
  viewport?: { x: number; y: number; zoom: number };
  meta?: Record<string, unknown>;
};

function deepMergeRecords(
  base: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const out = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    const prev = out[key];
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      prev &&
      typeof prev === "object" &&
      !Array.isArray(prev)
    ) {
      out[key] = deepMergeRecords(
        prev as Record<string, unknown>,
        value as Record<string, unknown>,
      );
    } else {
      out[key] = value;
    }
  }
  return out;
}

function mergeNodePatch(
  existing: CanvasDeltaNodePatch | undefined,
  patch: CanvasDeltaNodePatch,
): CanvasDeltaNodePatch {
  if (!existing) {
    if (!patch.type) {
      throw new CanvasProjectError(
        "INVALID_INPUT",
        `upsertNodes: new node ${patch.id} requires type`,
      );
    }
    return { ...patch };
  }
  const { data: patchData, ...patchRest } = patch;
  const merged: CanvasDeltaNodePatch = { ...existing, ...patchRest, id: patch.id };
  if (patchData && typeof patchData === "object") {
    merged.data = deepMergeRecords(
      (existing.data ?? {}) as Record<string, unknown>,
      patchData,
    );
  }
  return merged;
}

function mergeEdgePatch(
  existing: CanvasDeltaEdgePatch | undefined,
  patch: CanvasDeltaEdgePatch,
): CanvasDeltaEdgePatch {
  if (!existing) {
    if (!patch.source || !patch.target) {
      throw new CanvasProjectError(
        "INVALID_INPUT",
        `upsertEdges: new edge ${patch.id} requires source and target`,
      );
    }
    return { ...patch };
  }
  const { data: patchData, ...patchRest } = patch;
  const merged: CanvasDeltaEdgePatch = { ...existing, ...patchRest, id: patch.id };
  if (patchData && typeof patchData === "object") {
    merged.data = deepMergeRecords(
      (existing.data ?? {}) as Record<string, unknown>,
      patchData,
    );
  }
  return merged;
}

function assertCanvasGraphShape(canvas: unknown): CanvasGraphShape {
  if (!canvas || typeof canvas !== "object") {
    throw new CanvasProjectError("INVALID_INPUT", "canvas must be object");
  }
  return canvas as CanvasGraphShape;
}

function assertDeltaHasChanges(delta: CanvasDeltaPatch): void {
  const hasChanges =
    (delta.upsertNodes?.length ?? 0) > 0 ||
    (delta.removeNodeIds?.length ?? 0) > 0 ||
    (delta.upsertEdges?.length ?? 0) > 0 ||
    (delta.removeEdgeIds?.length ?? 0) > 0 ||
    delta.viewport !== undefined ||
    delta.meta !== undefined;
  if (!hasChanges) {
    throw new CanvasProjectError("INVALID_INPUT", "canvasDelta is empty");
  }
}

/** 将 delta 合并进 existing canvas，返回新 graph（不跑 media merge）。 */
export function applyCanvasDelta(
  existingCanvas: unknown,
  delta: CanvasDeltaPatch,
): unknown {
  assertDeltaHasChanges(delta);
  const graph = assertCanvasGraphShape(existingCanvas);
  const nodes = Array.isArray(graph.nodes) ? [...graph.nodes] : [];
  const edges = Array.isArray(graph.edges) ? [...graph.edges] : [];

  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const edgeById = new Map(edges.map((e) => [e.id, e]));

  for (const id of delta.removeNodeIds ?? []) {
    nodeById.delete(id);
    for (const [edgeId, edge] of [...edgeById.entries()]) {
      if (edge.source === id || edge.target === id) {
        edgeById.delete(edgeId);
      }
    }
  }

  for (const patch of delta.upsertNodes ?? []) {
    if (!patch?.id || typeof patch.id !== "string") {
      throw new CanvasProjectError("INVALID_INPUT", "upsertNodes requires id");
    }
    const merged = mergeNodePatch(nodeById.get(patch.id), patch);
    nodeById.set(patch.id, merged);
  }

  for (const id of delta.removeEdgeIds ?? []) {
    edgeById.delete(id);
  }

  for (const patch of delta.upsertEdges ?? []) {
    if (!patch?.id || typeof patch.id !== "string") {
      throw new CanvasProjectError("INVALID_INPUT", "upsertEdges requires id");
    }
    const merged = mergeEdgePatch(edgeById.get(patch.id), patch);
    edgeById.set(patch.id, merged);
  }

  const next: CanvasGraphShape = {
    ...graph,
    nodes: [...nodeById.values()],
    edges: [...edgeById.values()],
  };

  if (delta.viewport !== undefined) {
    next.viewport = delta.viewport;
  }
  if (delta.meta !== undefined) {
    next.meta = { ...(graph.meta ?? {}), ...delta.meta };
  }

  const incomingSchema = delta.meta?.schemaVersion;
  if (
    typeof incomingSchema === "number" &&
    typeof graph.schemaVersion === "number" &&
    incomingSchema < graph.schemaVersion
  ) {
    throw new CanvasProjectError(
      "INVALID_INPUT",
      "canvasDelta cannot downgrade schemaVersion",
    );
  }

  return next;
}

export function assertCanvasDeltaBaseUpdatedAt(
  expected: string | undefined,
  actual: Date,
): void {
  if (!expected) return;
  if (actual.toISOString() !== expected) {
    throw new CanvasProjectError(
      "CONFLICT",
      "canvas project was modified elsewhere",
      409,
    );
  }
}
