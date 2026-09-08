"use client";

import { EcomPromptMentionRefBar } from "@/components/media/ecom-prompt-mention-ref-bar";
import { buildReplicaMentionRefs } from "@/lib/media-decompose-replica-refs";
import type { SeedVideoReference } from "@/lib/seed-video-types";
import { cn } from "@/lib/utils";

type Props = {
  references: SeedVideoReference[];
  className?: string;
  emptyHint?: string;
};

/** 展示复刻参考资产顶栏（供 Prompt 引用） */
export function ReplicaRefsGalleryStrip({
  references,
  className,
  emptyHint = "尚未上传替换参考图；上传后在 Prompt 中用 @ 插入代号。",
}: Props) {
  const mentionRefs = buildReplicaMentionRefs(references);
  return (
    <EcomPromptMentionRefBar
      refs={mentionRefs}
      className={className}
      refsEmptyHint={emptyHint}
    />
  );
}
