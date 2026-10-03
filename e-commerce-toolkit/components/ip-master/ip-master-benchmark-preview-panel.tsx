"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useMemo } from "react";

import {
  EcomImagePreviewHost,
  useEcomImagePreview,
} from "@/components/media";
import { EcomMediaGeneratingBusy } from "@/components/media/ecom-media-generating-busy";
import { EcomButtonPrimary } from "@/components/ui/ecom-button";
import { cn } from "@/lib/utils";

type Props = {
  ossUrl?: string;
  generating?: boolean;
  generateDisabled?: boolean;
  onGenerate: () => void;
};

export function IpMasterBenchmarkPreviewPanel({
  ossUrl,
  generating,
  generateDisabled,
  onGenerate,
}: Props) {
  const previewItems = useMemo(
    () => (ossUrl?.trim() ? [{ src: ossUrl, title: "IP 基准图" }] : []),
    [ossUrl],
  );
  const { preview, openPreview, closePreview } = useEcomImagePreview(previewItems);

  const canPreview = Boolean(ossUrl?.trim()) && !generating;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[#e8e8ed] bg-[#fafafa] p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-[#6e6e73]">
        基准立绘预览
      </p>

      <EcomButtonPrimary
        size="sm"
        type="button"
        className="w-full max-w-[33vw] min-w-[12rem]"
        disabled={generateDisabled || generating}
        onClick={() => void onGenerate()}
      >
        {generating ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Sparkles className="h-3.5 w-3.5" />
        )}
        生成基准图
      </EcomButtonPrimary>

      <button
        type="button"
        disabled={!canPreview}
        aria-label={canPreview ? "查看基准图大图" : "基准图占位"}
        className={cn(
          "relative flex w-full max-w-full flex-col overflow-hidden rounded-xl border bg-white",
          canPreview
            ? "cursor-zoom-in border-[#d2d2d7] hover:border-[#0071e3]"
            : "cursor-default border-dashed border-[#d2d2d7]",
          "aspect-[3/4] w-full min-h-[320px] max-h-[min(88vh,920px)] lg:min-h-[420px]",
        )}
        onClick={() => {
          if (!ossUrl?.trim()) return;
          openPreview(ossUrl, "IP 基准图", previewItems);
        }}
      >
        {generating ? (
          <EcomMediaGeneratingBusy className="absolute inset-0" background="light" />
        ) : ossUrl?.trim() ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={ossUrl}
            alt="IP 基准立绘"
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center">
            <span className="text-sm font-medium text-[#86868b]">基准图占位</span>
            <span className="text-[11px] leading-relaxed text-[#aeaeb2]">
              确认左侧生图提示词后，点击上方按钮生成；成图将显示在此，点击可放大查看。
            </span>
          </div>
        )}
      </button>

      {canPreview ? (
        <p className="text-center text-[11px] text-[#86868b]">点击预览区查看大图（缩放 / 平移）</p>
      ) : null}

      <EcomImagePreviewHost
        preview={preview}
        galleryItems={previewItems}
        onClose={closePreview}
      />
    </div>
  );
}
