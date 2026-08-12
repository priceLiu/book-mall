"use client";

import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  label?: string;
};

/** 与微剧故事版 StoryboardPanelCard 一致的卡片内「生成中」态 */
export function EcomMediaGeneratingBusy({ className, label = "生成中…" }: Props) {
  return (
    <div
      className={cn(
        "absolute inset-0 z-10 flex h-full items-center justify-center gap-2 bg-[#f5f5f7] text-sm text-[#6e6e73]",
        className,
      )}
    >
      <Loader2 className="h-5 w-5 animate-spin" />
      {label}
    </div>
  );
}
