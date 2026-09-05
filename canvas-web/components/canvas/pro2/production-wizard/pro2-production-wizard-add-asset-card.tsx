"use client";

import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export type Pro2ProductionWizardAddAssetCardProps = {
  onClick: () => void;
  className?: string;
};

/** 向导 · 新增资产占位卡（16:9 · 虚线框 + 新增） */
export function Pro2ProductionWizardAddAssetCard({
  onClick,
  className,
}: Pro2ProductionWizardAddAssetCardProps) {
  return (
    <button
      type="button"
      className={cn(
        "flex min-w-[260px] flex-col overflow-hidden rounded-xl border border-dashed border-white/[0.08] bg-transparent transition",
        "hover:border-white/12 hover:bg-white/[0.03]",
        className,
      )}
      onClick={onClick}
    >
      <div className="relative flex aspect-video w-full items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-white/35 transition group-hover:text-violet-300/70">
          <Plus className="size-8" strokeWidth={1.5} />
          <span className="text-[12px] font-medium">新增</span>
        </div>
      </div>
    </button>
  );
}
