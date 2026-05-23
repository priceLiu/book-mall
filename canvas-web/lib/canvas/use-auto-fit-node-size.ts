"use client";

import { useEffect, useRef } from "react";

import { useCanvasStore } from "./store";

export type AutoFitNodeSizeOptions = {
  imageUrls: string[];
  /** 节点壳层固定高度（header + footer + 内外边距） */
  chromeHeight: number;
  /** 每张图下方操作条高度 */
  perImageChrome?: number;
  /** 图片间距 */
  gap?: number;
  minWidth?: number;
  minHeight?: number;
  /** 内容区左右 padding 总和 */
  horizontalPadding?: number;
  maxWidth?: number;
};

function loadImageSize(url: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () =>
      resolve({ w: img.naturalWidth || 1, h: img.naturalHeight || 1 });
    img.onerror = () => reject(new Error(`failed to load ${url}`));
    img.src = url;
  });
}

/**
 * 根据图片内容自动调整节点宽高。
 * - 新图到达时始终重算（即使用户曾手动调过尺寸）
 * - 同一组图且用户已手动调尺寸时不再覆盖
 */
export function useAutoFitNodeSize(
  nodeId: string,
  {
    imageUrls,
    chromeHeight,
    perImageChrome = 0,
    gap = 8,
    minWidth = 260,
    minHeight = 260,
    horizontalPadding = 36,
    maxWidth = 560,
  }: AutoFitNodeSizeOptions,
) {
  const resizeNode = useCanvasStore((s) => s.resizeNode);
  const manualSize = useCanvasStore((s) => {
    const n = s.nodes.find((x) => x.id === nodeId);
    return Boolean((n?.data as { manualSize?: boolean }).manualSize);
  });
  const currentWidth = useCanvasStore((s) => {
    const n = s.nodes.find((x) => x.id === nodeId);
    const w = n?.style?.width ?? n?.width;
    return typeof w === "number" ? w : minWidth;
  });

  const lastFitKey = useRef("");

  useEffect(() => {
    if (imageUrls.length === 0) return;

    const key = imageUrls.join("|");
    if (manualSize && lastFitKey.current === key) return;

    let cancelled = false;

    void (async () => {
      try {
        const sizes = await Promise.all(imageUrls.map(loadImageSize));
        if (cancelled) return;

        const maxNaturalW = Math.max(...sizes.map((s) => s.w));
        const fitWidth = Math.min(
          maxWidth,
          Math.max(minWidth, maxNaturalW + horizontalPadding),
        );
        const contentW = fitWidth - horizontalPadding;

        let imagesHeight = 0;
        for (const s of sizes) {
          imagesHeight += (contentW / s.w) * s.h + perImageChrome + gap;
        }
        imagesHeight -= gap;

        const height = Math.max(
          minHeight,
          Math.ceil(chromeHeight + imagesHeight),
        );

        resizeNode(nodeId, { width: Math.ceil(fitWidth), height });
        lastFitKey.current = key;
      } catch {
        // 图片加载失败时保留当前尺寸
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    nodeId,
    imageUrls,
    manualSize,
    currentWidth,
    chromeHeight,
    perImageChrome,
    gap,
    minWidth,
    minHeight,
    horizontalPadding,
    maxWidth,
    resizeNode,
  ]);
}
