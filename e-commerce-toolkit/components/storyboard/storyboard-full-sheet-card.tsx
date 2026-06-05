"use client";

import { Download, Eye, Film, Loader2, RefreshCw } from "lucide-react";
import { useState } from "react";

import { EcomButtonSecondary } from "@/components/ui/ecom-button";
import { StoryboardSheetLiveThumb } from "@/components/storyboard/storyboard-sheet-live-thumb";
import { StoryboardSheetThumbnail } from "@/components/storyboard/storyboard-sheet-thumbnail";
import { STORYBOARD_PREVIEW_MIN_H, storyboardPreviewAspectClass } from "@/lib/storyboard-aspect";
import type { StoryboardReference, StoryboardSheet } from "@/lib/storyboard-types";
import { cn } from "@/lib/utils";

type Props = {
  label: string;
  aspectRatio?: "16:9" | "9:16" | "1:1";
  sheet?: StoryboardSheet | null;
  references?: StoryboardReference[];
  productName?: string;
  productHighlight?: string;
  projectKeywords?: string;
  sheetPngUrl?: string | null;
  panelAspectRatio?: "16:9" | "9:16";
  /** 全部分镜图 / 单镜重新生图中 */
  imageGenBusy?: boolean;
  /** 合成完整分镜 PNG 上传中 */
  sheetPngBusy?: boolean;
  emptyHint: string;
  onPreview?: () => void;
  onRegenerateImage?: () => void;
  onGenerateVideo?: () => void;
  onDownloadPng?: () => void;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
};

function stopClick(e: React.MouseEvent) {
  e.stopPropagation();
}

/** 完整分镜图预览卡（悬停工具条 + 点击预览） */
export function StoryboardFullSheetCard({
  label,
  aspectRatio = "16:9",
  sheet,
  references = [],
  productName,
  productHighlight,
  projectKeywords,
  sheetPngUrl,
  panelAspectRatio = "9:16",
  imageGenBusy,
  sheetPngBusy,
  emptyHint,
  onPreview,
  onRegenerateImage,
  onGenerateVideo,
  onDownloadPng,
  primaryActionLabel,
  onPrimaryAction,
}: Props) {
  const [hover, setHover] = useState(false);
  const busy = Boolean(imageGenBusy || sheetPngBusy);
  const busyLabel = sheetPngBusy ? "合成中…" : imageGenBusy ? "生成中…" : "";
  const hasPanelImages =
    sheet?.panels.some((p) => Boolean(p.imageUrl?.trim())) ?? false;
  const hasPreview = Boolean(sheet || sheetPngUrl?.trim() || hasPanelImages);
  const canDownload = Boolean(sheetPngUrl?.trim());

  function renderSheetVisual() {
    if (sheet) {
      return (
        <StoryboardSheetLiveThumb
          sheet={sheet}
          references={references}
          productName={productName}
          productHighlight={productHighlight}
          projectKeywords={projectKeywords}
          thumbId="storyboard-full-sheet-card"
        />
      );
    }
    if (sheetPngUrl?.trim()) {
      return (
        <StoryboardSheetThumbnail
          sheet={null}
          sheetPngUrl={sheetPngUrl}
          panelAspectRatio={panelAspectRatio}
        />
      );
    }
    return null;
  }

  return (
    <div className="isolate flex min-w-0 flex-col">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-[#1d1d1f]">{label}</p>
        {onPreview && hasPreview && !busy ? (
          <EcomButtonSecondary
            size="sm"
            type="button"
            className="h-7 px-2.5 text-[11px]"
            onClick={() => onPreview()}
          >
            <Eye className="h-3.5 w-3.5 shrink-0" />
            预览
          </EcomButtonSecondary>
        ) : null}
      </div>
      <div
        className={cn(
          "relative w-full overflow-hidden rounded-xl border border-[#e8e8ed] bg-white shadow-sm",
          STORYBOARD_PREVIEW_MIN_H,
          (hasPreview || busy || sheet) && storyboardPreviewAspectClass(aspectRatio),
        )}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        {busy ? (
          <>
            {renderSheetVisual()}
            <div className="absolute inset-0 z-10 flex min-h-[200px] items-center justify-center gap-2 bg-white/80 text-sm text-[#6e6e73] backdrop-blur-[1px]">
              <Loader2 className="h-5 w-5 animate-spin" />
              {busyLabel}
            </div>
          </>
        ) : hasPreview ? (
          <>
            {renderSheetVisual()}
            {hover ? (
              <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 bg-black/45 backdrop-blur-[1px]">
                {onPreview ? (
                  <button
                    type="button"
                    title="放大预览"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/95 text-[#1d1d1f] shadow"
                    onClick={(e) => {
                      stopClick(e);
                      onPreview();
                    }}
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </button>
                ) : null}
                {canDownload && onDownloadPng ? (
                  <button
                    type="button"
                    title="下载 PNG"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/95 text-[#1d1d1f] shadow"
                    onClick={(e) => {
                      stopClick(e);
                      onDownloadPng();
                    }}
                  >
                    <Download className="h-3.5 w-3.5" />
                  </button>
                ) : null}
                {onRegenerateImage ? (
                  <button
                    type="button"
                    title="重新生图"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/95 text-[#1d1d1f] shadow"
                    onClick={(e) => {
                      stopClick(e);
                      onRegenerateImage();
                    }}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </button>
                ) : null}
                {onGenerateVideo ? (
                  <button
                    type="button"
                    title="生成完整视频"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0071e3] text-white shadow"
                    onClick={(e) => {
                      stopClick(e);
                      onGenerateVideo();
                    }}
                  >
                    <Film className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
            ) : null}
          </>
        ) : (
          <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-3 px-4 text-center">
            <p className="text-xs text-[#86868b]">{emptyHint}</p>
            {primaryActionLabel && onPrimaryAction ? (
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-lg border border-[#d2d2d7] bg-[#f5f5f7] px-3 py-1.5 text-xs font-medium text-[#1d1d1f] hover:bg-[#ebebed]"
                onClick={onPrimaryAction}
              >
                {primaryActionLabel}
              </button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
