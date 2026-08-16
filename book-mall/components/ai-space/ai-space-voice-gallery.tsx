"use client";

import { ChevronDown, ChevronUp, Loader2, Volume2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { AiSpaceFavoriteButton } from "@/components/ai-space/ai-space-favorite-button";
import { cn } from "@/lib/utils";

export type AiSpaceVoiceCatalogItem = {
  catalogId?: string;
  voiceId: string;
  label: string;
  subtitle: string;
  language?: string;
  previewUrl?: string;
  tags?: string[];
  avatarLetter: string;
  selectable?: boolean;
};

const VOICES_API = "/api/platform/v1/ai-space/voices";
const CLONED_VOICES_API = "/api/platform/v1/ai-space/voices/cloned";

function mapClonedToCatalog(item: {
  catalogId: string;
  voiceId: string;
  label: string;
  subtitle: string;
  language?: string;
  previewUrl?: string;
  tags?: string[];
  avatarLetter: string;
  selectable?: boolean;
}): AiSpaceVoiceCatalogItem {
  return {
    catalogId: item.catalogId,
    voiceId: item.voiceId,
    label: item.label,
    subtitle: item.subtitle,
    language: item.language,
    previewUrl: item.previewUrl,
    tags: item.tags,
    avatarLetter: item.avatarLetter,
    selectable: item.selectable !== false,
  };
}

function VoiceCard({
  voice,
  selected,
  favorite,
  selectionEnabled = true,
  onSelect,
}: {
  voice: AiSpaceVoiceCatalogItem;
  selected: boolean;
  favorite: boolean;
  selectionEnabled?: boolean;
  onSelect: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const canSelect = selectionEnabled && voice.selectable !== false;

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-lg border p-3 transition",
        selected
          ? "border-[#0969da] bg-[#f0f6ff] ring-2 ring-[#0969da]/20"
          : "border-[#d0d7de] bg-white hover:border-[#8c959f]",
        !canSelect && "opacity-80",
      )}
    >
      <button
        type="button"
        className="flex min-w-0 flex-1 items-start gap-2 text-left disabled:cursor-not-allowed"
        disabled={!canSelect}
        onClick={onSelect}
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#0969da] to-[#6e40c9] text-sm font-semibold text-white">
          {voice.avatarLetter}
        </span>
        <span className="min-w-0 flex-1 pr-16">
          <span className="flex items-center gap-1.5 truncate text-sm font-medium text-[#1f2328]">
            <span className="truncate">{voice.label}</span>
            {voice.tags?.includes("cloned") ? (
              <span className="shrink-0 rounded bg-[#fff8c5] px-1.5 py-0.5 text-[10px] font-medium text-[#9a6700]">
                克隆
              </span>
            ) : null}
          </span>
          <span className="block truncate text-[11px] text-[#656d76]">
            {voice.language ?? voice.subtitle}
          </span>
        </span>
      </button>

      <div className="absolute right-2 top-2 flex items-center gap-1">
        {voice.previewUrl ? (
          <>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <audio ref={audioRef} preload="metadata" src={voice.previewUrl} className="hidden" />
            <button
              type="button"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#656d76] hover:bg-[#f6f8fa] hover:text-[#0969da]"
              title="试听"
              onClick={(e) => {
                e.stopPropagation();
                const el = audioRef.current;
                if (!el) return;
                void el.play().catch(() => {
                  window.open(voice.previewUrl, "_blank", "noopener,noreferrer");
                });
              }}
            >
              <Volume2 className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <span
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#d0d7de]"
            title="暂无试听文件"
          >
            <Volume2 className="h-3.5 w-3.5" />
          </span>
        )}
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
  selectionEnabled = true,
}: {
  selectedVoiceId?: string;
  favoriteVoiceIds?: Set<string>;
  onSelectVoice: (voice: AiSpaceVoiceCatalogItem) => void;
  /** false = 仅试听，不可选为 TTS 音色（例如当前为百炼模型） */
  selectionEnabled?: boolean;
}) {
  const [items, setItems] = useState<AiSpaceVoiceCatalogItem[]>([]);
  const [clonedItems, setClonedItems] = useState<AiSpaceVoiceCatalogItem[]>([]);
  const [clonedLoading, setClonedLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  const selectedVoice =
    items.find((v) => v.voiceId === selectedVoiceId) ??
    clonedItems.find((v) => v.voiceId === selectedVoiceId);

  const loadCloned = useCallback(async () => {
    setClonedLoading(true);
    try {
      const res = await fetch(CLONED_VOICES_API, { credentials: "include" });
      if (!res.ok) return;
      const data = (await res.json()) as {
        items: Array<{
          catalogId: string;
          voiceId: string;
          label: string;
          subtitle: string;
          language?: string;
          previewUrl?: string;
          tags?: string[];
          avatarLetter: string;
          selectable?: boolean;
        }>;
      };
      setClonedItems((data.items ?? []).map(mapClonedToCatalog));
    } catch {
      /* 克隆列表失败时不阻断系统音色 */
    } finally {
      setClonedLoading(false);
    }
  }, []);

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
    void loadCloned();
    void loadPage(1);
  }, [loadCloned, loadPage]);

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
            与快速复制「我的作品 · 音频」同步；有试听文件即可点喇叭
            {!selectionEnabled ? " · 选用克隆音色请将语音模型切换为 MiniMax" : ""}
            {clonedItems.length > 0 ? ` · 共 ${clonedItems.length} 项` : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {(loading && items.length === 0) || clonedLoading ? (
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
          {clonedItems.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-medium text-[#1f2328]">我的克隆音色</p>
              {!selectionEnabled ? (
                <p className="text-xs text-[#9a6700]">
                  当前为百炼模型，克隆音色仅可试听；生成口播请切换上方「语音模型」为 MiniMax。
                </p>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {clonedItems.map((voice) => (
                  <VoiceCard
                    key={voice.catalogId ?? `cloned-${voice.voiceId}`}
                    voice={voice}
                    selected={selectionEnabled && selectedVoiceId === voice.voiceId}
                    favorite={favoriteVoiceIds?.has(voice.voiceId) ?? false}
                    selectionEnabled={selectionEnabled}
                    onSelect={() => {
                      if (!selectionEnabled || voice.selectable === false) return;
                      onSelectVoice(voice);
                      setCollapsed(true);
                    }}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {selectionEnabled ? (
            <>
              {clonedItems.length > 0 ? (
                <p className="text-xs font-medium text-[#656d76]">系统音色</p>
              ) : null}

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
        </>
      ) : null}
    </div>
  );
}
