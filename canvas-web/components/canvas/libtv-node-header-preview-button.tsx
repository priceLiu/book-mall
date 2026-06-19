"use client";

import { Eye } from "lucide-react";

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
