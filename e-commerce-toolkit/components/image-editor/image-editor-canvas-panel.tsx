"use client";

import { Link2 } from "lucide-react";

import { formatImageEditorPresetPixels } from "@/lib/image-editor-presets";
import { cn } from "@/lib/utils";

type Props = {
  width: number;
  height: number;
  lockAspect: boolean;
  disabled?: boolean;
  onWidth: (v: number) => void;
  onHeight: (v: number) => void;
  onToggleLock: () => void;
};

export function ImageEditorCanvasPanel({
  width,
  height,
  lockAspect,
  disabled,
  onWidth,
  onHeight,
  onToggleLock,
}: Props) {
  return (
    <aside className="flex w-[min(100%,280px)] shrink-0 flex-col gap-3 border-[var(--ie-border-soft)] bg-[var(--ie-cream)] p-3 lg:w-[252px] lg:rounded-xl lg:border">
      <div>
        <p className="text-[12px] font-semibold text-[var(--ie-ink)]">画布</p>
        <p className="mt-0.5 text-[10px] text-[var(--ie-subtle)]">输出尺寸，左侧编辑依此画布比例</p>
      </div>

      <div className="space-y-2">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] text-[var(--ie-subtle)]">图片尺寸 · 宽</span>
          <input
            type="number"
            min={1}
            max={8192}
            disabled={disabled}
            value={width}
            className="rounded-lg border border-[var(--ie-border-soft)] bg-[var(--ie-cream)] px-2 py-1.5 text-[12px] text-[var(--ie-ink)]"
            onChange={(e) => onWidth(Number(e.target.value) || 1)}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] text-[var(--ie-subtle)]">图片尺寸 · 高</span>
          <input
            type="number"
            min={1}
            max={8192}
            disabled={disabled}
            value={height}
            className="rounded-lg border border-[var(--ie-border-soft)] bg-[var(--ie-cream)] px-2 py-1.5 text-[12px] text-[var(--ie-ink)]"
            onChange={(e) => onHeight(Number(e.target.value) || 1)}
          />
        </label>
        <button
          type="button"
          disabled={disabled}
          title={lockAspect ? "解锁比例" : "锁定比例"}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-[11px]",
            lockAspect
              ? "border-[var(--ie-border)] bg-[var(--ie-cream-muted)] text-[var(--ie-ink)]"
              : "border-[var(--ie-border-soft)] text-[var(--ie-muted)]",
          )}
          onClick={onToggleLock}
        >
          <Link2 className="h-3.5 w-3.5" aria-hidden />
          {lockAspect ? "已锁定画布比例" : "锁定画布比例"}
        </button>
        <p className="text-[10px] text-[var(--ie-subtle)]">{formatImageEditorPresetPixels(width, height)}</p>
      </div>
    </aside>
  );
}