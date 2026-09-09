"use client";

import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import { EcomDialogCloseButton } from "@/components/ui/dialog";
import { VTON_MODEL_DEFAULT_PROMPT } from "@/lib/vton-model-prompts";

type Props = {
  open: boolean;
  onClose: () => void;
  busy?: boolean;
  onConfirm: (opts: { prompt: string }) => void | Promise<void>;
};

export function VtonFourViewGenerateDialog({ open, onClose, busy, onConfirm }: Props) {
  const [draft, setDraft] = useState(VTON_MODEL_DEFAULT_PROMPT);

  useEffect(() => {
    if (!open) return;
    setDraft(VTON_MODEL_DEFAULT_PROMPT);
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/45 p-4">
      <div
        className="flex max-h-[min(88vh,720px)] w-full max-w-lg flex-col rounded-2xl border border-[#e8e8ed] bg-white shadow-xl"
        role="dialog"
        aria-modal
        aria-labelledby="vton-four-view-gen-title"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#e8e8ed] px-5 py-4">
          <div>
            <h3 id="vton-four-view-gen-title" className="text-sm font-semibold text-[#1d1d1f]">
              AI 生全身模特
            </h3>
            <p className="mt-1 text-xs text-[#6e6e73]">
              编辑 Prompt 后点击生成；系统使用万相 2.7 Pro，一次输出白底正面全身图。
            </p>
          </div>
          <EcomDialogCloseButton onClick={onClose} disabled={busy} />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <label className="mb-2 block text-xs font-medium text-[#6e6e73]">生图 Prompt</label>
          <textarea
            className="ecom-scrollbar-thin min-h-[220px] w-full rounded-lg border border-[#e8e8ed] px-3 py-2 text-xs leading-relaxed text-[#1d1d1f] outline-none focus:border-[#0071e3]"
            value={draft}
            disabled={busy}
            onChange={(e) => setDraft(e.target.value)}
          />
        </div>

        <div className="flex justify-end gap-2 border-t border-[#e8e8ed] px-5 py-4">
          <EcomButtonSecondary type="button" size="sm" disabled={busy} onClick={onClose}>
            取消
          </EcomButtonSecondary>
          <EcomButtonPrimary
            type="button"
            size="sm"
            disabled={busy || !draft.trim()}
            onClick={() => void onConfirm({ prompt: draft.trim() })}
          >
            <Sparkles className="mr-1 inline h-3.5 w-3.5" />
            生成
          </EcomButtonPrimary>
        </div>
      </div>
    </div>,
    document.body,
  );
}
