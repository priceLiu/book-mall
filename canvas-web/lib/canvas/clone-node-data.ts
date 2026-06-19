import type { CanvasFlowNode } from "./types";

/** 画布节点 data 深拷贝，避免 duplicate / addNode / paste 共享嵌套引用 */
export function cloneCanvasNodeData(
  data: Record<string, unknown> | undefined | null,
): Record<string, unknown> {
  if (!data || typeof data !== "object") return {};
  return structuredClone(data);
}

/** addNode 初始 data：默认模板 + 传入 overrides 均深拷贝 */
export function mergeCanvasNodeInitialData(
  type: string,
  defaults: Record<string, unknown> | undefined,
  overrides?: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...cloneCanvasNodeData(defaults),
    ...cloneCanvasNodeData(overrides),
    __t: type,
  };
}

/** 复制节点 data：可选保留内容；保留时解绑 taskId，避免轮询写回源节点任务 */
export function duplicateCanvasNodeData(
  srcData: Record<string, unknown>,
  preserveContent: boolean,
): Record<string, unknown> {
  if (!preserveContent) {
    const next = cloneCanvasNodeData(srcData);
    delete next.runtime;
    return next;
  }
  const next = cloneCanvasNodeData(srcData);
  const rt = next.runtime;
  if (rt && typeof rt === "object" && !Array.isArray(rt)) {
    next.runtime = { ...(rt as Record<string, unknown>), taskId: undefined };
  }
  return next;
}

export function canvasNodesShareDataRef(
  nodes: { data?: unknown }[],
  dataRef: unknown,
): boolean {
  if (!dataRef) return false;
  let count = 0;
  for (const n of nodes) {
    if (n.data === dataRef) {
      count += 1;
      if (count > 1) return true;
    }
  }
  return false;
}

/** hydrate / 修复：多个节点共用同一 data 引用时，为每个节点深拷贝一份 */
export function isolateSharedCanvasNodeData(
  nodes: CanvasFlowNode[],
): CanvasFlowNode[] {
  const refCount = new Map<unknown, number>();
  for (const n of nodes) {
    if (n.data != null) {
      refCount.set(n.data, (refCount.get(n.data) ?? 0) + 1);
    }
  }
  const shared = new Set(
    [...refCount.entries()].filter(([, c]) => c > 1).map(([d]) => d),
  );
  if (shared.size === 0) return nodes;
  return nodes.map((n) => {
    if (!n.data || !shared.has(n.data)) return n;
    return {
      ...n,
      data: structuredClone(n.data as Record<string, unknown>),
    };
  });
}
