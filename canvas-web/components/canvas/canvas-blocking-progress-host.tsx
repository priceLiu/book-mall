"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CanvasBrandLoadingLogo } from "@/components/home/canvas-brand-loading-logo";
import { useCanvasBlockingProgressStore } from "@/lib/canvas/canvas-blocking-progress";

/** 阻断式进度层：进行中禁止点画布 / 键盘操作，完成后由调用方关闭 */
export function CanvasBlockingProgressHost() {
  const progress = useCanvasBlockingProgressStore((s) => s.progress);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!progress) return;
    const block = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener("keydown", block, true);
    return () => window.removeEventListener("keydown", block, true);
  }, [progress]);

  if (!mounted || !progress) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[1700] flex items-center justify-center bg-black/55 backdrop-blur-[2px]"
      role="alertdialog"
      aria-modal="true"
      aria-busy="true"
      aria-label={progress.title}
      onPointerDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="flex min-w-[280px] flex-col items-center gap-3 rounded-2xl border border-white/10 bg-[#141418] px-8 py-6 text-center shadow-2xl">
        <CanvasBrandLoadingLogo size="sm" />
        <p className="text-sm font-medium text-zinc-100">{progress.title}</p>
        {progress.message ? (
          <p className="text-xs text-zinc-400">{progress.message}</p>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
