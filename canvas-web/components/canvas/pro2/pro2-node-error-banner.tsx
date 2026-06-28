"use client";

import { AlertTriangle, X } from "lucide-react";

import { cn } from "@/lib/utils";

/** Pro2 薄卡/文本节点 · 内联错误条（不覆盖整卡内容） */
export function Pro2NodeErrorBanner({
  message,
  onDismiss,
  className,
}: {
  message: string;
  onDismiss?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "nodrag shrink-0 flex items-start gap-1.5 border-b border-red-500/25 bg-red-950/45 px-2 py-1.5",
        className,
      )}
    >
      <AlertTriangle className="mt-px size-3.5 shrink-0 text-red-400/90" />
      <p className="min-w-0 flex-1 text-[10px] leading-snug text-red-200/90">
        {message}
      </p>
      {onDismiss ? (
        <button
          type="button"
          className="nodrag shrink-0 rounded p-0.5 text-red-300/50 hover:text-red-200"
          aria-label="关闭错误提示"
          onClick={(e) => {
            e.stopPropagation();
            onDismiss();
          }}
        >
          <X className="size-3" />
        </button>
      ) : null}
    </div>
  );
}
