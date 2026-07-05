"use client";

import { ArrowUp, Loader2 } from "lucide-react";
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

  return (
    <button
      type="button"
      disabled={disabled || loading}
      title={title}
      className={cn(
        "nodrag flex shrink-0 items-center justify-center rounded-xl bg-white text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40",
        className,
      )}
      style={{ width: sendBtnPx, height: sendBtnPx }}
      onClick={onClick}
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
  );
}
