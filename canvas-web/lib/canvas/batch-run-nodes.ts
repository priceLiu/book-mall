"use client";

import {
  busEnqueueNode,
  busEnqueueNodesSequential,
  busEnqueueStoryRun,
  busEnqueueStoryRunsSequential,
} from "./canvas-run-bus";
import {
  optimisticPro2ThreeViewBatchStart,
  clearStalePro2ThreeViewInflight,
} from "./pro2-spawn-character-image-group";
import {
  clearPro2FrameInflightOutsideSyncGroup,
  optimisticPro2FrameBatchStart,
} from "./pro2-spawn-frame-image-group";
import { clearPro2ThreeViewInflightOutsideSyncGroup } from "./pro2-group-row-resolve";
import { markCanvasNodeGenerationStarted } from "./canvas-credits-notify";
import { useCanvasStore } from "./store";
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

/** 列节点 · 按行并发 enqueue（不同 rowKey 可并行，Gateway 队列负责限流） */
export function batchRunStoryRows(
  columnNodeId: string,
  rowKeys: string[],
  mediaKind: "threeView" | "sceneRef" | "frameImage" | "video" | "tts",
  options?: { forceFresh?: boolean },
) {
  for (const rowKey of rowKeys) {
    busEnqueueStoryRun({
      nodeId: columnNodeId,
      rowKey,
      mediaKind,
      forceFresh: options?.forceFresh,
    });
  }
}

/** Pro2 三视图 · 全量 optimistic + 并发入队（勿用 Sequential） */
export function batchRunPro2ThreeViewRows(
  columnNodeId: string,
  rowKeys: string[],
  options?: { forceFresh?: boolean },
) {
  const keys = rowKeys.filter(Boolean);
  if (!keys.length) return;
  markCanvasNodeGenerationStarted(columnNodeId);
  const { nodes, updateNodeData } = useCanvasStore.getState();
  clearStalePro2ThreeViewInflight(columnNodeId, keys, nodes, updateNodeData);
  const nodesAfterClear = useCanvasStore.getState().nodes;
  if (options?.forceFresh) {
    const col = nodesAfterClear.find((n) => n.id === columnNodeId);
    const rows =
      (col?.data as { rows?: import("./story-pro-workspace-types").StoryProCharacterRow[] })
        .rows ?? [];
    const allowed = new Set(keys);
    const cleared = rows.map((r) =>
      allowed.has(r.key) ? { ...r, runtime: undefined } : r,
    );
    updateNodeData(columnNodeId, { rows: cleared });
    const nodesAfter = nodesAfterClear.map((n) =>
      n.id === columnNodeId
        ? { ...n, data: { ...n.data, rows: cleared } }
        : n,
    );
    clearPro2ThreeViewInflightOutsideSyncGroup(
      columnNodeId,
      keys,
      nodesAfter,
      updateNodeData,
    );
    optimisticPro2ThreeViewBatchStart(
      columnNodeId,
      keys,
      nodesAfter,
      updateNodeData,
    );
  } else {
    optimisticPro2ThreeViewBatchStart(
      columnNodeId,
      keys,
      nodesAfterClear,
      updateNodeData,
    );
  }
  batchRunStoryRows(columnNodeId, keys, "threeView", options);
}

/** Pro2 分镜图 · 全量 optimistic + 并发入队 */
export function batchRunPro2FrameRows(
  columnNodeId: string,
  rowKeys: string[],
  options?: { forceFresh?: boolean },
) {
  const keys = rowKeys.filter(Boolean);
  if (!keys.length) return;
  markCanvasNodeGenerationStarted(columnNodeId);
  const { updateNodeData } = useCanvasStore.getState();
  const nodesAfterClear = useCanvasStore.getState().nodes;
  if (options?.forceFresh) {
    const col = nodesAfterClear.find((n) => n.id === columnNodeId);
    const rows =
      (col?.data as { rows?: import("./story-pro-workspace-types").StoryProFrameRow[] })
        .rows ?? [];
    const allowed = new Set(keys);
    const cleared = rows.map((r) =>
      allowed.has(r.key) ? { ...r, runtime: undefined } : r,
    );
    updateNodeData(columnNodeId, { rows: cleared });
    const nodesAfter = nodesAfterClear.map((n) =>
      n.id === columnNodeId
        ? { ...n, data: { ...n.data, rows: cleared } }
        : n,
    );
    clearPro2FrameInflightOutsideSyncGroup(
      columnNodeId,
      keys,
      nodesAfter,
      updateNodeData,
    );
    optimisticPro2FrameBatchStart(
      columnNodeId,
      keys,
      nodesAfter,
      updateNodeData,
    );
  } else {
    optimisticPro2FrameBatchStart(
      columnNodeId,
      keys,
      nodesAfterClear,
      updateNodeData,
    );
  }
  batchRunStoryRows(columnNodeId, keys, "frameImage", options);
}

/** 列节点 · 按行顺序跑 */
export function batchRunStoryRowsSequential(
  columnNodeId: string,
  rowKeys: string[],
  mediaKind: "threeView" | "sceneRef" | "frameImage" | "video" | "tts",
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
