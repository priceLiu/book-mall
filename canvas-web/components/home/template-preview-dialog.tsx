"use client";

import { createPortal } from "react-dom";
import { Copy, Loader2, X } from "lucide-react";

import { CanvasListCover } from "@/components/canvas/canvas-list-cover";
import type { CanvasGraph } from "@/lib/canvas/types";
import {
  PORTAL_PREVIEW_MODAL_BACKDROP_CLASS,
  useClientPortalMounted,
  useModalBodyScrollLock,
  useModalEscapeClose,
} from "@/lib/canvas/use-modal-portal-effects";

type Props = {
  name: string;
  description?: string;
  thumbnailUrl?: string | null;
  mediaKind?: "image" | "video";
  posterUrl?: string;
  graph?: CanvasGraph;
  onClose: () => void;
  onCopy?: () => void;
  copying?: boolean;
};

/** 门户首页 · 模板/案例预览：放大版 CanvasListCover（与「我的画布」一致） */
export function TemplatePreviewDialog({
  name,
  description,
  thumbnailUrl,
  mediaKind,
  posterUrl,
  graph,
  onClose,
  onCopy,
  copying,
}: Props) {
  const mounted = useClientPortalMounted();
  useModalBodyScrollLock(true);
  useModalEscapeClose(onClose);

  if (!mounted) return null;

  return createPortal(
    <div
      className={PORTAL_PREVIEW_MODAL_BACKDROP_CLASS}
      role="dialog"
      aria-modal
      aria-label={`预览：${name}`}
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-1 pb-3 pt-1">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">{name}</p>
            {description ? (
              <p className="truncate text-xs text-white/55">{description}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {onCopy ? (
              <button
                type="button"
                disabled={copying}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--canvas-accent)]/40 bg-[var(--canvas-accent)]/15 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[var(--canvas-accent)]/25 disabled:opacity-50"
                onClick={onCopy}
              >
                {copying ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Copy className="size-3.5" />
                )}
                复制到我的画布
              </button>
            ) : null}
            <button
              type="button"
              className="rounded-lg p-1.5 text-white/70 transition hover:bg-white/10 hover:text-white"
              aria-label="关闭"
              onClick={onClose}
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          {mediaKind === "video" && thumbnailUrl?.trim() ? (
            <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
              <video
                src={thumbnailUrl}
                poster={posterUrl?.trim() || undefined}
                className="size-full object-contain"
                controls
                autoPlay
                muted
                playsInline
                loop
                preload="metadata"
              />
            </div>
          ) : (
            <CanvasListCover
              url={thumbnailUrl}
              name={name}
              graph={graph}
              className="w-full border-0"
              disableEnlargePreview
            />
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
