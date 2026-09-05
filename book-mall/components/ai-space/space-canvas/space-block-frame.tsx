"use client";

/** 编辑态的块外壳：选中态、拖拽把手、删除 */

import { GripVertical, Trash2 } from "lucide-react";

import type { AiSpaceBlockDto } from "@/lib/ai-space/ai-space-space-types";
import { getSpaceBlockDef } from "@/lib/ai-space/space-blocks/types";
import { SPACE_SIZE_TIERS } from "@/lib/ai-space/space-blocks/size-tiers";
import type { SpaceThemeTokens } from "@/lib/ai-space/space-blocks/theme";
import { cn } from "@/lib/utils";

import { SpaceBlockContent } from "../space-blocks/renderers";

export function SpaceBlockFrame({
  block,
  selected,
  theme,
  accent,
  pageTitle,
  pageBio,
  onSelect,
  onDelete,
}: {
  block: AiSpaceBlockDto;
  selected: boolean;
  theme: SpaceThemeTokens;
  accent: string;
  pageTitle: string;
  pageBio: string;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const def = getSpaceBlockDef(block.blockType);

  return (
    <div
      className={cn(
        "group relative h-full w-full rounded-lg",
        selected ? "ring-2 ring-offset-1" : "ring-1 ring-transparent hover:ring-[#d0d7de]",
      )}
      style={selected ? { boxShadow: `0 0 0 2px ${accent}` } : undefined}
      onMouseDown={onSelect}
    >
      {/* 拖拽把手：RGL 的 dragConfig.handle 只认这个选择器，
          否则块内的滑块、按钮、视频控件都会被当成拖拽起点 */}
      <div
        className={cn(
          "space-drag-handle absolute -top-2.5 left-2 z-10 flex cursor-grab items-center gap-1 rounded border bg-white px-1.5 py-0.5 text-[10px] text-[#656d76] shadow-sm",
          selected ? "opacity-100" : "opacity-0 group-hover:opacity-100",
        )}
        style={{ borderColor: "#d0d7de" }}
      >
        <GripVertical className="h-3 w-3" />
        <span>{def?.label ?? block.blockType}</span>
        <span className="text-[#8c959f]">
          {SPACE_SIZE_TIERS[block.sizeTier].label}
        </span>
      </div>

      <button
        type="button"
        aria-label="删除该块"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className={cn(
          "absolute -top-2.5 right-2 z-10 rounded border border-[#d0d7de] bg-white p-1 text-[#656d76] shadow-sm hover:text-destructive",
          selected ? "opacity-100" : "opacity-0 group-hover:opacity-100",
        )}
      >
        <Trash2 className="h-3 w-3" />
      </button>

      <div className="h-full w-full overflow-hidden">
        <SpaceBlockContent
          block={block}
          readOnly={false}
          theme={theme}
          accent={accent}
          page={{ pageTitle, pageBio }}
        />
      </div>
    </div>
  );
}
