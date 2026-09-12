"use client";

import { nanoid } from "nanoid";
import { buildPro2ImageNodeData } from "./pro2-spawn-nodes";
import { selectPro2NodeAfterSpawn } from "./pro2-spawn-select";
import { PRO2_IMAGE_NODE_WIDTH } from "./story-pro2-node-chrome";
import { getInpaintCanvasHandle } from "./libtv-inpaint-canvas-registry";
import { clearLibtvInpaintSession } from "./libtv-inpaint-session";
import { notifyCreditsFromGatewayLog } from "./canvas-credits-notify";
import { isQwenImageEditModelKey } from "./canvas-image-edit-models";
import { LIBTV_MEDIA_FIT_VERSION } from "./libtv-node-chrome";
import { useCanvasStore } from "./store";
import type { CanvasFlowEdge, CanvasFlowNode } from "./types";

const GAP = 48;

type RunInpaintOpts = {
  sourceNodeId: string;
  projectId: string;
  modelKey: string;
  prompt: string;
  sourceImageUrl: string;
  nodes: CanvasFlowNode[];
  addNode: (
    type: "story-pro2-image",
    position: { x: number; y: number },
    data?: Record<string, unknown>,
  ) => string;
  setNodes: (fn: (nodes: CanvasFlowNode[]) => CanvasFlowNode[]) => void;
  setEdges: (fn: (edges: CanvasFlowEdge[]) => CanvasFlowEdge[]) => void;
  onGeneratingChange?: (generating: boolean) => void;
  resultLabel?: string;
  clearSession?: (
    nodeId: string,
    setNodes: (fn: (nodes: CanvasFlowNode[]) => CanvasFlowNode[]) => void,
  ) => void;
};

export async function runLibtvInpaint(opts: RunInpaintOpts): Promise<void> {
  const handle = getInpaintCanvasHandle(opts.sourceNodeId);
  const selection = handle?.exportSelection() ?? null;

  const isWan27 = opts.modelKey.trim().toLowerCase() === "wan2.7-image-pro";
  if (
    isWan27 &&
    selection?.kind !== "bbox" &&
    selection?.kind !== "multi-bbox"
  ) {
    throw new Error("万相 2.7 Pro 局部重绘需要框选区域");
  }
  if (
    !isWan27 &&
    !isQwenImageEditModelKey(opts.modelKey) &&
    selection?.kind !== "mask"
  ) {
    // wanx etc. handled via mask
  }

  const sourceImageSize = handle?.getNaturalSize() ?? null;

  opts.onGeneratingChange?.(true);
  try {
    const body: Record<string, unknown> = {
      modelKey: opts.modelKey,
      prompt: opts.prompt.trim(),
      sourceImageUrls: [opts.sourceImageUrl],
      clientApp: "canvas",
      clientPage: `canvas/${opts.projectId}/inpaint`,
    };
    if (sourceImageSize) {
      body.sourceImageSize = sourceImageSize;
    }
    if (selection) {
      if (selection.kind === "mask") {
        body.selection = { kind: "mask", maskDataUrl: selection.maskDataUrl };
      } else if (selection.kind === "multi-bbox") {
        body.selection = { kind: "multi-bbox", bboxList: selection.bboxList };
      } else {
        body.selection = { kind: "bbox", bbox: selection.bbox };
      }
    }

    const res = await fetch("/api/book-mall/api/platform/v1/image-local-edit", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      imageUrls?: string[];
      logId?: string;
      creditsCharged?: number;
    };
    if (!res.ok) {
      throw new Error(data.error ?? "重绘失败");
    }

    const resultUrl = data.imageUrls?.[0];
    if (!resultUrl) throw new Error("未获得重绘结果");

    const anchor = opts.nodes.find((n) => n.id === opts.sourceNodeId);
    if (!anchor) throw new Error("源节点不存在");

    const anchorData = (anchor.data ?? {}) as Record<string, unknown>;
    const anchorW = anchor.width ?? PRO2_IMAGE_NODE_WIDTH;
    const anchorH = anchor.height;
    const position = {
      x: anchor.position.x + anchorW + GAP,
      y: anchor.position.y,
    };

    const resultLabel = opts.resultLabel ?? "重绘";
    const clearSession = opts.clearSession ?? clearLibtvInpaintSession;

    const newId = opts.addNode(
      "story-pro2-image",
      position,
      buildPro2ImageNodeData({
        label: resultLabel,
        dockInput: "",
        ossUrl: resultUrl,
        mediaAspectPreset: anchorData.mediaAspectPreset,
        mediaNaturalW: sourceImageSize?.width ?? anchorData.mediaNaturalW,
        mediaNaturalH: sourceImageSize?.height ?? anchorData.mediaNaturalH,
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

    const natW =
      sourceImageSize?.width ??
      (Number(anchorData.mediaNaturalW) || 0);
    const natH =
      sourceImageSize?.height ??
      (Number(anchorData.mediaNaturalH) || 0);
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
              : Math.round(
                  (PRO2_IMAGE_NODE_WIDTH * natH) / Math.max(natW, 1),
                ),
        },
        {
          mediaFit: true,
          mediaFitKey: resultUrl,
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

    clearSession(opts.sourceNodeId, opts.setNodes);
    selectPro2NodeAfterSpawn(opts.setNodes, newId);

    if (data.logId) {
      notifyCreditsFromGatewayLog(data.logId, data.creditsCharged);
    }
  } finally {
    opts.onGeneratingChange?.(false);
  }
}
