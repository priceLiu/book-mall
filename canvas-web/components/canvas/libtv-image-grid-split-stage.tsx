"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { computeContainedImageBounds } from "@/lib/canvas/libtv-grid-split-image-bounds";
import type { LibtvImageGridSplitState } from "@/lib/canvas/libtv-image-grid-split";
import { LibtvImageGridSplitOverlay } from "./libtv-image-grid-split-overlay";

/** 宫格切分 · 图片 object-contain + 网格贴齐真实图像区域 */
export function LibtvImageGridSplitStage({
  src,
  alt,
  split,
  onToggleCell,
  onImageError,
}: {
  src: string;
  alt: string;
  split: LibtvImageGridSplitState;
  onToggleCell: (cellIndex: number) => void;
  onImageError?: () => void;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (!box) return;
      setStageSize({ w: box.width, h: box.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const onLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setNatural({
      w: img.naturalWidth || 1,
      h: img.naturalHeight || 1,
    });
  }, []);

  const imageBox =
    natural && stageSize.w > 0 && stageSize.h > 0
      ? computeContainedImageBounds(
          stageSize.w,
          stageSize.h,
          natural.w,
          natural.h,
        )
      : null;

  return (
    <div
      ref={stageRef}
      className="nodrag pointer-events-auto absolute inset-0 flex items-center justify-center"
    >
      <div
        className="relative max-h-full max-w-full"
        style={
          imageBox
            ? { width: imageBox.width, height: imageBox.height }
            : { width: "100%", height: "100%" }
        }
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          className="block size-full object-contain"
          draggable={false}
          onLoad={onLoad}
          onError={() => onImageError?.()}
        />
        {imageBox ? (
          <LibtvImageGridSplitOverlay
            split={split}
            onToggleCell={onToggleCell}
          />
        ) : null}
      </div>
    </div>
  );
}
