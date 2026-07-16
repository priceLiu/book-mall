"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/** 浮动 Dock 底栏 · 模型/参数锚点 Popover 容器（z ≥ 1100 · 高于 Dock z-1000） */
export const LIBTV_DOCK_POPOVER_CLASS =
  "nodrag nowheel max-h-[min(420px,70vh)] w-[min(22rem,calc(100vw-24px))] overflow-y-auto rounded-xl border border-white/12 bg-[#1a1a1c] py-2 shadow-2xl";

/** 参数 Popover · 更宽更高，容纳 Gateway schema + 参考模式，尽量避免滚动条 */
export const LIBTV_DOCK_PARAMS_POPOVER_CLASS =
  "nodrag nowheel w-[min(30rem,calc(100vw-20px))] max-h-[min(560px,88vh)] overflow-y-auto rounded-xl border border-white/10 bg-[#1a1a1c] py-2.5 shadow-2xl";

/** Dock 分段钮 · 选中态不用亮白描边，仅背景提亮 */
export function libtvDockSegmentButtonClass(
  active: boolean,
  opts?: { compact?: boolean },
): string {
  return cn(
    "rounded-lg border font-medium transition",
    opts?.compact ? "px-3 py-1.5 text-[12px]" : "px-4 py-2 text-[13px]",
    active
      ? "border-transparent bg-white/[0.10] text-white"
      : "border-transparent bg-white/[0.04] text-white/65 hover:bg-white/[0.07] hover:text-white/85",
  );
}

/** Pro2 / LibTV Dock · 模型列表项（无彩色边框 / hover） */
export function libtvDockModelItemClassName(selected: boolean): string {
  return cn(
    "flex w-full items-center gap-2 rounded-lg border px-2.5 py-2.5 text-left transition",
    selected
      ? "border-white/25 bg-white/[0.06] text-white"
      : "border-transparent text-white/80 hover:border-white/18 hover:bg-white/[0.04]",
  );
}

export const LIBTV_DOCK_PICKER_CHECK_CLASS = "size-4 shrink-0 text-white/55";

/** Dock 参数 Popover · 分段网格（与分镜视频 Dock 一致） */
export function LibtvDockParamGrid({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div>
      <p className="mb-2 px-3 text-[12px] text-white/50">{label}</p>
      <div className="grid grid-cols-3 gap-1.5 px-2">
        {options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            className={cn(
              "relative rounded-lg border px-2 py-2 text-[12px] font-medium transition",
              opt.id === value
                ? "border-transparent bg-white/[0.10] text-white"
                : "border-transparent bg-white/[0.04] text-white/70 hover:bg-white/[0.07]",
            )}
            onClick={() => onChange(opt.id)}
          >
            {opt.label}
            {opt.id === value ? (
              <Check className="absolute right-1 top-1 size-3 text-white/50" />
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}
