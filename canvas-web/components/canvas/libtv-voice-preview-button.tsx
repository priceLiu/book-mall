"use client";

import { Volume2 } from "lucide-react";
import { useMemo, useRef } from "react";

import {
  playLibtvVoicePreview,
  resolveLibtvVoicePreviewUrl,
} from "@/lib/canvas/libtv-voice-preview";
import { libtvDockSegmentButtonClass } from "@/components/canvas/libtv-dock-picker-chrome";
import { RF_NO_DRAG } from "@/lib/canvas/react-flow-classes";
import { cn } from "@/lib/utils";

export function LibtvDockLanguageSegment({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (next: string) => void;
  className?: string;
}) {
  const val = value === "English" ? "English" : "Chinese";
  return (
    <div className={cn("border-t border-white/10 px-2 pt-2.5", className)}>
      <p className="mb-1.5 text-[12px] text-white/50">语种</p>
      <div className="grid grid-cols-2 gap-1.5" role="group" aria-label="语种">
        {[
          { id: "Chinese", label: "中文" },
          { id: "English", label: "English" },
        ].map((opt) => {
          const active = val === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              aria-pressed={active}
              className={libtvDockSegmentButtonClass(active, { compact: true })}
              onClick={() => onChange(opt.id)}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function LibtvVoicePreviewButton({
  previewUrl,
  voiceId,
  minimaxOssFallback = false,
}: {
  previewUrl?: string;
  voiceId?: string;
  /** 仅 MiniMax 系统音色目录为 true；Qwen 等须 false */
  minimaxOssFallback?: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const resolved = useMemo(
    () =>
      resolveLibtvVoicePreviewUrl({
        previewUrl,
        voiceId,
        minimaxOssFallback,
      }),
    [previewUrl, voiceId, minimaxOssFallback],
  );

  if (!resolved) {
    return (
      <span
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white/25"
        title="暂无试听"
      >
        <Volume2 className="size-3.5" aria-hidden />
      </span>
    );
  }

  return (
    <>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioRef} preload="metadata" src={resolved} className="hidden" />
      <button
        type="button"
        className={cn(
          RF_NO_DRAG,
          "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white/55 hover:bg-white/[0.08] hover:text-white",
        )}
        title="试听"
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          const el = audioRef.current;
          if (el) {
            el.currentTime = 0;
            void el.play().catch(() => {
              playLibtvVoicePreview(resolved);
            });
            return;
          }
          playLibtvVoicePreview(resolved);
        }}
      >
        <Volume2 className="size-3.5" aria-hidden />
      </button>
    </>
  );
}
