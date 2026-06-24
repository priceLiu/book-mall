"use client";

import { useEffect, useRef } from "react";

import { nodeMeasuredSize } from "./normalize-graph-nodes";
import { useCanvasStore } from "./store";

/**
 * 分镜列节点按行数自动撑开尺寸。
 * - 仅在镜数变化或首次挂载时 resize，避免与手动拖拽/缩放打架
 * - 用户用 NodeResizer 调过后（manualSize）不再自动改尺寸
 */
export function useStoryColumnAutoSize(
  nodeId: string,
  targetSize: { width: number; height: number },
  rowCount: number,
) {
  const resizeNode = useCanvasStore((s) => s.resizeNode);
  const manualSize = useCanvasStore((s) =>
    Boolean(
      (s.nodes.find((x) => x.id === nodeId)?.data as { manualSize?: boolean })
        ?.manualSize,
    ),
  );
  const lastRowCountRef = useRef<number | null>(null);

  useEffect(() => {
    const prevRows = lastRowCountRef.current;
    const rowCountChanged = prevRows !== rowCount;
    lastRowCountRef.current = rowCount;

    const node = useCanvasStore.getState().nodes.find((n) => n.id === nodeId);
    if (!node) return;
    if (String(node.type ?? "").startsWith("story-pro2-")) return;
    const { w, h } = nodeMeasuredSize(node);
    const needTaller = h + 48 < targetSize.height;

    if (manualSize && !needTaller) return;
    if (!rowCountChanged && prevRows !== null && !needTaller) return;
    if (
      !needTaller &&
      Math.abs(h - targetSize.height) < 4 &&
      Math.abs(w - targetSize.width) < 4
    ) {
      return;
    }
    resizeNode(nodeId, {
      width: targetSize.width,
      height: Math.max(h, targetSize.height),
    });
  }, [nodeId, rowCount, targetSize.width, targetSize.height, manualSize, resizeNode]);
}
