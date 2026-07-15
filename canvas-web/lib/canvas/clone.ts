/**
 * canvas v2 · 从模板克隆 graph 并重分配 nodeId / edgeId。
 *
 * 用于「从模板新建画布」与「复用已有工作流」：避免 nodeId 在不同 project 之间撞车。
 * 顺手清理一遍 runtime（再保险）。
 */

import { nanoid } from "nanoid";
import { stripRuntimeForTemplate } from "./sanitize";
import type { CanvasGraph } from "./types";

function remapGraphIds(src: CanvasGraph): CanvasGraph {
  const idMap = new Map<string, string>();
  const nodes = src.nodes.map((n) => {
    const newId = `n_${nanoid(8)}`;
    idMap.set(n.id, newId);
    return { ...n, id: newId };
  }).map((n) => {
    if (!n.parentId) return n;
    const parentId = idMap.get(n.parentId);
    if (!parentId) {
      return { ...n, parentId: undefined, extent: undefined };
    }
    return { ...n, parentId };
  });
  const edges = src.edges.map((e) => ({
    ...e,
    id: `e_${nanoid(8)}`,
    source: idMap.get(e.source) ?? e.source,
    target: idMap.get(e.target) ?? e.target,
  }));
  return {
    ...src,
    nodes,
    edges,
  };
}

/**
 * 从模板新建 / fork：重分配 id，仅清瞬时态；保留模板内已有 OSS 媒体快照。
 * （结构空白模板本身不含 ossUrl；社区模板含图则 fork 后可见。）
 */
export function cloneGraphForNewProject(src: CanvasGraph): CanvasGraph {
  return remapGraphIds(
    stripRuntimeForTemplate(src, { keepPersistableMedia: true }),
  );
}

/** 复制画布：保留媒体与内容，重分配 nodeId / edgeId，并清理进行中的任务态。 */
export function cloneGraphForDuplicate(src: CanvasGraph): CanvasGraph {
  const idMap = new Map<string, string>();
  const nodes = src.nodes.map((n) => {
    const newId = `n_${nanoid(8)}`;
    idMap.set(n.id, newId);
    const data = { ...(n.data ?? {}) } as Record<string, unknown>;
    delete data.activeTaskId;
    const rt = data.runtime as
      | { status?: string; taskId?: string; [key: string]: unknown }
      | undefined;
    if (rt && (rt.status === "running" || rt.status === "pending")) {
      const nextRt = { ...rt, status: "idle" as const };
      delete nextRt.taskId;
      data.runtime = nextRt;
    }
    return { ...n, id: newId, data };
  }).map((n) => {
    if (!n.parentId) return n;
    const parentId = idMap.get(n.parentId);
    if (!parentId) {
      return { ...n, parentId: undefined, extent: undefined };
    }
    return { ...n, parentId };
  });
  const edges = src.edges.map((e) => ({
    ...e,
    id: `e_${nanoid(8)}`,
    source: idMap.get(e.source) ?? e.source,
    target: idMap.get(e.target) ?? e.target,
  }));
  return {
    ...src,
    nodes,
    edges,
  };
}
