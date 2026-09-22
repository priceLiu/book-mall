"use client";

import { useEffect, useState } from "react";

import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type DetailPageSuiteSlotPromptSaveExtras = {
  slotCopy?: string;
  burnCopyInImage?: boolean;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  prompt: string;
  /** 子维度拍摄要求（item_label），编辑模式只读展示 */
  shootingRequirement?: string;
  /** 新增点位模式 */
  mode?: "edit" | "add";
  saving?: boolean;
  onSave: (prompt: string, extras?: DetailPageSuiteSlotPromptSaveExtras) => void | Promise<void>;
  onRewrite?: () => void;
  rewriteBusy?: boolean;
  /** 爆款套图：当前生效模块文案 */
  slotCopy?: string;
  /** 爆款套图：AI 基准文案（恢复用） */
  slotCopyAi?: string;
  burnCopyInImage?: boolean;
  showSlotCopyField?: boolean;
};

const promptTextareaClass =
  "mt-1 w-full min-h-[7rem] max-h-[min(16rem,28vh)] resize-y rounded-lg border border-[#d2d2d7] bg-white px-3 py-2 text-sm leading-relaxed text-[#1d1d1f] outline-none focus:border-[#424245] focus:ring-0";

/** 详情页套图 · 单点位出图提示词编辑 */
export function DetailPageSuiteSlotPromptEditDialog({
  open,
  onOpenChange,
  title,
  prompt,
  shootingRequirement,
  mode = "edit",
  saving = false,
  onSave,
  onRewrite,
  rewriteBusy = false,
  slotCopy = "",
  slotCopyAi = "",
  burnCopyInImage = false,
  showSlotCopyField = false,
}: Props) {
  const isAdd = mode === "add";
  const [draft, setDraft] = useState(prompt);
  const [copyDraft, setCopyDraft] = useState(slotCopy);
  const [burnIn, setBurnIn] = useState(burnCopyInImage);
  const [useAiCopy, setUseAiCopy] = useState(true);

  const aiCopy = slotCopyAi.trim();

  useEffect(() => {
    if (open) {
      setDraft(prompt);
      setCopyDraft(slotCopy);
      setBurnIn(burnCopyInImage);
      setUseAiCopy(Boolean(aiCopy) && slotCopy.trim() === aiCopy);
    }
  }, [open, prompt, slotCopy, slotCopyAi, burnCopyInImage, aiCopy]);

  useEffect(() => {
    if (!showSlotCopyField || !useAiCopy || !aiCopy) return;
    setCopyDraft(aiCopy);
  }, [useAiCopy, aiCopy, showSlotCopyField]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80vh] max-w-2xl flex-col gap-0 overflow-hidden p-0">
        <div className="ecom-scrollbar-thin min-h-0 flex-1 overflow-y-auto px-6 pt-6">
          <DialogHeader className="pr-10">
            <DialogTitle className="leading-snug">
              {isAdd ? title : showSlotCopyField ? `${title} · 文案与出图` : `${title} · 出图提示词`}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4 space-y-4 pb-2">
            {!isAdd && shootingRequirement?.trim() ? (
              <div className="rounded-lg border border-[#e8e8ed] bg-[#f5f5f7] px-3 py-2 text-sm leading-relaxed text-[#1d1d1f]">
                <span className="font-medium text-[#6e6e73]">拍摄要求：</span>
                {shootingRequirement.trim()}
              </div>
            ) : null}
            {showSlotCopyField && !isAdd ? (
              <div className="space-y-2">
                <label className="block text-sm text-[#6e6e73]">
                  模块文案（AI 原创二创；可修改）
                  <textarea
                    className="mt-1 min-h-[88px] max-h-[min(8rem,18vh)] w-full resize-y rounded-lg border border-[#d2d2d7] bg-white px-3 py-2 text-sm leading-relaxed text-[#1d1d1f] outline-none focus:border-[#424245]"
                    value={copyDraft}
                    onChange={(e) => {
                      setUseAiCopy(false);
                      setCopyDraft(e.target.value);
                    }}
                    placeholder={
                      aiCopy
                        ? undefined
                        : "尚未生成文案；可点「AI 重写本条」或先在左侧生成原创文案与 Prompt"
                    }
                  />
                </label>
                <div className="space-y-2 text-xs text-[#424245]">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    {aiCopy ? (
                      <label className="flex cursor-pointer items-center gap-2">
                        <input
                          type="checkbox"
                          checked={useAiCopy}
                          onChange={(e) => setUseAiCopy(e.target.checked)}
                        />
                        使用 AI 生成文案
                      </label>
                    ) : null}
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={burnIn}
                        disabled={!copyDraft.trim()}
                        onChange={(e) => setBurnIn(e.target.checked)}
                      />
                      出图时将模块文案渲染进画面
                    </label>
                  </div>
                  <p className="leading-relaxed text-[#86868b]">
                    {aiCopy ? (
                      <>
                        「使用 AI 生成文案」：勾选时用上方 AI 基准句填充，取消后可完全手改。
                        <br />
                      </>
                    ) : null}
                    「渲染进画面」：仅把<strong className="font-medium text-[#515154">模块文案</strong>
                    短标题烧进图（约 48 字内）；出图提示词只描述摄影画面，不会整段变成字。生图模型
                    <strong className="font-medium text-[#515154">不能</strong>
                    做淘宝详情排版，长文案/多段说明请先取消勾选，后期再排版。
                  </p>
                </div>
              </div>
            ) : null}
            <label className="block text-sm text-[#6e6e73]">
              {isAdd
                ? "填写出图提示词，保存后新增 1 个点位格"
                : showSlotCopyField
                  ? "出图提示词（描述画面与商品，默认不含上框文案）"
                  : "下方为完整出图提示词（含全片约束与本张拍摄要求），修改后保存将同步至中栏点位卡"}
              <textarea
                className={
                  showSlotCopyField || isAdd
                    ? promptTextareaClass
                    : `${promptTextareaClass} max-h-[min(22rem,42vh)] min-h-[12rem]`
                }
                value={draft}
                autoFocus={!showSlotCopyField}
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
              disabled={saving || rewriteBusy}
              onClick={onRewrite}
            >
              {rewriteBusy ? "AI 生成中…" : "AI 重写本条（文案+提示词）"}
            </EcomButtonSecondary>
          ) : null}
          <EcomButtonSecondary
            type="button"
            size="sm"
            disabled={saving}
            onClick={() => onOpenChange(false)}
          >
            取消
          </EcomButtonSecondary>
          <EcomButtonPrimary
            type="button"
            size="sm"
            disabled={
              saving ||
              (isAdd ? !draft.trim() : showSlotCopyField ? !draft.trim() : !draft.trim())
            }
            onClick={() =>
              void onSave(
                draft.trim(),
                showSlotCopyField
                  ? {
                      slotCopy: copyDraft.trim(),
                      burnCopyInImage: burnIn && Boolean(copyDraft.trim()),
                    }
                  : undefined,
              )
            }
          >
            {saving ? "保存中…" : isAdd ? "添加点位" : "保存"}
          </EcomButtonPrimary>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
