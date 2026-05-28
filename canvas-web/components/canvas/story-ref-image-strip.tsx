"use client";

import Image from "next/image";
import { Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StoryRefImage } from "@/lib/canvas/story-ref-image";

/** 行左侧参考图条；prompt 中 @ 引用后高亮边框 */
export function StoryRefImageStrip({
  refs,
  activeIds,
  onPreview,
}: {
  refs: StoryRefImage[];
  activeIds: string[];
  onPreview?: (url: string, title: string) => void;
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
              "group/ref-thumb relative flex min-h-[72px] flex-1 overflow-hidden rounded-md border-2 bg-black/40 transition-shadow",
              active
                ? "border-[#fb923c] shadow-[0_0_0_1px_#fb923c,0_0_12px_rgba(251,146,60,0.45)]"
                : "border-white/15",
              ref.url && onPreview && "cursor-pointer",
            )}
            onClick={() => {
              if (ref.url && onPreview) onPreview(ref.url, ref.label);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && ref.url && onPreview) {
                onPreview(ref.url, ref.label);
              }
            }}
            role={ref.url && onPreview ? "button" : undefined}
            tabIndex={ref.url && onPreview ? 0 : undefined}
          >
            {ref.url ? (
              <>
                <Image
                  src={ref.url}
                  alt={ref.label}
                  fill
                  className="object-contain"
                  unoptimized
                />
                {onPreview ? (
                  <span
                    className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-black/45 opacity-0 transition-opacity group-hover/ref-thumb:opacity-100"
                    aria-hidden
                  >
                    <Eye className="size-4 text-white/90" />
                  </span>
                ) : null}
              </>
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
