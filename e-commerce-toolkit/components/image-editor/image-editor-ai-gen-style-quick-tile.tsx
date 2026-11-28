"use client";

import { Check } from "lucide-react";

import { ImageEditorAiGenStyleThumb } from "@/components/image-editor/image-editor-ai-gen-style-thumb";
import type { AiGenStyleModel } from "@/lib/image-editor-ai-gen-style-models";
import { cn } from "@/lib/utils";

type Props = {
  model: AiGenStyleModel;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
};

export function ImageEditorAiGenStyleQuickTile({ model, selected, disabled, onSelect }: Props) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        "relative aspect-square w-full overflow-hidden rounded-lg border text-left disabled:opacity-50",
        selected ? "border-[#0071e3] ring-1 ring-[#0071e3]/35" : "border-[var(--ie-border-soft)]",
      )}
      onClick={onSelect}
    >
      <ImageEditorAiGenStyleThumb model={model} shape="square" className="absolute inset-0 h-full w-full" />
      <span
        className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 via-black/30 to-transparent px-1 pb-1.5 pt-6 text-center text-[11px] font-medium leading-tight text-white"
        aria-hidden
      >
        {model.label}
      </span>
      {selected ? (
        <span className="absolute right-1 top-1 grid h-4 w-4 place-items-center rounded-full bg-[#0071e3] text-white shadow-sm">
          <Check className="h-2.5 w-2.5" aria-hidden />
        </span>
      ) : null}
    </button>
  );
}