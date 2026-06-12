/** 分镜视频 1.0 轨道节点 type 清单 */

import type { CanvasFlowNode } from "./types";

export const SBV1_NODE_TYPES = [
  "sbv1-image",
  "sbv1-video-engine",
] as const;

export type Sbv1NodeType = (typeof SBV1_NODE_TYPES)[number];

const SBV1_NODE_TYPE_SET = new Set<string>(SBV1_NODE_TYPES);

export function isSbv1PipelineNodeType(type: string): boolean {
  return SBV1_NODE_TYPE_SET.has(type);
}

export function hasSbv1Pipeline(nodes: CanvasFlowNode[]): boolean {
  return nodes.some((n) => isSbv1PipelineNodeType(n.type ?? ""));
}
