"use client";

import { getInpaintCanvasHandle } from "./libtv-inpaint-canvas-registry";
import { clearLibtvEraseSession } from "./libtv-erase-session";
import { notifyCreditsFromGatewayLog } from "./canvas-credits-notify";
import { spawnLibtvMagicEditResult } from "./libtv-magic-edit-spawn";
import type { CanvasFlowEdge, CanvasFlowNode } from "./types";

type RunEraseOpts = {
  sourceNodeId: string;
  projectId: string;
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
};

export async function runLibtvErase(opts: RunEraseOpts): Promise<void> {
  const handle = getInpaintCanvasHandle(opts.sourceNodeId);
  const selection = handle?.exportSelection();
  if (!selection || selection.kind !== "mask") {
    throw new Error("请先涂抹或框选需要擦除的区域");
  }

  const sourceImageSize = handle?.getNaturalSize() ?? null;
  opts.onGeneratingChange?.(true);
  try {
    const res = await fetch("/api/book-mall/api/platform/v1/image-erase", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceImageUrl: opts.sourceImageUrl,
        maskDataUrl: selection.maskDataUrl,
        clientPage: `canvas/${opts.projectId}/erase`,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      imageUrls?: string[];
      logId?: string;
      creditsCharged?: number;
    };
    if (!res.ok) throw new Error(data.error ?? "擦除失败");

    const resultUrl = data.imageUrls?.[0];
    if (!resultUrl) throw new Error("未获得擦除结果");

    spawnLibtvMagicEditResult({
      sourceNodeId: opts.sourceNodeId,
      resultLabel: "擦除",
      resultUrl,
      nodes: opts.nodes,
      addNode: opts.addNode,
      setNodes: opts.setNodes,
      setEdges: opts.setEdges,
      naturalSize: sourceImageSize,
    });

    clearLibtvEraseSession(opts.sourceNodeId, opts.setNodes);
    if (data.logId) {
      notifyCreditsFromGatewayLog(data.logId, data.creditsCharged);
    }
  } finally {
    opts.onGeneratingChange?.(false);
  }
}
