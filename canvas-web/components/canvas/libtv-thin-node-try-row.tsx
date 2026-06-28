"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** 薄卡空态 · 可点击功能行（hover 高亮，与 LibTV 设计稿一致） */
export const LIBTV_TRY_ACTION_ROW_CLASS =
  "nodrag flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] text-white/85 transition-colors hover:bg-white/10 active:bg-white/[0.14]";

/** 薄卡空态 · 说明行（轻微 hover 提示可读） */
export const LIBTV_TRY_HINT_ROW_CLASS =
  "flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] text-white/55 transition-colors hover:bg-white/[0.06]";

/** 节点 stage 空白区 · 整卡可拖（勿加 nodrag） */
export const LIBTV_NODE_STAGE_DRAG_CLASS =
  "min-h-0 flex-1 cursor-grab active:cursor-grabbing";

export function LibtvTryActionRow({
  icon: Icon,
  label,
  onClick,
  disabled,
  className,
}: {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        LIBTV_TRY_ACTION_ROW_CLASS,
        disabled && "cursor-not-allowed opacity-45 hover:bg-transparent",
        className,
      )}
      onClick={onClick}
    >
      <Icon className="size-4 shrink-0 text-white/55" />
      {label}
    </button>
  );
}

export function LibtvTryHintRow({
  icon: Icon,
  label,
  className,
}: {
  icon: LucideIcon;
  label: string;
  className?: string;
}) {
  return (
    <span className={cn(LIBTV_TRY_HINT_ROW_CLASS, className)}>
      <Icon className="size-4 shrink-0 text-white/45" />
      {label}
    </span>
  );
}
