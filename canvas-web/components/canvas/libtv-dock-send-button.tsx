"use client";

import { ArrowUp, Loader2 } from "lucide-react";
import { flushCanvasTextDrafts } from "@/lib/canvas/flush-text-drafts";
import { LIBTV_INPUT_DOCK_SEND_BTN_CLASS } from "@/lib/canvas/libtv-node-chrome";
import { useLibtvDockToolbarMetrics } from "@/lib/canvas/use-libtv-dock-toolbar-metrics";
import { cn } from "@/lib/utils";

/** Dock 底栏 · 发送/生成钮（emerald 正圆 · 与画布磁吸 Dock 上传图标同色） */
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
          LIBTV_INPUT_DOCK_SEND_BTN_CLASS,
          "relative z-10 touch-manipulation",
          faded && "opacity-40",
          loading ? "cursor-wait" : disabled ? "cursor-not-allowed" : "",
          "before:absolute before:-inset-3 before:rounded-full before:content-['']",
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
