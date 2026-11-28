"use client";

import { useId, useState } from "react";
import { Info } from "lucide-react";

import { IMAGE_EDITOR_AI_GEN_DISCLAIMER_TEXT } from "@/lib/image-editor-ai-gen-disclaimer";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
};

export function ImageEditorAiGenDisclaimer({ className }: Props) {
  const [open, setOpen] = useState(false);
  const tipId = useId();

  return (
    <div className={cn("relative flex justify-center", className)}>
      <button
        type="button"
        className="relative flex items-center gap-1 rounded-md px-1 py-0.5 text-[10px] text-[var(--ie-muted)] hover:text-[var(--ie-ink)]"
        aria-expanded={open}
        aria-describedby={open ? tipId : undefined}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((v) => !v)}
      >
        <Info className="h-3 w-3 shrink-0" aria-hidden />
        免责声明
        <span
          id={tipId}
          role="tooltip"
          className={cn(
            "pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-[min(320px,calc(100vw-2rem))] -translate-x-1/2 rounded-lg bg-[#353535] px-3 py-2.5 text-left text-[11px] font-normal leading-[1.55] text-white shadow-lg",
            open ? "block" : "hidden",
          )}
        >
          {IMAGE_EDITOR_AI_GEN_DISCLAIMER_TEXT}
          <span
            className="absolute -bottom-1.5 left-1/2 h-0 w-0 -translate-x-1/2 border-x-[6px] border-t-[6px] border-x-transparent border-t-[#353535]"
            aria-hidden
          />
        </span>
      </button>
    </div>
  );
}