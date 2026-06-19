"use client";

import { Check, Eye, Loader2 } from "lucide-react";

/** LibTV 图片节点 · 标题栏右上角预览（替代 Stage 居中 Eye） */
export function LibtvNodeHeaderPreviewButton({
  visible,
  onClick,
}: {
  visible: boolean;
  onClick: () => void;
}) {
  if (!visible) return null;
  return (
    <button
      type="button"
      className="nodrag flex size-7 shrink-0 items-center justify-center rounded-md text-white/55 transition hover:bg-white/10 hover:text-white/90"
      title="预览大图"
      aria-label="预览大图"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <Eye className="size-3.5" strokeWidth={1.75} />
    </button>
  );
}

/** 标题栏右上角 · 已入库勾 + 预览 Eye */
export function LibtvNodeHeaderActions({
  portraitActive,
  portraitImporting,
  showPreview,
  onPreview,
}: {
  portraitActive?: boolean;
  portraitImporting?: boolean;
  showPreview: boolean;
  onPreview: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      {portraitImporting ? (
        <span
          className="flex size-7 items-center justify-center"
          title="私域人像入库中…"
        >
          <Loader2 className="size-3.5 animate-spin text-cyan-300/90" />
        </span>
      ) : portraitActive ? (
        <span
          className="flex size-7 items-center justify-center"
          title="已入库 · 生视频将引用 asset://"
          aria-label="已入库"
        >
          <Check className="size-3.5 text-emerald-400" strokeWidth={2.5} />
        </span>
      ) : null}
      <LibtvNodeHeaderPreviewButton visible={showPreview} onClick={onPreview} />
    </div>
  );
}
