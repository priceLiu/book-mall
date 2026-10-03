"use client";

import { useEffect, useState } from "react";

import {
  EcomCopyLayoutStudioDialog,
  type EcomCopyLayoutStudioPreviewResult,
  type EcomCopyLayoutStudioSaveExtras,
} from "@/components/copy-layout/ecom-copy-layout-studio-dialog";
import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { detailPageAspectClass } from "@/lib/detail-page-suite-platform-ratio";
import type { EcomDetailPageRatio } from "@/lib/detail-page-suite-platform-ratio";
import type { EcomCopyOverlay } from "@private/ecom-copy-overlay";

export type DetailPageSuiteSlotPromptSaveExtras = {
  slotCopy?: string;
  copyOverlay?: EcomCopyOverlay;
  burnCopyInImage?: boolean;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  prompt: string;
  shootingRequirement?: string;
  mode?: "edit" | "add";
  saving?: boolean;
  composing?: boolean;
  onSave: (prompt: string, extras?: DetailPageSuiteSlotPromptSaveExtras) => void | Promise<void>;
  onCompose?: (
    prompt: string,
    extras: DetailPageSuiteSlotPromptSaveExtras,
  ) => void | Promise<void>;
  onPreview?: (
    prompt: string,
    extras: DetailPageSuiteSlotPromptSaveExtras,
  ) => void | Promise<EcomCopyLayoutStudioPreviewResult | void>;
  onConfirmCompose?: (
    prompt: string,
    extras: DetailPageSuiteSlotPromptSaveExtras,
    ctx: { previewUrl: string },
  ) => void | Promise<void>;
  onRewrite?: () => void;
  rewriteBusy?: boolean;
  promptRefUrls?: string[];
  promptRefUploadBusy?: boolean;
  onUploadPromptRef?: (file: File) => void;
  slotCopy?: string;
  slotCopyAi?: string;
  showSlotCopyField?: boolean;
  baseImageUrl?: string | null;
  copyOverlay?: EcomCopyOverlay | null;
  exportWidthPx?: number;
  displayRatio?: EcomDetailPageRatio;
};

const promptTextareaClass =
  "mt-1 w-full min-h-[7rem] max-h-[min(16rem,28vh)] resize-y rounded-lg border border-[#d2d2d7] bg-white px-3 py-2 text-sm leading-relaxed text-[#1d1d1f] outline-none focus:border-[#424245] focus:ring-0";

