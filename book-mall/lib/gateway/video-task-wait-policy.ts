/**
 * 视频任务等待策略：Canvas 10min 后台化 UI 与 Gateway 筛选共用阈值。
 * 硬超时（90min STALE_TIMEOUT）见 poll-config / volcengine stale release。
 */
import type { Prisma } from "@prisma/client";

export const VIDEO_BACKGROUND_UI_MS = 10 * 60 * 1000;
export const VIDEO_BACKGROUND_UI_SEC = VIDEO_BACKGROUND_UI_MS / 1000;

export const VIDEO_BACKGROUND_UI_LABEL = "持续后台生成中…";
export const VIDEO_GENERATING_LABEL = "视频生成中…";
export const VIDEO_QUEUE_LABEL = "排队中…";
export const VIDEO_BACKGROUND_WAIT_HINT =
  "视频仍在厂商侧生成，可先处理其他内容；成片后将通知您加载到节点。";

const IN_FLIGHT_STATUSES = ["PENDING", "RUNNING"] as const;

export function isVideoBackgroundWaitAge(
  submittedAt: Date | null | undefined,
  createdAt: Date,
  nowMs: number = Date.now(),
  thresholdMs: number = VIDEO_BACKGROUND_UI_MS,
): boolean {
  const ts = (submittedAt ?? createdAt).getTime();
  return nowMs - ts >= thresholdMs;
}

/** Gateway 日志 · 进行中且已等待 ≥ threshold（默认 10min） */
export function buildVideoBackgroundWaitWhere(
  thresholdMs: number = VIDEO_BACKGROUND_UI_MS,
  nowMs: number = Date.now(),
): Prisma.GatewayRequestLogWhereInput {
  const cutoff = new Date(nowMs - thresholdMs);
  return {
    status: { in: [...IN_FLIGHT_STATUSES] },
    submittedAt: { lte: cutoff },
  };
}

export function resolveVideoGeneratingLabel(
  isPending: boolean,
  isBackground: boolean,
): string {
  if (isBackground) return VIDEO_BACKGROUND_UI_LABEL;
  if (isPending) return VIDEO_QUEUE_LABEL;
  return VIDEO_GENERATING_LABEL;
}
