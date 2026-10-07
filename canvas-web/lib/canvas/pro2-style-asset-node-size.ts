"use client";

import { loadImageNaturalSize } from "./libtv-media-node-auto-fit";
import { computeLibtvMediaNodeSize } from "./libtv-media-node-size";
import { useCanvasStore } from "./store";

/** 风格库预览图 URL 变更后 · 按 natural 比例调整素材节点外框 */
export function fitPro2StyleAssetNodeToPreviewImage(
  nodeId: string,
  imageUrl: string,
): void {
  const url = imageUrl.trim();
  if (!url) return;

  void loadImageNaturalSize(url)
    .then(({ w, h }) => {
      const state = useCanvasStore.getState();
      const node = state.nodes.find((n) => n.id === nodeId);
      if (!node || node.type !== "story-pro2-style-asset") return;

      const d = node.data as {
        manualSize?: boolean;
        stylePreviewFitKey?: string;
      };
      if (d.manualSize) return;
      const fitKey = `${url}|${w}x${h}`;
      if (d.stylePreviewFitKey === fitKey) return;

      const size = computeLibtvMediaNodeSize(w, h, "sbv1-media");
      state.resizeNode(nodeId, size);
      state.updateNodeData(nodeId, {
        stylePreviewFitKey: fitKey,
        mediaNaturalW: w,
        mediaNaturalH: h,
      });
    })
    .catch(() => {
      /* 探测失败时保留当前外框 */
    });
}
