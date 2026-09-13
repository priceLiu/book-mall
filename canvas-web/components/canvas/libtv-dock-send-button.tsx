"use client";

import { ArrowUp } from "lucide-react";
import { flushCanvasTextDrafts } from "@/lib/canvas/flush-text-drafts";
import {
  LIBTV_DOCK_SEND_ARROW_STROKE,
  libtvDockSendButtonClass,
  libtvDockSendButtonStyle,
} from "@/lib/canvas/libtv-node-chrome";
import { useLibtvDockToolbarMetrics } from "@/lib/canvas/use-libtv-dock-toolbar-metrics";
import { cn } from "@/lib/utils";

/** Dock 底栏 · 发送/生成钮（空=白 · 有内容=绿 · 生成中=琥珀+停止方块） */
export function LibtvDockSendButton({
  disabled,
  loading,
  hasContent = false,
  title,
  stopTitle = "中止生成",
  onClick,
  onStop,
  className,
  sizePx,
  iconPx,
}: {
  disabled?: boolean;
  loading?: boolean;
  hasContent?: boolean;
  title: string;
  stopTitle?: string;
  onClick: () => void;
  /** 生成中点击 · 中止（替代节点右上角 X） */
  onStop?: () => void;
  className?: string;
  sizePx?: number;
  iconPx?: number;
}) {
  const { sendBtnPx, sendIconPx } = useLibtvDockToolbarMetrics();
  const btnPx = sizePx ?? sendBtnPx;
  const arrowPx = iconPx ?? sendIconPx;
  const btnColors = libtvDockSendButtonStyle({ loading, hasContent });
  const stoppable = Boolean(loading && onStop);
  const displayTitle = stoppable ? stopTitle : title;

  const activate = () => {
    if (loading) {
      if (onStop) onStop();
      return;
    }
    if (disabled) return;
    flushCanvasTextDrafts();
    onClick();
  };

  /** 停止方块 · 相对圆形钮直径约 38%（与箭头视觉重量接近） */
  const stopSquarePx = Math.max(12, Math.round(btnPx * 0.38));

  return (
    <span className="relative -m-2 inline-flex shrink-0 p-2">
      <button
        type="button"
        aria-disabled={!stoppable && (disabled || loading)}
        title={displayTitle}
        data-libtv-dock-interactive=""
        className={cn(
          libtvDockSendButtonClass({
            loading,
            hasContent,
            disabled: !stoppable && disabled,
          }),
          "relative z-10",
          stoppable && "cursor-pointer",
          "before:absolute before:-inset-3 before:rounded-full before:content-['']",
          className,
        )}
        style={{
          width: btnPx,
          height: btnPx,
          backgroundColor: btnColors.backgroundColor,
          color: btnColors.color,
        }}
        onMouseDown={(e) => {
          if (e.button !== 0) return;
          e.stopPropagation();
          if (stoppable) return;
          if (!loading && !disabled) flushCanvasTextDrafts();
        }}
        onClick={(e) => {
          e.stopPropagation();
          activate();
        }}
      >
        {loading ? (
          <span
            className="block shrink-0 rounded-[3px] bg-black"
            style={{ width: stopSquarePx, height: stopSquarePx }}
            aria-hidden
          />
        ) : (
          <ArrowUp
            strokeWidth={LIBTV_DOCK_SEND_ARROW_STROKE}
            style={{ width: arrowPx, height: arrowPx }}
          />
        )}
      </button>
    </span>
  );
}
