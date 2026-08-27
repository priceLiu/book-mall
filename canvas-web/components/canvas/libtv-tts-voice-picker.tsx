"use client";

import { ChevronDown, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { useLibtvDockToolbarMetrics } from "@/lib/canvas/use-libtv-dock-toolbar-metrics";
import {
  fetchLibtvClonedVoices,
  fetchLibtvVoicePage,
  type LibtvVoiceCatalogItem,
} from "@/lib/canvas/libtv-audio-voice-catalog-client";
import { cn } from "@/lib/utils";
import {
  Sbv1ToolbarDropdown,
  useSbv1ToolbarAnchor,
} from "./sbv1/sbv1-toolbar-anchor-popover";
import { LIBTV_DOCK_PARAMS_POPOVER_CLASS } from "./libtv-dock-picker-chrome";

const INITIAL_VISIBLE = 8;
const LOAD_MORE_STEP = 10;
const SYSTEM_PAGE_SIZE = 10;

export function libtvTtsVoiceTriggerLabel(
  voiceId: string,
  voices: LibtvVoiceCatalogItem[],
): string {
  const id = voiceId.trim();
  if (!id) return "音色";
  const hit = voices.find((v) => v.voiceId === id);
  if (hit) return hit.label;
  return id.length > 12 ? `${id.slice(0, 10)}…` : id;
}

export function LibtvTtsDockVoicePicker({
  voiceId,
  disabled,
  open: controlledOpen,
  onOpenChange,
  onSelectVoice,
}: {
  voiceId: string;
  disabled?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSelectVoice: (voiceId: string) => void;
}) {
  const base = useBookMallBaseUrl();
  const { anchorRef, open: internalOpen, setOpen: setInternalOpen, rect } =
    useSbv1ToolbarAnchor(controlledOpen);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const { fontPx, minHeightPx, chevronPx } = useLibtvDockToolbarMetrics();

  const [cloned, setCloned] = useState<LibtvVoiceCatalogItem[]>([]);
  const [system, setSystem] = useState<LibtvVoiceCatalogItem[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);

  const merged = useMemo(
    () => [...cloned, ...system],
    [cloned, system],
  );
  const selectedLabel = libtvTtsVoiceTriggerLabel(voiceId, merged);
  const visibleItems = merged.slice(0, visibleCount);
  const canLoadMore = visibleCount < merged.length || hasMore;

  const loadCloned = useCallback(async () => {
    if (!base) return;
    try {
      setCloned(await fetchLibtvClonedVoices(base));
    } catch {
      setCloned([]);
    }
  }, [base]);

  const loadSystemPage = useCallback(
    async (nextPage: number) => {
      if (!base) return;
      setLoading(true);
      try {
        const data = await fetchLibtvVoicePage(base, nextPage, SYSTEM_PAGE_SIZE);
        setSystem((prev) =>
          nextPage === 1 ? data.items : [...prev, ...data.items],
        );
        setPage(nextPage);
        setHasMore(data.hasMore);
      } finally {
        setLoading(false);
      }
    },
    [base],
  );

  useEffect(() => {
    if (!open || !base) return;
    void loadCloned();
    if (page === 0) void loadSystemPage(1);
  }, [open, base, loadCloned, loadSystemPage, page]);

  const onLoadMore = () => {
    const nextVisible = visibleCount + LOAD_MORE_STEP;
    if (nextVisible > merged.length && hasMore && !loading && base) {
      void loadSystemPage(page + 1);
    }
    setVisibleCount(nextVisible);
  };

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        disabled={disabled}
        title={selectedLabel}
        className="nodrag flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-2 text-white hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40"
        style={{ fontSize: fontPx, minHeight: minHeightPx }}
        onClick={() => setOpen(!open)}
      >
        <span className="whitespace-nowrap">{selectedLabel}</span>
        <ChevronDown
          className="shrink-0 opacity-45"
          style={{ width: chevronPx, height: chevronPx }}
        />
      </button>
      <Sbv1ToolbarDropdown
        open={open}
        setOpen={setOpen}
        rect={rect}
        placement="auto"
        estimatedHeight={360}
        className={LIBTV_DOCK_PARAMS_POPOVER_CLASS}
      >
        <div className="max-h-[320px] overflow-y-auto px-1 pb-1">
          {cloned.length > 0 ? (
            <p className="px-2 pb-1 pt-0.5 text-[11px] text-white/45">我的克隆音色</p>
          ) : null}
          {visibleItems.length === 0 && loading ? (
            <div className="flex items-center justify-center gap-2 py-6 text-[12px] text-white/45">
              <Loader2 className="size-3.5 animate-spin" />
              加载音色…
            </div>
          ) : null}
          {visibleItems.map((voice) => {
            const active = voiceId.trim() === voice.voiceId;
            return (
              <button
                key={voice.catalogId ?? voice.voiceId}
                type="button"
                disabled={voice.selectable === false}
                className={cn(
                  "flex w-full flex-col rounded-md px-2.5 py-2 text-left transition",
                  active
                    ? "bg-white/[0.12] text-white"
                    : "text-white/75 hover:bg-white/[0.06]",
                  voice.selectable === false && "cursor-not-allowed opacity-50",
                )}
                onClick={() => {
                  onSelectVoice(voice.voiceId);
                  setOpen(false);
                }}
              >
                <span className="truncate text-[13px] font-medium">{voice.label}</span>
                <span className="truncate text-[11px] text-white/45">
                  {voice.language ?? voice.subtitle}
                  {voice.tags?.includes("cloned") ? " · 克隆" : ""}
                </span>
              </button>
            );
          })}
          {canLoadMore ? (
            <button
              type="button"
              className="mt-1 w-full rounded-md py-2 text-center text-[12px] text-white/55 hover:bg-white/[0.06] hover:text-white/80"
              disabled={loading}
              onClick={onLoadMore}
            >
              {loading ? "加载中…" : "更多"}
            </button>
          ) : null}
        </div>
      </Sbv1ToolbarDropdown>
    </>
  );
}
