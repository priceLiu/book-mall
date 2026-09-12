"use client";

import { Download, Loader2 } from "lucide-react";

import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import { EcomDialogCloseButton } from "@/components/ui/dialog";

type Props = {
  open: boolean;
  busy?: boolean;
  exportBusy?: boolean;
  previewUrl: string | null;
  onOpenChange: (open: boolean) => void;
  onExport: () => void;
};

/** 成品两步导出 · 第一步：预览合成 PNG；第二步：用户确认后下载 */
export function ImageLayerExportPreviewDialog({
  open,
  busy,
  exportBusy,
  previewUrl,
  onOpenChange,
  onExport,
}: Props) {
  if (!open) return null;

  const anyBusy = busy || exportBusy;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal
      aria-labelledby="image-layer-export-preview-title"
      onClick={() => {
        if (!anyBusy) onOpenChange(false);
      }}
    >
      <div
        className="relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[#e8e8ed] bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <EcomDialogCloseButton disabled={anyBusy} onClick={() => onOpenChange(false)} />
        <div className="border-b border-[#e8e8ed] px-5 py-4 pr-12">
          <h2 id="image-layer-export-preview-title" className="text-base font-semibold text-[#1d1d1f]">
            成品预览
          </h2>
          <p className="mt-1 text-[12px] leading-relaxed text-[#6e6e73]">
            以下为当前画布合成结果（底图 + 各图层位置）。确认无误后再导出 PNG 到本地。
          </p>
        </div>

        <div className="ecom-scrollbar-thin min-h-[240px] flex-1 overflow-auto bg-[#f3f4f6] p-4">
          {busy ? (
            <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 text-sm text-[#6b7280]">
              <Loader2 className="h-8 w-8 animate-spin text-[#2563eb]" />
              正在合成预览…
            </div>
          ) : previewUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={previewUrl}
              alt="成品预览"
              className="mx-auto block h-auto max-w-full rounded-lg shadow-md"
            />
          ) : (
            <div className="flex min-h-[280px] items-center justify-center text-sm text-[#9ca3af]">
              预览生成失败，请关闭后重试
            </div>
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-[#e8e8ed] px-5 py-4">
          <EcomButtonSecondary disabled={anyBusy} onClick={() => onOpenChange(false)}>
            关闭
          </EcomButtonSecondary>
          <EcomButtonPrimary
            disabled={anyBusy || !previewUrl}
            onClick={() => void onExport()}
          >
            {exportBusy ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-1.5 h-4 w-4" />
            )}
            {exportBusy ? "导出中…" : "导出 PNG"}
          </EcomButtonPrimary>
        </div>
      </div>
    </div>
  );
}
