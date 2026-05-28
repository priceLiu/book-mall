"use client";

import type { StoryProCharacterAssetRecord } from "@/lib/canvas-api";
import {
  STORY_ROW_BANNER_CLASS,
  STORY_ROW_META_CLASS,
} from "@/lib/canvas/story-column-sync";
import { PRO_ROW_SECONDARY_BTN_CLASS } from "@/lib/canvas/story-pro-node-chrome";
import {
  frameRowHasStaleAssetSnapshot,
  readinessClass,
  readinessDetail,
  readinessLabel,
  type FrameRowAssetReadiness,
} from "@/lib/canvas/story-pro-asset-readiness";
import {
  applyFrameRefSuggestionsToPrompt,
  type FrameRefSuggestion,
} from "@/lib/canvas/story-pro-frame-ref-suggest";

export function StoryProFrameRefSuggestBar({
  suggestions,
  currentPrompt,
  onApply,
  reserveSpace,
}: {
  suggestions: FrameRefSuggestion[];
  currentPrompt: string;
  onApply: (nextPrompt: string) => void;
  /** 占位统一行高：无建议时也保留高度 */
  reserveSpace?: boolean;
}) {
  if (!suggestions.length) {
    return reserveSpace ? (
      <div className="min-h-[26px]" aria-hidden />
    ) : null;
  }
  const names = suggestions.map((s) => s.name).join("、");
  return (
    <div className={STORY_ROW_BANNER_CLASS}>
      <span className={STORY_ROW_META_CLASS}>建议 @：{names}</span>
      <button
        type="button"
        className={PRO_ROW_SECONDARY_BTN_CLASS}
        onClick={() => {
          const { prompt } = applyFrameRefSuggestionsToPrompt(
            currentPrompt,
            suggestions,
          );
          onApply(prompt);
        }}
      >
        一键插入 @
      </button>
    </div>
  );
}

export function StoryProFrameAssetReadinessBar({
  readiness,
  stale,
  reserveSpace,
}: {
  readiness: FrameRowAssetReadiness;
  stale?: boolean;
  reserveSpace?: boolean;
}) {
  if (readiness.level === "none" && !stale) {
    return reserveSpace ? (
      <div className="min-h-[22px]" aria-hidden />
    ) : null;
  }
  return (
    <div className="flex flex-wrap items-center gap-2 text-[10px]">
      {readiness.level !== "none" ? (
        <span className={readinessClass(readiness.level)}>
          {readinessLabel(readiness.level)}
          {readiness.characters.length
            ? ` · ${readinessDetail(readiness.level, readiness.characters)}`
            : ""}
        </span>
      ) : null}
      {stale ? (
        <span className={STORY_ROW_META_CLASS}>角色资产已更新 · 建议重跑静帧</span>
      ) : null}
    </div>
  );
}

export function frameRowStaleSnapshot(
  row: {
    characterRefSnapshotAt?: string;
    characterAssetVersions?: Record<string, number>;
  },
  assets: StoryProCharacterAssetRecord[],
  projectId?: string | null,
): boolean {
  return frameRowHasStaleAssetSnapshot(row, assets, projectId);
}
