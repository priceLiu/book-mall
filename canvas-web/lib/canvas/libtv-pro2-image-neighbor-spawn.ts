"use client";

import { nanoid } from "nanoid";

import {
  absoluteNodePosition,
  nodeMeasuredSize,
} from "./normalize-graph-nodes";
import { buildPro2ImageNodeData } from "./pro2-spawn-nodes";
import { selectPro2NodeAfterSpawn } from "./pro2-spawn-select";
import { PRO2_IMAGE_NODE_WIDTH } from "./story-pro2-node-chrome";
import { LIBTV_MEDIA_FIT_VERSION } from "./libtv-node-chrome";
import { useCanvasStore } from "./store";
import type { CanvasFlowEdge, CanvasFlowNode } from "./types";

const GAP = 48;

export type SpawnPro2ImageNeighborOpts = {
  sourceNodeId: string;
  resultLabel: string;
  nodes: CanvasFlowNode[];
  addNode: (
    type: "story-pro2-image",
    position: { x: number; y: number },
    data?: Record<string, unknown>,
  ) => string;
  setNodes: (fn: (nodes: CanvasFlowNode[]) => CanvasFlowNode[]) => void;
  setEdges: (fn: (edges: CanvasFlowEdge[]) => CanvasFlowEdge[]) => void;
  sourceHandle: "image" | "out_video";
  imageNodeData?: Record<string, unknown>;
  resultUrl?: string;
  naturalSize?: { width: number; height: number } | null;
  copyAnchorDimensions?: boolean;
};

/** Pro2 · 源节点右侧新建 `story-pro2-image` 并连线（魔法编辑 / 视频截帧等） */
export function spawnPro2ImageNeighbor(
  opts: SpawnPro2ImageNeighborOpts,
): string {
  const anchor = opts.nodes.find((n) => n.id === opts.sourceNodeId);
  if (!anchor) throw new Error("源节点不存在");

  const anchorData = (anchor.data ?? {}) as Record<string, unknown>;
  const abs = absoluteNodePosition(anchor, opts.nodes);
  const { w: selfW } = nodeMeasuredSize(anchor);
  const position = {
    x: abs.x + selfW + GAP,
    y: abs.y,
  };

  const natW =
    opts.naturalSize?.width ?? (Number(anchorData.mediaNaturalW) || 0);
  const natH =
    opts.naturalSize?.height ?? (Number(anchorData.mediaNaturalH) || 0);

  const anchorW = anchor.width ?? PRO2_IMAGE_NODE_WIDTH;
  const anchorH = anchor.height;

  const nodeData =
    opts.imageNodeData ??
    buildPro2ImageNodeData({
      label: opts.resultLabel,
      dockInput: "",
      ossUrl: opts.resultUrl,
      mediaAspectPreset: anchorData.mediaAspectPreset,
      mediaNaturalW: natW > 0 ? natW : anchorData.mediaNaturalW,
      mediaNaturalH: natH > 0 ? natH : anchorData.mediaNaturalH,
    });

  const newId = opts.addNode("story-pro2-image", position, nodeData);
  if (!newId) throw new Error("无法创建图片节点");

  if (
    opts.copyAnchorDimensions &&
    typeof anchorW === "number" &&
    typeof anchorH === "number" &&
    anchorW > 0 &&
    anchorH > 0
  ) {
    opts.setNodes((prev) =>
      prev.map((n) =>
        n.id === newId
          ? {
              ...n,
              width: anchorW,
              height: anchorH,
              style: { ...n.style, width: anchorW, height: anchorH },
            }
          : n,
      ),
    );
  }

  if (natW > 0 && natH > 0 && opts.resultUrl?.trim()) {
    useCanvasStore.getState().applyLibtvMediaFit(
      newId,
      {
        width:
          typeof anchorW === "number" && anchorW > 0
            ? anchorW
            : PRO2_IMAGE_NODE_WIDTH,
        height:
          typeof anchorH === "number" && anchorH > 0
            ? anchorH
            : Math.round((PRO2_IMAGE_NODE_WIDTH * natH) / Math.max(natW, 1)),
      },
      {
        mediaFit: true,
        mediaFitKey: opts.resultUrl.trim(),
        mediaFitVersion: LIBTV_MEDIA_FIT_VERSION,
        mediaNaturalW: natW,
        mediaNaturalH: natH,
        mediaAspectPreset:
          typeof anchorData.mediaAspectPreset === "string"
            ? anchorData.mediaAspectPreset
            : undefined,
      },
    );
  }

  opts.setEdges((prev) => [
    ...prev,
    {
      id: `e-${nanoid(6)}`,
      source: opts.sourceNodeId,
      target: newId,
      sourceHandle: opts.sourceHandle,
      targetHandle: "in_image",
    },
  ]);

  selectPro2NodeAfterSpawn(opts.setNodes, newId);
  return newId;
}
