"use client";

import { EcomVideoSlot } from "@/components/media/ecom-video-slot";
import { StoryboardPanelVideoHoverActions } from "@/components/storyboard/storyboard-panel-video-hover-actions";
import { storyboardPanelCardWidth } from "@/lib/storyboard-aspect";
import type { StoryboardPanel } from "@/lib/storyboard-types";
import { cn } from "@/lib/utils";

type Props = {
  panel: StoryboardPanel;
  aspectRatio?: "16:9" | "9:16";
  videoUrl?: string | null;
  posterUrl?: string | null;
  busy?: boolean;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  onPreview?: () => void;
  onRegenerateVideo?: () => void;
};

export function StoryboardPanelVideoCard({
  panel,
  aspectRatio = "9:16",
  videoUrl,
  posterUrl,
  busy = false,
  selectable = false,
  selected = false,
  onToggleSelect,
  onPreview,
  onRegenerateVideo,
}: Props) {
  const cardWidth = storyboardPanelCardWidth(aspectRatio);
  const hasVideo = Boolean(videoUrl?.trim());
  const showHoverActions = hasVideo && !busy && (onPreview || onRegenerateVideo);

  return (
    <article
      className={cn(
        "group relative flex shrink-0 flex-col overflow-hidden rounded-xl border bg-white shadow-sm transition",
        selected ? "border-[var(--ecom-primary)] ring-2 ring-[#0071e3]/25" : "border-[#e8e8ed]",
      )}
      style={{ width: cardWidth }}
      onClick={
        selectable && onToggleSelect && hasVideo && !busy
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
            disabled={!hasVideo || busy}
            onChange={onToggleSelect}
            aria-label={`选择镜头 ${panel.index} 视频`}
            className="h-3.5 w-3.5 accent-[var(--ecom-primary)] disabled:cursor-not-allowed disabled:opacity-40"
          />
        </label>
      ) : null}
      <div
        className={cn(
          "relative flex justify-center bg-[#f5f5f7] p-2",
          showHoverActions && "group/video-hover",
        )}
      >
        <EcomVideoSlot
          src={videoUrl}
          aspectRatio={aspectRatio}
          generating={busy}
          generatingPosterUrl={posterUrl ?? undefined}
          emptyLabel={busy ? "生成中…" : "待生成"}
          playSize="md"
          onPreview={showHoverActions ? undefined : hasVideo && !busy ? onPreview : undefined}
        />
        {showHoverActions ? (
          <StoryboardPanelVideoHoverActions
            onPreview={onPreview}
            onRegenerate={onRegenerateVideo}
          />
        ) : null}
      </div>
      <div className="flex items-center justify-between px-3 py-2">
        <p className="text-xs font-semibold text-[#1d1d1f]">
          镜头 {panel.index}
          {panel.timeline ? (
            <span className="ml-1 font-normal text-[#86868b]">{panel.timeline}</span>
          ) : null}
        </p>
        {hasVideo && !busy ? (
          <span className="text-[10px] font-medium text-[#34c759]">已生成</span>
        ) : busy ? (
          <span className="text-[10px] font-medium text-[#0071e3]">生成中</span>
        ) : null}
      </div>
    </article>
  );
}
