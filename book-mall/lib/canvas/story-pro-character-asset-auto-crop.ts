/**
 * 三视图（左正 / 中侧 / 右背）→ 脸 / 全身 / 服装 裁切区域（相对坐标 0–1）
 */
import type { StoryProCharacterAssetRefKind } from "@prisma/client";

export type AutoCropSlotKind = Extract<
  StoryProCharacterAssetRefKind,
  "face" | "full_body" | "outfit"
>;

export const THREE_VIEW_AUTO_CROP_REGIONS: Record<
  AutoCropSlotKind,
  { x: number; y: number; w: number; h: number }
> = {
  face: { x: 0, y: 0, w: 1 / 3, h: 0.42 },
  full_body: { x: 0, y: 0, w: 1 / 3, h: 1 },
  outfit: { x: 0.02, y: 0.34, w: 1 / 3 - 0.04, h: 0.38 },
};

export const AUTO_CROP_SLOT_LABELS: Record<AutoCropSlotKind, string> = {
  face: "脸",
  full_body: "全身",
  outfit: "服装",
};

export const AUTO_FILL_KINDS: AutoCropSlotKind[] = [
  "face",
  "full_body",
  "outfit",
];
