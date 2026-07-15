"use client";

import { LayoutTemplate } from "lucide-react";

import { cn } from "@/lib/utils";

/** 无 OSS 快照时的静态占位（禁止挂载 live React Flow） */
export function TemplateSnapshotPlaceholder({
  className,
  heightClass = "h-40",
  label = "工作流预览",
}: {
  className?: string;
  heightClass?: string;
  label?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-black/50",
        heightClass,
        className,
      )}
    >
      <LayoutTemplate className="size-7 text-white/25" strokeWidth={1.5} />
      <span className="px-3 text-center text-[10px] text-white/35">{label}</span>
    </div>
  );
}
