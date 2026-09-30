"use client";

import { createPortal } from "react-dom";

import { EcomDialogCloseButton } from "@/components/ui/dialog";
import {
  ecomModalBackdropMouseDown,
  useEcomModalEscape,
} from "@/components/ui/ecom-modal-layer";

type Props = {
  open: boolean;
  title: string;
  prompt: string;
  onClose: () => void;
};

/** 模特试衣 · 成片悬停 · 只读提示词预览 */
export function VtonPromptPreviewDialog({ open, title, prompt, onClose }: Props) {
  useEcomModalEscape(open, onClose);

  if (!open || typeof document === "undefined") return null;

  const body = prompt.trim() || "（本条结果未保存提示词）";

  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vton-prompt-preview-title"
      onMouseDown={ecomModalBackdropMouseDown(onClose)}
    >
      <div className="relative flex max-h-[min(92vh,880px)] w-[min(94vw,56rem)] flex-col rounded-2xl bg-white p-6 shadow-2xl">
        <EcomDialogCloseButton onClick={onClose} />
        <h3
          id="vton-prompt-preview-title"
          className="pr-10 text-lg font-semibold text-[#1d1d1f]"
        >
          {title}
        </h3>
        <p className="mt-1 text-xs text-[#86868b]">生成时使用的 Prompt</p>
        <div className="ecom-scrollbar-thin mt-4 min-h-[min(32vh,320px)] max-h-[min(72vh,680px)] w-full flex-1 overflow-y-auto whitespace-pre-wrap rounded-lg bg-[#f5f5f7] px-4 py-3 text-[13px] leading-relaxed text-[#1d1d1f]">
          {body}
        </div>
      </div>
    </div>,
    document.body,
  );
}
