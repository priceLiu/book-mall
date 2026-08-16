"use client";

import Image from "next/image";

import type { AiSpaceAudioAssetDto } from "@/lib/ai-space/ai-space-audio-service";
import { AI_SPACE_S2V_MAX_AUDIO_SEC } from "@/lib/ai-space/ai-space-compose-types";
import type { AiSpaceDigitalHumanDto } from "@/lib/ai-space/ai-space-digital-human-types";
import { cn } from "@/lib/utils";

function formatDuration(sec: number): string {
  if (!sec || sec <= 0) return "时长未知";
  return `${sec.toFixed(1)} 秒`;
}

export function AiSpaceComposeFavoriteHumans({
  items,
  selectedId,
  onSelect,
}: {
  items: Array<AiSpaceDigitalHumanDto & { isFavorite?: boolean }>;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const favorites = items.filter((h) => h.isFavorite);
  if (favorites.length === 0) return null;

  return (
    <div className="mb-4 rounded-lg border border-amber-200/80 bg-amber-50/50 p-3">
      <p className="mb-2 text-xs font-medium text-[#1f2328]">我的收藏 · 数字人</p>
      <ul className="flex flex-wrap gap-2">
        {favorites.map((h) => (
          <li key={h.id}>
            <button
              type="button"
              onClick={() => onSelect(h.id)}
              className={cn(
                "flex w-24 flex-col overflow-hidden rounded-lg border text-left transition",
                selectedId === h.id
                  ? "border-[#0969da] ring-2 ring-[#0969da]/25"
                  : "border-[#d0d7de] bg-white hover:border-[#8c959f]",
              )}
            >
              <span className="relative block aspect-[3/4] bg-[#f6f8fa]">
                <Image
                  src={h.avatarImageUrl}
                  alt={h.name}
                  fill
                  sizes="96px"
                  className="object-cover"
                  unoptimized
                />
              </span>
              <span className="truncate px-1.5 py-1 text-[10px] text-[#1f2328]">{h.name}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AiSpaceComposeFavoriteAudio({
  items,
  selectedId,
  onSelect,
}: {
  items: Array<AiSpaceAudioAssetDto & { isFavorite?: boolean }>;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const favorites = items.filter(
    (a) =>
      a.isFavorite &&
      a.durationSec > 0 &&
      a.durationSec < AI_SPACE_S2V_MAX_AUDIO_SEC,
  );
  if (favorites.length === 0) return null;

  return (
    <div className="mb-4 rounded-lg border border-amber-200/80 bg-amber-50/50 p-3">
      <p className="mb-2 text-xs font-medium text-[#1f2328]">我的收藏 · 口播音频</p>
      <ul className="flex flex-wrap gap-2">
        {favorites.map((a) => (
          <li key={a.id}>
            <button
              type="button"
              onClick={() => onSelect(a.id)}
              className={cn(
                "max-w-[12rem] rounded-md border px-2.5 py-1.5 text-left text-xs transition",
                selectedId === a.id
                  ? "border-[#0969da] bg-[#f0f6ff] text-[#0550ae]"
                  : "border-[#d0d7de] bg-white text-[#1f2328] hover:border-[#8c959f]",
              )}
            >
              <span className="block truncate font-medium">{a.name}</span>
              <span className="text-[#8c959f]">{formatDuration(a.durationSec)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
