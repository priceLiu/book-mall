"use client";

import { cn } from "@/lib/utils";
import type { LibtvImageGridSplitState } from "@/lib/canvas/libtv-image-grid-split";

/** 图片 stage 内 · 宫格切分 overlay（多选 + hover） */
export function LibtvImageGridSplitOverlay({
  split,
  onToggleCell,
}: {
  split: LibtvImageGridSplitState;
  onToggleCell: (cellIndex: number) => void;
}) {
  const total = split.cols * split.rows;

  return (
    <div
      className="nodrag pointer-events-auto absolute inset-0 z-20 grid"
      style={{
        gridTemplateColumns: `repeat(${split.cols}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${split.rows}, minmax(0, 1fr))`,
      }}
    >
      {Array.from({ length: total }, (_, i) => {
        const selected = split.selected.includes(i);
        return (
          <button
            key={i}
            type="button"
            className={cn(
              "relative border border-white/25 transition",
              selected
                ? "bg-sky-400/25 ring-1 ring-inset ring-sky-300/70"
                : "bg-transparent hover:bg-white/[0.12]",
            )}
            aria-pressed={selected}
            onClick={(e) => {
              e.stopPropagation();
              onToggleCell(i);
            }}
          />
        );
      })}
    </div>
  );
}
