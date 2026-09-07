/** 故事剧场模式 · 共享类型（与 e-commerce-toolkit 对齐） */

export type ProductionMode = "standard_script" | "story_theater";

export type StoryTheaterVersionKey = "T1" | "T2" | "T3" | "T4" | "T5";

export const STORY_THEATER_VERSION_KEYS: StoryTheaterVersionKey[] = [
  "T1",
  "T2",
  "T3",
  "T4",
  "T5",
];

export const STORY_THEATER_VERSION_TITLES: Record<StoryTheaterVersionKey, string> = {
  T1: "T1 · 痛点治愈剧情",
  T2: "T2 · 场景适配剧情",
  T3: "T3 · 前后反差剧情",
  T4: "T4 · 经验避坑剧情",
  T5: "T5 · 情绪共鸣剧情",
};

export type StoryTheaterTopicRef = {
  id: string;
  title: string;
  storyCore: string;
  storyType: string;
};

export function isStoryTheaterVersionKey(raw: string): raw is StoryTheaterVersionKey {
  return raw === "T1" || raw === "T2" || raw === "T3" || raw === "T4" || raw === "T5";
}

export function resolveProductionMode(raw: unknown): ProductionMode | null {
  if (raw === "standard_script" || raw === "story_theater") return raw;
  return null;
}

export function effectiveProductionMode(raw: unknown): ProductionMode {
  return resolveProductionMode(raw) ?? "standard_script";
}

export function isStoryTheaterProductionMode(raw: unknown): boolean {
  return effectiveProductionMode(raw) === "story_theater";
}
