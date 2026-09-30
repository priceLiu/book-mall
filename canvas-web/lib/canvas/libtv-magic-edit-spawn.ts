"use client";

import { buildPro2ImageNodeData } from "./pro2-spawn-nodes";
import { spawnPro2ImageNeighbor } from "./libtv-pro2-image-neighbor-spawn";
import type { CanvasFlowEdge, CanvasFlowNode } from "./types";

export type SpawnMagicEditResultOpts = {
  sourceNodeId: string;
  resultLabel: string;
  resultUrl: string;
  nodes: CanvasFlowNode[];
  addNode: (
    type: "story-pro2-image",
    position: { x: number; y: number },
    data?: Record<string, unknown>,
  ) => string;
  setNodes: (fn: (nodes: CanvasFlowNode[]) => CanvasFlowNode[]) => void;
  setEdges: (fn: (edges: CanvasFlowEdge[]) => CanvasFlowEdge[]) => void;
  naturalSize?: { width: number; height: number } | null;
};

export function spawnLibtvMagicEditResult(
  opts: SpawnMagicEditResultOpts,
): string {
  const anchor = opts.nodes.find((n) => n.id === opts.sourceNodeId);
  if (!anchor) throw new Error("源节点不存在");
  const anchorData = (anchor.data ?? {}) as Record<string, unknown>;
  const natW =
    opts.naturalSize?.width ?? (Number(anchorData.mediaNaturalW) || 0);
  const natH =
    opts.naturalSize?.height ?? (Number(anchorData.mediaNaturalH) || 0);

  return spawnPro2ImageNeighbor({
    sourceNodeId: opts.sourceNodeId,
    resultLabel: opts.resultLabel,
    nodes: opts.nodes,
    addNode: opts.addNode,
    setNodes: opts.setNodes,
    setEdges: opts.setEdges,
    sourceHandle: "image",
    resultUrl: opts.resultUrl,
    naturalSize: opts.naturalSize,
    copyAnchorDimensions: true,
    imageNodeData: buildPro2ImageNodeData({
      label: opts.resultLabel,
      dockInput: "",
      ossUrl: opts.resultUrl,
      mediaAspectPreset: anchorData.mediaAspectPreset,
      mediaNaturalW: natW > 0 ? natW : anchorData.mediaNaturalW,
      mediaNaturalH: natH > 0 ? natH : anchorData.mediaNaturalH,
    }),
  });
}
