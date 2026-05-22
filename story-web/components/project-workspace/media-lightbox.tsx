"use client";

import { useEffect } from "react";
import Image from "next/image";
import { X } from "lucide-react";
import { ModalPortal } from "@/components/common/modal-portal";

type MediaLightboxProps = {
  open: boolean;
  /** image: 全屏预览图片；video: 全屏播放视频 */
  kind: "image" | "video";
  src?: string | null;
  /** 视频预览：可选 poster（一般用本帧的分镜图） */
  poster?: string | null;
  alt?: string;
  /** 顶部小标签，展示分镜编号或角色名 */
  caption?: string;
  onClose: () => void;
};

/**
 * 全屏媒体预览：黑底 + 居中内容；点击背景或按 Esc 关闭。
 * - image: <Image fill objectFit="contain" />
 * - video: <video controls autoPlay />；含 poster 时先显示首帧
 */
export function MediaLightbox({
  open,
  kind,
  src,
  poster,
  alt,
  caption,
  onClose,
}: MediaLightboxProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open || !src) return null;

  return (
    <ModalPortal>
    <div
      className="fixed inset-0 z-[105] flex flex-col items-center justify-center bg-black/95 p-6"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full border border-white/20 bg-black/40 px-3 py-1.5 text-xs text-white/90 transition hover:bg-white/10"
        aria-label="关闭预览"
      >
        <X className="size-4" />
        关闭 (Esc)
      </button>

      {caption ? (
        <p className="absolute left-4 top-4 max-w-[60vw] truncate rounded-md bg-black/40 px-3 py-1.5 text-xs text-white/85">
          {caption}
        </p>
      ) : null}

      <div
        className="relative flex h-[88vh] w-[88vw] items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {kind === "image" ? (
          <Image
            src={src}
            alt={alt ?? ""}
            fill
            sizes="88vw"
            className="select-none object-contain"
            unoptimized
            priority
          />
        ) : (
          <video
            src={src}
            poster={poster ?? undefined}
            className="max-h-full max-w-full select-none rounded-md object-contain"
            controls
            autoPlay
            playsInline
          />
        )}
      </div>
    </div>
    </ModalPortal>
  );
}
