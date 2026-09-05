"use client";

import type { StoryProRunContext } from "./story-pro-workspace-types";
import type { StoryRunContext } from "./story-workspace-types";

/** 画布节点运行总线：避免 CustomEvent 在部分时序下未被 runner 接收。 */

export type CanvasRunSequentialOpts = { forceFresh?: boolean };

export type CanvasCancelGenerationJob = {
  nodeId: string;
  taskId?: string;
  rowKey?: string;
  mediaKind?: StoryRunContext["mediaKind"];
  llmSection?: StoryRunContext["llmSection"];
};

export type CanvasStoryRunJob = {
  nodeId: string;
  forceFresh?: boolean;
} & (StoryRunContext | StoryProRunContext);

type CanvasRunBusHandlers = {
  enqueueNode: (nodeId: string, forceFresh?: boolean) => boolean;
  enqueueStoryRun: (job: CanvasStoryRunJob) => boolean;
  enqueueNodesSequential: (
    nodeIds: string[],
    opts?: CanvasRunSequentialOpts,
  ) => void;
  enqueueStoryRunsSequential: (
    jobs: CanvasStoryRunJob[],
    opts?: CanvasRunSequentialOpts,
  ) => void;
  cancelGeneration: (job: CanvasCancelGenerationJob) => boolean;
};

let handlers: CanvasRunBusHandlers | null = null;

export function registerCanvasRunBus(next: CanvasRunBusHandlers) {
  handlers = next;
}

export function unregisterCanvasRunBus() {
  handlers = null;
}

export function busEnqueueNode(nodeId: string, forceFresh?: boolean): boolean {
  return busEnqueueStoryRun({ nodeId, forceFresh });
}

export function busEnqueueStoryRun(job: CanvasStoryRunJob): boolean {
  if (handlers) {
    return handlers.enqueueStoryRun(job);
  }
  window.dispatchEvent(
    new CustomEvent("canvas:run-node", { detail: job }),
  );
  return true;
}

export function busEnqueueNodesSequential(
  nodeIds: string[],
  opts?: CanvasRunSequentialOpts,
) {
  if (!nodeIds.length) return;
  if (handlers) {
    handlers.enqueueNodesSequential(nodeIds, opts);
    return;
  }
  busEnqueueStoryRunsSequential(
    nodeIds.map((nodeId) => ({ nodeId, forceFresh: opts?.forceFresh })),
    opts,
  );
}

export function busEnqueueStoryRunsSequential(
  jobs: CanvasStoryRunJob[],
  opts?: CanvasRunSequentialOpts,
) {
  if (!jobs.length) return;
  const withForce = jobs.map((j) => ({
    ...j,
    forceFresh: j.forceFresh ?? opts?.forceFresh,
  }));
  if (handlers) {
    handlers.enqueueStoryRunsSequential(withForce, opts);
    return;
  }
  window.dispatchEvent(
    new CustomEvent("canvas:run-jobs-sequential", {
      detail: { jobs: withForce, forceFresh: opts?.forceFresh },
    }),
  );
}

export function busCancelCanvasGeneration(job: CanvasCancelGenerationJob): boolean {
  if (handlers?.cancelGeneration) {
    return handlers.cancelGeneration(job);
  }
  window.dispatchEvent(
    new CustomEvent("canvas:cancel-generation", { detail: job }),
  );
  return true;
}
