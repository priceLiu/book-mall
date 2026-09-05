"use client";

import Image from "next/image";
import { ImageIcon } from "lucide-react";

import { EcomMediaGeneratingBusy } from "@/components/media/ecom-media-generating-busy";
import { EcomSaveToPoseLibraryButton } from "@/components/admin/ecom-save-to-pose-library-button";
import { StoryboardPanelImageHoverActions } from "@/components/storyboard/storyboard-panel-image-hover-actions";
import { storyboardPanelCardWidth, storyboardPreviewAspectClass } from "@/lib/storyboard-aspect";
import type { StoryboardPanel } from "@/lib/storyboard-types";
import { cn } from "@/lib/utils";

type Props = {
  panel: StoryboardPanel;
  aspectRatio?: "16:9" | "9:16";
  imageUrl?: string | null;
  busy?: boolean;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  onRegenerateImage?: () => void;
  onRegenerateVideo?: () => void;
  onPreviewImage?: () => void;
  onPreviewImagePrompt?: () => void;
  onPreviewPanelVideo?: () => void;
  onEditScript?: () => void;
  /** 卡片序号前缀，默认「镜头」（故事版）；模特图模块传「姿势」 */
  indexLabel?: string;
  generateImageTitle?: string;
};

export function StoryboardPanelCard({
  panel,
  aspectRatio = "9:16",
  imageUrl,
  busy,
  selectable = false,
  selected = false,
  onToggleSelect,
  onRegenerateImage,
  onPreviewImage,
  onPreviewImagePrompt,
  onPreviewPanelVideo,
  indexLabel = "镜头",
  generateImageTitle = "生成此镜头分镜图",
}: Props) {
  const hasPanelVideo = Boolean(panel.videoUrl);
  const cardWidth = storyboardPanelCardWidth(aspectRatio);

  return (
    <article
      className={cn(
        "group relative flex shrink-0 flex-col overflow-hidden rounded-xl border bg-white shadow-sm transition",
        selected ? "border-[var(--ecom-primary)] ring-2 ring-[#0071e3]/25" : "border-[#e8e8ed]",
      )}
      style={{ width: cardWidth }}
      onClick={
        selectable && onToggleSelect
          ? (e) => {
              const t = e.target as HTMLElement;
              if (t.closest("button, a, input, label")) return;
              onToggleSelect();
            }
          : undefined
      }
    >
      {selectable && onToggleSelect ? (
        <label
          className="absolute left-2 top-2 z-20 flex cursor-pointer items-center gap-1 rounded-md bg-white/90 px-1.5 py-0.5 shadow-sm"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelect}
            aria-label={`选择${indexLabel} ${panel.index}`}
            className="h-3.5 w-3.5 accent-[var(--ecom-primary)]"
          />
        </label>
      ) : null}
      <div
        className={cn(
          "relative w-full bg-[#f5f5f7]",
          storyboardPreviewAspectClass(aspectRatio),
          imageUrl && !busy && "group/image",
        )}
      >
        {imageUrl ? (
          <Image src={imageUrl} alt={`${indexLabel}${panel.index}`} fill className="object-cover" unoptimized />
        ) : (
          <button
            type="button"
            title={generateImageTitle}
            disabled={!onRegenerateImage || busy}
            className="flex h-full w-full flex-col items-center justify-center gap-2 text-[#86868b] transition hover:bg-[#ebebed] disabled:cursor-default disabled:hover:bg-transparent"
            onClick={(e) => {
              e.stopPropagation();
              onRegenerateImage?.();
            }}
          >
            <ImageIcon className="h-8 w-8 opacity-40" />
            <span className="text-xs">待生成</span>
          </button>
        )}
        {busy ? <EcomMediaGeneratingBusy className="absolute inset-0 h-full w-full" /> : null}

        {imageUrl && !busy ? (
          <StoryboardPanelImageHoverActions
            onPreview={onPreviewImage}
            onRegenerate={onRegenerateImage}
            onPreviewPrompt={onPreviewImagePrompt}
          />
        ) : null}
      </div>

      <div className="flex items-center justify-between px-3 py-2">
        <p className="text-xs font-semibold text-[#1d1d1f]">
          {indexLabel} {panel.index}
          {panel.timeline ? (
            <span className="ml-1 font-normal text-[#86868b]">{panel.timeline}</span>
          ) : null}
        </p>
        {hasPanelVideo && onPreviewPanelVideo ? (
          <button
            type="button"
            className="text-[10px] font-medium text-[#34c759] hover:underline"
            onClick={(e) => {
              e.stopPropagation();
              onPreviewPanelVideo();
            }}
          >
            有视频
          </button>
        ) : imageUrl ? (
          <EcomSaveToPoseLibraryButton
            imageUrl={imageUrl}
            prompt={panel.imagePrompt}
            sourceModule="ecom-storyboard"
            sourceAssetId={`panel-${panel.index}`}
          />
        ) : null}
      </div>
    </article>
  );
}
