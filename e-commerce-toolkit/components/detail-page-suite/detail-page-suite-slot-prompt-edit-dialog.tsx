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
  onSave: (prompt: string, slotCopy?: string) => void | Promise<void>;
  onRewrite?: () => void;
  rewriteBusy?: boolean;
  /** 爆款套图：编辑模块文案 slot_copy */
  slotCopy?: string;
  showSlotCopyField?: boolean;
};

const textareaClass =
  "mt-1 w-full h-[50vh] min-h-[50vh] max-h-[70vh] resize-y rounded-lg border border-[#d2d2d7] bg-white px-3 py-2 text-sm leading-relaxed text-[#1d1d1f] outline-none focus:border-[#424245] focus:ring-0";

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
  showSlotCopyField = false,
}: Props) {
  const isAdd = mode === "add";
  const [draft, setDraft] = useState(prompt);
  const [copyDraft, setCopyDraft] = useState(slotCopy);

  useEffect(() => {
    if (open) {
      setDraft(prompt);
      setCopyDraft(slotCopy);
    }
  }, [open, prompt, slotCopy]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader className="pr-10">
          <DialogTitle className="leading-snug">
            {isAdd ? title : showSlotCopyField ? `${title} · 文案与出图` : `${title} · 出图提示词`}
          </DialogTitle>
        </DialogHeader>
        {!isAdd && shootingRequirement?.trim() ? (
          <div className="rounded-lg border border-[#e8e8ed] bg-[#f5f5f7] px-3 py-2 text-sm leading-relaxed text-[#1d1d1f]">
            <span className="font-medium text-[#6e6e73]">拍摄要求：</span>
            {shootingRequirement.trim()}
          </div>
        ) : null}
        {showSlotCopyField && !isAdd ? (
          <label className="block text-sm text-[#6e6e73]">
            模块文案（详情页上展示的文字，可与画面分开展示；勾选「出图时渲染文案」时会写入生图）
            <textarea
              className="mt-1 min-h-[88px] w-full resize-y rounded-lg border border-[#d2d2d7] bg-white px-3 py-2 text-sm leading-relaxed text-[#1d1d1f] outline-none focus:border-[#424245]"
              value={copyDraft}
              onChange={(e) => setCopyDraft(e.target.value)}
              placeholder="如：核心卖点短句、参数说明…"
            />
          </label>
        ) : null}
        <label className="block text-sm text-[#6e6e73]">
          {isAdd
            ? "填写出图提示词，保存后新增 1 个点位格"
            : showSlotCopyField
              ? "出图提示词（描述画面与商品，默认不含上框文案）"
              : "下方为完整出图提示词（含全片约束与本张拍摄要求），修改后保存将同步至中栏点位卡"}
          <textarea
            className={textareaClass}
            value={draft}
            autoFocus={!showSlotCopyField}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="中文生图描述…"
          />
        </label>
        <DialogFooter className="flex-wrap gap-2 sm:justify-end">
          {!isAdd && onRewrite ? (
            <EcomButtonSecondary
              type="button"
              size="sm"
              disabled={saving || rewriteBusy}
              onClick={onRewrite}
            >
              {rewriteBusy ? "AI 重写中…" : "AI 重写本条"}
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
            disabled={saving || (isAdd ? !draft.trim() : showSlotCopyField ? !draft.trim() && !copyDraft.trim() : !draft.trim())}
            onClick={() =>
              void onSave(
                draft.trim(),
                showSlotCopyField ? copyDraft.trim() : undefined,
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
