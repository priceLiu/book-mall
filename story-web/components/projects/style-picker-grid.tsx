"use client";

import Image from "next/image";
import { COMIC_STYLES } from "@/lib/comic-styles";
import type { AspectRatio } from "@/lib/projects/types";
import { cn } from "@/lib/utils";

type StylePickerGridProps = {
  value: number | null;
  aspectRatio: AspectRatio;
  onChange: (styleId: number) => void;
};

export function StylePickerGrid({ value, aspectRatio, onChange }: StylePickerGridProps) {
  const thumbAspect = aspectRatio === "9:16" ? "aspect-[9/16]" : "aspect-video";

  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
      {COMIC_STYLES.map((style) => {
        const selected = value === style.id;
        return (
          <button
            key={style.id}
            type="button"
            onClick={() => onChange(style.id)}
            className={cn(
              "group text-left transition",
              selected ? "ring-2 ring-[var(--story-accent)] ring-offset-2 ring-offset-[var(--story-surface)]" : "",
            )}
          >
            <div
              className={cn(
                "relative overflow-hidden rounded-lg border border-white/10 bg-black/40 transition-[aspect-ratio]",
                thumbAspect,
              )}
            >
              <Image
                src={style.url}
                alt={style.name_cn}
                fill
                sizes="(max-width: 768px) 33vw, 120px"
                className="object-cover transition group-hover:scale-105"
              />
              {selected ? (
                <span className="absolute inset-0 bg-[var(--story-accent)]/20 ring-2 ring-inset ring-[var(--story-accent)]" />
              ) : null}
              <span className="absolute right-1 top-1 rounded bg-black/60 px-1 py-0.5 text-[9px] text-white/90">
                {aspectRatio}
              </span>
            </div>
            <p className="mt-2 truncate text-xs font-medium text-white">{style.name_cn}</p>
            <p className="truncate text-[10px] text-[var(--story-muted)]">{style.type_cn}</p>
          </button>
        );
      })}
    </div>
  );
}

function AspectRatioPreview({ aspectRatio }: { aspectRatio: AspectRatio }) {
  const isPortrait = aspectRatio === "9:16";

  return (
    <div className="flex items-center gap-4 rounded-xl border border-white/10 bg-black/25 p-4">
      <div
        className={cn(
          "relative shrink-0 overflow-hidden rounded-lg border border-dashed border-white/25 bg-black/40 transition-all duration-300",
          isPortrait ? "h-28 w-[63px]" : "h-[63px] w-28",
        )}
      >
        <div className="absolute inset-0 flex items-center justify-center text-[10px] text-[var(--story-muted)]">
          {aspectRatio}
        </div>
      </div>
      <p className="text-xs leading-relaxed text-[var(--story-muted)]">
        项目封面、分镜图与视频将按{" "}
        <span className="font-medium text-white">{aspectRatio}</span> 比例生成。
        切换后下方风格预览同步更新。
      </p>
    </div>
  );
}

export { AspectRatioPreview };
