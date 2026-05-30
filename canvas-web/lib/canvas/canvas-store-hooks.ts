"use client";

import { useMemo } from "react";

import { useCanvasStore } from "./store";
import type { CanvasFlowEdge, CanvasFlowNode } from "./types";

/** 图数据变更序号（不含纯拖动坐标 / 纯选中） */
export function useCanvasGraphRevision(): number {
  return useCanvasStore((s) => s.graphRevision);
}

/** 仅在 graphRevision 变化时取 nodes/edges 快照，避免订阅整图数组 */
export function useCanvasGraphSnapshot(): {
  nodes: CanvasFlowNode[];
  edges: CanvasFlowEdge[];
} {
  const revision = useCanvasGraphRevision();
  return useMemo(() => {
    const s = useCanvasStore.getState();
    return { nodes: s.nodes, edges: s.edges };
  }, [revision]);
}

/** Store actions（引用稳定，可多处复用） */
export function useCanvasStoreActions() {
  return {
    updateNodeData: useCanvasStore((s) => s.updateNodeData),
    setNodeRuntime: useCanvasStore((s) => s.setNodeRuntime),
    setNodes: useCanvasStore((s) => s.setNodes),
    setEdges: useCanvasStore((s) => s.setEdges),
    addNode: useCanvasStore((s) => s.addNode),
    resizeNode: useCanvasStore((s) => s.resizeNode),
    reparentNode: useCanvasStore((s) => s.reparentNode),
  };
}
