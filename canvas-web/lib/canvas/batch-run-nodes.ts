"use client";

import {
  busEnqueueNode,
  busEnqueueNodesSequential,
  busEnqueueStoryRun,
  busEnqueueStoryRunsSequential,
} from "./canvas-run-bus";
import type { StoryLlmSection } from "./story-workspace-types";
import { STORY_HUB_SECTION_ORDER } from "./spawn-story-workspace";

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

/** 文案中枢 · 按段顺序生成 */
export function runStoryHubSectionsSequential(
  hubId: string,
  sections: readonly StoryLlmSection[] = STORY_HUB_SECTION_ORDER,
  options?: { forceFresh?: boolean },
) {
  busEnqueueStoryRunsSequential(
    sections.map((llmSection) => ({
      nodeId: hubId,
      llmSection,
      forceFresh: options?.forceFresh,
    })),
    options,
  );
}

/** 文案中枢 · 单段生成（审阅弹窗 / 节点底栏） */
export function runStoryHubSection(
  hubId: string,
  section: StoryLlmSection,
  options?: { forceFresh?: boolean },
) {
  busEnqueueStoryRun({
    nodeId: hubId,
    llmSection: section,
    forceFresh: options?.forceFresh,
  });
}

/** 列节点 · 按行顺序跑 */
export function batchRunStoryRowsSequential(
  columnNodeId: string,
  rowKeys: string[],
  mediaKind: "threeView" | "frameImage" | "video" | "tts",
  options?: { forceFresh?: boolean },
) {
  busEnqueueStoryRunsSequential(
    rowKeys.map((rowKey) => ({
      nodeId: columnNodeId,
      rowKey,
      mediaKind,
      forceFresh: options?.forceFresh,
    })),
    options,
  );
}

export { busEnqueueStoryRun };
