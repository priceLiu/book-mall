"use client";

import { Plus } from "lucide-react";

import {
  detailPageAspectClass,
  detailPageCardWidth,
  type EcomDetailPageRatio,
} from "@/lib/detail-page-suite-platform-ratio";
import { cn } from "@/lib/utils";

type Props = {
  displayRatio: EcomDetailPageRatio;
  disabled?: boolean;
  disabledReason?: string;
  onClick: () => void;
};

/** 模块点位格末尾 · 手填提示词新增 */
export function DetailPageSuiteAddSlotCard({
  displayRatio,
  disabled,
  disabledReason,
  onClick,
}: Props) {
  const cardWidth = detailPageCardWidth(displayRatio);

  return (
    <button
      type="button"
      disabled={disabled}
      title={disabled ? disabledReason : "新增点位 · 输入出图提示词"}
      className={cn(
        "group flex shrink-0 flex-col overflow-hidden rounded-xl border border-dashed bg-white text-left shadow-sm transition",
        disabled
          ? "cursor-not-allowed border-[#e8e8ed] opacity-50"
          : "border-[#d2d2d7] hover:border-[#0071e3] hover:bg-[#fafafa]",
      )}
      style={{ width: cardWidth }}
      onClick={onClick}
    >
      <div
        className={cn(
          "flex w-full flex-col items-center justify-center gap-2 bg-[#f5f5f7] text-[#86868b] transition group-hover:bg-[#f0f6ff] group-hover:text-[#0071e3]",
          detailPageAspectClass(displayRatio),
          disabled && "group-hover:bg-[#f5f5f7] group-hover:text-[#86868b]",
        )}
      >
        <span className="flex size-10 items-center justify-center rounded-full border border-current bg-white/80">
          <Plus className="size-5" strokeWidth={2.25} />
        </span>
        <span className="text-xs font-medium">新增点位</span>
      </div>
      <p className="px-3 py-2 text-center text-[10px] leading-relaxed text-[#86868b]">
        点击输入提示词
      </p>
    </button>
  );
}
