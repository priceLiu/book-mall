"use client";

import { ChevronDown, ChevronUp, Film } from "lucide-react";

import type { JianyingLibtvClipSlot } from "@/lib/canvas/jianying-from-workspace";
import { moveClipOrderNodeIds } from "@/lib/canvas/jianying-from-workspace";
import { cn } from "@/lib/utils";

function ClipOrderThumbnail({ slot }: { slot: JianyingLibtvClipSlot }) {
  if (slot.posterUrl?.trim()) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={slot.posterUrl}
        alt=""
        className="h-full w-full object-cover"
        draggable={false}
      />
    );
  }
  if (slot.videoUrl?.trim()) {
    return (
      <video
        src={slot.videoUrl}
        muted
        playsInline
        preload="metadata"
        className="h-full w-full object-cover"
        draggable={false}
      />
    );
  }
  return (
    <div className="flex h-full w-full items-center justify-center bg-white/[0.04] text-white/20">
      <Film className="size-5" />
    </div>
  );
}

type Props = {
  slots: JianyingLibtvClipSlot[];
  orderNodeIds: string[];
  disabled?: boolean;
  onOrderChange: (orderNodeIds: string[]) => void;
  className?: string;
};

export function JianyingClipOrderStrip({
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
        <p className="text-[12px] text-white/55">剪辑顺序（从左到右拼接）</p>
        <p className="text-[11px] text-white/35">↑↓ 调整 · 缩略图对应各镜视频</p>
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
                slot.hasVideo
                  ? "border-emerald-500/25 bg-emerald-500/[0.06]"
                  : "border-white/10 bg-white/[0.03]",
              )}
            >
              <div className="relative h-[72px] w-full overflow-hidden rounded-md bg-black/50">
                <ClipOrderThumbnail slot={slot} />
                <span
                  className={cn(
                    "absolute left-1 top-1 flex size-5 items-center justify-center rounded-full text-[10px] font-semibold tabular-nums shadow-sm",
                    slot.hasVideo
                      ? "bg-emerald-600/90 text-white"
                      : "bg-black/70 text-white/50",
                  )}
                >
                  {index + 1}
                </span>
                {!slot.hasVideo ? (
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
                    onOrderChange(
                      moveClipOrderNodeIds(orderNodeIds, id, -1),
                    )
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
                    onOrderChange(
                      moveClipOrderNodeIds(orderNodeIds, id, 1),
                    )
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
