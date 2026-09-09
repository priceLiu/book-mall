"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Volume2 } from "lucide-react";

import {
  fetchQrVoicePage,
  filterCatalogSeedVoices,
  useQrAudioCatalog,
  type QrVoiceCatalogItem,
} from "@/lib/qr-audio-catalog-client";
import { useIntersectionVisible } from "@/lib/use-intersection-visible";

type Props = {
  selectedVoiceId?: string;
  focusSelected?: boolean;
  voiceProvider?: "minimax" | "elevenlabs";
  onSelectVoice: (voice: QrVoiceCatalogItem) => void;
};

const INITIAL_PAGE_SIZE = 24;
const LOAD_MORE_PAGE_SIZE = 40;

function VoiceCard({
  voice,
  selected,
  scrollIntoView,
  onSelect,
}: {
  voice: QrVoiceCatalogItem;
  selected: boolean;
  scrollIntoView?: boolean;
  onSelect: () => void;
}) {
  const { ref: visRef, visible } = useIntersectionVisible<HTMLButtonElement>("200px 0px");
  const [hover, setHover] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const preload = visible || hover;

  useEffect(() => {
    if (!scrollIntoView || !selected) return;
    visRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [scrollIntoView, selected, visRef]);

  return (
    <button
      ref={visRef}
      type="button"
      data-voice-id={voice.voiceId}
      onClick={onSelect}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={`flex flex-col rounded-xl border p-3 text-left transition ${
        selected
          ? "border-[var(--qr-brand)] bg-[rgba(59,130,246,0.12)] shadow-[0_0_0_1px_rgba(59,130,246,0.35)]"
          : "border-white/10 hover:border-white/20"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-orange-400 via-pink-500 to-violet-500 text-sm font-semibold text-white">
          {voice.avatarLetter}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-[var(--qr-text-primary)]">
            {voice.label}
          </span>
          <span className="block truncate text-[11px] text-[var(--qr-text-muted)]">
            {voice.language ?? voice.subtitle}
          </span>
        </span>
        {voice.previewUrl && preload ? (
          <audio
            ref={audioRef}
            preload={hover ? "auto" : "metadata"}
            src={voice.previewUrl}
            className="hidden"
          />
        ) : null}
        {voice.previewUrl ? (
          <span
            className="rounded-full p-1.5 text-[var(--qr-text-muted)] hover:bg-white/10"
            onClick={(e) => {
              e.stopPropagation();
              void audioRef.current?.play();
            }}
            role="presentation"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        ) : null}
      </div>
    </button>
  );
}

export function QrVoiceGallery({
  selectedVoiceId,
  focusSelected = false,
  voiceProvider = "minimax",
  onSelectVoice,
}: Props) {
  const { catalog } = useQrAudioCatalog();
  const seedItems = useMemo(
    () => (catalog ? filterCatalogSeedVoices(catalog, voiceProvider) : []),
    [catalog, voiceProvider],
  );

  const { ref: panelRef, visible: panelVisible } = useIntersectionVisible<HTMLDivElement>("80px 0px");
  const [items, setItems] = useState<QrVoiceCatalogItem[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hydratedFromSeed, setHydratedFromSeed] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  useEffect(() => {
    setItems([]);
    setPage(0);
    setHasMore(true);
    setError(null);
    setHydratedFromSeed(false);
  }, [voiceProvider]);

  useEffect(() => {
    if (hydratedFromSeed || seedItems.length === 0) return;
    setItems(seedItems);
    setHydratedFromSeed(true);
    setError(null);
  }, [hydratedFromSeed, seedItems]);

  const loadPage = useCallback(
    async (nextPage: number) => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      setLoading(true);
      setError(null);
      const pageSize = nextPage === 1 ? INITIAL_PAGE_SIZE : LOAD_MORE_PAGE_SIZE;
      try {
        const data = await fetchQrVoicePage(nextPage, pageSize, voiceProvider);
        setItems((prev) => {
          if (nextPage === 1) {
            const merged = [...data.items];
            for (const seed of seedItems) {
              if (!merged.some((v) => v.voiceId === seed.voiceId)) {
                merged.push(seed);
              }
            }
            return merged;
          }
          const seen = new Set(prev.map((v) => v.voiceId));
          const appended = data.items.filter((v) => !seen.has(v.voiceId));
          return [...prev, ...appended];
        });
        setHasMore(data.hasMore);
        setPage(nextPage);
        if ("warning" in data && typeof data.warning === "string" && data.warning.trim()) {
          setError(data.warning.trim());
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : "加载失败";
        setError(message);
        if (nextPage === 1 && seedItems.length > 0) {
          setItems(seedItems);
          setHydratedFromSeed(true);
        }
      } finally {
        loadingRef.current = false;
        setLoading(false);
      }
    },
    [seedItems, voiceProvider],
  );

  useEffect(() => {
    if (!panelVisible) return;
    if (page > 0 || loadingRef.current) return;
    void loadPage(1);
  }, [panelVisible, page, loadPage]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || !panelVisible) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && hasMore && !loadingRef.current && page > 0) {
          void loadPage(page + 1);
        }
      },
      { rootMargin: "320px 0px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, loadPage, page, panelVisible]);

  const showInitialSpinner = loading && items.length === 0;

  return (
    <div ref={panelRef} className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex flex-col gap-1 border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <Volume2 className="h-4 w-4 text-[var(--qr-text-muted)]" />
          <span className="text-sm font-medium">音色列表</span>
          {selectedVoiceId ? (
            <span className="ml-auto text-[11px] text-[var(--qr-text-muted)]">点击卡片选用</span>
          ) : null}
        </div>
        {voiceProvider === "elevenlabs" ? (
          <p className="text-[11px] text-[var(--qr-text-muted)]">
            变声器使用 ElevenLabs 音色；制作旁白请在「制作旁白」中选用 MiniMax 音色（100+）
          </p>
        ) : null}
      </div>
      {error && items.length === 0 ? (
        <div className="flex items-center justify-between gap-2 p-4 text-sm text-red-400">
          <span>{error}</span>
          <button
            type="button"
            className="qr-btn-secondary shrink-0 text-xs"
            onClick={() => void loadPage(page > 0 ? page + 1 : 1)}
          >
            重试
          </button>
        </div>
      ) : null}
      {error && items.length > 0 ? (
        <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-2 text-xs text-amber-400/90">
          <span>
            {voiceProvider === "elevenlabs" && /ElevenLabs|凭证|sk_/i.test(error)
              ? `仅显示内置音色；${error}`
              : `部分音色加载失败：${error}`}
          </span>
          <button
            type="button"
            className="qr-btn-secondary shrink-0 text-[11px]"
            onClick={() => void loadPage(page > 0 ? page + 1 : 1)}
          >
            重试
          </button>
        </div>
      ) : null}
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {showInitialSpinner ? (
          <div className="flex justify-center py-16 text-[var(--qr-text-muted)]">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {items.map((v) => (
              <VoiceCard
                key={v.voiceId}
                voice={v}
                selected={selectedVoiceId === v.voiceId}
                scrollIntoView={focusSelected}
                onSelect={() => onSelectVoice(v)}
              />
            ))}
          </div>
        )}
        {loading && items.length > 0 ? (
          <div className="flex justify-center py-4 text-[var(--qr-text-muted)]">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : null}
        <div ref={sentinelRef} className="h-4" />
      </div>
    </div>
  );
}
