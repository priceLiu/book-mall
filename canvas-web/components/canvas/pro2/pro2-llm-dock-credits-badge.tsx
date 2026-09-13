"use client";

import { useModelCreditsPreview } from "@/lib/canvas/use-model-credits-preview";
import { LibtvDockCreditsLabel } from "@/components/canvas/libtv-dock-credits-label";

/** Pro2 / Story LLM Dock · 积分预览（默认 4k in + 2k out 估算） */
export function Pro2LlmDockCreditsBadge(props: {
  modelKey: string | undefined | null;
  fontPx: number;
}) {
  const key = props.modelKey?.trim() ?? "";
  const estCredits = useModelCreditsPreview(key, 0);
  if (!key || estCredits?.credits == null) return null;
  return (
    <LibtvDockCreditsLabel
      credits={estCredits.credits}
      fontPx={props.fontPx}
      title={`${estCredits.canonicalModelKey} · 预计约 ${estCredits.credits} 积分（按 4k 输入 + 2k 输出估算，LLM 按 token 分价，实扣以实际用量为准）`}
    />
  );
}
