"use client";

import { EcomPromptMentionRefBar } from "@/components/media/ecom-prompt-mention-ref-bar";
import { buildFilmPullMentionRefs } from "@/lib/film-pull-mention-refs";
import type { FilmPullCharacterRef } from "@/lib/film-pull-types";
import { cn } from "@/lib/utils";

type Props = {
  characterRefs: FilmPullCharacterRef[];
  className?: string;
};

/** 展示项目内全部参考资产顶栏（供 Prompt 引用） */
export function FilmPullRefsGalleryStrip({ characterRefs, className }: Props) {
  const mentionRefs = buildFilmPullMentionRefs(characterRefs);
  return (
    <EcomPromptMentionRefBar
      refs={mentionRefs}
      className={className}
      refsEmptyHint="尚未上传模特/产品参考图；上传后在 Prompt 中用 @ 插入代号。"
    />
  );
}
