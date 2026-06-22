/**
 * 视频 · 持续后台生成（≥10min 不占前台焦虑，仍 RUNNING + 继续 poll）。
 * 与 Canvas / Gateway UI 的「后台等待」阈值共用 VIDEO_BACKGROUND_UI_MS。
 */
import type { Prisma } from "@prisma/client";

import { VIDEO_BACKGROUND_UI_MS } from "@/lib/gateway/video-task-wait-policy";

export const VIDEO_BACKGROUND_GENERATION_LABEL = "持续后台生成中…";
export const VIDEO_BACKGROUND_WAIT_HINT =
  "视频仍在厂商侧生成，可先处理其他内容；成片后将通知您加载到节点。";
export const VIDEO_BACKGROUND_RECOVER_HINT =
  "厂商侧可能已出片，请点击「加载到节点」恢复。";

/** 历史误杀 failCode（可尝试向厂商复核并恢复） */
export const VOLCENGINE_RECOVERABLE_STALL_FAIL_CODES = [
  "VOLCENGINE_GATEWAY_POLL_STALL",
] as const;

export type VideoBackgroundGenerationMeta = {
  sinceMs: number;
  slotReleased?: boolean;
  promotedAtMs?: number;
};

export function readVideoBackgroundGeneration(
  resultSummary: unknown,
): VideoBackgroundGenerationMeta | null {
  if (!resultSummary || typeof resultSummary !== "object") return null;
  const gw = (resultSummary as Record<string, unknown>)._gateway;
  if (!gw || typeof gw !== "object") return null;
  const bg = (gw as Record<string, unknown>).backgroundGeneration;
  if (!bg || typeof bg !== "object") return null;
  const sinceMs = Number((bg as Record<string, unknown>).sinceMs);
  if (!Number.isFinite(sinceMs)) return null;
  return {
    sinceMs,
    slotReleased: (bg as Record<string, unknown>).slotReleased === true,
    promotedAtMs: Number((bg as Record<string, unknown>).promotedAtMs) || undefined,
  };
}

export function attachVideoBackgroundGeneration(
  resultSummary: unknown,
  meta: VideoBackgroundGenerationMeta,
): Record<string, unknown> {
  const base =
    resultSummary && typeof resultSummary === "object" && !Array.isArray(resultSummary)
      ? ({ ...(resultSummary as Record<string, unknown>) } as Record<string, unknown>)
      : resultSummary != null
        ? { value: resultSummary }
        : {};
  const prevGw =
    base._gateway && typeof base._gateway === "object"
      ? { ...(base._gateway as Record<string, unknown>) }
      : {};
  base._gateway = {
    ...prevGw,
    backgroundGeneration: {
      sinceMs: meta.sinceMs,
      slotReleased: meta.slotReleased ?? false,
      promotedAtMs: meta.promotedAtMs ?? Date.now(),
    },
  };
  return base;
}

/** Gateway RUNNING 视频是否仍占用交通并发槽（后台已释放槽的不计入） */
export function isGatewayVideoLogOccupyingTrafficSlot(input: {
  status: string;
  requestKind?: string | null;
  resultSummary?: unknown;
}): boolean {
  if (input.status !== "RUNNING" || input.requestKind !== "VIDEO") return false;
  const bg = readVideoBackgroundGeneration(input.resultSummary);
  return !(bg?.slotReleased === true);
}

export function isVideoBackgroundGenerationAge(
  submittedAt: Date | null | undefined,
  createdAt: Date,
  nowMs: number = Date.now(),
  thresholdMs: number = VIDEO_BACKGROUND_UI_MS,
): boolean {
  const ts = (submittedAt ?? createdAt).getTime();
  return nowMs - ts >= thresholdMs;
}

export function buildGatewayBackgroundGenerationWhere(
  thresholdMs: number = VIDEO_BACKGROUND_UI_MS,
  nowMs: number = Date.now(),
): Prisma.GatewayRequestLogWhereInput {
  const cutoff = new Date(nowMs - thresholdMs);
  return {
    status: "RUNNING",
    requestKind: "VIDEO",
    submittedAt: { lte: cutoff },
  };
}

export function isRecoverableVolcengineStallFailCode(
  failCode: string | null | undefined,
): boolean {
  if (!failCode) return false;
  return (VOLCENGINE_RECOVERABLE_STALL_FAIL_CODES as readonly string[]).includes(
    failCode,
  );
}
