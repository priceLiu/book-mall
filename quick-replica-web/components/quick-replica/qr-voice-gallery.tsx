"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Volume2 } from "lucide-react";

import { fetchQrPlatform } from "@/lib/qr-platform-fetch";
import { useIntersectionVisible } from "@/lib/use-intersection-visible";
import type { QrVoiceCatalogItem } from "@/lib/qr-audio-catalog-client";

type Props = {
  selectedVoiceId?: string;
  focusSelected?: boolean;
  onSelectVoice: (voice: QrVoiceCatalogItem) => void;
};

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
  const { ref: visRef, visible } = useIntersectionVisible("200px 0px");
  const [hover, setHover] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const preload = visible || hover;

  useEffect(() => {
    if (!scrollIntoView || !selected) return;
    visRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [scrollIntoView, selected, visRef]);

  return (
    <button
      ref={visRef as React.RefObject<HTMLButtonElement>}
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

export function QrVoiceGallery({ selectedVoiceId, focusSelected = false, onSelectVoice }: Props) {
  const [items, setItems] = useState<QrVoiceCatalogItem[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  const loadPage = useCallback(async (nextPage: number) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchQrPlatform(
        `/api/book-mall/api/platform/v1/quick-replica/voices?page=${nextPage}&pageSize=40`,
      );
      if (!res.ok) throw new Error(`加载音色失败（${res.status}）`);
      const data = (await res.json()) as {
        items: QrVoiceCatalogItem[];
        hasMore: boolean;
      };
      setItems((prev) => (nextPage === 1 ? data.items : [...prev, ...data.items]));
      setHasMore(data.hasMore);
      setPage(nextPage);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
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
    if (!el || !hasMore) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && hasMore && !loadingRef.current) {
          void loadPage(page + 1);
        }
      },
      { rootMargin: "240px 0px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, loadPage, page]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
        <Volume2 className="h-4 w-4 text-[var(--qr-text-muted)]" />
        <span className="text-sm font-medium">音色列表</span>
        {selectedVoiceId ? (
          <span className="ml-auto text-[11px] text-[var(--qr-text-muted)]">点击卡片选用</span>
        ) : null}
      </div>
      {error ? <div className="p-4 text-sm text-red-400">{error}</div> : null}
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
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
        {loading ? (
          <div className="flex justify-center py-4 text-[var(--qr-text-muted)]">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : null}
        <div ref={sentinelRef} className="h-4" />
      </div>
    </div>
  );
}
