"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/** LibTV 节点底部 · 可关闭 / 定时收起的错误提示 */
export function LibtvNodeErrorBanner({
  message,
  visible,
  onDismiss,
  className,
}: {
  message: string;
  visible: boolean;
  onDismiss: () => void;
  className?: string;
}) {
  if (!visible || !message.trim()) return null;

  return (
    <div
      className={cn(
        "nodrag shrink-0 border-t border-red-500/20 bg-red-500/10 px-2 py-2",
        className,
      )}
      role="alert"
    >
      <div className="flex items-start gap-2">
        <p
          className="min-w-0 flex-1 text-[11px] leading-relaxed text-red-200"
          title={message}
        >
          {message}
        </p>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDismiss();
          }}
          className="nodrag shrink-0 rounded p-1 text-red-200/70 transition hover:bg-red-500/15 hover:text-red-100"
          aria-label="关闭错误提示"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
