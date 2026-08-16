"use client";

import Image from "next/image";
import Link from "next/link";
import { Star, Volume2 } from "lucide-react";

import { AiSpaceAudioControls } from "@/components/ai-space/ai-space-audio-controls";
import { AiSpaceFavoriteButton } from "@/components/ai-space/ai-space-favorite-button";
import type { AiSpaceFavoriteEntryDto } from "@/lib/ai-space/ai-space-favorite-service";
import { AI_SPACE_FAVORITE_KIND_LABEL } from "@/lib/ai-space/ai-space-favorite-types";

function formatDuration(sec: number): string {
  if (!sec || sec <= 0) return "时长未知";
  return `${sec.toFixed(1)} 秒`;
}

export function AiSpaceFavoritesDesk({
  initialFavorites,
}: {
  initialFavorites: AiSpaceFavoriteEntryDto[];
}) {
  const favorites = initialFavorites;

  const groups = {
    digital_human: favorites.filter((f) => f.targetKind === "digital_human"),
    audio: favorites.filter((f) => f.targetKind === "audio"),
    tts_voice: favorites.filter((f) => f.targetKind === "tts_voice"),
  };

  if (favorites.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[#d0d7de] bg-[#f6f8fa] p-10 text-center">
        <Star className="mx-auto h-8 w-8 text-[#8c959f]" />
        <p className="mt-3 text-sm font-medium text-[#1f2328]">还没有收藏</p>
        <p className="mt-1 text-sm text-[#656d76]">
          在音频库、数字人库或音色列表中点击星标，即可加入「我的收藏」；合成台可优先选用收藏素材。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {groups.digital_human.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-[#1f2328]">
            {AI_SPACE_FAVORITE_KIND_LABEL.digital_human}
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {groups.digital_human.map((fav) =>
              fav.digitalHuman ? (
                <li
                  key={fav.id}
                  className="overflow-hidden rounded-lg border border-[#d0d7de] bg-white"
                >
                  <div className="relative aspect-[3/4] bg-[#f6f8fa]">
                    <Image
                      src={fav.digitalHuman.avatarImageUrl}
                      alt={fav.digitalHuman.name}
                      fill
                      sizes="200px"
                      className="object-cover"
                      unoptimized
                    />
                    <div className="absolute right-2 top-2">
                      <AiSpaceFavoriteButton
                        targetKind="digital_human"
                        targetId={fav.targetId}
                        initialFavorite
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 p-3">
                    <span className="truncate text-sm font-medium text-[#1f2328]">
                      {fav.digitalHuman.name}
                    </span>
                    <Link
                      href="/account/ai-space?tab=compose"
                      className="shrink-0 text-xs text-[#0969da] hover:underline"
                    >
                      去合成
                    </Link>
                  </div>
                </li>
              ) : null,
            )}
          </ul>
        </section>
      ) : null}

      {groups.audio.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-[#1f2328]">
            {AI_SPACE_FAVORITE_KIND_LABEL.audio}
          </h2>
          <ul className="space-y-3">
            {groups.audio.map((fav) =>
              fav.audio ? (
                <li
                  key={fav.id}
                  className="flex flex-col gap-3 rounded-lg border border-[#d0d7de] bg-white p-3 lg:flex-row lg:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[#1f2328]">{fav.audio.name}</p>
                    <p className="text-xs text-[#8c959f]">{formatDuration(fav.audio.durationSec)}</p>
                  </div>
                  <div className="flex min-w-0 items-center gap-2">
                    <AiSpaceAudioControls
                      className="h-8 min-w-0 flex-1 lg:max-w-md"
                      src={fav.audio.audioUrl}
                    />
                    <AiSpaceFavoriteButton
                      targetKind="audio"
                      targetId={fav.targetId}
                      initialFavorite
                    />
                  </div>
                </li>
              ) : null,
            )}
          </ul>
        </section>
      ) : null}

      {groups.tts_voice.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-[#1f2328]">
            {AI_SPACE_FAVORITE_KIND_LABEL.tts_voice}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {groups.tts_voice.map((fav) => (
              <li
                key={fav.id}
                className="flex items-center gap-3 rounded-lg border border-[#d0d7de] bg-white p-3"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#0969da] to-[#6e40c9] text-sm font-semibold text-white">
                  {fav.meta?.avatarLetter ?? fav.meta?.label?.charAt(0) ?? "音"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[#1f2328]">
                    {fav.meta?.label ?? fav.targetId}
                  </p>
                  <p className="truncate text-xs text-[#656d76]">
                    {fav.meta?.language ?? fav.targetId}
                  </p>
                </div>
                {fav.meta?.previewUrl ? (
                  <>
                    {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                    <audio preload="none" src={fav.meta.previewUrl} className="hidden" id={`fav-v-${fav.id}`} />
                    <button
                      type="button"
                      className="rounded-md p-1.5 text-[#656d76] hover:bg-[#f6f8fa]"
                      onClick={() => document.getElementById(`fav-v-${fav.id}`)?.play()}
                    >
                      <Volume2 className="h-4 w-4" />
                    </button>
                  </>
                ) : null}
                <AiSpaceFavoriteButton
                  targetKind="tts_voice"
                  targetId={fav.targetId}
                  initialFavorite
                  meta={fav.meta ?? undefined}
                />
              </li>
            ))}
          </ul>
          <p className="text-xs text-[#8c959f]">
            收藏的音色可在
            <Link href="/account/ai-space?tab=audio" className="text-[#0969da] hover:underline">
              音频库
            </Link>
            生成口播时快速选用。
          </p>
        </section>
      ) : null}
    </div>
  );
}
