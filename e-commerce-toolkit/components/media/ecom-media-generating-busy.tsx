"use client";

import { RefreshCw } from "lucide-react";

import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  /** 留空则仅扫光 + 旋转图标，不显示文字 */
  label?: string;
  /**
   * overlay：半透明黑底（叠在已有图上，默认）
   * black：纯黑底 + 可见扫光（故事版成片 / 分镜生成）
   */
  background?: "overlay" | "black";
};

/**
 * 电商工具箱 · 媒体生成中（扫光 + 中央 RefreshCw），与画布 LibtvMediaGeneratingState 一致。
 * 扫光类 `.ecom-media-generating-sweep` 自带 `position: relative`，不可与 `absolute inset-0` 同元素混用。
 */
export function EcomMediaGeneratingBusy({
  className,
  label,
  background = "overlay",
}: Props) {
  const solidBlack = background === "black";

  return (
    <div className={cn("absolute inset-0 z-10", solidBlack && "bg-black", className)}>
      <div
        className={cn(
          "relative size-full overflow-hidden ecom-media-generating-sweep",
          solidBlack && "ecom-media-generating-sweep-on-black",
        )}
      >
        <div
          className={cn(
            "absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 px-4 py-8 text-center",
            solidBlack ? "bg-transparent" : "bg-black/45",
          )}
        >
          <span className="flex size-12 items-center justify-center rounded-full border border-[#0071e3]/45 bg-black/55 text-[#2997ff] shadow-lg backdrop-blur-sm sm:size-[3.25rem]">
            <RefreshCw className="h-5 w-5 animate-spin sm:h-6 sm:w-6" />
          </span>
          {label?.trim() ? (
            <span className="text-[11px] font-medium text-white/90">{label}</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
