"use client";

import { useEffect, useState } from "react";

import { ProductDesignPromptMentionTextarea } from "@/components/product-design/product-design-prompt-mention-textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EcomDialogPrimaryButton,
} from "@/components/ui/dialog";
import type { EcomPromptImageRef } from "@/lib/ecom-prompt-mention";
import { PRODUCT_DESIGN_PROMPT_MENTION_FIELD_PROPS } from "@/lib/product-design-prompt-mention-ui";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: string;
  onCommit: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  title?: string;
  subtitle?: string;
  /** 传入时在弹窗内使用带缩略图的 @ 引用编辑器（与模特试衣一致） */
  referenceImages?: EcomPromptImageRef[];
  pickerZIndex?: number;
};

/** 生图 Prompt 弹窗编辑（槽位 icon 触发或内联 textarea 双击共用） */
export function ProductDesignPromptDialog({
  open,
  onOpenChange,
  value,
  onCommit,
  disabled,
  placeholder = "生图 Prompt…",
  title = "编辑生图 Prompt",
  subtitle,
  referenceImages,
  pickerZIndex = 6000,
}: Props) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  function handleOpenChange(next: boolean) {
    if (!next && open) {
      if (draft !== value) onCommit(draft);
    }
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-3xl flex-col gap-3">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {subtitle ? <DialogDescription>{subtitle}</DialogDescription> : null}
        </DialogHeader>
        {referenceImages != null ? (
          <ProductDesignPromptMentionTextarea
            value={draft}
            referenceImages={referenceImages}
            disabled={disabled}
            onChange={setDraft}
            minHeightClass="min-h-[40vh]"
            className="text-[13px]"
            pickerZIndex={pickerZIndex}
            {...PRODUCT_DESIGN_PROMPT_MENTION_FIELD_PROPS}
          />
        ) : (
          <textarea
            className="min-h-[50vh] w-full flex-1 resize-y rounded-lg border border-[#e8e8ed] px-3 py-2.5 font-mono text-[13px] leading-relaxed text-[#1d1d1f] focus:border-[#0071e3]/40 focus:outline-none focus:ring-2 focus:ring-[#0071e3]/15 disabled:cursor-not-allowed disabled:bg-[#f5f5f7]"
            value={draft}
            autoFocus
            disabled={disabled}
            placeholder={placeholder}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                handleOpenChange(false);
              }
            }}
          />
        )}
        <DialogFooter>
          <EcomDialogPrimaryButton
            type="button"
            disabled={disabled}
            onClick={() => handleOpenChange(false)}
          >
            完成
          </EcomDialogPrimaryButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
