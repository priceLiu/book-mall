"use client";

import { useEffect, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";

import { ProductDesignPromptMentionTextarea } from "@/components/product-design/product-design-prompt-mention-textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EcomDialogCloseButton,
  EcomDialogPrimaryButton,
} from "@/components/ui/dialog";
import type { EcomPromptImageRef } from "@/lib/ecom-prompt-mention";
import { PRODUCT_DESIGN_PROMPT_MENTION_FIELD_PROPS } from "@/lib/product-design-prompt-mention-ui";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: string;
  onCommit: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  title?: string;
  subtitle?: string;
  /** 服务端自动追加的风格/基准串摘要（只读提示） */
  systemAppendHint?: string;
  /** 传入时在弹窗内使用带缩略图的 @ 引用编辑器（与模特试衣一致） */
  referenceImages?: EcomPromptImageRef[];
  pickerZIndex?: number;
  /** 与同页其他 Radix Dialog 并存时设为 true，避免 Presence 无限更新 */
  nativeOverlay?: boolean;
};

/** 生图 Prompt 弹窗编辑（槽位 icon 触发或内联 textarea 双击共用） */
export function ProductDesignPromptDialog({
  open,
  onOpenChange,
  value,
  onCommit,
  disabled,
  placeholder = "生图 Prompt…",
  title = "编辑 Prompt",
  subtitle,
  systemAppendHint,
  referenceImages,
  pickerZIndex = 6000,
  nativeOverlay = false,
}: Props) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  useEffect(() => {
    if (!nativeOverlay || !open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  function handleClose() {
    if (draft !== value) onCommit(draft);
    onOpenChange(false);
  }

  function handleOpenChange(next: boolean) {
    if (!next && open) {
      if (draft !== value) onCommit(draft);
    }
    onOpenChange(next);
  }

  const dismissOnBackdrop = (e: MouseEvent) => {
    if (e.target === e.currentTarget) handleClose();
  };

  const hintBlock = systemAppendHint ? (
    <p className="mt-2 rounded-lg bg-[#f5f5f7] px-3 py-2 text-[11px] leading-relaxed text-[#6e6e73]">
      系统将追加：{systemAppendHint}
    </p>
  ) : null;

  const editor =
    referenceImages != null ? (
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
            handleClose();
          }
        }}
      />
    );

  if (nativeOverlay) {
    if (!open || typeof document === "undefined") return null;
    return createPortal(
      <div
        className="fixed inset-0 z-[300] flex items-center justify-center bg-black/45 p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-design-prompt-title"
        onClick={dismissOnBackdrop}
      >
        <div
          className={cn(
            "relative flex max-h-[85vh] w-full max-w-3xl flex-col gap-3 overflow-hidden rounded-2xl bg-white p-6 shadow-2xl",
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <EcomDialogCloseButton onClick={() => handleClose()} />
          <div className="space-y-1.5 pr-8">
            <h2
              id="product-design-prompt-title"
              className="text-lg font-semibold leading-none tracking-tight text-[#1d1d1f]"
            >
              {title}
            </h2>
            {subtitle ? (
              <p className="text-sm text-[#6e6e73]">{subtitle}</p>
            ) : null}
            {hintBlock}
          </div>
          {editor}
          <div className="flex justify-end pt-1">
            <EcomDialogPrimaryButton type="button" disabled={disabled} onClick={() => handleClose()}>
              完成
            </EcomDialogPrimaryButton>
          </div>
        </div>
      </div>,
      document.body,
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-3xl flex-col gap-3">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {subtitle ? <DialogDescription>{subtitle}</DialogDescription> : null}
          {hintBlock}
        </DialogHeader>
        {editor}
        <DialogFooter>
          <EcomDialogPrimaryButton type="button" disabled={disabled} onClick={() => handleClose()}>
            完成
          </EcomDialogPrimaryButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
