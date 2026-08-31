"use client";

import { Loader2 } from "lucide-react";
import { useMemo } from "react";

import { EcomVideoSlot } from "@/components/media/ecom-video-slot";
import { StoryboardPanelCard } from "@/components/storyboard/storyboard-panel-card";
import { StoryboardPanelVideoCard } from "@/components/storyboard/storyboard-panel-video-card";
import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import type { StoryboardPanel, StoryboardSheet } from "@/lib/storyboard-types";
import { resolveStoryboardMergeTargetIndexes } from "@/lib/storyboard-pending-panels";

type Props = {
  sheet: StoryboardSheet;
  aspectRatio: "16:9" | "9:16";
  selectedImagePanels: ReadonlySet<number>;
  onToggleImagePanelSelect: (panelIndex: number) => void;
  selectedVideoPanels: ReadonlySet<number>;
  onToggleVideoPanelSelect: (panelIndex: number) => void;
  activeImageGenPanels: ReadonlySet<number>;
  panelVidBusyPanels: readonly number[];
  imgBusy?: boolean;
  vidBusy?: boolean;
  mergeBusy?: boolean;
  /** 无勾选时生成全部；有勾选时仅生成选中镜 */
  onGenerateAllImages: (panelIndexes?: number[]) => void;
  onGenerateSelectedVideos: (panelIndexes: number[]) => void;
  onMergeSelectedVideos: (panelIndexes: number[]) => void;
  onGeneratePanelImage: (panelIndex: number) => void;
  mergedVideoUrl?: string | null;
  mergedVideoExpiresAt?: string | null;
  onPreviewMergedVideo?: () => void;
  onPreviewImage?: (src: string, title: string) => void;
  onPreviewPanelPrompt?: (panelIndex: number) => void;
  onPreviewPanelVideo?: (panelIndex: number, videoUrl: string) => void;
  onRegeneratePanelVideo?: (panelIndex: number) => void;
};

