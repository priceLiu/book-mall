"use client";

import { EcomWorkspaceResultFrame } from "@/components/media/ecom-workspace-result-frame";
import { EcomButtonSecondary } from "@/components/ui/ecom-button";
import { EcomDialogCloseButton } from "@/components/ui/dialog";
import {
  ECOM_WORKSPACE_RESULT_GRID_CLASS,
  ECOM_WORKSPACE_RESULT_LABEL_CLASS,
  ecomWorkspaceResultShellClass,
} from "@/lib/ecom-workspace-result-grid";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  imageUrls: string[];
  onCancel: () => void;
  onPick: (url: string) => void;
};

export function BackgroundReplaceResultDialog({
  open,
  imageUrls,
  onCancel,
  onPick,
}: Props) {
  if (!open || imageUrls.length === 0) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal
      aria-labelledby="bg-replace-pick-title"
      onClick={onCancel}
    >
      <div
        className="relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[#e8e8ed] bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <EcomDialogCloseButton onClick={onCancel} />
        <div className="border-b border-[#e8e8ed] px-5 py-4 pr-12">
          <h2 id="bg-replace-pick-title" className="text-base font-semibold text-[#1d1d1f]">
            选择生成结果
          </h2>
          <p className="mt-1 text-[12px] leading-relaxed text-[#6e6e73]">
            本次生成了 {imageUrls.length} 张。点选一张应用到中栏；其余可在生成记录查看。
          </p>
        </div>
        <div
          className={cn(
            "ecom-scrollbar-thin min-h-[200px] overflow-auto bg-[#f3f4f6] p-4",
            ECOM_WORKSPACE_RESULT_GRID_CLASS,
          )}
        >
          {imageUrls.map((url, index) => (
            <button
              key={`${url}-${index}`}
              type="button"
              onClick={() => onPick(url)}
              className="min-w-0 text-left transition hover:opacity-95"
            >
              <div className={cn(ecomWorkspaceResultShellClass(), "bg-white shadow-sm")}>
                <EcomWorkspaceResultFrame aspect="tryon-image">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={`结果 ${index + 1}`} className="size-full object-contain object-top" />
                </EcomWorkspaceResultFrame>
              </div>
              <p className={ECOM_WORKSPACE_RESULT_LABEL_CLASS}>结果 {index + 1}</p>
            </button>
          ))}
        </div>
        <div className="flex justify-end border-t border-[#e8e8ed] px-5 py-3">
          <EcomButtonSecondary onClick={onCancel}>稍后再选</EcomButtonSecondary>
        </div>
      </div>
    </div>
  );
}
