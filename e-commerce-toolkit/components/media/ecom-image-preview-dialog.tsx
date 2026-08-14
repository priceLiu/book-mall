"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { buildEcomOssThumbUrl } from "@/lib/ecom-oss-image-url";
import { cn } from "@/lib/utils";

function cssAspectRatio(ratio?: string): string {
  switch (ratio) {
    case "3:4":
      return "3 / 4";
    case "4:5":
      return "4 / 5";
    case "16:9":
      return "16 / 9";
    case "9:16":
      return "9 / 16";
    default:
      return "1 / 1";
  }
}

/** 大图预览（borderless / 暗色遮罩）右上角关闭钮 */
const PREVIEW_CLOSE_BUTTON_CLASS = [
  "[&>button]:absolute [&>button]:right-3 [&>button]:top-3 [&>button]:z-10",
  "[&>button]:flex [&>button]:h-8 [&>button]:w-8 [&>button]:items-center [&>button]:justify-center",
  "[&>button]:rounded-full [&>button]:border-0 [&>button]:bg-[#1d1d1f]",
  "[&>button]:text-white [&>button]:opacity-100",
  "[&>button]:shadow-md [&>button]:transition-colors",
  "[&>button]:hover:bg-black [&>button]:hover:opacity-100",
  "[&>button]:focus:outline-none [&>button]:focus:ring-2 [&>button]:focus:ring-white/30 [&>button]:focus:ring-offset-0",
  "[&>button_svg]:h-4 [&>button_svg]:w-4 [&>button_svg]:stroke-[2.5]",
].join(" ");

