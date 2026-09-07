"use client";

import { Palette } from "lucide-react";

import { cn } from "@/lib/utils";

/** 门户 / 列表悬停加载 · 仅品牌 logo 转圈，不用扫光 */
export function CanvasBrandLoadingLogo({
  className,
  iconClassName,
  size = "md",
}: {
  className?: string;
  iconClassName?: string;
  size?: "sm" | "md" | "lg";
}) {
  const box =
    size === "sm" ? "size-8" : size === "lg" ? "size-12" : "size-10";
  const icon =
    size === "sm" ? "size-4" : size === "lg" ? "size-6" : "size-5";

  return (
    <div
      className={cn("flex items-center justify-center", className)}
      role="status"
      aria-label="加载中"
    >
      <span
        className={cn(
          "flex items-center justify-center rounded-md border border-white/15 bg-gradient-to-br from-[var(--canvas-accent)]/30 to-transparent",
          box,
        )}
      >
        <Palette
          className={cn(
            "animate-spin text-[var(--canvas-accent)]",
            icon,
            iconClassName,
          )}
          strokeWidth={2}
        />
      </span>
    </div>
  );
}
