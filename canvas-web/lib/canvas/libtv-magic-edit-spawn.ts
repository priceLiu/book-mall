"use client";

import { nanoid } from "nanoid";
import { buildPro2ImageNodeData } from "./pro2-spawn-nodes";
import { selectPro2NodeAfterSpawn } from "./pro2-spawn-select";
import { PRO2_IMAGE_NODE_WIDTH } from "./story-pro2-node-chrome";
import { LIBTV_MEDIA_FIT_VERSION } from "./libtv-node-chrome";
import { useCanvasStore } from "./store";
import type { CanvasFlowEdge, CanvasFlowNode } from "./types";

const GAP = 48;

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
  const anchorW = anchor.width ?? PRO2_IMAGE_NODE_WIDTH;
  const anchorH = anchor.height;
  const position = {
    x: anchor.position.x + anchorW + GAP,
    y: anchor.position.y,
  };

  const natW =
    opts.naturalSize?.width ?? (Number(anchorData.mediaNaturalW) || 0);
  const natH =
    opts.naturalSize?.height ?? (Number(anchorData.mediaNaturalH) || 0);

  const newId = opts.addNode(
    "story-pro2-image",
    position,
    buildPro2ImageNodeData({
      label: opts.resultLabel,
      dockInput: "",
      ossUrl: opts.resultUrl,
      mediaAspectPreset: anchorData.mediaAspectPreset,
      mediaNaturalW: natW > 0 ? natW : anchorData.mediaNaturalW,
      mediaNaturalH: natH > 0 ? natH : anchorData.mediaNaturalH,
    }),
  );
  if (!newId) throw new Error("无法创建结果节点");

  if (
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

  if (natW > 0 && natH > 0) {
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
        mediaFitKey: opts.resultUrl,
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
      sourceHandle: "image",
      targetHandle: "in_image",
    },
  ]);

  selectPro2NodeAfterSpawn(opts.setNodes, newId);
  return newId;
}
