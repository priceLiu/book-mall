"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import {
  fetchLibtvClonedVoices,
  fetchLibtvVoicePage,
  type LibtvVoiceCatalogItem,
} from "@/lib/canvas/libtv-audio-voice-catalog-client";
import {
  dedupeLibtvVoiceCatalogItems,
  libtvMinimaxVoiceSelectOptions,
} from "@/lib/canvas/libtv-minimax-voice-catalog-options";
import {
  resolveLibtvDockVoiceFullLabel,
} from "@/lib/canvas/libtv-tts-voice-preference";

export {
  dedupeLibtvVoiceCatalogItems,
  libtvMinimaxVoiceSelectOptions,
} from "@/lib/canvas/libtv-minimax-voice-catalog-options";

export const LIBTV_MINIMAX_VOICE_CATALOG_PAGE_SIZE = 10;

export function libtvTtsVoiceTriggerLabel(
  voiceId: string,
  voices: LibtvVoiceCatalogItem[],
  savedLabel?: string,
): string {
  const hit = voices.find((v) => v.voiceId === voiceId.trim());
  return resolveLibtvDockVoiceFullLabel({
    voiceId,
    savedLabel,
    catalogLabel: hit?.label,
  });
}

/** MiniMax 音色目录 · 与 Dock 音色 Popover 共用 */
export function useLibtvMinimaxVoiceCatalog(active: boolean) {
  const base = useBookMallBaseUrl();
  const [cloned, setCloned] = useState<LibtvVoiceCatalogItem[]>([]);
  const [system, setSystem] = useState<LibtvVoiceCatalogItem[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);

  const merged = useMemo(
    () => dedupeLibtvVoiceCatalogItems([...cloned, ...system]),
    [cloned, system],
  );
  const options = useMemo(
    () => libtvMinimaxVoiceSelectOptions(merged),
    [merged],
  );

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
        const data = await fetchLibtvVoicePage(
          base,
          nextPage,
          LIBTV_MINIMAX_VOICE_CATALOG_PAGE_SIZE,
        );
        setSystem((prev) =>
          nextPage === 1 ? data.items : [...prev, ...data.items],
        );
        setPage(nextPage);
        setHasMore(data.hasMore);
      } catch (e) {
        console.warn("[libtv voice catalog] load system page failed", e);
        if (nextPage === 1) {
          setSystem([]);
          setHasMore(false);
        }
      } finally {
        setLoading(false);
      }
    },
    [base],
  );

  useEffect(() => {
    if (!active || !base) return;
    void loadCloned();
    if (page === 0) void loadSystemPage(1);
  }, [active, base, loadCloned, loadSystemPage, page]);

  const onLoadMore = useCallback(() => {
    if (hasMore && !loading && base) void loadSystemPage(page + 1);
  }, [base, hasMore, loadSystemPage, loading, page]);

  const resolveVoicePreviewUrl = useCallback(
    (voiceId: string) =>
      merged.find((v) => v.voiceId === voiceId.trim())?.previewUrl,
    [merged],
  );

  return {
    options,
    merged,
    loading,
    hasMore,
    onLoadMore,
    resolveVoicePreviewUrl,
    hasCloned: cloned.length > 0,
  };
}
