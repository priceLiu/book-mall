/**
 * Gen-HotCold-R3 · 画布任务表热读窗口（与后台视频恢复窗对齐）。
 *
 * 用户可见成品在 `CanvasProject.canvas` JSON + OSS；本窗口仅限制高频 `/tasks` 轮询扫描范围。
 */
import type { CanvasGenerationStatus, Prisma } from "@prisma/client";

import { GENERATION_INFLIGHT_STATUSES } from "@/lib/generation/traffic-control/constants";

const HOUR_MS = 3_600_000;

const CANVAS_TERMINAL_STATUSES: CanvasGenerationStatus[] = [
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
];

function readPositiveNumber(envKey: string, fallback: number): number {
  const raw = Number(process.env[envKey] ?? "");
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

/** 终态任务热读小时数（默认 6，覆盖火山长视频 + 恢复窗）。 */
export function getCanvasTaskTerminalHotHours(): number {
  return readPositiveNumber("CANVAS_TASK_TERMINAL_HOT_HOURS", 6);
}

export function canvasTaskTerminalHotWindowMs(): number {
  return getCanvasTaskTerminalHotHours() * HOUR_MS;
}

export function canvasTaskTerminalCutoffDate(now = new Date()): Date {
  return new Date(now.getTime() - canvasTaskTerminalHotWindowMs());
}

/** 生成记录面板默认回看天数。 */
export const CANVAS_GENERATION_RECORDS_DEFAULT_DAYS = 30;

export function canvasGenerationRecordsDefaultSince(now = new Date()): Date {
  return new Date(
    now.getTime() - CANVAS_GENERATION_RECORDS_DEFAULT_DAYS * 24 * HOUR_MS,
  );
}

/** 高频 `/tasks` 轻量读 WHERE 片段（在飞 + 近窗终态）。 */
export function buildCanvasTaskHotReadWhere(
  cutoff: Date = canvasTaskTerminalCutoffDate(),
): Prisma.CanvasGenerationTaskWhereInput {
  return {
    OR: [
      { status: { in: [...GENERATION_INFLIGHT_STATUSES] } },
      {
        status: { in: CANVAS_TERMINAL_STATUSES },
        updatedAt: { gte: cutoff },
      },
    ],
  };
}
