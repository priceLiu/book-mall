"use client";

import { useEffect, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";

import { EcomGenerateCreditsBeside } from "@/components/billing/ecom-generate-credits-beside";
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
import { BRAND_VI_SKETCH_GEN_DEFAULT_PROMPT } from "@/lib/brand-vi-types";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultPrompt?: string;
  busy?: boolean;
  hasSeedSketch?: boolean;
  modelKey?: string;
  onConfirm: (prompt: string) => void | Promise<void>;
  nativeOverlay?: boolean;
};

/** 生成参考图：编辑 Prompt 后调用 wan2.7-image */
export function BrandViSketchGenerateDialog({
  open,
  onOpenChange,
  defaultPrompt = BRAND_VI_SKETCH_GEN_DEFAULT_PROMPT,
  busy,
  hasSeedSketch,
  modelKey = "wan2.7-image",
  onConfirm,
  nativeOverlay = true,
}: Props) {
  const [draft, setDraft] = useState(defaultPrompt);

  useEffect(() => {
    if (open) setDraft(defaultPrompt);
  }, [open, defaultPrompt]);

  useEffect(() => {
    if (!nativeOverlay || !open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [nativeOverlay, open, onOpenChange]);

  const description =
    "使用通义万相 2.7（wan2.7-image）生成参考图并填入上方槽位。" +
    (hasSeedSketch
      ? " 将以当前第 1 张参考图为 IP 草图参考，保持造型细节。"
      : " 当前无参考图时将纯文生图；上传 IP 草图后再生成可更好保留造型。");

  const textarea = (
    <textarea
      className="min-h-[40vh] w-full flex-1 resize-y rounded-lg border border-[#e8e8ed] px-3 py-2.5 text-[13px] leading-relaxed text-[#1d1d1f] focus:border-[#0071e3]/40 focus:outline-none focus:ring-2 focus:ring-[#0071e3]/15 disabled:cursor-not-allowed disabled:bg-[#f5f5f7]"
      value={draft}
      autoFocus
      disabled={busy}
      placeholder="描述期望的参考图风格与角色…"
      onChange={(e) => setDraft(e.target.value)}
    />
  );

  const footer = (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
      <EcomGenerateCreditsBeside modelKey={modelKey} imageCount={1} enabled={open} />
      <EcomDialogPrimaryButton
        disabled={busy || !draft.trim()}
        onClick={() => {
          if (busy || !draft.trim()) return;
          onOpenChange(false);
          void onConfirm(draft.trim());
        }}
      >
        生成
      </EcomDialogPrimaryButton>
    </div>
  );

  if (nativeOverlay) {
    if (!open || typeof document === "undefined") return null;

    const dismissOnBackdrop = (e: MouseEvent) => {
      if (e.target === e.currentTarget) onOpenChange(false);
    };

    return createPortal(
      <div
        className="fixed inset-0 z-[300] flex items-center justify-center bg-black/45 p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="brand-vi-sketch-gen-title"
        onClick={dismissOnBackdrop}
      >
        <div
          className={cn(
            "relative flex max-h-[85vh] w-full max-w-3xl flex-col gap-3 overflow-hidden rounded-2xl bg-white p-6 shadow-2xl",
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <EcomDialogCloseButton onClick={() => onOpenChange(false)} />
          <div className="space-y-1.5 pr-8">
            <h2
              id="brand-vi-sketch-gen-title"
              className="text-lg font-semibold leading-none tracking-tight text-[#1d1d1f]"
            >
              生成参考图
            </h2>
            <p className="text-sm text-[#6e6e73]">{description}</p>
          </div>
          {textarea}
          {footer}
        </div>
      </div>,
      document.body,
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-3xl flex-col gap-3">
        <DialogHeader>
          <DialogTitle>生成参考图</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {textarea}
        <DialogFooter className="items-center sm:justify-between">
          <EcomGenerateCreditsBeside modelKey={modelKey} imageCount={1} enabled={open} />
          <EcomDialogPrimaryButton
            disabled={busy || !draft.trim()}
            onClick={() => {
              if (busy || !draft.trim()) return;
              onOpenChange(false);
              void onConfirm(draft.trim());
            }}
          >
            生成
          </EcomDialogPrimaryButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
