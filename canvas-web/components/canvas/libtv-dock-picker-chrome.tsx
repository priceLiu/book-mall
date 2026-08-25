"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const LIBTV_DOCK_POPOVER_SHELL =
  "nodrag nowheel max-h-[min(420px,70vh)] overflow-y-auto rounded-xl border border-white/10 bg-[#1a1a1c] py-2 shadow-[0_8px_32px_rgba(0,0,0,0.45)] ring-0 outline-none";

/** 浮动 Dock 底栏 · 模型选择 Popover（较宽，容纳 displayName + modelKey + 类型标签） */
export const LIBTV_DOCK_MODEL_POPOVER_CLASS = `${LIBTV_DOCK_POPOVER_SHELL} w-[min(28rem,calc(100vw-24px))] min-w-[20rem]`;

/** 浮动 Dock 底栏 · 通用锚点 Popover（参数段、高清视频等） */
export const LIBTV_DOCK_POPOVER_CLASS = `${LIBTV_DOCK_POPOVER_SHELL} w-[min(22rem,calc(100vw-24px))]`;

/** 参数 Popover · 更宽更高，容纳 Gateway schema + 参考模式，尽量避免滚动条 */
export const LIBTV_DOCK_PARAMS_POPOVER_CLASS =
  "nodrag nowheel w-[min(30rem,calc(100vw-20px))] max-h-[min(560px,88vh)] overflow-y-auto rounded-xl border border-white/10 bg-[#1a1a1c] py-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.45)] ring-0 outline-none";

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
export function libtvDockModelItemClassName(
  selected: boolean,
  disabled = false,
): string {
  return cn(
    "flex w-full items-center gap-2 rounded-lg border px-2.5 py-2.5 text-left transition",
    disabled
      ? "cursor-not-allowed border-transparent text-white/35 opacity-50"
      : selected
        ? "border-transparent bg-white/[0.10] text-white"
        : "border-transparent text-white/80 hover:bg-white/[0.04]",
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
