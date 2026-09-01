"use client";

import { buildFilmPullMentionRefs } from "@/lib/film-pull-mention-refs";
import type { FilmPullCharacterRef } from "@/lib/film-pull-types";
import { cn } from "@/lib/utils";

type Props = {
  characterRefs: FilmPullCharacterRef[];
  className?: string;
};

/** 展示项目内全部参考图及 @图片N 标签（供 Prompt 引用） */
export function FilmPullRefsGalleryStrip({ characterRefs, className }: Props) {
  const mentionRefs = buildFilmPullMentionRefs(characterRefs);
  if (mentionRefs.length === 0) {
    return (
      <p className={cn("text-[11px] leading-relaxed text-[#86868b]", className)}>
        尚未上传模特/产品参考图；请在复刻设置中上传，并在 Prompt 中用 @图片1 … 引用。
      </p>
    );
  }

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {mentionRefs.map((ref) => (
        <div
          key={ref.token}
          className="flex items-center gap-1.5 rounded-lg border border-[#e8e8ed] bg-white px-1.5 py-1"
          title={ref.label}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={ref.url}
            alt={ref.label}
            className="h-10 w-10 shrink-0 rounded-md border border-[#e8e8ed] object-cover"
          />
          <span className="pr-1 font-mono text-[10px] font-medium text-[#0071e3]">{ref.token}</span>
        </div>
      ))}
    </div>
  );
}
