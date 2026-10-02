import { isProVerticalId } from "@/lib/ecom/pro-vertical/registry";
import type { ProVerticalId } from "@/lib/ecom/pro-vertical/types";

/** Story Theater 与 Pro vertical 对齐（9 大品类） */
export type StoryTheaterVertical = ProVerticalId;

export function parseStoryTheaterVertical(raw: string | null | undefined): StoryTheaterVertical | null {
  const v = raw?.trim();
  if (!v || !isProVerticalId(v)) return null;
  return v;
}

export const STORY_THEATER_VERTICAL_LABELS: Record<StoryTheaterVertical, string> = {
  fashion_apparel: "服装",
  bags: "包包",
  digital_3c: "3C 数码",
  footwear: "鞋子",
  jewelry: "珠宝",
  outdoor_gear: "户外用品",
  loungewear: "家居服",
  kitchenware: "厨房用品",
  baby_maternal: "母婴用品",
};
