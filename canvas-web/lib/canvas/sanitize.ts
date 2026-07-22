/**
 * canvas v2 · 工作流模板清洗
 *
 * - 始终清除瞬时态（blob、上传中、任务 id、ephemeral）
 * - keepPersistableMedia=false：再清 ossUrl（空白结构模板）
 * - keepPersistableMedia=true：保留 OSS / runtime.ossUrl / poster（社区分享预览与 fork）
 */

import type { CanvasFlowNode, CanvasGraph } from "./types";

const TRANSIENT_KEYS = [
  "blobUrl",
  "uploading",
  "uploadError",
  "activeTaskId",
] as const;

function stripTransientRuntime(
  data: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...data };
  for (const k of TRANSIENT_KEYS) {
    delete next[k];
  }
  const rt = next.runtime;
  if (rt && typeof rt === "object" && !Array.isArray(rt)) {
    const runtime = { ...(rt as Record<string, unknown>) };
    delete runtime.ephemeralUrl;
    delete runtime.taskId;
    if (
      runtime.status === "running" ||
      runtime.status === "pending" ||
      runtime.status === "queued"
    ) {
      runtime.status = "idle";
    }
    next.runtime = runtime;
  }
  return next;
}

function stripPersistableMedia(
  data: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...data };
  delete next.ossUrl;
  delete next.imageUrl;
  delete next.videoUrl;
  delete next.outputUrl;
  const rt = next.runtime;
  if (rt && typeof rt === "object" && !Array.isArray(rt)) {
    const runtime = { ...(rt as Record<string, unknown>) };
    delete runtime.ossUrl;
    delete runtime.posterUrl;
    delete runtime.ephemeralUrl;
    next.runtime = runtime;
  }
  return next;
}

function stripNodeRuntime(
  n: CanvasFlowNode,
  keepPersistableMedia: boolean,
): CanvasFlowNode {
  let data = stripTransientRuntime({
    ...(n.data ?? {}),
  } as Record<string, unknown>);
  if (!keepPersistableMedia) {
    data = stripPersistableMedia(data);
  }
  return { ...n, data };
}

export type StripRuntimeOptions = {
  /** true：社区分享 / fork 预览，保留 OSS 媒体快照 */
  keepPersistableMedia?: boolean;
};

export function stripRuntimeForTemplate(
  graph: CanvasGraph,
  opts?: StripRuntimeOptions,
): CanvasGraph {
  const keep = opts?.keepPersistableMedia === true;
  return {
    ...graph,
    nodes: graph.nodes.map((n) => stripNodeRuntime(n, keep)),
  };
}

/** autosave / PATCH 前剥离 blob、上传中、ephemeral 等瞬时字段，保留 OSS 成片 */
export function stripGraphForPersist(graph: CanvasGraph): CanvasGraph {
  return stripRuntimeForTemplate(graph, { keepPersistableMedia: true });
}
