"use client";

import type { Sbv1DockInputMode } from "@/lib/canvas/sbv1-workspace-types";
import type { Sbv1DockModeChip } from "@/lib/canvas/sbv1-video-model-reference";
import { cn } from "@/lib/utils";

/** 视频 Dock 顶栏 · 按模型点亮的输入模式 chip（文生视频 / 首尾帧 / 图片参考…） */
export function Sbv1VideoDockModeBar({
  chips,
  activeMode,
  disabled,
  onSelect,
  chipFontPx,
  chipMinHeightPx,
}: {
  chips: Sbv1DockModeChip[];
  activeMode: Sbv1DockInputMode;
  disabled?: boolean;
  onSelect: (mode: Sbv1DockInputMode) => void;
  /** 屏上恒定字号（flow px · 已抵消 shell 缩放） */
  chipFontPx?: number;
  /** 屏上恒定 pill 高度（字号缩小后仍保持原高度） */
  chipMinHeightPx?: number;
}) {
  if (!chips.length) return null;

  return (
    <div className="nodrag flex shrink-0 flex-wrap items-center gap-1.5 border-b border-white/[0.06] px-2 py-1.5">
      {chips.map((c) => {
        const active = c.id === activeMode;
        return (
          <button
            key={c.id}
            type="button"
            disabled={disabled}
            style={{
              ...(chipFontPx != null ? { fontSize: chipFontPx } : {}),
              ...(chipMinHeightPx != null
                ? { minHeight: chipMinHeightPx }
                : {}),
            }}
            className={cn(
              "rounded-full border px-2.5 py-1 font-medium leading-tight transition",
              chipFontPx == null && "text-[12px]",
              active
                ? "border-white/35 bg-white/[0.08] text-white"
                : "border-white/10 text-white/70 hover:border-white/20 hover:text-white/90",
              disabled && "cursor-not-allowed opacity-50",
            )}
            onClick={() => onSelect(c.id)}
          >
            {c.label}
          </button>
        );
      })}
    </div>
  );
}
