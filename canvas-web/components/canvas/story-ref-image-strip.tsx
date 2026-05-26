"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import type { StoryRefImage } from "@/lib/canvas/story-ref-image";

/** 行左侧参考图条；prompt 中 @ 引用后高亮边框 */
export function StoryRefImageStrip({
  refs,
  activeIds,
}: {
  refs: StoryRefImage[];
  activeIds: string[];
}) {
  if (!refs.length) return null;

  return (
    <div className="flex w-[76px] shrink-0 flex-col gap-1.5 self-stretch">
      {refs.map((ref) => {
        const active = activeIds.includes(ref.id);
        return (
          <div
            key={ref.id}
            title={ref.label}
            className={cn(
              "relative flex min-h-[72px] flex-1 overflow-hidden rounded-md border-2 transition-shadow",
              active
                ? "border-[#fb923c] shadow-[0_0_0_1px_#fb923c,0_0_12px_rgba(251,146,60,0.45)]"
                : "border-white/15",
            )}
          >
            {ref.url ? (
              <Image
                src={ref.url}
                alt={ref.label}
                fill
                className="object-cover"
                unoptimized
              />
            ) : (
              <span className="flex flex-1 items-center justify-center px-1 text-center text-[8px] leading-tight text-[var(--canvas-muted)]">
                待上游生成
              </span>
            )}
            <span className="absolute inset-x-0 bottom-0 bg-black/65 px-0.5 py-0.5 text-center text-[8px] leading-tight text-white/90">
              {ref.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
