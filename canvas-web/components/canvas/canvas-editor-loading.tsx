"use client";

import { Loader2 } from "lucide-react";

/** 画布编辑器路由 / 重型 chunk 加载占位 */
export function CanvasEditorRouteLoading({
  label = "加载画布…",
}: {
  label?: string;
}) {
  return (
    <div
      className="fixed inset-0 z-[200] flex h-[100dvh] items-center justify-center bg-[var(--canvas-bg)] text-[var(--canvas-muted)]"
      data-canvas-editor
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Loader2 className="mr-2 size-5 animate-spin text-[var(--canvas-accent,#7c6cff)]" />
      {label}
    </div>
  );
}
