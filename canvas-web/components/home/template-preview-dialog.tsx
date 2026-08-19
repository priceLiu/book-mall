"use client";

import { Copy, Loader2, X } from "lucide-react";

import { CanvasListCover } from "@/components/canvas/canvas-list-cover";
import type { CanvasGraph } from "@/lib/canvas/types";

type Props = {
  name: string;
  description?: string;
  thumbnailUrl?: string | null;
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
  graph,
  onClose,
  onCopy,
  copying,
}: Props) {
  return (
    <div
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal
      aria-label={`预览：${name}`}
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[var(--canvas-surface)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">{name}</p>
            {description ? (
              <p className="truncate text-xs text-white/45">{description}</p>
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
              className="rounded-lg p-1.5 text-white/60 transition hover:bg-white/8 hover:text-white"
              aria-label="关闭"
              onClick={onClose}
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4">
          <CanvasListCover
            url={thumbnailUrl}
            name={name}
            graph={graph}
            className="w-full"
          />
        </div>
      </div>
    </div>
  );
}
