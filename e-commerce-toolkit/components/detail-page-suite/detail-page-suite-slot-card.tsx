"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight, ImageIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { EcomMediaGeneratingBusy } from "@/components/media/ecom-media-generating-busy";
import { StoryboardPanelImageHoverActions } from "@/components/storyboard/storyboard-panel-image-hover-actions";
import type { EcomDetailPageRatio } from "@/lib/detail-page-suite-platform-ratio";
import {
  detailPageAspectClass,
  detailPageCardWidth,
} from "@/lib/detail-page-suite-platform-ratio";
import {
  clampDetailPageSuiteActiveImageIndex,
  resolveDetailPageSuiteActiveImageIndex,
  resolveDetailPageSuiteSlotHistory,
} from "@/lib/detail-page-suite-slot-images";
import type { DetailPageSuiteSlot } from "@/lib/detail-page-suite-types";
import { useSaveToCatalog } from "@/lib/use-save-to-catalog";
import { cn } from "@/lib/utils";

type Props = {
  slot: DetailPageSuiteSlot;
  moduleId: string;
  displayRatio: EcomDetailPageRatio;
  busy?: boolean;
  busyLabel?: string;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  onRegenerateImage?: () => void;
  onPreviewImage?: (url: string) => void;
  onPreviewPrompt?: () => void;
  onEditPrompt?: (prompt: string) => void;
  onRewritePrompt?: () => void;
  onActiveImageIndexChange?: (index: number) => void;
};

export function DetailPageSuiteSlotCard({
  slot,
  moduleId,
  displayRatio,
  busy,
  busyLabel,
  selectable = false,
  selected = false,
  onToggleSelect,
  onRegenerateImage,
  onPreviewImage,
  onPreviewPrompt,
  onEditPrompt,
  onRewritePrompt,
  onActiveImageIndexChange,
}: Props) {
  const saveToCatalog = useSaveToCatalog();
  const history = useMemo(() => resolveDetailPageSuiteSlotHistory(slot), [slot]);
  const serverActiveIndex = useMemo(
    () => resolveDetailPageSuiteActiveImageIndex(slot),
    [slot],
  );
  const [activeIndex, setActiveIndex] = useState(serverActiveIndex);

  useEffect(() => {
    setActiveIndex(serverActiveIndex);
  }, [serverActiveIndex, slot.item_key, history.length]);

  const activeImage = useMemo(() => {
    if (history.length === 0) return null;
    const idx = clampDetailPageSuiteActiveImageIndex(activeIndex, history.length);
    return history[idx] ?? null;
  }, [activeIndex, history]);

  const displayUrl = activeImage?.url ?? null;
  const hasMultiple = history.length > 1;
  const cardWidth = detailPageCardWidth(displayRatio);
  const hasPrompt = Boolean(slot.positive_prompt?.trim());

  const shiftActive = useCallback(
    (delta: number) => {
      if (history.length <= 1) return;
      const next = clampDetailPageSuiteActiveImageIndex(activeIndex + delta, history.length);
      if (next === activeIndex) return;
      setActiveIndex(next);
      onActiveImageIndexChange?.(next);
    },
    [activeIndex, history.length, onActiveImageIndexChange],
  );

  return (
    <article
      className={cn(
        "group relative isolate flex shrink-0 flex-col overflow-hidden rounded-xl border bg-white shadow-sm transition",
        selected ? "border-[var(--ecom-primary)] ring-2 ring-[#0071e3]/25" : "border-[#e8e8ed]",
      )}
      style={{ width: cardWidth }}
      onClick={
        selectable && onToggleSelect
          ? (e) => {
              const t = e.target as HTMLElement;
              if (t.closest("button, a, input, label, textarea")) return;
              onToggleSelect();
            }
          : undefined
      }
    >
      <div
        className={cn(
          "relative w-full bg-[#f5f5f7]",
          detailPageAspectClass(displayRatio),
          displayUrl && !busy && "group/image",
        )}
      >
        {selectable && onToggleSelect ? (
          <label
            className={cn(
              "absolute left-2 top-2 z-20 flex items-center gap-1 rounded-md bg-white/90 px-1.5 py-0.5 shadow-sm",
              hasPrompt ? "cursor-pointer" : "cursor-not-allowed opacity-60",
            )}
            onClick={(e) => e.stopPropagation()}
            title={hasPrompt ? "勾选参与出图" : "请先生成提示词"}
          >
            <input
              type="checkbox"
              checked={hasPrompt ? selected : false}
              disabled={!hasPrompt}
              onChange={onToggleSelect}
              aria-label={`选择 ${slot.item_label}`}
              className="h-3.5 w-3.5 accent-[var(--ecom-primary)]"
            />
          </label>
        ) : null}

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
              alt={slot.item_label}
              fill
              className="relative z-[1] object-cover"
              unoptimized
            />
          </>
        ) : (
          <button
            type="button"
            title={hasPrompt ? "生成此点位图" : "请先生成提示词"}
            disabled={!onRegenerateImage || busy || !hasPrompt}
            className="flex h-full w-full flex-col items-center justify-center gap-2 px-3 text-[#86868b] transition hover:bg-[#ebebed] disabled:cursor-default disabled:hover:bg-transparent"
            onClick={(e) => {
              e.stopPropagation();
              onRegenerateImage?.();
            }}
          >
            {hasPrompt ? (
              <p className="line-clamp-6 w-full text-left text-[10px] leading-relaxed text-[#6e6e73]">
                {slot.positive_prompt}
              </p>
            ) : (
              <>
                <ImageIcon className="h-8 w-8 opacity-40" />
                <span className="text-xs">待生成提示词</span>
              </>
            )}
          </button>
        )}

        {busy ? (
          <EcomMediaGeneratingBusy
            label={busyLabel ?? "出图中…"}
            className="absolute inset-0 z-[2] h-full w-full"
          />
        ) : null}

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
                shiftActive(+1);
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
            onPreviewPrompt={onPreviewPrompt}
            onSaveToCatalog={() =>
              saveToCatalog({
                url: displayUrl,
                prompt: slot.positive_prompt,
                sourceModule: "detail-page-suite",
                sourceAssetId: `${moduleId}:${slot.item_key}`,
              })
            }
          />
        ) : null}
      </div>

      <div className="space-y-1 px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-xs font-semibold text-[#1d1d1f]">{slot.item_label}</p>
          {history.length > 0 ? (
            <span className="shrink-0 text-[10px] text-[#86868b]">
              {history.length > 1 ? `${history.length} 版` : "已生成"}
            </span>
          ) : null}
        </div>
        {onEditPrompt && hasPrompt && !displayUrl ? (
          <textarea
            className="min-h-[52px] w-full resize-none rounded border border-[#e8e8ed] px-2 py-1 text-[10px] leading-relaxed text-[#424245] outline-none focus:border-[#0071e3]"
            value={slot.positive_prompt}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onEditPrompt(e.target.value)}
          />
        ) : null}
        {hasPrompt && onRewritePrompt ? (
          <button
            type="button"
            className="text-[10px] text-[#0071e3] hover:underline"
            onClick={(e) => {
              e.stopPropagation();
              onRewritePrompt();
            }}
          >
            AI 重写本条
          </button>
        ) : null}
      </div>
    </article>
  );
}
