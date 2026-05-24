"use client";

import { busEnqueueNode, busEnqueueNodesSequential } from "./canvas-run-bus";

/** 按顺序触发节点运行（避免并发 429）。 */
export function batchRunNodesSequential(
  nodeIds: string[],
  options?: { forceFresh?: boolean },
) {
  busEnqueueNodesSequential(nodeIds, options);
}

/** 批量触发节点运行（并发 enqueue）。 */
export function batchRunNodes(
  nodeIds: string[],
  options?: { forceFresh?: boolean },
) {
  for (const nodeId of nodeIds) {
    busEnqueueNode(nodeId, options?.forceFresh);
  }
}

/** 按顺序触发 LLM 文案链（大纲 → 角色 → 分镜）。 */
export function runStoryLlmPipelineSequential(
  nodeIds: string[],
  options?: { forceFresh?: boolean },
) {
  busEnqueueNodesSequential(nodeIds, options);
}
