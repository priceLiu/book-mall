/**
 * canvas v2 · 工作流模板"保存清洗"
 *
 * 把当前画布抽象成"可复用的工作流"：
 * - 删除运行时字段（runtime, ossUrl, blobUrl, uploading, activeTaskId, ...）
 * - 删除已上传的图片节点的 ossUrl / blobUrl（避免把用户当次素材带到模板里）
 * - 保留结构 / handles / prompt / params / providerId（但 providerId 通常会随用户变化；保留但允许目标用户覆盖）
 *
 * 调用：在 saveCanvasTemplate 之前调一次。
 */

import type { CanvasFlowNode, CanvasGraph } from "./types";

const RUNTIME_KEYS = [
  "runtime",
  "ossUrl",
  "blobUrl",
  "uploading",
  "uploadError",
  "activeTaskId",
] as const;

function stripNodeRuntime(n: CanvasFlowNode): CanvasFlowNode {
  const data = { ...(n.data ?? {}) } as Record<string, unknown>;
  for (const k of RUNTIME_KEYS) {
    delete data[k];
  }
  // image 节点：保留 label，但清空当次的图片
  if (n.type === "image" || n.type === "story-pro2-image") {
    delete data.ossUrl;
    delete data.blobUrl;
    delete data.uploading;
    delete data.uploadError;
  }
  return { ...n, data };
}

export function stripRuntimeForTemplate(graph: CanvasGraph): CanvasGraph {
  return {
    ...graph,
    nodes: graph.nodes.map(stripNodeRuntime),
  };
}
