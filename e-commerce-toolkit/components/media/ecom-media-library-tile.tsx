"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Download, Eye, Sparkles, Trash2 } from "lucide-react";

import {
  EcomVideoHoverPreview,
  EcomVideoThumb,
} from "@/components/media/ecom-video-player";
import { buildEcomOssThumbUrl } from "@/lib/ecom-oss-image-url";
import { cn } from "@/lib/utils";
import { useIntersectionVisible } from "@/lib/use-intersection-visible";

/** 资产库 / 模块结果区：一行 5 张（md+），见 design/MEDIA.md */
export const ECOM_LIBRARY_MEDIA_GRID_CLASS =
  "grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5";

const HOVER_BTN =
  "inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-[#1d1d1f] shadow-md transition hover:bg-white";

type Props = {
  kind: "image" | "video";
  src: string;
  thumbnailSrc?: string | null;
  alt?: string;
  onPreview: () => void;
  onDownload?: () => void;
  onDelete?: () => void;
  /** 展示到「我的 AI 空间」作品墙（Book 只存指向） */
  onPinToAiSpace?: () => void;
  pinnedToAiSpace?: boolean;
  /** 选择模式（资产 picker） */
  selected?: boolean;
  onSelect?: () => void;
  /** 默认 aspect-square；模板区等可传 aspect-[3/4] */
  aspectClass?: string;
  /** 关闭视口懒加载（极少场景） */
  disableLazy?: boolean;
  className?: string;
};

/**
 * 统一媒体缩略图：悬停显示图标操作（预览 / 下载），禁止文字按钮。
 * 全站图片、视频列表须复用本组件或同等 hover 规范。
 */
export function EcomMediaLibraryTile({
  kind,
  src,
  thumbnailSrc,
  alt = "",
  onPreview,
  onDownload,
  onDelete,
  onPinToAiSpace,
  pinnedToAiSpace,
  selected,
  onSelect,
  aspectClass = "aspect-square",
  disableLazy = false,
  className,
}: Props) {
  const thumb = thumbnailSrc ?? src;
  const selectable = Boolean(onSelect);
  const { ref, visible } = useIntersectionVisible<HTMLDivElement>("480px 0px");
  const [mediaLoaded, setMediaLoaded] = useState(false);
  const [hovered, setHovered] = useState(false);
  /** 视频封面图：与 src 相同说明没有真封面，只能回退到 video 取帧 */
  const videoPosterSrc =
    kind === "video" && thumbnailSrc?.trim() && thumbnailSrc !== src
      ? thumbnailSrc
      : null;
  const thumbDisplaySrc = useMemo(
    () =>
      kind === "image"
        ? buildEcomOssThumbUrl(thumb, thumbnailSrc)
        : thumb,
    [kind, thumb, thumbnailSrc],
  );
  const [resolvedSrc, setResolvedSrc] = useState(thumbDisplaySrc);

  const onMediaLoad = useCallback(() => setMediaLoaded(true), []);

  useEffect(() => {
    setMediaLoaded(false);
    setResolvedSrc(thumbDisplaySrc);
  }, [thumbDisplaySrc, src, kind]);

  const onImageError = useCallback(() => {
    if (resolvedSrc !== thumb) setResolvedSrc(thumb);
  }, [resolvedSrc, thumb]);

  const shouldLoad = disableLazy || visible;
  const showSkeleton = !disableLazy && (!shouldLoad || !mediaLoaded);

  const body =
    kind === "image" ? (
      shouldLoad ? (
        <Image
          src={resolvedSrc}
          alt={alt}
          fill
          className="object-cover"
          loading="lazy"
          decoding="async"
          unoptimized
          onLoad={onMediaLoad}
          onError={onImageError}
        />
      ) : null
    ) : shouldLoad ? (
      videoPosterSrc ? (
        <>
          <Image
            src={videoPosterSrc}
            alt={alt}
            fill
            className="object-cover"
            loading="lazy"
            decoding="async"
            unoptimized
            onLoad={onMediaLoad}
          />
          {hovered ? <EcomVideoHoverPreview src={src} /> : null}
        </>
      ) : (
        <EcomVideoThumb
          src={src}
          className="pointer-events-none"
          onLoadedData={onMediaLoad}
        />
      )
    ) : null;

  return (
    <div
      ref={ref}
      className={cn(
        "group relative overflow-hidden rounded-lg border border-[#e8e8ed] bg-[#f5f5f7]",
        aspectClass,
        selectable && "cursor-pointer",
        selected && "ring-2 ring-[#0071e3] ring-offset-1",
        className,
      )}
      onMouseEnter={videoPosterSrc ? () => setHovered(true) : undefined}
      onMouseLeave={videoPosterSrc ? () => setHovered(false) : undefined}
      onClick={selectable ? onSelect : undefined}
      onKeyDown={
        selectable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect?.();
              }
            }
          : undefined
      }
      role={selectable ? "button" : undefined}
      tabIndex={selectable ? 0 : undefined}
    >
      {showSkeleton ? (
        <div className="ecom-skeleton absolute inset-0" aria-hidden />
      ) : null}
      {body}

      {selected ? (
        <span className="absolute right-1 top-1 z-10 grid h-5 w-5 place-items-center rounded-full bg-[#0071e3] text-white">
          <Check className="h-3 w-3" strokeWidth={3} />
        </span>
      ) : null}

      <div
        className={cn(
          "absolute inset-0 z-[1] flex items-center justify-center gap-2",
          "bg-black/0 opacity-0 transition duration-150",
          "group-hover:bg-black/45 group-hover:opacity-100",
          "group-focus-within:bg-black/45 group-focus-within:opacity-100",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className={HOVER_BTN}
          aria-label="预览"
          title="预览"
          onClick={onPreview}
        >
          <Eye className="h-4 w-4" />
        </button>
        {onDownload ? (
          <button
            type="button"
            className={HOVER_BTN}
            aria-label="下载"
            title="下载"
            onClick={onDownload}
          >
            <Download className="h-4 w-4" />
          </button>
        ) : null}
        {onPinToAiSpace ? (
          <button
            type="button"
            className={cn(HOVER_BTN, pinnedToAiSpace && "text-[#0071e3]")}
            aria-label={pinnedToAiSpace ? "已展示到 AI 空间" : "展示到 AI 空间"}
            title={pinnedToAiSpace ? "已展示到 AI 空间" : "展示到 AI 空间"}
            onClick={onPinToAiSpace}
          >
            <Sparkles className="h-4 w-4" />
          </button>
        ) : null}
        {onDelete ? (
          <button
            type="button"
            className={cn(HOVER_BTN, "text-red-600 hover:bg-red-50")}
            aria-label="删除"
            title="删除"
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
