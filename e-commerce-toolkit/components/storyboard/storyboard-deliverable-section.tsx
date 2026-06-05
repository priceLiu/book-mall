"use client";

import { Clapperboard, Eye, Film, RefreshCw } from "lucide-react";

import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import { StoryboardFullSheetCard } from "@/components/storyboard/storyboard-full-sheet-card";
import { StoryboardResultCard } from "@/components/storyboard/storyboard-result-card";
import { isStoryboardVideoUrl } from "@/lib/storyboard-media";
import type { StoryboardReference, StoryboardSheet } from "@/lib/storyboard-types";

type Props = {
  durationSec: number;
  panelVideoCount: number;
  videoAspectRatio: "16:9" | "9:16" | "1:1";
  panelAspectRatio?: "16:9" | "9:16";
  sheetPngUrl?: string | null;
  sheet: StoryboardSheet | null;
  references?: StoryboardReference[];
  productName?: string;
  productHighlight?: string;
  projectKeywords?: string;
  videoUrl?: string | null;
  hasSheetImages: boolean;
  canMergePanels: boolean;
  vidBusy: boolean;
  imageGenBusy: boolean;
  sheetPngBusy: boolean;
  mergeBusy: boolean;
  snapshotBusy: boolean;
  hasDeliverableSnapshot: boolean;
  onGenerateFullVideo: () => void;
  onOpenDeliverableReview: () => void;
  onSaveSnapshot: () => void;
  onOpenImagePicker: () => void;
  onOpenSheetPreview: () => void;
  onReloadProject: () => void;
  onMergePanelVideos: () => void;
  onPreviewVideo: (src: string, title?: string) => void;
};

/** 成片区：工具条 + 分镜图/成片双栏（左只读预览，右视频播放器） */
export function StoryboardDeliverableSection({
  durationSec,
  panelVideoCount,
  videoAspectRatio,
  panelAspectRatio = "9:16",
  sheetPngUrl,
  sheet,
  references = [],
  productName,
  productHighlight,
  projectKeywords,
  videoUrl,
  hasSheetImages,
  canMergePanels,
  vidBusy,
  imageGenBusy,
  sheetPngBusy,
  mergeBusy,
  snapshotBusy,
  hasDeliverableSnapshot,
  onGenerateFullVideo,
  onOpenDeliverableReview,
  onSaveSnapshot,
  onOpenImagePicker,
  onOpenSheetPreview,
  onReloadProject,
  onMergePanelVideos,
  onPreviewVideo,
}: Props) {
  const resolvedVideo = isStoryboardVideoUrl(videoUrl) ? videoUrl!.trim() : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e8e8ed] bg-[#fafafa] px-4 py-3">
        <p className="text-xs text-[#6e6e73]">
          整图成片 {durationSec}s · 已生成 {panelVideoCount} 镜单镜视频
          {canMergePanels ? " · 可合并" : ""}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <EcomButtonSecondary size="sm" type="button" onClick={onReloadProject} title="从服务器重新加载项目">
            <RefreshCw className="h-3.5 w-3.5 shrink-0" />
            刷新
          </EcomButtonSecondary>
          {hasDeliverableSnapshot ? (
            <EcomButtonSecondary size="sm" type="button" onClick={onOpenDeliverableReview}>
              <Eye className="h-3.5 w-3.5 shrink-0" />
              交付查阅
            </EcomButtonSecondary>
          ) : null}
          <EcomButtonSecondary
            size="sm"
            type="button"
            disabled={snapshotBusy || !sheet}
            onClick={onSaveSnapshot}
          >
            {snapshotBusy ? "保存中…" : "保存交付快照"}
          </EcomButtonSecondary>
          <EcomButtonSecondary size="sm" type="button" disabled={!hasSheetImages} onClick={onOpenImagePicker}>
            重新生图
          </EcomButtonSecondary>
          <EcomButtonPrimary
            size="sm"
            type="button"
            disabled={!hasSheetImages || vidBusy}
            onClick={onGenerateFullVideo}
          >
            <Film className="h-3.5 w-3.5 shrink-0" />
            {vidBusy ? "生成中…" : "生成完整视频"}
          </EcomButtonPrimary>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="isolate min-w-0 overflow-hidden">
          <StoryboardFullSheetCard
            label="完整分镜图"
            aspectRatio={videoAspectRatio}
            sheet={sheet}
            references={references}
            productName={productName}
            productHighlight={productHighlight}
            projectKeywords={projectKeywords}
            sheetPngUrl={sheetPngUrl}
            panelAspectRatio={panelAspectRatio}
            imageGenBusy={imageGenBusy}
            sheetPngBusy={sheetPngBusy}
            emptyHint="请先生成分镜图"
            onPreview={sheet ? onOpenSheetPreview : undefined}
            onRegenerateImage={hasSheetImages ? onOpenImagePicker : undefined}
            onGenerateVideo={hasSheetImages && !vidBusy ? onGenerateFullVideo : undefined}
            onDownloadPng={
              sheetPngUrl?.trim()
                ? () => {
                    const a = document.createElement("a");
                    a.href = sheetPngUrl!.trim();
                    a.download = "storyboard-sheet.png";
                    a.target = "_blank";
                    a.rel = "noopener noreferrer";
                    a.click();
                  }
                : undefined
            }
            primaryActionLabel={!hasSheetImages ? "生成分镜图" : undefined}
            onPrimaryAction={!hasSheetImages ? onOpenImagePicker : undefined}
          />
        </div>

        <div className="isolate min-w-0 overflow-hidden">
          <StoryboardResultCard
            label="完整视频"
            aspectRatio={videoAspectRatio}
            videoSrc={resolvedVideo}
            emptyHint="整图成片或合并分镜视频"
            busy={vidBusy}
            disabled={!hasSheetImages && !canMergePanels}
            primaryActionLabel={hasSheetImages && !resolvedVideo ? "整图成片" : undefined}
            onPrimaryAction={hasSheetImages && !resolvedVideo ? onGenerateFullVideo : undefined}
            secondaryActionLabel={canMergePanels ? "合并分镜视频" : undefined}
            onSecondaryAction={canMergePanels ? onMergePanelVideos : undefined}
            mergeBusy={mergeBusy}
            canMerge={canMergePanels}
            onMergePanels={canMergePanels ? onMergePanelVideos : undefined}
            onPreviewVideo={
              resolvedVideo ? () => onPreviewVideo(resolvedVideo, sheet?.overview.title) : undefined
            }
          />
        </div>
      </div>

      {canMergePanels ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-[#e8e8ed] bg-white px-4 py-2.5">
          <span className="text-xs text-[#6e6e73]">
            <Clapperboard className="mr-1 inline h-3.5 w-3.5" />
            已有 {panelVideoCount} 个镜头视频可拼接
          </span>
          <EcomButtonSecondary size="sm" type="button" disabled={mergeBusy} onClick={onMergePanelVideos}>
            {mergeBusy ? "合并中…" : "合并分镜视频"}
          </EcomButtonSecondary>
        </div>
      ) : null}
    </div>
  );
}
