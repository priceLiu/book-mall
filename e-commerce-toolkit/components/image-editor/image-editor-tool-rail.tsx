"use client";

import {
  Boxes,
  CircleDashed,
  Eraser,
  Plus,
  SlidersHorizontal,
  Sparkles,
  Type,
  UserRound,
  Wand2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { ImageEditorToolId } from "@/lib/image-editor-types";
import { cn } from "@/lib/utils";

/** 与美图设计室左轨顺序、命名对齐 */
const TOOLS: Array<{ id: ImageEditorToolId; label: string; icon: LucideIcon }> = [
  { id: "add", label: "添加", icon: Plus },
  { id: "adjust", label: "调整", icon: SlidersHorizontal },
  { id: "text", label: "文字", icon: Type },
  { id: "erase", label: "消除笔", icon: Eraser },
  { id: "cutout", label: "抠图", icon: CircleDashed },
  { id: "hd", label: "变清晰", icon: Sparkles },
  { id: "color", label: "调色", icon: Wand2 },
  { id: "assets", label: "我的", icon: UserRound },
  { id: "more", label: "更多", icon: Boxes },
];

type Props = {
  active: ImageEditorToolId;
  disabled?: boolean;
  onSelect: (id: ImageEditorToolId) => void;
};

export function ImageEditorToolRail({ active, disabled, onSelect }: Props) {
  return (
    <nav
      className="flex w-[72px] shrink-0 flex-col items-center gap-0.5 border-r border-[var(--ie-border-soft)] bg-[var(--ie-cream)] py-2"
      aria-label="图片编辑工具"
    >
      {TOOLS.map((tool) => {
        const Icon = tool.icon;
        const selected = active === tool.id;
        return (
          <button
            key={tool.id}
            type="button"
            disabled={disabled}
            title={tool.label}
            className={cn(
              "flex w-[60px] flex-col items-center gap-1 rounded-lg px-1 py-2 text-[10px] transition-colors",
              disabled
                ? "text-[var(--ie-muted)] opacity-40"
                : selected
                  ? "bg-[var(--ie-cream-muted)] font-semibold text-[var(--ie-ink)] ring-1 ring-[var(--ie-border)]"
                  : "text-[var(--ie-muted)] hover:bg-[var(--ie-cream-muted)] hover:text-[var(--ie-ink)]",
            )}
            onClick={() => onSelect(tool.id)}
          >
            <Icon className="h-[22px] w-[22px] shrink-0 stroke-[1.5]" aria-hidden />
            <span className="leading-none">{tool.label}</span>
          </button>
        );
      })}
    </nav>
  );
}