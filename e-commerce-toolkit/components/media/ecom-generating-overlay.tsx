"use client";

import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

type Props = {
  label?: string;
  className?: string;
};

/** 电商媒体区生成中扫光遮罩（主图/详情出图、视觉分析等待） */
export function EcomGeneratingOverlay({ label, className }: Props) {
  return (
    <div
      className={cn(
        "absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-black/35 px-3 text-center",
        className,
      )}
    >
      <div className="ecom-media-shimmer absolute inset-0" aria-hidden />
      <Loader2 className="relative z-10 h-6 w-6 animate-spin text-white/90" />
      {label ? (
        <p className="relative z-10 text-[11px] font-medium text-white/95">{label}</p>
      ) : null}
    </div>
  );
}