export function StoryboardPanelMediaStrip({
  sheet,
  aspectRatio,
  selectedImagePanels,
  onToggleImagePanelSelect,
  selectedVideoPanels,
  onToggleVideoPanelSelect,
  activeImageGenPanels,
  panelVidBusyPanels,
  imgBusy = false,
  vidBusy = false,
  mergeBusy = false,
  onGenerateAllImages,
  onGenerateSelectedVideos,
  onMergeSelectedVideos,
  onGeneratePanelImage,
  mergedVideoUrl,
  mergedVideoExpiresAt,
  onPreviewMergedVideo,
  onPreviewImage,
  onPreviewPanelPrompt,
  onPreviewPanelVideo,
  onRegeneratePanelVideo,
}: Props) {
  const selectedImageList = useMemo(
    () => [...selectedImagePanels].sort((a, b) => a - b),
    [selectedImagePanels],
  );

  const selectedVideoList = useMemo(
    () => [...selectedVideoPanels].sort((a, b) => a - b),
    [selectedVideoPanels],
  );

  const panelByIndex = useMemo(() => {
    const map = new Map<number, StoryboardPanel>();
    for (const p of sheet.panels) map.set(p.index, p);
    return map;
  }, [sheet.panels]);

  const videoTargetIndexes = useMemo(
    () =>
      selectedImageList.filter((index) => {
        const p = panelByIndex.get(index);
        return Boolean(p?.imageUrl?.trim());
      }),
    [selectedImageList, panelByIndex],
  );

  /** 须勾选 ≥2 个已有 videoUrl 的单镜；未勾选时不默认合并全部 */
  const mergeTargetIndexes = useMemo(
    () =>
      resolveStoryboardMergeTargetIndexes({
        selectedVideoPanels: selectedVideoList,
        panels: sheet.panels,
      }),
    [selectedVideoList, sheet.panels],
  );

  const videoActionTargets = useMemo(
    () => videoTargetIndexes.filter((index) => !panelVidBusyPanels.includes(index)),
    [videoTargetIndexes, panelVidBusyPanels],
  );

  const anySelectedVideoBusy = videoActionTargets.some((index) =>
    panelVidBusyPanels.includes(index),
  );

  const panelVideoCount = useMemo(
    () => sheet.panels.filter((p) => Boolean(p.videoUrl?.trim())).length,
    [sheet.panels],
  );

  const imageStripBusy = imgBusy || activeImageGenPanels.size > 0;
  const generateVideoDisabled = videoActionTargets.length === 0;
  const hasMergedVideo = Boolean(mergedVideoUrl?.trim());
  const mergedExpiresLabel =
    mergedVideoExpiresAt &&
    !Number.isNaN(new Date(mergedVideoExpiresAt).getTime())
      ? new Date(mergedVideoExpiresAt).toLocaleString("zh-CN", {
          month: "numeric",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : null;

  return (
    <div className="space-y-8">
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-medium text-[#1d1d1f]">各镜头分镜图</p>
          <div className="flex flex-wrap items-center gap-2">
            <EcomButtonSecondary
              size="sm"
              type="button"
              disabled={imageStripBusy}
              onClick={() =>
                onGenerateAllImages(
                  selectedImageList.length > 0 ? selectedImageList : undefined,
                )
              }
            >
              {selectedImageList.length > 0
                ? `生成分镜图（${selectedImageList.length}）`
                : "生成全部分镜图"}
            </EcomButtonSecondary>
            <EcomButtonSecondary
              size="sm"
              type="button"
              disabled={generateVideoDisabled}
              onClick={() => onGenerateSelectedVideos(videoActionTargets)}
            >
              {anySelectedVideoBusy ? (
                <>
                  <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" />
                  生成视频中…
                </>
              ) : (
                `生成视频${videoActionTargets.length > 0 ? `（${videoActionTargets.length}）` : videoTargetIndexes.length > 0 ? `（${videoTargetIndexes.length}）` : ""}`
              )}
            </EcomButtonSecondary>
          </div>
        </div>
        <p className="mb-3 text-[11px] leading-relaxed text-[#86868b]">
          勾选有分镜图的镜头后可批量生成视频；合并请在下方「单镜视频」区操作。
        </p>
        <div className="flex flex-wrap gap-4">
          {sheet.panels.map((panel, i) => (
            <StoryboardPanelCard
              key={`strip-panel-${panel.index}-${i}`}
              panel={panel}
              aspectRatio={aspectRatio}
              imageUrl={panel.imageUrl}
              selectable
              selected={selectedImagePanels.has(panel.index)}
              onToggleSelect={() => onToggleImagePanelSelect(panel.index)}
              busy={activeImageGenPanels.has(panel.index)}
              onRegenerateImage={() => onGeneratePanelImage(panel.index)}
              onPreviewImage={
                panel.imageUrl && onPreviewImage
                  ? () => onPreviewImage(panel.imageUrl!, `镜头 ${panel.index}`)
                  : undefined
              }
              onPreviewImagePrompt={
                onPreviewPanelPrompt ? () => onPreviewPanelPrompt(panel.index) : undefined
              }
            />
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-[#e8e8ed] bg-[#fafafa] p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-medium text-[#1d1d1f]">各镜头单镜视频</p>
            <p className="mt-0.5 text-[11px] text-[#86868b]">
              已生成 {panelVideoCount} / {sheet.panels.length} 镜
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <EcomButtonPrimary
              size="sm"
              type="button"
              disabled={mergeBusy || mergeTargetIndexes.length < 2}
              onClick={() => onMergeSelectedVideos(mergeTargetIndexes)}
            >
              {mergeBusy ? (
                <>
                  <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" />
                  合并中…
                </>
              ) : (
                `合并视频${mergeTargetIndexes.length >= 2 ? `（${mergeTargetIndexes.length}）` : ""}`
              )}
            </EcomButtonPrimary>
          </div>
        </div>
        <p className="mb-3 text-[11px] leading-relaxed text-[#86868b]">
          勾选至少 2 个已生成的单镜视频后点「合并视频」；成片显示在下方「合并成片」区。
        </p>
        <div className="flex flex-wrap gap-4">
          {sheet.panels.map((panel, i) => (
            <StoryboardPanelVideoCard
              key={`strip-video-${panel.index}-${i}`}
              panel={panel}
              aspectRatio={aspectRatio}
              videoUrl={panel.videoUrl}
              posterUrl={panel.imageUrl}
              selectable
              selected={selectedVideoPanels.has(panel.index)}
              onToggleSelect={() => onToggleVideoPanelSelect(panel.index)}
              busy={panelVidBusyPanels.includes(panel.index)}
              onPreview={
                panel.videoUrl && onPreviewPanelVideo
                  ? () => onPreviewPanelVideo(panel.index, panel.videoUrl!)
                  : undefined
              }
              onRegenerateVideo={
                onRegeneratePanelVideo && panel.imageUrl?.trim()
                  ? () => onRegeneratePanelVideo(panel.index)
                  : undefined
              }
            />
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-[#e8e8ed] bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-medium text-[#1d1d1f]">合并成片</p>
            <p className="mt-0.5 text-[11px] text-[#86868b]">
              {hasMergedVideo
                ? "各镜头已云端合成（含转场）"
                : mergeBusy
                  ? "正在合成…"
                  : "勾选单镜视频后点上方「合并视频」"}
            </p>
          </div>
          {hasMergedVideo ? (
            <span className="text-[10px] font-medium text-[#34c759]">已生成</span>
          ) : null}
        </div>
        <div className="mx-auto w-full max-w-sm">
          <EcomVideoSlot
            src={mergedVideoUrl}
            aspectRatio={aspectRatio}
            generating={mergeBusy}
            emptyLabel={mergeBusy ? "合并中…" : "待合并"}
            playSize="md"
            layout="gallery-workspace"
            className="!bg-black"
            onPreview={
              hasMergedVideo && !mergeBusy && onPreviewMergedVideo
                ? onPreviewMergedVideo
                : undefined
            }
          />
        </div>
        {mergedExpiresLabel ? (
          <p className="mt-2 text-center text-[10px] text-[#86868b]">
            限时下载至 {mergedExpiresLabel}，请及时保存；到期后云端文件将清理。
          </p>
        ) : null}
      </section>
    </div>
  );
}
