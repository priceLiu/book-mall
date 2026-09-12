"use client";

import { getExpandCanvasHandle } from "./libtv-magic-edit-canvas-registry";
import { clearLibtvExpandSession } from "./libtv-expand-session";
import { notifyCreditsFromGatewayLog } from "./canvas-credits-notify";
import { spawnLibtvMagicEditResult } from "./libtv-magic-edit-spawn";
import type { CanvasFlowEdge, CanvasFlowNode } from "./types";

type RunExpandOpts = {
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

export async function runLibtvExpand(opts: RunExpandOpts): Promise<void> {
  const handle = getExpandCanvasHandle(opts.sourceNodeId);
  const offsets = handle?.exportExpandOffsets() ?? null;
  if (!offsets) throw new Error("请向外拖动扩图框后再生成");

  const naturalSize = handle?.getNaturalSize() ?? null;
  opts.onGeneratingChange?.(true);
  try {
    const res = await fetch("/api/book-mall/api/platform/v1/image-outpaint", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceImageUrl: opts.sourceImageUrl,
        offsets,
        clientPage: `canvas/${opts.projectId}/expand`,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      imageUrls?: string[];
      logId?: string;
      creditsCharged?: number;
    };
    if (!res.ok) throw new Error(data.error ?? "扩图失败");

    const resultUrl = data.imageUrls?.[0];
    if (!resultUrl) throw new Error("未获得扩图结果");

    spawnLibtvMagicEditResult({
      sourceNodeId: opts.sourceNodeId,
      resultLabel: "扩图",
      resultUrl,
      nodes: opts.nodes,
      addNode: opts.addNode,
      setNodes: opts.setNodes,
      setEdges: opts.setEdges,
      naturalSize,
    });

    clearLibtvExpandSession(opts.sourceNodeId, opts.setNodes);
    if (data.logId) {
      notifyCreditsFromGatewayLog(data.logId, data.creditsCharged);
    }
  } finally {
    opts.onGeneratingChange?.(false);
  }
}