/** 详情页套图 · 单点位编辑（排版模式走 EcomCopyLayoutStudioDialog 壳层） */
export function DetailPageSuiteSlotPromptEditDialog({
  open,
  onOpenChange,
  title,
  prompt,
  shootingRequirement,
  mode = "edit",
  saving = false,
  composing = false,
  onSave,
  onCompose,
  onPreview,
  onConfirmCompose,
  onRewrite,
  rewriteBusy = false,
  promptRefUrls = [],
  promptRefUploadBusy = false,
  onUploadPromptRef,
  slotCopy = "",
  slotCopyAi = "",
  showSlotCopyField = false,
  baseImageUrl = null,
  copyOverlay = null,
  exportWidthPx = 750,
  displayRatio = "3:4",
}: Props) {
  const isAdd = mode === "add";
  const layoutMode = showSlotCopyField && !isAdd;
  const [draft, setDraft] = useState(prompt);

  useEffect(() => {
    if (open) setDraft(prompt);
  }, [open, prompt]);

  const busy = saving || composing;

  if (layoutMode) {
    const rightColumnExtras = (
      <>
        {shootingRequirement?.trim() ? (
          <div className="rounded-lg border border-[#e8e8ed] bg-[#f5f5f7] px-3 py-2 text-sm leading-relaxed text-[#1d1d1f]">
            <span className="font-medium text-[#6e6e73]">拍摄要求：</span>
            {shootingRequirement.trim()}
          </div>
        ) : null}
        {onUploadPromptRef ? (
          <div className="space-y-2 rounded-lg border border-[#e8e8ed] bg-[#fafafa] px-3 py-2">
            <p className="text-xs font-medium text-[#6e6e73]">本格参考 / 场景图</p>
            <p className="text-[10px] leading-relaxed text-[#86868b]">
              上传后可用于 AI 重写本条 Prompt（最多 3 张）。
            </p>
            {promptRefUrls.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {promptRefUrls.map((url) => (
                  <img
                    key={url}
                    src={url}
                    alt=""
                    className="h-14 w-14 rounded-md border border-[#e8e8ed] object-cover"
                  />
                ))}
              </div>
            ) : null}
            <label className="inline-flex cursor-pointer items-center">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={busy || promptRefUploadBusy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) onUploadPromptRef(file);
                }}
              />
              <span className="inline-flex h-8 items-center rounded-lg border border-[#d2d2d7] bg-white px-3 text-xs">
                {promptRefUploadBusy ? "上传中…" : "上传参考图"}
              </span>
            </label>
          </div>
        ) : null}
      </>
    );

    return (
      <EcomCopyLayoutStudioDialog
        open={open}
        onOpenChange={onOpenChange}
        title={title}
        baseImageUrl={baseImageUrl}
        imagePrompt={prompt}
        slotCopy={slotCopy}
        slotCopyAi={slotCopyAi}
        copyOverlay={copyOverlay}
        exportWidthPx={exportWidthPx}
        aspectClassName={detailPageAspectClass(displayRatio)}
        saving={saving}
        composing={composing}
        rewriteBusy={rewriteBusy}
        onRewrite={onRewrite}
        rewriteButtonLabel={
          onUploadPromptRef ? "AI 重写本条 Prompt" : "AI 重写本条（文案+提示词）"
        }
        rightColumnExtras={rightColumnExtras}
        onSave={(imagePrompt, extras) => void onSave(imagePrompt, extras)}
        onPreview={
          onPreview
            ? (imagePrompt, extras) =>
                void onPreview(imagePrompt, extras as DetailPageSuiteSlotPromptSaveExtras)
            : undefined
        }
        onConfirmCompose={
          onConfirmCompose
            ? (imagePrompt, extras, ctx) =>
                void onConfirmCompose(
                  imagePrompt,
                  extras as DetailPageSuiteSlotPromptSaveExtras,
                  ctx,
                )
            : undefined
        }
        onCompose={
          onCompose && !onPreview
            ? (imagePrompt, extras) =>
                void onCompose(imagePrompt, extras as EcomCopyLayoutStudioSaveExtras)
            : undefined
        }
      />
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80vh] max-w-2xl flex-col gap-0 overflow-hidden p-0">
        <div className="ecom-scrollbar-thin min-h-0 flex-1 overflow-y-auto px-6 pt-6">
          <DialogHeader className="pr-10">
            <DialogTitle className="leading-snug">
              {isAdd ? title : `${title} · 出图提示词`}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4 space-y-4 pb-2">
            {!isAdd && shootingRequirement?.trim() ? (
              <div className="rounded-lg border border-[#e8e8ed] bg-[#f5f5f7] px-3 py-2 text-sm leading-relaxed text-[#1d1d1f]">
                <span className="font-medium text-[#6e6e73]">拍摄要求：</span>
                {shootingRequirement.trim()}
              </div>
            ) : null}
            <label className="block text-sm text-[#6e6e73]">
              {isAdd
                ? "填写出图提示词，保存后新增 1 个点位格"
                : "下方为完整出图提示词（含全片约束与本张拍摄要求），修改后保存将同步至中栏点位卡"}
              <textarea
                className={`${promptTextareaClass} max-h-[min(22rem,42vh)] min-h-[12rem]`}
                value={draft}
                autoFocus
                onChange={(e) => setDraft(e.target.value)}
                placeholder="中文生图描述…"
              />
            </label>
          </div>
        </div>
        <DialogFooter className="shrink-0 flex-wrap gap-2 border-t border-[#e8e8ed] px-6 py-4 sm:justify-end">
          {!isAdd && onRewrite ? (
            <EcomButtonSecondary
              type="button"
              size="sm"
              disabled={busy || rewriteBusy}
              onClick={onRewrite}
            >
              {rewriteBusy ? "AI 生成中…" : "AI 重写本条（文案+提示词）"}
            </EcomButtonSecondary>
          ) : null}
          <EcomButtonSecondary
            type="button"
            size="sm"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            取消
          </EcomButtonSecondary>
          <EcomButtonPrimary
            type="button"
            size="sm"
            disabled={busy || !draft.trim()}
            onClick={() => void onSave(draft.trim(), undefined)}
          >
            {saving ? "保存中…" : isAdd ? "添加点位" : "保存"}
          </EcomButtonPrimary>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
