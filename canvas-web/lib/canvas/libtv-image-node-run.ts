import type { CanvasFlowNode } from "./types";

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
  if (node.type === "story-pro2-image") {
    const role = (node.data as { pro2MediaRole?: string }).pro2MediaRole ?? "generic";
    return role === "generic" || role === "scene";
  }
  return false;
}

/** 点击生成后立即进入扫光态（不等 API 返回） */
export function libtvImageRunPendingPatch(): Record<string, unknown> {
  return {
    uploading: true,
    uploadError: undefined,
    runtime: {
      status: "pending",
      failCode: undefined,
      failMessage: undefined,
    },
  };
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
    updateNodeData(node.id, {
      runtime: {
        status: "pending",
        failCode: undefined,
        failMessage: undefined,
      },
    });
    return true;
  }
  return false;
}
