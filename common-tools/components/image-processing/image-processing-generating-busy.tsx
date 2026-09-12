"use client";

import { RefreshCw } from "lucide-react";

import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  /** 留空则仅扫光 + 旋转图标 */
  label?: string;
};

/** 常用工具 · 生图生成中（扫光 + 中央 RefreshCw，对齐电商 ecom-media-generating-sweep） */
export function ImageProcessingGeneratingBusy({ className, label }: Props) {
  return (
    <div className={cn("absolute inset-0 z-10 bg-[#fafafa]", className)}>
      <div className="relative size-full overflow-hidden ct-media-generating-sweep">
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-white/80 px-4 py-8 text-center">
          <span className="flex size-10 items-center justify-center rounded-full border border-[#0071e3]/35 bg-white text-[#0071e3] shadow-sm">
            <RefreshCw className="h-4 w-4 animate-spin" aria-hidden />
          </span>
          {label?.trim() ? (
            <span className="text-[11px] font-medium text-[#6e6e73]">{label}</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
