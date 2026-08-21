/**
 * canvas v2 · 工作流模板清洗
 *
 * - 始终清除瞬时态（blob、上传中、ephemeral）
 * - 已入队的生成：保留 runtime.taskId + pending/running，刷新后仍显示扫光
 * - 无 taskId 的乐观 pending：落盘改 idle，避免刷新后假扫光
 * - keepPersistableMedia=false：再清 ossUrl（空白结构模板）
 * - keepPersistableMedia=true：保留 OSS / runtime.ossUrl / poster（社区分享预览与 fork）
 */

import type { CanvasFlowNode, CanvasGraph } from "./types";

const TRANSIENT_KEYS = [
  "blobUrl",
  "uploading",
  "uploadError",
  "activeTaskId",
  /** 云端剪辑进度 · 会话态；落盘会导致 pending 卡死且每次进度更新触发空保存风暴 */
  "mediaRenderInFlight",
] as const;

const INFLIGHT_RUNTIME_STATUSES = new Set(["running", "pending", "queued"]);

const NODE_RUNTIME_KEYS = [
  "runtime",
  "themeOutlineRuntime",
  "outlineRuntime",
  "characterRuntime",
  "sceneRuntime",
  "storyboardRuntime",
] as const;

const ROW_RUNTIME_KEYS = ["runtime", "videoRuntime", "ttsRuntime"] as const;

function persistRuntimeObject(
  rt: Record<string, unknown>,
  keepBoundInflight: boolean,
): Record<string, unknown> {
  const runtime = { ...rt };
  delete runtime.ephemeralUrl;
  const taskId =
    typeof runtime.taskId === "string" ? runtime.taskId.trim() : "";
  const status =
    typeof runtime.status === "string" ? runtime.status : "";
  const inflight = INFLIGHT_RUNTIME_STATUSES.has(status);
  if (inflight && keepBoundInflight && taskId) {
    runtime.taskId = taskId;
    return runtime;
  }
  if (inflight) {
    runtime.status = "idle";
  }
  delete runtime.taskId;
  return runtime;
}

function persistNestedRuntimes(
  data: Record<string, unknown>,
  keepBoundInflight: boolean,
): Record<string, unknown> {
  const next = { ...data };
  for (const key of NODE_RUNTIME_KEYS) {
    const rt = next[key];
    if (rt && typeof rt === "object" && !Array.isArray(rt)) {
      next[key] = persistRuntimeObject(
        rt as Record<string, unknown>,
        keepBoundInflight,
      );
    }
  }
  if (Array.isArray(next.rows)) {
    next.rows = next.rows.map((row) => {
      if (!row || typeof row !== "object" || Array.isArray(row)) return row;
      const r = { ...(row as Record<string, unknown>) };
      for (const key of ROW_RUNTIME_KEYS) {
        const rt = r[key];
        if (rt && typeof rt === "object" && !Array.isArray(rt)) {
          r[key] = persistRuntimeObject(
            rt as Record<string, unknown>,
            keepBoundInflight,
          );
        }
      }
      return r;
    });
  }
  return next;
}

function stripTransientRuntime(
  data: Record<string, unknown>,
  keepBoundInflight: boolean,
): Record<string, unknown> {
  const next = { ...data };
  for (const k of TRANSIENT_KEYS) {
    delete next[k];
  }
  return persistNestedRuntimes(next, keepBoundInflight);
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
  let data = stripTransientRuntime(
    { ...(n.data ?? {}) } as Record<string, unknown>,
    keepPersistableMedia,
  );
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
