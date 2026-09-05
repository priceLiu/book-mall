"use client";

import { Loader2 } from "lucide-react";

import {
  LIBTV_MINIMAX_VOICE_CATALOG_PAGE_SIZE,
  useLibtvMinimaxVoiceCatalog,
} from "@/lib/canvas/use-libtv-minimax-voice-catalog";
import type { LibtvTtsRowPreviewSpec } from "@/lib/canvas/libtv-tts-preview-client";
import { cn } from "@/lib/utils";
import { LibtvVoiceSelectList } from "./libtv-voice-select-list";

/** MiniMax 音色列表 · 未勾选调参试听时 OSS 原样音；勾选后各行 voiceId 实时合成 */
export function LibtvMinimaxVoiceCatalogList({
  active,
  voiceId,
  disabled,
  listKey,
  className,
  maxHeightClass = "max-h-[240px]",
  rowPreviewSpec,
  onSelectVoice,
  onSynthPlayed,
}: {
  active: boolean;
  voiceId: string;
  disabled?: boolean;
  listKey?: string;
  className?: string;
  maxHeightClass?: string;
  rowPreviewSpec?: LibtvTtsRowPreviewSpec;
  onSelectVoice: (voiceId: string, label: string) => void;
  onSynthPlayed?: (info: { voiceId: string; dataUrl: string }) => void;
}) {
  const { options, merged, loading, hasMore, onLoadMore, hasCloned } =
    useLibtvMinimaxVoiceCatalog(active);

  if (!active) return null;

  return (
    <div className={cn("flex min-h-0 flex-col px-0.5", className)}>
      {hasCloned ? (
        <p className="shrink-0 px-2 pb-0.5 pt-0 text-[10px] text-white/40">
          我的克隆音色
        </p>
      ) : null}
      {options.length === 0 && loading ? (
        <div className="flex items-center justify-center gap-2 py-6 text-[12px] text-white/45">
          <Loader2 className="size-3.5 animate-spin" />
          加载音色…
        </div>
      ) : options.length === 0 && !loading ? (
        <p className="px-3 py-6 text-center text-[11px] leading-relaxed text-white/40">
          音色目录暂时不可用，请稍后重试或刷新页面。
        </p>
      ) : (
        <LibtvVoiceSelectList
          key={listKey ?? (active ? "voice-catalog-open" : "voice-catalog-closed")}
          options={options}
          value={voiceId.trim()}
          pageSize={LIBTV_MINIMAX_VOICE_CATALOG_PAGE_SIZE}
          loading={loading}
          hasMore={hasMore}
          onLoadMore={onLoadMore}
          maxHeightClass={maxHeightClass}
          minimaxOssFallback
          rowPreviewSpec={rowPreviewSpec}
          onSynthPlayed={onSynthPlayed}
          onSelect={(nextVoiceId) => {
            const hit = merged.find((v) => v.voiceId === nextVoiceId);
            onSelectVoice(nextVoiceId, hit?.label?.trim() || nextVoiceId);
          }}
        />
      )}
    </div>
  );
}
