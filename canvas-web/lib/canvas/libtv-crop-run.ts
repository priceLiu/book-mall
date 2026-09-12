"use client";

import { getCropCanvasHandle } from "./libtv-magic-edit-canvas-registry";
import { clearLibtvCropSession } from "./libtv-crop-session";
import { spawnLibtvMagicEditResult } from "./libtv-magic-edit-spawn";
import type { CanvasFlowEdge, CanvasFlowNode } from "./types";

type RunCropOpts = {
  sourceNodeId: string;
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

export async function runLibtvCrop(opts: RunCropOpts): Promise<void> {
  const handle = getCropCanvasHandle(opts.sourceNodeId);
  const bbox = handle?.exportCropBbox() ?? null;
  if (!bbox) throw new Error("请先调整裁剪区域");

  const naturalSize = handle?.getNaturalSize() ?? null;
  opts.onGeneratingChange?.(true);
  try {
    const res = await fetch("/api/book-mall/api/platform/v1/image-crop", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceImageUrl: opts.sourceImageUrl,
        bbox,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      imageUrls?: string[];
    };
    if (!res.ok) throw new Error(data.error ?? "裁剪失败");

    const resultUrl = data.imageUrls?.[0];
    if (!resultUrl) throw new Error("未获得裁剪结果");

    const cropW = bbox[2] - bbox[0];
    const cropH = bbox[3] - bbox[1];
    spawnLibtvMagicEditResult({
      sourceNodeId: opts.sourceNodeId,
      resultLabel: "裁剪",
      resultUrl,
      nodes: opts.nodes,
      addNode: opts.addNode,
      setNodes: opts.setNodes,
      setEdges: opts.setEdges,
      naturalSize:
        cropW > 0 && cropH > 0
          ? { width: Math.round(cropW), height: Math.round(cropH) }
          : naturalSize,
    });

    clearLibtvCropSession(opts.sourceNodeId, opts.setNodes);
  } finally {
    opts.onGeneratingChange?.(false);
  }
}
