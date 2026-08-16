"use client";

import { ChevronDown, ChevronUp, Loader2, Volume2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { AiSpaceFavoriteButton } from "@/components/ai-space/ai-space-favorite-button";
import { cn } from "@/lib/utils";

export type AiSpaceVoiceCatalogItem = {
  voiceId: string;
  label: string;
  subtitle: string;
  language?: string;
  previewUrl?: string;
  tags?: string[];
  avatarLetter: string;
};

const VOICES_API = "/api/platform/v1/ai-space/voices";

function VoiceCard({
  voice,
  selected,
  favorite,
  onSelect,
}: {
  voice: AiSpaceVoiceCatalogItem;
  selected: boolean;
  favorite: boolean;
  onSelect: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-lg border p-3 transition",
        selected
          ? "border-[#0969da] bg-[#f0f6ff] ring-2 ring-[#0969da]/20"
          : "border-[#d0d7de] bg-white hover:border-[#8c959f]",
      )}
    >
      <button type="button" className="flex min-w-0 flex-1 items-start gap-2 text-left" onClick={onSelect}>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#0969da] to-[#6e40c9] text-sm font-semibold text-white">
          {voice.avatarLetter}
        </span>
        <span className="min-w-0 flex-1 pr-8">
          <span className="block truncate text-sm font-medium text-[#1f2328]">{voice.label}</span>
          <span className="block truncate text-[11px] text-[#656d76]">
            {voice.language ?? voice.subtitle}
          </span>
        </span>
      </button>

      <div className="absolute right-2 top-2 flex items-center gap-1">
        {voice.previewUrl ? (
          <>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <audio ref={audioRef} preload="none" src={voice.previewUrl} className="hidden" />
            <button
              type="button"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#656d76] hover:bg-[#f6f8fa] hover:text-[#0969da]"
              title="试听"
              onClick={(e) => {
                e.stopPropagation();
                void audioRef.current?.play();
              }}
            >
              <Volume2 className="h-3.5 w-3.5" />
            </button>
          </>
        ) : null}
        <AiSpaceFavoriteButton
          targetKind="tts_voice"
          targetId={voice.voiceId}
          initialFavorite={favorite}
          meta={{
            label: voice.label,
            language: voice.language ?? voice.subtitle,
            previewUrl: voice.previewUrl,
            avatarLetter: voice.avatarLetter,
          }}
        />
      </div>
    </div>
  );
}

export function AiSpaceVoiceGallery({
  selectedVoiceId,
  favoriteVoiceIds,
  onSelectVoice,
}: {
  selectedVoiceId?: string;
  favoriteVoiceIds?: Set<string>;
  onSelectVoice: (voice: AiSpaceVoiceCatalogItem) => void;
}) {
  const [items, setItems] = useState<AiSpaceVoiceCatalogItem[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  const selectedVoice = items.find((v) => v.voiceId === selectedVoiceId);

  const loadPage = useCallback(async (nextPage: number) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${VOICES_API}?page=${nextPage}&pageSize=40`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`加载音色失败（${res.status}）`);
      const data = (await res.json()) as {
        items: AiSpaceVoiceCatalogItem[];
        hasMore: boolean;
      };
      setItems((prev) => (nextPage === 1 ? data.items : [...prev, ...data.items]));
      setPage(nextPage);
      setHasMore(data.hasMore);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载音色失败");
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPage(1);
  }, [loadPage]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || loading) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadPage(page + 1);
      },
      { rootMargin: "200px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, loadPage, loading, page]);

  return (
    <div className="space-y-3 rounded-lg border border-[#d0d7de] bg-[#fafbfc] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[#1f2328]">音色列表</p>
          <p className="mt-0.5 text-xs text-[#656d76]">
            与快速复制共用 MiniMax 目录，支持试听与收藏
            {items.length > 0 ? ` · 已加载 ${items.length} 项` : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {loading && items.length === 0 ? (
            <Loader2 className="h-4 w-4 animate-spin text-[#0969da]" />
          ) : null}
          <button
            type="button"
            className="inline-flex h-8 items-center gap-1 rounded-md border border-[#d0d7de] bg-white px-2.5 text-xs font-medium text-[#656d76] transition hover:border-[#8c959f] hover:text-[#1f2328]"
            aria-expanded={!collapsed}
            aria-controls="ai-space-voice-gallery-grid"
            onClick={() => setCollapsed((v) => !v)}
          >
            {collapsed ? (
              <>
                <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                展开列表
              </>
            ) : (
              <>
                <ChevronUp className="h-3.5 w-3.5" aria-hidden />
                收起列表
              </>
            )}
          </button>
        </div>
      </div>

      {collapsed && selectedVoice ? (
        <div className="flex items-center gap-2 rounded-md border border-[#0969da]/30 bg-[#f0f6ff] px-3 py-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-[#0969da] to-[#6e40c9] text-xs font-semibold text-white">
            {selectedVoice.avatarLetter}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-[#1f2328]">{selectedVoice.label}</span>
            <span className="block truncate text-[11px] text-[#656d76]">
              {selectedVoice.language ?? selectedVoice.subtitle}
            </span>
          </span>
        </div>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {!collapsed ? (
        <>
          <div
            id="ai-space-voice-gallery-grid"
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
          >
            {items.map((voice) => (
              <VoiceCard
                key={voice.voiceId}
                voice={voice}
                selected={selectedVoiceId === voice.voiceId}
                favorite={favoriteVoiceIds?.has(voice.voiceId) ?? false}
                onSelect={() => {
                  onSelectVoice(voice);
                  setCollapsed(true);
                }}
              />
            ))}
          </div>

          <div ref={sentinelRef} className="h-4" />
          {loading && items.length > 0 ? (
            <p className="text-center text-xs text-[#8c959f]">加载更多音色…</p>
          ) : null}
          {!hasMore && items.length > 0 ? (
            <p className="text-center text-xs text-[#8c959f]">已加载全部音色</p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
