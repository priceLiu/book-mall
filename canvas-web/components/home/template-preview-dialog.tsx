"use client";

import { Copy, Loader2 } from "lucide-react";

import { CanvasListCover } from "@/components/canvas/canvas-list-cover";
import { PortalCardIconButton } from "@/components/home/portal-card-icon-button";

type Props = {
  name: string;
  description?: string;
  thumbnailUrl?: string | null;
  onClose: () => void;
  onCopy?: () => void;
  copying?: boolean;
};

/** 门户首页 · 模板预览：放大版 CanvasListCover（与「我的画布」一致） */
export function TemplatePreviewDialog({
  name,
  description,
  thumbnailUrl,
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
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">{name}</p>
            {description ? (
              <p className="truncate text-xs text-white/45">{description}</p>
            ) : null}
          </div>
          <button
            type="button"
            className="shrink-0 rounded-lg px-3 py-1.5 text-xs text-white/60 hover:bg-white/8"
            onClick={onClose}
          >
            关闭
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4">
          <CanvasListCover url={thumbnailUrl} name={name} className="w-full" />
        </div>

        {onCopy ? (
          <div className="flex justify-end gap-2 border-t border-white/10 px-4 py-3">
            <PortalCardIconButton
              title="复制到我的画布"
              aria-label="复制到我的画布"
              disabled={copying}
              onClick={onCopy}
            >
              {copying ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Copy className="size-3.5" />
              )}
            </PortalCardIconButton>
          </div>
        ) : null}
      </div>
    </div>
  );
}
