"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  ImageZoomControls,
  IMAGE_ZOOM_BUTTON_STEP,
} from "@/components/media/image-zoom-controls";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { buildEcomOssThumbUrl } from "@/lib/ecom-oss-image-url";
import {
  useImageZoomPan,
  type ImageZoomPanStageProps,
} from "@/lib/media/use-image-zoom-pan";
import { cn } from "@/lib/utils";

/** 大图预览右上角关闭钮（覆写 DialogContent 自带的那颗） */
const PREVIEW_CLOSE_BUTTON_CLASS = [
  "[&>button]:absolute [&>button]:right-4 [&>button]:top-4 [&>button]:z-20",
  "[&>button]:flex [&>button]:h-8 [&>button]:w-8 [&>button]:items-center [&>button]:justify-center",
  "[&>button]:rounded-full [&>button]:border-0 [&>button]:bg-black/75",
  "[&>button]:text-white [&>button]:opacity-100 [&>button]:backdrop-blur-sm",
  "[&>button]:shadow-md [&>button]:transition-colors",
  "[&>button]:hover:bg-black [&>button]:hover:opacity-100",
  "[&>button]:focus:outline-none [&>button]:focus:ring-2 [&>button]:focus:ring-white/40 [&>button]:focus:ring-offset-0",
  "[&>button_svg]:h-4 [&>button_svg]:w-4 [&>button_svg]:stroke-[2.5]",
].join(" ");

/** 先缩略图占位，原图加载完成后 crossfade 换上 */
function EcomPreviewImageStage({
  src,
  thumbSrc,
  alt,
  stageProps,
}: {
  src: string;
  thumbSrc?: string;
  alt: string;
  stageProps: ImageZoomPanStageProps;
}) {
  const thumb = useMemo(
    () => thumbSrc?.trim() || buildEcomOssThumbUrl(src),
    [src, thumbSrc],
  );
  const [fullLoaded, setFullLoaded] = useState(false);
  const [fullFailed, setFullFailed] = useState(false);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(
    null,
  );
  const [thumbReady, setThumbReady] = useState(false);

  useEffect(() => {
    setFullLoaded(false);
    setFullFailed(false);
    setNaturalSize(null);
    setThumbReady(false);
  }, [src, thumbSrc]);

  const onImageMeta = useCallback((img: HTMLImageElement) => {
    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
      setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
    }
  }, []);

  // 后台预加载原图，加载完成后按 intrinsic 尺寸展示，不被锁在缩略图盒子里
  useEffect(() => {
    const img = new window.Image();
    img.decoding = "async";
    img.src = src;
    img.onload = () => {
      onImageMeta(img);
      setFullLoaded(true);
    };
    img.onerror = () => setFullFailed(true);
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [src, onImageMeta]);

  const showProgress = !fullLoaded && !fullFailed;
  const intrinsicClass = "block max-h-[90vh] max-w-[96vw] w-auto h-auto";

  return (
    <div
      {...stageProps}
      className="relative inline-block leading-none"
      aria-busy={showProgress}
      aria-label={alt}
    >
      {showProgress && !thumbReady ? (
        <div
          className="ecom-skeleton aspect-[3/4] max-h-[90vh] w-[min(72vw,420px)] rounded-sm bg-white/10"
          aria-hidden
        />
      ) : null}

      {fullLoaded ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          key={src}
          src={src}
          alt=""
          draggable={false}
          decoding="async"
          width={naturalSize?.w}
          height={naturalSize?.h}
          className={cn(intrinsicClass, "relative z-[2] opacity-100")}
        />
      ) : (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={thumb}
          alt=""
          aria-hidden
          draggable={false}
          decoding="async"
          onLoad={(e) => {
            onImageMeta(e.currentTarget);
            setThumbReady(true);
          }}
          className={cn(
            intrinsicClass,
            "relative transition-opacity duration-300 ease-out",
            thumbReady ? "opacity-100" : "opacity-0",
          )}
        />
      )}

      {showProgress ? (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-3 z-[3] flex justify-center px-6"
          aria-hidden
        >
          <div className="w-[min(160px,50%)]">
            <div className="ecom-upload-progress ecom-upload-progress-indeterminate bg-white/20 [&>span]:bg-white/90">
              <span />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * 全站统一的图片放大预览：全屏暗底 + 滚轮缩放 + 拖拽平移 + 右下角控件。
 * 交互规范见 `.cursor/rules/image-preview-zoom-pan.mdc`。
 */
export function EcomImagePreviewDialog({
  src,
  thumbSrc,
  open,
  onOpenChange,
  title = "图片预览",
}: {
  src: string;
  thumbSrc?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
}) {
  const { zoom, zoomBy, reset, stageProps } = useImageZoomPan(src);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex h-[100dvh] max-h-[100dvh] w-screen max-w-none items-center justify-center",
          "translate-x-[-50%] translate-y-[-50%] overflow-hidden border-0 bg-black/90 p-0 shadow-none sm:rounded-none",
          PREVIEW_CLOSE_BUTTON_CLASS,
        )}
        // 内容铺满视口，Radix 的「点击外部关闭」不会触发，改为点空白处关闭
        onClick={(e) => {
          if (e.target === e.currentTarget) onOpenChange(false);
        }}
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <EcomPreviewImageStage
          src={src}
          thumbSrc={thumbSrc}
          alt={title}
          stageProps={stageProps}
        />
        {/* 控件必须是缩放容器的兄弟节点，否则会跟着图片一起被 scale */}
        <ImageZoomControls
          zoom={zoom}
          onZoomIn={() => zoomBy(IMAGE_ZOOM_BUTTON_STEP)}
          onZoomOut={() => zoomBy(-IMAGE_ZOOM_BUTTON_STEP)}
          onReset={reset}
        />
      </DialogContent>
    </Dialog>
  );
}
