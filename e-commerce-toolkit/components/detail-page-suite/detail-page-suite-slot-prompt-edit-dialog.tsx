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
  /** 新增点位模式 */
  mode?: "edit" | "add";
  saving?: boolean;
  onSave: (prompt: string) => void | Promise<void>;
  onRewrite?: () => void;
  rewriteBusy?: boolean;
};

const textareaClass =
  "mt-1 w-full min-h-[200px] resize-y rounded-lg border border-[#d2d2d7] bg-white px-3 py-2 text-sm leading-relaxed text-[#1d1d1f] outline-none focus:border-[#424245] focus:ring-0";

/** 详情页套图 · 单点位出图提示词编辑 */
export function DetailPageSuiteSlotPromptEditDialog({
  open,
  onOpenChange,
  title,
  prompt,
  mode = "edit",
  saving = false,
  onSave,
  onRewrite,
  rewriteBusy = false,
}: Props) {
  const isAdd = mode === "add";
  const [draft, setDraft] = useState(prompt);

  useEffect(() => {
    if (open) setDraft(prompt);
  }, [open, prompt]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader className="pr-10">
          <DialogTitle className="leading-snug">
            {isAdd ? title : `${title} · 出图提示词`}
          </DialogTitle>
        </DialogHeader>
        <label className="block text-sm text-[#6e6e73]">
          {isAdd ? "填写出图提示词，保存后新增 1 个点位格" : "修改后保存，将同步至中栏点位卡"}
          <textarea
            className={textareaClass}
            value={draft}
            autoFocus
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
            disabled={saving || !draft.trim()}
            onClick={() => void onSave(draft.trim())}
          >
            {saving ? "保存中…" : isAdd ? "添加点位" : "保存"}
          </EcomButtonPrimary>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
