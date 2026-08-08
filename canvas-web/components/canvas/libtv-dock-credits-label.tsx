"use client";

import { cn } from "@/lib/utils";

/** 生成 Dock · 积分预估（生成钮左侧：≈ N积分 · 柠檬黄） */
export function LibtvDockCreditsLabel({
  credits,
  title,
  fontPx,
  className,
}: {
  credits: number | null | undefined;
  title?: string;
  fontPx?: number;
  className?: string;
}) {
  if (credits == null || !Number.isFinite(credits)) return null;
  const rounded = Math.max(0, Math.round(credits));
  return (
    <span
      className={cn(
        "nodrag shrink-0 whitespace-nowrap tabular-nums text-yellow-300",
        className,
      )}
      style={fontPx != null ? { fontSize: fontPx } : undefined}
      title={title}
    >
      ≈ {rounded}积分
    </span>
  );
}
