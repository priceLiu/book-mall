"use client";

import { cropCanvasGridSplitCell } from "@/lib/canvas-api";
import type { GridSplitCrop } from "@/lib/canvas/libtv-grid-split-crop";
import { materializeImageInputsForRun } from "@/lib/canvas/materialize-image-inputs-for-run";
import type { StoryRefImage } from "@/lib/canvas/story-ref-image";

/** 宫格高清 · 提交前解析参考图（服务端裁切 OSS，绕过浏览器 CORS） */
export async function resolveHdGridSplitImageInputs(
  base: string,
  projectId: string,
  nodeId: string,
  data: {
    gridSplitCrop?: GridSplitCrop;
    gridSplitSourceUrl?: string;
    ossUrl?: string;
    blobUrl?: string;
    pro2HdFromGridSplit?: boolean;
  },
  updateNodeData: (id: string, patch: Record<string, unknown>) => void,
): Promise<string[]> {
  if (!data.pro2HdFromGridSplit || !data.gridSplitCrop) return [];

  let imageUrl = String(data.gridSplitSourceUrl ?? "").trim();
  if (!/^https?:\/\//.test(imageUrl)) {
    const blob = String(data.gridSplitSourceUrl ?? data.blobUrl ?? "").trim();
    if (blob.startsWith("blob:")) {
      const uploaded = await materializeImageInputsForRun(base, [blob]);
      imageUrl = uploaded[0] ?? "";
    }
  }
  if (!/^https?:\/\//.test(imageUrl)) return [];

  const crop = data.gridSplitCrop;
  const ossUrl = await cropCanvasGridSplitCell(base, {
    projectId,
    imageUrl,
    col: crop.col,
    row: crop.row,
    cols: crop.cols,
    rows: crop.rows,
  });

  const refId = `hd-ref-${nodeId}`;
  const dockRefImages: StoryRefImage[] = [
    { id: refId, label: "参考图", url: ossUrl },
  ];
  updateNodeData(nodeId, {
    ossUrl,
    blobUrl: undefined,
    uploading: false,
    gridSplitCrop: undefined,
    gridSplitFrameCrop: true,
    mediaFitKey: ossUrl,
    dockRefImages,
  });

  return [ossUrl];
}
