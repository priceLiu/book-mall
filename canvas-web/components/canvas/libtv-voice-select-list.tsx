"use client";

import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { LibtvVoicePreviewButton } from "./libtv-voice-preview-button";

export type LibtvVoiceSelectOption = {
  value: string;
  label: string;
  subtitle?: string;
  previewUrl?: string;
  disabled?: boolean;
  /** 列表项唯一 key；默认同 value */
  rowKey?: string;
};

const DEFAULT_PAGE_SIZE = 10;
const LOAD_MORE_THRESHOLD_PX = 48;

export function LibtvVoiceSelectList({
  options,
  value,
  onSelect,
  pageSize = DEFAULT_PAGE_SIZE,
  loading = false,
  hasMore = false,
  onLoadMore,
  maxHeightClass = "max-h-[240px]",
  minimaxOssPreviewFallback = false,
}: {
  options: LibtvVoiceSelectOption[];
  value: string;
  onSelect: (voiceId: string) => void;
  pageSize?: number;
  loading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  maxHeightClass?: string;
  /** MiniMax 音色列表为 true；Qwen 等无 OSS 试听须 false */
  minimaxOssPreviewFallback?: boolean;
}) {
  const selectedIdx = useMemo(
    () => options.findIndex((o) => o.value === value),
    [options, value],
  );

  const [visibleCount, setVisibleCount] = useState(() =>
    selectedIdx >= 0
      ? Math.min(options.length, Math.max(pageSize, selectedIdx + 1))
      : pageSize,
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);
  const loadMoreCooldownRef = useRef(false);

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  useEffect(() => {
    if (selectedIdx < 0) return;
    setVisibleCount((prev) =>
      Math.max(prev, Math.min(options.length, selectedIdx + 1)),
    );
  }, [selectedIdx, options.length]);

  const visibleItems = options.slice(0, visibleCount);
  const canExpandLocal = visibleCount < options.length;

  const tryLoadMore = useCallback(() => {
    if (loadMoreCooldownRef.current || loadingRef.current) return;

    if (canExpandLocal) {
      loadMoreCooldownRef.current = true;
      setVisibleCount((c) => Math.min(c + pageSize, options.length));
      window.setTimeout(() => {
        loadMoreCooldownRef.current = false;
      }, 120);
      return;
    }

    if (hasMore && onLoadMore && !loading) {
      loadMoreCooldownRef.current = true;
      loadingRef.current = true;
      onLoadMore();
      window.setTimeout(() => {
        loadMoreCooldownRef.current = false;
      }, 280);
    }
  }, [canExpandLocal, hasMore, loading, onLoadMore, options.length, pageSize]);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const remaining = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (remaining <= LOAD_MORE_THRESHOLD_PX) tryLoadMore();
  }, [tryLoadMore]);

  if (options.length === 0 && loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-6 text-[12px] text-white/45">
        <Loader2 className="size-3.5 animate-spin" />
        加载音色…
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className={cn(
        "nodrag nowheel overflow-y-auto overscroll-contain px-0.5",
        maxHeightClass,
      )}
      data-canvas-wheel-scroll
      onWheel={(e) => e.stopPropagation()}
      onScroll={onScroll}
    >
      {visibleItems.map((voice) => {
        const active = value === voice.value;
        return (
          <div
            key={voice.rowKey ?? voice.value}
            className={cn(
              "flex items-center gap-1 rounded-md pr-1 transition",
              active ? "bg-white/[0.12]" : "hover:bg-white/[0.06]",
            )}
          >
            <button
              type="button"
              disabled={voice.disabled}
              className={cn(
                "flex min-w-0 flex-1 flex-col px-2.5 py-2 text-left",
                active ? "text-white" : "text-white/75",
                voice.disabled && "cursor-not-allowed opacity-50",
              )}
              onClick={() => onSelect(voice.value)}
            >
              <span className="truncate text-[13px] font-medium">{voice.label}</span>
              {voice.subtitle ? (
                <span className="truncate text-[11px] text-white/45">{voice.subtitle}</span>
              ) : null}
            </button>
            <LibtvVoicePreviewButton
              previewUrl={voice.previewUrl}
              voiceId={voice.value}
              minimaxOssFallback={minimaxOssPreviewFallback}
            />
          </div>
        );
      })}
      {loading && options.length > 0 ? (
        <p className="pb-1 text-center text-[11px] text-white/40">加载更多音色…</p>
      ) : null}
    </div>
  );
}
