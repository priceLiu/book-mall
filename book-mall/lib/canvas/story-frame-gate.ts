/**
 * 分镜静帧 → 视频 · 生产门禁（快手版 + 影视专业版共用）
 */

export type StoryFrameGateCode =
  | "FRAME_IMAGE_REQUIRED"
  | "FRAME_NOT_APPROVED";

export class StoryFrameGateError extends Error {
  readonly code: StoryFrameGateCode;
  readonly httpStatus = 400;

  constructor(code: StoryFrameGateCode, message: string) {
    super(message);
    this.name = "StoryFrameGateError";
    this.code = code;
  }
}

type FrameRowLike = Record<string, unknown>;

export function resolveStoryFrameImageUrl(row: FrameRowLike): string {
  const direct = String(row.frameImageUrl ?? "").trim();
  if (/^https?:\/\//.test(direct)) return direct;
  const rt = row.runtime as
    | { ossUrl?: string; ephemeralUrl?: string }
    | undefined;
  const fromRt = String(rt?.ossUrl ?? rt?.ephemeralUrl ?? "").trim();
  return /^https?:\/\//.test(fromRt) ? fromRt : "";
}

export function isStoryFrameApproved(row: FrameRowLike): boolean {
  return Boolean(String(row.frameApprovedAt ?? "").trim());
}

/** 视频生成前校验：须已有分镜图且已过审 */
export function assertStoryVideoFrameGate(row: FrameRowLike): string {
  const frameUrl = resolveStoryFrameImageUrl(row);
  if (!frameUrl) {
    throw new StoryFrameGateError(
      "FRAME_IMAGE_REQUIRED",
      "分镜视频需要已生成的分镜静帧，请先生成该镜的分镜图。",
    );
  }
  if (!isStoryFrameApproved(row)) {
    throw new StoryFrameGateError(
      "FRAME_NOT_APPROVED",
      "该镜分镜图尚未过审，请在分镜列点击「通过」后再生成视频。",
    );
  }
  return frameUrl;
}
