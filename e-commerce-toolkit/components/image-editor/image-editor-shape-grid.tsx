"use client";

import { Ban } from "lucide-react";

import {
  getImageEditorShapeDef,
  IMAGE_EDITOR_SHAPE_MASK_ORDER,
} from "@/lib/image-editor-shape-catalog";
import type { ImageEditorShapeMaskId } from "@/lib/image-editor-shape-catalog";
import { cn } from "@/lib/utils";

type Props = {
  value: ImageEditorShapeMaskId;
  disabled?: boolean;
  onChange: (id: ImageEditorShapeMaskId) => void;
};

function ShapeThumb({ pathD }: { pathD: string | null }) {
  if (!pathD) {
    return (
      <Ban
        className="h-[85%] w-[85%] max-h-full max-w-full text-[var(--ie-muted)]"
        strokeWidth={1.5}
        aria-hidden
      />
    );
  }
  return (
    <svg
      viewBox="0 0 100 100"
      className="h-[85%] w-[85%] max-h-full max-w-full shrink-0 text-[var(--ie-muted)]/75"
      aria-hidden
    >
      <path d={pathD} fill="currentColor" />
    </svg>
  );
}

export function ImageEditorShapeGrid({ value, disabled, onChange }: Props) {
  return (
    <div className="max-h-[min(52vh,300px)] overflow-y-auto ecom-scrollbar-thin pr-0.5">
      <div className="grid grid-cols-3 gap-2">
        {IMAGE_EDITOR_SHAPE_MASK_ORDER.map((id) => {
          const def = getImageEditorShapeDef(id);
          const selected = value === id;
          return (
            <button
              key={id}
              type="button"
              disabled={disabled}
              title={id}
              className={cn(
                "flex aspect-square items-center justify-center rounded-lg border bg-[var(--ie-cream-muted)] transition-colors",
                selected
                  ? "border-[var(--ie-border)] ring-1 ring-[var(--ie-border)]"
                  : "border-[var(--ie-border-soft)] hover:border-[var(--ie-border)]",
                disabled && "opacity-40",
              )}
              onClick={() => onChange(id)}
            >
              <ShapeThumb pathD={def?.pathD ?? null} />
            </button>
          );
        })}
      </div>
    </div>
  );
}