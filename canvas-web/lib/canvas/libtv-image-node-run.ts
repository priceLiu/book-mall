import { markCanvasNodeGenerationStarted } from "./canvas-credits-notify";
import type { CanvasFlowNode, CanvasNodeRuntime } from "./types";

/** 组内分镜格：走列 batch，不用 Dock 模型选择 */
export function isLibtvPipelineImageCell(
  node: Pick<CanvasFlowNode, "type" | "data"> | undefined,
): boolean {
  if (node?.type !== "story-pro2-image") return false;
  return (node.data as { pro2MediaRole?: string }).pro2MediaRole === "frame";
}

/** sbv1-image · Pro2 独立/场景图格：Dock 模型选择 + sbv1-image runner */
export function isLibtvFreestandingImageNode(
  node: Pick<CanvasFlowNode, "type" | "data"> | undefined,
): boolean {
  if (!node) return false;
  if (node.type === "sbv1-image") return true;
  if (node.type === "story-pro2-three-view") return true;
  if (node.type === "story-pro2-image") {
    const role = (node.data as { pro2MediaRole?: string }).pro2MediaRole ?? "generic";
    return role === "generic" || role === "scene";
  }
  return false;
}

/** 点击生成后立即进入扫光态（不等 API / 入队返回） */
export function libtvImageRunPendingPatch(): Record<string, unknown> {
  return {
    uploading: true,
    uploadError: undefined,
    runtime: libtvMediaRunPendingRuntime(),
  };
}

export function libtvMediaRunPendingRuntime(): CanvasNodeRuntime {
  return {
    status: "pending",
    taskId: undefined,
    failCode: undefined,
    failMessage: undefined,
    dismissedFailTaskId: undefined,
  };
}

export function libtvMediaRunIdlePatch(): Record<string, unknown> {
  return {
    uploading: false,
    uploadError: undefined,
    runtime: {
      status: "idle",
      taskId: undefined,
      failCode: undefined,
      failMessage: undefined,
      dismissedFailTaskId: undefined,
    } satisfies CanvasNodeRuntime,
  };
}

/** 点击生成瞬间 · 节点 + Dock 同步进入 pending（校验失败时再 revert） */
export function optimisticLibtvMediaRunStart(
  nodeId: string,
  updateNodeData: (id: string, patch: Record<string, unknown>) => void,
  _setNodeRuntime?: (id: string, runtime: Partial<CanvasNodeRuntime>) => void,
): void {
  markCanvasNodeGenerationStarted(nodeId);
  updateNodeData(nodeId, libtvImageRunPendingPatch());
}

export function revertOptimisticLibtvMediaRunStart(
  nodeId: string,
  updateNodeData: (id: string, patch: Record<string, unknown>) => void,
  _setNodeRuntime?: (id: string, runtime: Partial<CanvasNodeRuntime>) => void,
): void {
  updateNodeData(nodeId, libtvMediaRunIdlePatch());
}

/** 无 taskId 的 pending/uploading（乐观态落库后任务未提交） */
export function isOrphanLibtvMediaInflight(data: {
  uploading?: unknown;
  runtime?: {
    status?: string;
    taskId?: string;
    ossUrl?: string;
    ephemeralUrl?: string;
  } | null;
}): boolean {
  const rt = data.runtime;
  const s = rt?.status;
  if (rt?.ossUrl?.trim() || rt?.ephemeralUrl?.trim()) return false;
  if (rt?.taskId?.trim()) return false;
  if (data.uploading) return true;
  return s === "pending" || s === "running";
}

export function clearOrphanLibtvMediaInflightInNodes<
  T extends { type?: string; data?: Record<string, unknown> },
>(nodes: T[]): T[] {
  let changed = false;
  const next = nodes.map((n) => {
    const isMedia =
      isLibtvFreestandingImageNode(n as Pick<CanvasFlowNode, "type" | "data">) ||
      n.type === "sbv1-video-engine";
    if (!isMedia || !isOrphanLibtvMediaInflight((n.data ?? {}) as never)) {
      return n;
    }
    changed = true;
    return {
      ...n,
      data: { ...(n.data ?? {}), ...libtvMediaRunIdlePatch() },
    };
  });
  return changed ? next : nodes;
}

export function commitLibtvImageRunPendingPatch(
  node: Pick<CanvasFlowNode, "id" | "type" | "data"> | undefined,
  updateNodeData: (id: string, patch: Record<string, unknown>) => void,
): boolean {
  if (!node || !isLibtvFreestandingImageNode(node)) return false;
  updateNodeData(node.id, libtvImageRunPendingPatch());
  return true;
}

/** 图片 / 视频媒体节点 · 入队后立即 pending */
export function commitLibtvMediaRunPendingPatch(
  node: Pick<CanvasFlowNode, "id" | "type" | "data"> | undefined,
  updateNodeData: (id: string, patch: Record<string, unknown>) => void,
): boolean {
  if (!node) return false;
  if (commitLibtvImageRunPendingPatch(node, updateNodeData)) return true;
  if (node.type === "sbv1-video-engine") {
    updateNodeData(node.id, libtvImageRunPendingPatch());
    return true;
  }
  return false;
}
