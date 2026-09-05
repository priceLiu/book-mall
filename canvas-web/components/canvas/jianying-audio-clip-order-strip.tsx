"use client";

import { ChevronDown, ChevronUp, Music, Volume2 } from "lucide-react";
import { useRef } from "react";

import type { JianyingLibtvAudioClipSlot } from "@/lib/canvas/jianying-from-workspace";
import { moveClipOrderNodeIds } from "@/lib/canvas/jianying-from-workspace";
import { cn } from "@/lib/utils";

function AudioClipPreviewButton({ audioUrl }: { audioUrl?: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  if (!audioUrl?.trim()) {
    return (
      <span className="inline-flex size-6 items-center justify-center text-white/25">
        <Volume2 className="size-3.5" />
      </span>
    );
  }
  return (
    <>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioRef} preload="metadata" src={audioUrl} className="hidden" />
      <button
        type="button"
        className="inline-flex size-6 items-center justify-center rounded-md text-white/55 hover:bg-white/10 hover:text-white"
        title="试听"
        onClick={() => {
          const el = audioRef.current;
          if (!el) return;
          void el.play().catch(() => undefined);
        }}
      >
        <Volume2 className="size-3.5" />
      </button>
    </>
  );
}

type Props = {
  slots: JianyingLibtvAudioClipSlot[];
  orderNodeIds: string[];
  disabled?: boolean;
  onOrderChange: (orderNodeIds: string[]) => void;
  className?: string;
};

export function JianyingAudioClipOrderStrip({
  slots,
  orderNodeIds,
  disabled = false,
  onOrderChange,
  className,
}: Props) {
  if (slots.length <= 0) return null;

  const slotById = new Map(slots.map((s) => [s.sourceNodeId, s]));

  return (
    <div className={cn("flex min-h-0 flex-col gap-1.5", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12px] text-white/55">音频顺序（第 N 段对应第 N 镜视频）</p>
        <p className="text-[11px] text-white/35">↑↓ 调整</p>
      </div>
      <div className="nodrag flex min-h-0 gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {orderNodeIds.map((id, index) => {
          const slot = slotById.get(id);
          if (!slot) return null;
          return (
            <div
              key={id}
              className={cn(
                "flex w-[104px] shrink-0 flex-col gap-1 rounded-lg border p-1.5",
                "border-emerald-500/25 bg-emerald-500/[0.06]",
              )}
            >
              <div className="relative flex h-[36px] w-full flex-col items-center justify-center gap-0.5 overflow-hidden rounded-md bg-black/50">
                <Music className="size-4 text-white/35" />
                <AudioClipPreviewButton audioUrl={slot.previewUrl ?? slot.audioUrl} />
                <span className="absolute left-1 top-1 flex size-5 items-center justify-center rounded-full bg-emerald-600/90 text-[10px] font-semibold tabular-nums text-white shadow-sm">
                  {index + 1}
                </span>
                {!slot.hasLocalPreview ? (
                  <span className="absolute inset-x-0 bottom-0 bg-black/70 py-0.5 text-center text-[9px] text-white/55">
                    未生成
                  </span>
                ) : null}
              </div>
              <p
                className="truncate px-0.5 text-[10px] font-medium text-white/80"
                title={slot.label}
              >
                {slot.label}
              </p>
              <div className="flex items-center justify-center gap-0.5">
                <button
                  type="button"
                  disabled={disabled || index === 0}
                  className="flex size-6 items-center justify-center rounded-md text-white/45 transition hover:bg-white/10 hover:text-white/80 disabled:opacity-30"
                  title="前移"
                  onClick={() =>
                    onOrderChange(moveClipOrderNodeIds(orderNodeIds, id, -1))
                  }
                >
                  <ChevronUp className="size-3.5" />
                </button>
                <button
                  type="button"
                  disabled={disabled || index === orderNodeIds.length - 1}
                  className="flex size-6 items-center justify-center rounded-md text-white/45 transition hover:bg-white/10 hover:text-white/80 disabled:opacity-30"
                  title="后移"
                  onClick={() =>
                    onOrderChange(moveClipOrderNodeIds(orderNodeIds, id, 1))
                  }
                >
                  <ChevronDown className="size-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
