"use client";

import { Download, X } from "lucide-react";
import { useEffect } from "react";

import { ModalPortal } from "@/components/common/modal-portal";
import { EcomVideoPlayer } from "@/components/media/ecom-video-player";
import { ECOM_DIALOG_CLOSE_BUTTON_CLASS } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/** 对齐 canvas `StoryMediaPreviewModal`：全屏黑底 lightbox + 自适应视频框 */
export function EcomVideoPreviewDialog({
  src,
  open,
  onOpenChange,
  title = "视频预览",
  poster,
}: {
  src: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  poster?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onOpenChange]);

  if (!open || !src.trim()) return null;

  return (
    <ModalPortal>
      <div
        className="pointer-events-auto fixed inset-0 z-[2000] flex flex-col bg-black/88 backdrop-blur-md"
        style={{ backgroundColor: "rgba(0,0,0,0.88)" }}
        onClick={() => onOpenChange(false)}
      >
        <div
          className="flex shrink-0 items-center justify-between px-4 py-3"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-sm text-white/80">{title}</p>
          <div className="flex items-center gap-2">
            <a
              href={src}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md border border-white/20 px-2.5 py-1 text-[12px] text-white/85 hover:bg-white/10"
            >
              <Download className="size-3.5" />
              下载 mp4
            </a>
            <button
              type="button"
              className={cn(ECOM_DIALOG_CLOSE_BUTTON_CLASS, "static shrink-0")}
              onClick={() => onOpenChange(false)}
              aria-label="关闭"
            >
              <X className="h-4 w-4 stroke-[2.5]" />
            </button>
          </div>
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center p-4">
          <div onClick={(e) => e.stopPropagation()}>
            <EcomVideoPlayer
              src={src}
              poster={poster}
              autoPlay
              adaptiveBackdrop
              frameless
              className="mx-auto"
            />
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
