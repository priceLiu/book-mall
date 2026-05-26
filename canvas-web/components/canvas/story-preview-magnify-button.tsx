"use client";

import { Search } from "lucide-react";

import { cn } from "@/lib/utils";

/** 漫剧剧本 · 统一放大镜预览按钮（仅图标） */
export function StoryPreviewMagnifyButton({
  onClick,
  className,
  variant = "onDark",
}: {
  onClick: (e: React.MouseEvent) => void;
  className?: string;
  /** onDark=节点标题栏；onLight=白纸预览区 */
  variant?: "onDark" | "onLight";
}) {
  const activate = (e: React.MouseEvent | React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
  };

  return (
    <button
      type="button"
      title="打开预览"
      aria-label="打开预览"
      className={cn(
        "nodrag nowheel pointer-events-auto inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md border transition",
        variant === "onDark"
          ? "border-[#fb923c]/40 bg-[#fb923c]/15 text-[#fdba74] hover:bg-[#fb923c]/25"
          : "border-neutral-200 bg-white text-[#ea580c] shadow-sm hover:border-[#fb923c]/50 hover:bg-white",
        className,
      )}
      onPointerDown={activate}
      onMouseDown={activate}
      onClick={(e) => {
        activate(e);
        onClick(e);
      }}
    >
      <Search className="size-4 pointer-events-none" strokeWidth={2.25} />
    </button>
  );
}
