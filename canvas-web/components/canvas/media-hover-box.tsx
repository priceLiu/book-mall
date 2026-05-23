"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Eye, Upload, X } from "lucide-react";

/** 根据 URL 猜测是否为视频 */
export function isVideoMediaUrl(url: string): boolean {
  return /\.(mp4|webm|mov|m4v|avi)(\?|#|$)/i.test(url);
}

export type MediaHoverBoxProps = {
  /** 媒体地址；空则显示 placeholder */
  src?: string;
  /** 显式指定类型；缺省则按 URL 后缀推断 */
  mediaKind?: "image" | "video";
  /**
   * uploadable：用户上传区（hover 显示 上传 + 预览）
   * generated：生成结果（hover 仅 预览）
   */
  variant?: "uploadable" | "generated";
  onUpload?: () => void;
  alt?: string;
  className?: string;
  /** 无 src 时的占位 */
  placeholder?: ReactNode;
  /** img object-fit */
  fit?: "cover" | "contain";
};

/**
 * 画布内图片 / 视频预览区：鼠标移入显示操作 logo。
 * - 图片（可上传）：上传 + 预览
 * - 图片 / 视频（生成结果）：仅预览
 */
export function MediaHoverBox({
  src,
  mediaKind,
  variant = "generated",
  onUpload,
  alt = "media",
  className = "",
  placeholder,
  fit = "contain",
}: MediaHoverBoxProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const kind =
    mediaKind ?? (src && isVideoMediaUrl(src) ? "video" : "image");
  const canPreview = !!src;
  const showUpload = variant === "uploadable" && !!onUpload;

  const openPreview = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (canPreview) setPreviewOpen(true);
    },
    [canPreview],
  );

  const triggerUpload = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onUpload?.();
    },
    [onUpload],
  );

  return (
    <>
      <div
        className={`group/media relative h-full w-full overflow-hidden ${className}`}
      >
        {src ? (
          kind === "video" ? (
            <video
              src={src}
              className={
                fit === "cover"
                  ? "h-full w-full object-cover"
                  : "h-full w-full object-contain"
              }
              muted
              playsInline
              preload="metadata"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={alt}
              className={
                fit === "cover"
                  ? "h-full w-full object-cover"
                  : "h-full w-full object-contain"
              }
              draggable={false}
            />
          )
        ) : (
          placeholder
        )}

        {(showUpload || canPreview) && src ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 bg-black/0 opacity-0 transition group-hover/media:bg-black/45 group-hover/media:opacity-100">
            {showUpload ? (
              <button
                type="button"
                title="上传 / 替换"
                onClick={triggerUpload}
                className="nodrag pointer-events-auto grid size-9 place-items-center rounded-full border border-white/20 bg-black/70 text-white shadow-lg transition hover:scale-105 hover:border-white/50 hover:bg-black/90"
              >
                <Upload className="size-4" />
              </button>
            ) : null}
            {canPreview ? (
              <button
                type="button"
                title="预览"
                onClick={openPreview}
                className="nodrag pointer-events-auto grid size-9 place-items-center rounded-full border border-white/20 bg-black/70 text-white shadow-lg transition hover:scale-105 hover:border-white/50 hover:bg-black/90"
              >
                <Eye className="size-4" />
              </button>
            ) : null}
          </div>
        ) : null}

        {/* 空态也可点上传 */}
        {!src && showUpload ? (
          <button
            type="button"
            onClick={triggerUpload}
            className="nodrag absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/20 text-[11px] text-white/60 transition hover:bg-black/35 hover:text-white/90"
          >
            <Upload className="size-5" />
            点击上传
          </button>
        ) : null}
      </div>

      {previewOpen && src ? (
        <MediaPreviewLightbox
          src={src}
          kind={kind}
          alt={alt}
          onClose={() => setPreviewOpen(false)}
        />
      ) : null}
    </>
  );
}

/** 全屏预览弹层（可单独用于 chip 等小区域） */
export function MediaPreviewLightbox({
  src,
  kind,
  alt,
  onClose,
}: {
  src: string;
  kind: "image" | "video";
  alt: string;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 grid size-9 place-items-center rounded-full border border-white/20 bg-black/60 text-white hover:bg-black/80"
        aria-label="关闭预览"
      >
        <X className="size-5" />
      </button>
      <div
        className="max-h-[90vh] max-w-[min(92vw,1200px)] overflow-hidden rounded-lg"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {kind === "video" ? (
          <video
            src={src}
            controls
            autoPlay
            className="max-h-[90vh] max-w-full"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={alt}
            className="max-h-[90vh] max-w-full object-contain"
          />
        )}
      </div>
    </div>,
    document.body,
  );
}
