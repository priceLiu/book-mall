"use client";

import {
  ImageZoomControls,
  IMAGE_ZOOM_BUTTON_STEP,
} from "@/components/media/image-zoom-controls";
import { useImageZoomPan } from "@/lib/media/use-image-zoom-pan";
import { cn } from "@/lib/utils";
import { useRef } from "react";

/** 弹窗 / 卡片内的单张图片：滚轮缩放 + 拖拽 + 右下角控件（规范同全屏预览） */
export function EcomZoomableInlineImage({
  src,
  alt,
  className,
  viewportClassName,
}: {
  src: string;
  alt: string;
  className?: string;
  viewportClassName?: string;
}) {
  const wheelHostRef = useRef<HTMLDivElement>(null);
  const { zoom, zoomBy, reset, stageProps } = useImageZoomPan(src, {
    wheelHostRef,
  });

  return (
    <div
      ref={wheelHostRef}
      className={cn(
        "relative flex min-h-[200px] items-center justify-center overflow-hidden",
        viewportClassName,
      )}
    >
      <div
        {...stageProps}
        className="relative inline-block max-w-full leading-none"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          draggable={false}
          className={cn("mx-auto block h-auto max-w-full", className)}
        />
      </div>
      <ImageZoomControls
        zoom={zoom}
        onZoomIn={() => zoomBy(IMAGE_ZOOM_BUTTON_STEP)}
        onZoomOut={() => zoomBy(-IMAGE_ZOOM_BUTTON_STEP)}
        onReset={reset}
      />
    </div>
  );
}
