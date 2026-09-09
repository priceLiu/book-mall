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
   * light：白底半透明 + 蓝色图标（服装池等小格）
   */
  background?: "overlay" | "black" | "light";
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
  const light = background === "light";

  return (
    <div
      className={cn(
        "absolute inset-0 z-10",
        solidBlack && "bg-black",
        light && "bg-[#fafafa]",
        className,
      )}
    >
      <div
        className={cn(
          "relative size-full overflow-hidden ecom-media-generating-sweep",
          solidBlack && "ecom-media-generating-sweep-on-black",
        )}
      >
        <div
          className={cn(
            "absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 px-4 py-8 text-center",
            light && "bg-white/80",
            !light && !solidBlack && "bg-black/45",
            solidBlack && "bg-transparent",
          )}
        >
          <span
            className={cn(
              "flex items-center justify-center rounded-full border shadow-sm",
              light
                ? "size-10 border-[#0071e3]/35 bg-white text-[#0071e3]"
                : "size-12 border-[#0071e3]/45 bg-black/55 text-[#2997ff] shadow-lg backdrop-blur-sm sm:size-[3.25rem]",
            )}
          >
            <RefreshCw className={cn("animate-spin", light ? "h-4 w-4" : "h-5 w-5 sm:h-6 sm:w-6")} />
          </span>
          {label?.trim() ? (
            <span
              className={cn(
                "text-[11px] font-medium",
                light ? "text-[#6e6e73]" : "text-white/90",
              )}
            >
              {label}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
