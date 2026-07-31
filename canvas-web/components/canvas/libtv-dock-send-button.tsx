"use client";

import { ArrowUp, Loader2 } from "lucide-react";
import { flushCanvasTextDrafts } from "@/lib/canvas/flush-text-drafts";
import { useLibtvDockToolbarMetrics } from "@/lib/canvas/use-libtv-dock-toolbar-metrics";
import { cn } from "@/lib/utils";

/** Dock 底栏 · 发送/生成钮（白底箭头） */
export function LibtvDockSendButton({
  disabled,
  loading,
  title,
  onClick,
  className,
}: {
  disabled?: boolean;
  loading?: boolean;
  title: string;
  onClick: () => void;
  className?: string;
}) {
  const { sendBtnPx, sendIconPx } = useLibtvDockToolbarMetrics();
  const faded = Boolean(disabled || loading);

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    if (loading || disabled) return;
    // 在 pointerdown 发送：mousedown preventDefault 会吞掉 click；blur 竞态也会吞 click
    e.preventDefault();
    flushCanvasTextDrafts();
    onClick();
  };

  return (
    // 外层负边距扩大可点区域；capture 先 flush 草稿（disabled 原生钮收不到事件）
    <span
      className="relative -m-2 inline-flex shrink-0 p-2"
      onPointerDownCapture={flushCanvasTextDrafts}
    >
      <button
        type="button"
        aria-disabled={faded}
        title={title}
        className={cn(
          "nodrag relative z-10 flex shrink-0 touch-manipulation items-center justify-center rounded-xl bg-white text-black transition hover:bg-white/90",
          faded && "opacity-40",
          loading ? "cursor-wait" : disabled ? "cursor-not-allowed" : "",
          "before:absolute before:-inset-3 before:rounded-2xl before:content-['']",
          className,
        )}
        style={{ width: sendBtnPx, height: sendBtnPx }}
        onPointerDown={handlePointerDown}
      >
        {loading ? (
          <Loader2
            className="animate-spin"
            style={{ width: sendIconPx, height: sendIconPx }}
          />
        ) : (
          <ArrowUp style={{ width: sendIconPx, height: sendIconPx }} />
        )}
      </button>
    </span>
  );
}
