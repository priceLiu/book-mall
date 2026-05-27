"use client";

import type { StoryProRunContext } from "./story-pro-workspace-types";
import type { StoryRunContext } from "./story-workspace-types";

/** 画布节点运行总线：避免 CustomEvent 在部分时序下未被 runner 接收。 */

export type CanvasRunSequentialOpts = { forceFresh?: boolean };

export type CanvasStoryRunJob = {
  nodeId: string;
  forceFresh?: boolean;
} & (StoryRunContext | StoryProRunContext);

type CanvasRunBusHandlers = {
  enqueueNode: (nodeId: string, forceFresh?: boolean) => void;
  enqueueStoryRun: (job: CanvasStoryRunJob) => void;
  enqueueNodesSequential: (
    nodeIds: string[],
    opts?: CanvasRunSequentialOpts,
  ) => void;
  enqueueStoryRunsSequential: (
    jobs: CanvasStoryRunJob[],
    opts?: CanvasRunSequentialOpts,
  ) => void;
};

let handlers: CanvasRunBusHandlers | null = null;

export function registerCanvasRunBus(next: CanvasRunBusHandlers) {
  handlers = next;
}

export function unregisterCanvasRunBus() {
  handlers = null;
}

export function busEnqueueNode(nodeId: string, forceFresh?: boolean) {
  busEnqueueStoryRun({ nodeId, forceFresh });
}

export function busEnqueueStoryRun(job: CanvasStoryRunJob) {
  if (handlers) {
    handlers.enqueueStoryRun(job);
    return;
  }
  window.dispatchEvent(
    new CustomEvent("canvas:run-node", { detail: job }),
  );
}

export function busEnqueueNodesSequential(
  nodeIds: string[],
  opts?: CanvasRunSequentialOpts,
) {
  if (!nodeIds.length) return;
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
