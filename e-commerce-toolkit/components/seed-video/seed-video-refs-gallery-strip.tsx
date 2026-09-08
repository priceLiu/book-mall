"use client";

import { EcomPromptMentionRefBar } from "@/components/media/ecom-prompt-mention-ref-bar";
import { buildSeedVideoMentionRefs } from "@/lib/seed-video-mention-refs";
import type { SeedVideoReference } from "@/lib/seed-video-types";
import { cn } from "@/lib/utils";

type Props = {
  references: SeedVideoReference[];
  className?: string;
};

/** @deprecated 请用 EcomPromptMentionRefBar + buildSeedVideoMentionRefs */
export function SeedVideoRefsGalleryStrip({ references, className }: Props) {
  const mentionRefs = buildSeedVideoMentionRefs(references);
  return (
    <EcomPromptMentionRefBar
      refs={mentionRefs}
      className={className}
      refsEmptyHint="尚未上传参考图；请在上方上传，并在 Prompt 中用 @ 插入代号。"
    />
  );
}