/** 先缩略图、原图加载后 crossfade */
function EcomPreviewImageStage({
  src,
  thumbSrc,
  alt,
  aspectRatio,
  fitClass,
  borderless = false,
  maxHeightClass = "max-h-[80vh]",
  minHeightClass = "min-h-[360px]",
}: {
  src: string;
  thumbSrc?: string;
  alt: string;
  aspectRatio?: string;
  fitClass: string;
  borderless?: boolean;
  maxHeightClass?: string;
  minHeightClass?: string;
}) {
  const thumb = useMemo(
    () => thumbSrc?.trim() || buildEcomOssThumbUrl(src),
    [src, thumbSrc],
  );
  const [fullLoaded, setFullLoaded] = useState(false);
  const [fullFailed, setFullFailed] = useState(false);
  const [naturalRatio, setNaturalRatio] = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(
    null,
  );
  const [thumbReady, setThumbReady] = useState(false);

  useEffect(() => {
    setFullLoaded(false);
    setFullFailed(false);
    setNaturalRatio(null);
    setNaturalSize(null);
    setThumbReady(false);
  }, [src, thumbSrc]);

  const onImageMeta = useCallback((img: HTMLImageElement) => {
    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
      setNaturalRatio(`${img.naturalWidth} / ${img.naturalHeight}`);
      setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
    }
  }, []);

  const showProgress = !fullLoaded && !fullFailed;

  const intrinsicClass =
    "block max-h-[90vh] max-w-[96vw] w-auto h-auto select-none";

  // borderless：后台预加载原图，完成后按 intrinsic 尺寸展示（不再锁在缩略图盒子内）
  useEffect(() => {
    if (!borderless) return;
    const img = new window.Image();
    img.decoding = "async";
    img.src = src;
    img.onload = () => {
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        setNaturalRatio(`${img.naturalWidth} / ${img.naturalHeight}`);
        setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
      }
      setFullLoaded(true);
    };
    img.onerror = () => setFullFailed(true);
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [borderless, src]);

  const markFullLoaded = useCallback(
    (img: HTMLImageElement) => {
      onImageMeta(img);
      setFullLoaded(true);
    },
    [onImageMeta],
  );

  const aspectStyle = useMemo(() => {
    if (naturalRatio) return { aspectRatio: naturalRatio };
    if (aspectRatio) return { aspectRatio: cssAspectRatio(aspectRatio) };
    return undefined;
  }, [naturalRatio, aspectRatio]);

  if (borderless) {
    return (
      <div
        className="relative inline-block leading-none"
        aria-busy={showProgress}
        aria-label={alt}
      >
        {showProgress && !thumbReady && !fullLoaded ? (
          <div
            className="ecom-skeleton aspect-[3/4] w-[min(72vw,420px)] max-h-[90vh] rounded-sm bg-white/10"
            aria-hidden
          />
        ) : null}

        {fullLoaded ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            key={src}
            src={src}
            alt=""
            decoding="async"
            width={naturalSize?.w}
            height={naturalSize?.h}
            onLoad={(e) => markFullLoaded(e.currentTarget)}
            className={cn(
              intrinsicClass,
              "relative z-[2] transition-opacity duration-500 ease-out opacity-100",
            )}
          />
        ) : null}

        {!fullLoaded ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={thumb}
            alt=""
            aria-hidden
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
        ) : null}

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

  return (
    <div
      className={cn(
        "relative mx-auto w-full overflow-hidden rounded-lg bg-[#ececee]",
        maxHeightClass,
        minHeightClass,
        (aspectRatio || naturalRatio) && "min-h-0",
      )}
      style={aspectStyle}
      aria-busy={showProgress}
      aria-label={alt}
    >
      {showProgress ? (
        <div
          className="ecom-skeleton absolute inset-0 z-0"
          aria-hidden
        />
      ) : null}

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={thumb}
        alt=""
        aria-hidden
        decoding="async"
        onLoad={(e) => onImageMeta(e.currentTarget)}
        className={cn(
          "absolute inset-0 z-[1] h-full w-full transition-opacity duration-500 ease-out",
          fitClass,
          fullLoaded ? "opacity-0" : "opacity-100",
        )}
      />

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={src}
        src={src}
        alt=""
        decoding="async"
        onLoad={(e) => {
          onImageMeta(e.currentTarget);
          setFullLoaded(true);
        }}
        onError={() => setFullFailed(true)}
        className={cn(
          "absolute inset-0 z-[2] h-full w-full transition-opacity duration-500 ease-out",
          fitClass,
          fullLoaded ? "opacity-100" : "opacity-0",
        )}
      />

      {showProgress ? (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-3 z-[3] flex justify-center px-6"
          aria-hidden
        >
          <div className="w-[min(160px,50%)]">
            <div className="ecom-upload-progress ecom-upload-progress-indeterminate">
              <span />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function EcomImagePreviewDialog({
  src,
  thumbSrc,
  open,
  onOpenChange,
  title = "图片预览",
  aspectRatio,
  objectFit = "contain",
  fullscreen = false,
  /** 无标题、无边框；图片按自身比例自适应填满视口 */
  borderless = false,
}: {
  src: string;
  thumbSrc?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  aspectRatio?: string;
  objectFit?: "cover" | "contain";
  fullscreen?: boolean;
  borderless?: boolean;
}) {
  const fitClass = objectFit === "cover" ? "object-cover object-center" : "object-contain";

  if (fullscreen) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className={cn(
            "flex h-[100dvh] max-h-[100dvh] w-[100vw] max-w-[100vw] flex-col gap-0 border-0 bg-black/95 p-0 text-white",
            "translate-x-[-50%] translate-y-[-50%]",
            borderless && PREVIEW_CLOSE_BUTTON_CLASS,
          )}
        >
          {!borderless ? (
            <DialogHeader className="shrink-0 border-b border-white/10 px-4 py-3">
              <DialogTitle className="text-sm font-medium text-white">{title}</DialogTitle>
            </DialogHeader>
          ) : (
            <DialogTitle className="sr-only">{title}</DialogTitle>
          )}
          <div className="flex min-h-0 flex-1 items-center justify-center p-4 sm:p-8">
            <EcomPreviewImageStage
              src={src}
              thumbSrc={thumbSrc}
              alt={title}
              aspectRatio={aspectRatio}
              fitClass={fitClass}
              borderless={borderless}
              maxHeightClass="max-h-[calc(100dvh-5rem)]"
              minHeightClass="min-h-[240px]"
            />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (borderless) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className={cn(
            "max-w-none gap-0 border-0 bg-transparent p-0 shadow-none",
            "flex w-auto items-center justify-center sm:rounded-none",
            PREVIEW_CLOSE_BUTTON_CLASS,
          )}
        >
          <DialogTitle className="sr-only">{title}</DialogTitle>
          <EcomPreviewImageStage
            src={src}
            thumbSrc={thumbSrc}
            alt={title}
            aspectRatio={aspectRatio}
            fitClass="object-contain object-center"
            borderless
          />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl gap-3">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <EcomPreviewImageStage
          src={src}
          thumbSrc={thumbSrc}
          alt={title}
          aspectRatio={aspectRatio}
          fitClass={fitClass}
        />
      </DialogContent>
    </Dialog>
  );
}
