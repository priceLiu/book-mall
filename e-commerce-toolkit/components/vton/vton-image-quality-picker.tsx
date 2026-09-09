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
      <span className="text-[10px] font-medium text-[#86868b]">质量</span>
      <div className="inline-flex rounded-lg border border-[#e8e8ed] bg-[#f5f5f7] p-0.5">
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
                  ? "bg-white text-[#1d1d1f] shadow-sm"
                  : "text-[#6e6e73] hover:text-[#1d1d1f]",
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
