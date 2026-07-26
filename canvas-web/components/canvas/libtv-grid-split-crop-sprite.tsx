"use client";

import { useEffect, useState } from "react";
import type { GridSplitCrop } from "@/lib/canvas/libtv-grid-split-crop";
import { gridSplitCellAspectRatio } from "@/lib/canvas/grid-split-cell-extract";
import { loadImageNaturalSize } from "@/lib/canvas/libtv-media-node-auto-fit";
import { cn } from "@/lib/utils";

/** 宫格单元 · 按原图像素比例精确定位（left/top 百分比，避免 margin 在非单元比例容器串格） */
export function LibtvGridSplitCropSprite({
  url,
  crop,
  className,
  imgClassName,
}: {
  url: string;
  crop: GridSplitCrop;
  className?: string;
  imgClassName?: string;
}) {
  const { cols, rows, col, row } = crop;
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    void loadImageNaturalSize(url)
      .then(({ w, h }) => {
        if (!cancelled) setNatural({ w, h });
      })
      .catch(() => {
        if (!cancelled) setNatural(null);
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  const cellAspect =
    natural != null
      ? gridSplitCellAspectRatio(natural.w, natural.h, cols, rows)
      : null;

  return (
    <div
      className={cn("relative overflow-hidden", className)}
      style={cellAspect != null ? { aspectRatio: cellAspect } : undefined}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt=""
        draggable={false}
        className={cn("absolute max-w-none select-none", imgClassName)}
        style={{
          width: `${cols * 100}%`,
          height: `${rows * 100}%`,
          left: `-${col * 100}%`,
          top: `-${row * 100}%`,
        }}
      />
    </div>
  );
}
