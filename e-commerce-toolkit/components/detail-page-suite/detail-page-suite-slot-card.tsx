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
  buildDetailPageSuiteSlotPreviewItems,
  clampDetailPageSuiteActiveImageIndex,
  resolveDetailPageSuiteActiveImageIndex,
  resolveDetailPageSuiteSlotHistory,
} from "@/lib/detail-page-suite-slot-images";
import type { EcomImagePreviewItem } from "@/lib/media/ecom-image-preview";
import { isDetailPageSuiteSizeChartPromptMarker } from "@/lib/detail-page-suite-size-chart";
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
  onPreviewImage?: (payload: {
    src: string;
    title: string;
    items: EcomImagePreviewItem[];
    initialIndex: number;
  }) => void;
  onPreviewPrompt?: () => void;
  onOpenPromptEdit?: () => void;
  onActiveImageIndexChange?: (index: number) => void;
  imageGenError?: string;
  /** 爆款：始终展示模块文案占位 */
  slotCopyMode?: "hit";
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
  onPreviewImage,
  onPreviewPrompt,
  onOpenPromptEdit,
  onActiveImageIndexChange,
  imageGenError,
  slotCopyMode,
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
  const hasPrompt =
    Boolean(slot.positive_prompt?.trim()) ||
    isDetailPageSuiteSizeChartPromptMarker(slot.positive_prompt);

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
        busy && "ecom-media-generating-sweep border-[#0071e3]/40",
        !busy && selected
          ? "border-[var(--ecom-primary)] ring-2 ring-[#0071e3]/25"
          : !busy && "border-[#e8e8ed]",
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
              busy ? "cursor-not-allowed opacity-60" : "cursor-pointer",
            )}
            onClick={(e) => e.stopPropagation()}
            title="勾选参与批量操作"
          >
            <input
              type="checkbox"
              checked={selected}
              disabled={busy}
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
        ) : hasPrompt && onOpenPromptEdit ? (
          <button
            type="button"
            title={
              isDetailPageSuiteSizeChartPromptMarker(slot.positive_prompt)
                ? "点击编辑尺码参数"
                : "点击编辑出图提示词"
            }
            disabled={busy}
            className="flex h-full w-full items-stretch px-3 py-3 text-left transition hover:bg-[#ebebed] disabled:cursor-default disabled:hover:bg-transparent"
            onClick={(e) => {
              e.stopPropagation();
              onOpenPromptEdit();
            }}
          >
            <p className="line-clamp-[10] w-full text-[10px] leading-relaxed text-[#424245]">
              {isDetailPageSuiteSizeChartPromptMarker(slot.positive_prompt)
                ? "系统尺码表 · 已就绪，点击编辑尺码数据后生图"
                : slot.positive_prompt}
            </p>
          </button>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-3 text-[#86868b]">
            <ImageIcon className="h-8 w-8 opacity-40" />
            <span className="text-xs">{busy ? "提示词生成中…" : "待生成提示词"}</span>
          </div>
        )}

        {busy ? (
          <EcomMediaGeneratingBusy
            label={busyLabel ?? "出图中…"}
            background={displayUrl ? "overlay" : "light"}
            className="absolute inset-0 z-[2] h-full w-full"
          />
        ) : null}

        {hasMultiple && displayUrl && !busy ? (
          <div className="pointer-events-none absolute right-1 top-1 z-[30]">
            <span className="rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium leading-none text-white">
              {activeIndex + 1} / {history.length}
            </span>
          </div>
        ) : null}

        {hasMultiple && displayUrl && !busy ? (
          <div className="absolute inset-0 z-[4] flex items-center justify-between px-0.5 opacity-0 transition group-hover/image:opacity-100">
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
            onPreview={
              onPreviewImage && displayUrl
                ? () => {
                    const items = buildDetailPageSuiteSlotPreviewItems(slot);
                    onPreviewImage({
                      src: displayUrl,
                      title: slot.item_label,
                      items,
                      initialIndex: activeIndex,
                    });
                  }
                : undefined
            }
            onPreviewPrompt={onOpenPromptEdit ?? onPreviewPrompt}
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
          <p className="truncate text-xs font-semibold text-[#1d1d1f]" title={slot.item_label}>
            {slot.item_label}
          </p>
          {history.length > 0 ? (
            <span className="shrink-0 text-[10px] text-[#86868b]">
              {history.length > 1 ? `${history.length} 版` : "已生成"}
            </span>
          ) : imageGenError ? (
            <span className="shrink-0 text-[10px] text-[#ff3b30]">出图失败</span>
          ) : null}
        </div>
        {slotCopyMode === "hit" ? (
          <p
            className="line-clamp-3 text-[10px] leading-relaxed text-[#424245]"
            title={
              slot.slot_copy?.trim() || slot.slot_copy_ai?.trim() || undefined
            }
          >
            <span className="text-[#86868b]">模块文案：</span>
            {slot.slot_copy?.trim() ||
              slot.slot_copy_ai?.trim() ||
              "（未填写，可点格子编辑）"}
            {slot.burn_copy_in_image &&
            (slot.slot_copy?.trim() || slot.slot_copy_ai?.trim()) ? (
              <span className="ml-1 text-[#0066cc]">· 出图含字</span>
            ) : null}
          </p>
        ) : slot.slot_copy?.trim() ? (
          <p className="line-clamp-3 text-[10px] leading-relaxed text-[#424245]" title={slot.slot_copy}>
            {slot.slot_copy}
          </p>
        ) : null}
        {imageGenError ? (
          <p
            className="line-clamp-2 text-[10px] leading-relaxed text-[#ff3b30]"
            title={imageGenError}
          >
            {imageGenError}
          </p>
        ) : null}
      </div>
    </article>
  );
}
