"use client";

/** 画布节点运行总线：避免 CustomEvent 在部分时序下未被 runner 接收。 */

export type CanvasRunSequentialOpts = { forceFresh?: boolean };

type CanvasRunBusHandlers = {
  enqueueNode: (nodeId: string, forceFresh?: boolean) => void;
  enqueueNodesSequential: (
    nodeIds: string[],
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
  if (handlers) {
    handlers.enqueueNode(nodeId, forceFresh);
    return;
  }
  window.dispatchEvent(
    new CustomEvent("canvas:run-node", { detail: { nodeId, forceFresh } }),
  );
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
  window.dispatchEvent(
    new CustomEvent("canvas:run-nodes-sequential", {
      detail: { nodeIds, forceFresh: opts?.forceFresh },
    }),
  );
}
