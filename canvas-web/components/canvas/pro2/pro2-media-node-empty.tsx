"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** 2.0 媒体节点（图片 / 三视图 / 视频）· 统一暗色空状态 */
export function Pro2MediaNodeEmptyState({
  icon: Icon,
  label,
  className,
  /** LibTV 节点空态：整卡可拖，勿加 nodrag */
  passNodeDrag = false,
}: {
  icon: LucideIcon;
  label: string;
  className?: string;
  passNodeDrag?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex h-full min-h-[120px] flex-col items-center justify-center gap-2 px-4 text-center",
        !passNodeDrag && "nodrag",
        className,
      )}
    >
      <Icon className="size-8 text-white/20" strokeWidth={1.5} />
      <span className="text-[11px] text-white/45">{label}</span>
    </div>
  );
}

/** 2.0 媒体节点 · 统一暗色错误态 */
export function Pro2MediaNodeErrorState({
  icon: Icon,
  title,
  message,
  className,
}: {
  icon: LucideIcon;
  title: string;
  message?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "nodrag flex h-full min-h-[120px] flex-col items-center justify-center gap-2 px-4 py-4 text-center",
        className,
      )}
    >
      <Icon className="size-7 text-red-400/90" strokeWidth={1.5} />
      <p className="text-[12px] font-medium text-red-300/95">{title}</p>
      {message ? (
        <p className="max-w-full text-[10px] leading-relaxed text-red-300/70">
          {message}
        </p>
      ) : null}
    </div>
  );
}
