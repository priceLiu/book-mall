/**
 * 分镜静帧 → 视频 · UI / 客户端门禁（与 book-mall story-frame-gate 语义一致）
 */

import { modelHasStoryCapabilities } from "@/lib/canvas/story-model-capabilities";

export type StoryFrameGateCode =
  | "FRAME_IMAGE_REQUIRED"
  | "FRAME_NOT_APPROVED";

type FrameRowLike = {
  frameImageUrl?: string;
  frameApprovedAt?: string;
  frameRejectedReason?: string;
  runtime?: { ossUrl?: string; ephemeralUrl?: string };
};

export function resolveStoryFrameImageUrl(row: FrameRowLike): string | undefined {
  const direct = row.frameImageUrl?.trim();
  if (direct && /^https?:\/\//.test(direct)) return direct;
  const fromRt =
    row.runtime?.ossUrl?.trim() || row.runtime?.ephemeralUrl?.trim();
  if (fromRt && /^https?:\/\//.test(fromRt)) return fromRt;
  return undefined;
}

export function isStoryFrameApproved(row: FrameRowLike): boolean {
  return Boolean(row.frameApprovedAt?.trim());
}

export function storyVideoGenerateBlockReason(
  frameRow: FrameRowLike | undefined,
): string | null {
  if (!frameRow) return "找不到对应分镜行";
  const url = resolveStoryFrameImageUrl(frameRow);
  if (!url) return "请先生成该镜的分镜图（静帧先行）";
  if (!isStoryFrameApproved(frameRow)) return "分镜静帧待过审 · 请在分镜图旁点击「通过」";
  return null;
}

/** 影视专业版 / 漫剧 · 分镜视频：图生视频（i2v）或参考生视频（R2V） */
export function isStoryProVideoModel(modelKey: string): boolean {
  return (
    modelHasStoryCapabilities(modelKey, ["video_i2v"]) ||
    modelHasStoryCapabilities(modelKey, ["video_r2v"])
  );
}

export function filterStoryProVideoModelKeys(keys: readonly string[]): string[] {
  return keys.filter(isStoryProVideoModel);
}

/** @deprecated 使用 filterStoryProVideoModelKeys */
export function filterStoryProVideoI2vModelKeys(keys: readonly string[]): string[] {
  return filterStoryProVideoModelKeys(keys);
}
