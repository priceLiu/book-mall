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

  const activate = () => {
    if (loading || disabled) return;
    flushCanvasTextDrafts();
    onClick();
  };

  return (
    // 外层负边距扩大可点区域
    <span className="relative -m-2 inline-flex shrink-0 p-2">
      <button
        type="button"
        aria-disabled={faded}
        title={title}
        data-libtv-dock-interactive=""
        className={cn(
          "nodrag relative z-10 flex shrink-0 touch-manipulation items-center justify-center rounded-xl bg-white text-black transition hover:bg-white/90",
          faded && "opacity-40",
          loading ? "cursor-wait" : disabled ? "cursor-not-allowed" : "",
          "before:absolute before:-inset-3 before:rounded-2xl before:content-['']",
          className,
        )}
        style={{ width: sendBtnPx, height: sendBtnPx }}
        onMouseDown={(e) => {
          if (e.button !== 0) return;
          e.stopPropagation();
          // 须在 blur 提交前 flush；勿 preventDefault，否则配合 Dock footer capture 会吞掉 click
          if (!loading && !disabled) flushCanvasTextDrafts();
        }}
        onClick={(e) => {
          e.stopPropagation();
          activate();
        }}
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
