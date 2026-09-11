"use client";

import { ProductDesignPromptMentionTextarea } from "@/components/product-design/product-design-prompt-mention-textarea";
import { OutfitEditableCell } from "@/components/outfit-video/outfit-editable-cell";
import type { EcomPromptImageRef } from "@/lib/ecom-prompt-mention";
import { cn } from "@/lib/utils";

const MENTION_CELL_CLASS =
  "min-w-[9rem] max-w-[20rem] rounded-md border border-transparent bg-transparent px-1 py-0.5 text-xs leading-relaxed hover:border-[#e8e8ed] focus-within:border-[#0071e3] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#0071e3]/15";

type Props = {
  value: string;
  mentionRefs: EcomPromptImageRef[];
  disabled?: boolean;
  placeholder?: string;
  minRows?: number;
  onChange: (value: string) => void;
  className?: string;
};

export function OutfitEditableMentionCell({
  value,
  mentionRefs,
  disabled,
  placeholder,
  minRows = 2,
  onChange,
  className,
}: Props) {
  if (mentionRefs.length === 0) {
    return (
      <OutfitEditableCell
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        minRows={minRows}
        onChange={onChange}
        className={className}
      />
    );
  }

  const minHeightClass = minRows >= 3 ? "min-h-[4.5rem]" : "min-h-[3rem]";

  return (
    <ProductDesignPromptMentionTextarea
      value={value}
      referenceImages={mentionRefs}
      disabled={disabled}
      hideQuickInsert
      showTopRefBar={false}
      mentionBadgeVariant="top-bar-bound"
      minHeightClass={minHeightClass}
      className={cn(MENTION_CELL_CLASS, disabled && "opacity-50", className)}
      onChange={onChange}
    />
  );
}
