/** 故事剧场工作流 · toolkit 侧 choice 标签与 phase 辅助 */

import type { FashionDeliverable } from "@/lib/fashion-types";
import type { ProDeliverable } from "@/lib/pro-vertical/types";
import {
  STORY_THEATER_VERSION_TITLES,
  effectiveProductionMode,
  isStoryTheaterProductionMode,
  type StoryTheaterVersionKey,
} from "@/lib/story-theater-types";

export const PRODUCTION_MODE_SCRIPT = "选择产出：分镜脚本标准线";
export const PRODUCTION_MODE_STORY = "选择产出：故事剧场线";
export const STORY_TOPIC_PICK_PREFIX = "选择故事主题：";
export const STORY_THEATER_PICK_PREFIX = "选择故事版 ";
export const FASHION_AI_STORY_THEATER = "fashion-step:story-theater-generate";
export const PRO_AI_STORY_THEATER = "pro-step:story-theater-generate";

export function storyTopicChoiceLabel(title: string): string {
  return `${STORY_TOPIC_PICK_PREFIX}${title}`;
}

export function parseStoryTopicChoice(message: string): string | null {
  const trimmed = message.trim();
  if (!trimmed.startsWith(STORY_TOPIC_PICK_PREFIX)) return null;
  return trimmed.slice(STORY_TOPIC_PICK_PREFIX.length).trim() || null;
}

export function storyTheaterVersionChoiceLabel(key: StoryTheaterVersionKey): string {
  return `${STORY_THEATER_PICK_PREFIX}${key}`;
}

export function parseStoryTheaterVersionChoice(message: string): StoryTheaterVersionKey | null {
  const m = message.trim().match(/^选择故事版\s*(T[1-5])$/);
  const key = m?.[1];
  return key === "T1" || key === "T2" || key === "T3" || key === "T4" || key === "T5"
    ? key
    : null;
}

export function deliverableProductionMode(
  d: FashionDeliverable | ProDeliverable | null | undefined,
): ReturnType<typeof effectiveProductionMode> {
  return effectiveProductionMode(d?.productionMode);
}

export function isStoryTheaterDeliverable(
  d: FashionDeliverable | ProDeliverable | null | undefined,
): boolean {
  return isStoryTheaterProductionMode(d?.productionMode);
}

export function listStoryTheaterVersionKeys(
  d:
    | Pick<FashionDeliverable, "storyTheaterVersions">
    | Pick<ProDeliverable, "storyTheaterVersions">
    | null
    | undefined,
): StoryTheaterVersionKey[] {
  const versions = d?.storyTheaterVersions ?? {};
  return (["T1", "T2", "T3", "T4", "T5"] as StoryTheaterVersionKey[]).filter((k) => {
    const v = versions[k];
    if (!v || typeof v !== "object") return false;
    return (
      (v.panels?.length ?? 0) > 0 ||
      Boolean(v.title?.trim()) ||
      Boolean(v.summary?.trim())
    );
  });
}

export function storyTheaterVersionCardTitle(key: StoryTheaterVersionKey, title?: string): string {
  const base = STORY_THEATER_VERSION_TITLES[key];
  return title?.trim() ? `${base}：${title.trim()}` : base;
}

export function storyTheaterLlmTrigger(usesPro: boolean): string {
  return usesPro ? PRO_AI_STORY_THEATER : FASHION_AI_STORY_THEATER;
}
