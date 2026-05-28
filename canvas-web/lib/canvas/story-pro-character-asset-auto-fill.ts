import type { StoryProCharacterAssetRecord } from "@/lib/canvas-api";
import {
  STORY_PRO_ASSET_REF_KIND_LABELS,
  type StoryProAssetRefKind,
} from "@/lib/canvas/story-pro-character-asset-catalog";

export type AutoCropSlotKind = Extract<
  StoryProAssetRefKind,
  "face" | "full_body" | "outfit"
>;

export type AutoFillSlotsResult = {
  filled: AutoCropSlotKind[];
  skipped: AutoCropSlotKind[];
  asset?: StoryProCharacterAssetRecord;
  error?: string;
};

export function formatAutoFillSlotsMessage(result: AutoFillSlotsResult): string {
  const parts: string[] = [];
  if (result.filled.length) {
    parts.push(
      `已自动裁切：${result.filled.map((k) => STORY_PRO_ASSET_REF_KIND_LABELS[k]).join("、")}`,
    );
  }
  if (result.skipped.length) {
    parts.push(
      `未覆盖已有：${result.skipped.map((k) => STORY_PRO_ASSET_REF_KIND_LABELS[k]).join("、")}`,
    );
  }
  if (result.error) parts.push(result.error);
  if (!parts.length) return "三视图已入库";
  return parts.join(" · ");
}
