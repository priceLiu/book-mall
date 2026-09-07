"use client";

import { Play } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { EcomVideoThumb } from "@/components/media/ecom-video-player";
import {
  readEcomMediaStageShortSide,
  resolveEcomMediaStagePreviewChrome,
} from "@/lib/media/ecom-media-stage-preview-chrome";
import { cn } from "@/lib/utils";

type Props = {
  src: string;
  posterUrl?: string | null;
  onPreview: () => void;
  className?: string;
  fit?: "cover" | "contain";
};

/** 工作区成片 Stage：封面 + 悬停磨砂 Play · 点击打开 EcomVideoPreviewDialog */
export function EcomVideoStagePreview({
  src,
  posterUrl,
  onPreview,
  className,
  fit = "contain",
}: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageShortSide, setStageShortSide] = useState(200);
  const chrome = useMemo(
    () => resolveEcomMediaStagePreviewChrome(stageShortSide),
    [stageShortSide],
  );

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const sync = () => setStageShortSide(readEcomMediaStageShortSide(el));
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, [src]);

  const objectClass =
    fit === "cover"
      ? "size-full object-cover object-center"
      : "size-full object-contain object-center";

  return (
    <div
      ref={stageRef}
      className={cn("group/stage relative size-full overflow-hidden bg-black", className)}
    >
      {posterUrl?.trim() ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={posterUrl.trim()} alt="" className={objectClass} draggable={false} />
      ) : (
        <EcomVideoThumb src={src} className={objectClass} />
      )}
      <div className={chrome.overlayClass}>
        <button
          type="button"
          title="播放视频"
          aria-label="播放视频"
          className={chrome.btnClass}
          style={{
            width: chrome.btnSizePx,
            height: chrome.btnSizePx,
          }}
          onClick={(e) => {
            e.stopPropagation();
            onPreview();
          }}
        >
          <Play
            className="pointer-events-none shrink-0 translate-x-px"
            style={{
              width: chrome.iconSizePx,
              height: chrome.iconSizePx,
            }}
            strokeWidth={1.75}
          />
        </button>
      </div>
    </div>
  );
}
