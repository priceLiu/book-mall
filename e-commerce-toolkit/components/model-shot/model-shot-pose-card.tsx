"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight, ImageIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { EcomMediaGeneratingBusy } from "@/components/media/ecom-media-generating-busy";
import { StoryboardPanelImageHoverActions } from "@/components/storyboard/storyboard-panel-image-hover-actions";
import { storyboardPreviewAspectClass } from "@/lib/storyboard-aspect";
import type { StoryboardPanel } from "@/lib/storyboard-types";
import {
  clampModelShotActiveImageIndex,
  resolveModelShotActiveImage,
  resolveModelShotActiveImageIndex,
  resolveModelShotPoseImageHistory,
} from "@/lib/model-shot-pose-images";
import type { ModelShotPoseItem } from "@/lib/model-shot-types";
import { cn } from "@/lib/utils";

type Props = {
  item: ModelShotPoseItem;
  panel: StoryboardPanel;
  aspectRatio?: "16:9" | "9:16";
  busy?: boolean;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  onRegenerateImage?: () => void;
  onPreviewImage?: (url: string) => void;
  onPreviewImagePrompt?: () => void;
  onActiveImageIndexChange?: (index: number) => void;
  indexLabel?: string;
  generateImageTitle?: string;
};

export function ModelShotPoseCard({
  item,
  panel,
  aspectRatio = "9:16",
  busy,
  selectable = false,
  selected = false,
  onToggleSelect,
  onRegenerateImage,
  onPreviewImage,
  onPreviewImagePrompt,
  onActiveImageIndexChange,
  indexLabel = "姿势",
  generateImageTitle = "生成此姿势模特图",
}: Props) {
  const history = useMemo(() => resolveModelShotPoseImageHistory(item), [item]);
  const serverActiveIndex = useMemo(() => resolveModelShotActiveImageIndex(item), [item]);
  const [activeIndex, setActiveIndex] = useState(serverActiveIndex);

  useEffect(() => {
    setActiveIndex(serverActiveIndex);
  }, [serverActiveIndex, item.index, history.length]);

  const activeImage = useMemo(() => {
    if (history.length === 0) return null;
    const idx = clampModelShotActiveImageIndex(activeIndex, history.length);
    return history[idx] ?? null;
  }, [activeIndex, history]);

  const displayUrl = activeImage?.url ?? null;
  const hasMultiple = history.length > 1;

  const shiftActive = useCallback(
    (delta: number) => {
      if (history.length <= 1) return;
      const next = clampModelShotActiveImageIndex(activeIndex + delta, history.length);
      if (next === activeIndex) return;
      setActiveIndex(next);
      onActiveImageIndexChange?.(next);
    },
    [activeIndex, history.length, onActiveImageIndexChange],
  );

  return (
    <article
      className={cn(
        "group relative flex w-full min-w-0 flex-col overflow-hidden rounded-xl border bg-white shadow-sm transition",
        selected ? "border-[var(--ecom-primary)] ring-2 ring-[#0071e3]/25" : "border-[#e8e8ed]",
      )}
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
          displayUrl && !busy && "group/image",
        )}
      >
        {displayUrl ? (
          <>
            {history.length > 1 ? (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 translate-x-0.5 translate-y-0.5 scale-[0.98] overflow-hidden rounded-sm opacity-40"
              >
                <Image
                  src={history[Math.max(0, activeIndex - 1)]?.url ?? history[0]!.url}
                  alt=""
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
            ) : null}
            <Image
              src={displayUrl}
              alt={`${indexLabel}${panel.index}`}
              fill
              className="relative z-[1] object-cover"
              unoptimized
            />
          </>
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

        {busy ? <EcomMediaGeneratingBusy className="absolute inset-0 z-[2] h-full w-full" /> : null}

        {hasMultiple && displayUrl && !busy ? (
          <div className="pointer-events-none absolute inset-x-0 top-2 z-[3] flex justify-center opacity-0 transition group-hover/image:opacity-100">
            <span className="rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium text-white">
              {activeIndex + 1} / {history.length}
            </span>
          </div>
        ) : null}

        {hasMultiple && displayUrl && !busy ? (
          <div className="absolute inset-0 z-[4] flex items-center justify-between px-1 opacity-0 transition group-hover/image:opacity-100">
            <button
              type="button"
              aria-label="上一张"
              disabled={activeIndex <= 0}
              className="pointer-events-auto flex size-8 items-center justify-center rounded-full bg-black/50 text-white transition hover:bg-black/70 disabled:cursor-default disabled:opacity-30"
              onClick={(e) => {
                e.stopPropagation();
                shiftActive(-1);
              }}
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              aria-label="下一张"
              disabled={activeIndex >= history.length - 1}
              className="pointer-events-auto flex size-8 items-center justify-center rounded-full bg-black/50 text-white transition hover:bg-black/70 disabled:cursor-default disabled:opacity-30"
              onClick={(e) => {
                e.stopPropagation();
                shiftActive(1);
              }}
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        ) : null}

        {displayUrl && !busy ? (
          <StoryboardPanelImageHoverActions
            onPreview={onPreviewImage ? () => onPreviewImage(displayUrl) : undefined}
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
        {resolveModelShotActiveImage(item) ? (
          <span className="text-[10px] text-[#86868b]">
            {history.length > 1 ? `${history.length} 版` : "已生成"}
          </span>
        ) : null}
      </div>
    </article>
  );
}
