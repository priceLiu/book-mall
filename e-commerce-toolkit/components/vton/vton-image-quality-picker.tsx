"use client";

import {
  VTON_MODEL_IMAGE_QUALITY_OPTIONS,
  type VtonModelImageSize,
} from "@/lib/vton-image-quality";
import { cn } from "@/lib/utils";

type Props = {
  value: VtonModelImageSize;
  onChange: (value: VtonModelImageSize) => void;
  disabled?: boolean;
  className?: string;
};

export function VtonImageQualityPicker({ value, onChange, disabled, className }: Props) {
  return (
    <div
      className={cn("inline-flex items-center gap-2", className)}
      role="group"
      aria-label="生成质量"
    >
      <span className="text-[10px] font-medium text-[var(--ecom-subtle)]">质量</span>
      <div className="inline-flex rounded-lg border border-[var(--ecom-divider)] bg-[var(--ecom-parchment)] p-0.5">
        {VTON_MODEL_IMAGE_QUALITY_OPTIONS.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              disabled={disabled}
              aria-pressed={active}
              className={cn(
                "min-w-[2.75rem] rounded-md px-2 py-1 text-[10px] font-medium transition-colors",
                active
                  ? "bg-white text-[var(--ecom-ink)] shadow-sm"
                  : "text-[var(--ecom-muted)] hover:text-[var(--ecom-ink)]",
                disabled && "cursor-not-allowed opacity-50",
              )}
              onClick={() => onChange(opt.value)}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
