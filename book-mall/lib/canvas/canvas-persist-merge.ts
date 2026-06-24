/**
 * PATCH 画布时合并已落库的节点成片，防止客户端 autosave 用 running/无 URL 覆盖 DB 中的 done+ossUrl。
 */
import {
  CANVAS_MEDIA_NODE_TYPES,
  CANVAS_IMAGE_MEDIA_NODE_TYPES,
} from "@/lib/canvas/canvas-media-patch";

type NodeMediaState = {
  url?: string;
  status?: string;
  taskId?: string;
  ossUrl?: string;
  ephemeralUrl?: string;
  posterUrl?: string;
  textOutput?: string;
};

function readNodeMediaState(data: unknown): NodeMediaState {
  if (!data || typeof data !== "object") return {};
  const d = data as {
    ossUrl?: string;
    runtime?: {
      status?: string;
      taskId?: string;
      ossUrl?: string;
      ephemeralUrl?: string;
      posterUrl?: string;
      textOutput?: string;
    };
  };
  const runtime = d.runtime ?? {};
  const url =
    runtime.ossUrl?.trim() ||
    runtime.ephemeralUrl?.trim() ||
    d.ossUrl?.trim();
  return {
    url: url || undefined,
    status: runtime.status,
    taskId: runtime.taskId?.trim(),
    ossUrl: runtime.ossUrl?.trim() || d.ossUrl?.trim(),
    ephemeralUrl: runtime.ephemeralUrl?.trim(),
    posterUrl: runtime.posterUrl?.trim(),
    textOutput: runtime.textOutput?.trim(),
  };
}

/** 已有 done+成片时，拒绝被无 URL / inflight 的 PATCH 降级。 */
export function shouldPreserveExistingNodeMedia(
  incoming: NodeMediaState,
  existing: NodeMediaState,
): boolean {
  if (!existing.url || existing.status !== "done") return false;
  if (incoming.url && incoming.status === "done") {
    if (incoming.taskId && existing.taskId && incoming.taskId !== existing.taskId) {
      return false;
    }
    return false;
  }
  if (!incoming.url) return true;
  if (incoming.status === "running" || incoming.status === "pending") return true;
  return false;
}

function mergeNodeMediaData(
  incomingData: Record<string, unknown> | undefined,
  existingData: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const base = { ...(incomingData ?? {}) };
  const ex = existingData ?? {};
  const exRt = (ex.runtime ?? {}) as Record<string, unknown>;
  const inRt = (base.runtime ?? {}) as Record<string, unknown>;

  const mergedRuntime = {
    ...inRt,
    ...exRt,
    status: "done",
    taskId: exRt.taskId ?? inRt.taskId,
    ossUrl: exRt.ossUrl ?? inRt.ossUrl,
    ephemeralUrl: exRt.ephemeralUrl ?? inRt.ephemeralUrl,
    posterUrl: exRt.posterUrl ?? inRt.posterUrl,
    textOutput: inRt.textOutput ?? exRt.textOutput,
    failCode: undefined,
    failMessage: undefined,
  };

  const next: Record<string, unknown> = {
    ...base,
    runtime: mergedRuntime,
  };

  const exOss = typeof ex.ossUrl === "string" ? ex.ossUrl.trim() : "";
  if (exOss) {
    next.ossUrl = exOss;
    next.uploading = false;
    next.uploadError = undefined;
    next.blobUrl = undefined;
  }

  return next;
}

/** 将 existing 画布中已落库的媒体合并进 incoming（仅防降级，不覆盖用户新 done）。 */
export function mergePersistedMediaIntoCanvasGraph(
  incoming: unknown,
  existing: unknown,
): unknown {
  if (!incoming || typeof incoming !== "object") return incoming;
  if (!existing || typeof existing !== "object") return incoming;

  const inGraph = incoming as {
    nodes?: Array<{ id: string; type?: string; data?: Record<string, unknown> }>;
  };
  const exGraph = existing as {
    nodes?: Array<{ id: string; type?: string; data?: Record<string, unknown> }>;
  };

  if (!Array.isArray(inGraph.nodes) || !Array.isArray(exGraph.nodes)) {
    return incoming;
  }

  const exById = new Map(exGraph.nodes.map((n) => [n.id, n]));

  return {
    ...inGraph,
    nodes: inGraph.nodes.map((inNode) => {
      const exNode = exById.get(inNode.id);
      if (!exNode || !CANVAS_MEDIA_NODE_TYPES.has(inNode.type ?? "")) {
        return inNode;
      }
      const inMedia = readNodeMediaState(inNode.data);
      const exMedia = readNodeMediaState(exNode.data);
      if (!shouldPreserveExistingNodeMedia(inMedia, exMedia)) return inNode;
      return {
        ...inNode,
        data: mergeNodeMediaData(inNode.data, exNode.data),
      };
    }),
  };
}

export { CANVAS_IMAGE_MEDIA_NODE_TYPES };
