/**
 * 生成耗时预警（默认 ≥800s）：列表筛选 + poll 升格处理。
 */
import type { Prisma } from "@prisma/client";

import { recoverCanvasVideoTaskDisplay } from "@/lib/canvas/canvas-video-display-recover";
import { isCanvasVolcengineVideoTaskPayload } from "@/lib/canvas/canvas-constants";
import { prisma } from "@/lib/prisma";

import { getGenerationSlowWarnMs } from "./poll-config";
import { resolveGenerationSlowWarnMs } from "./slow-warn-config";

const IN_FLIGHT_SLOW_STATUSES = ["PENDING", "RUNNING"] as const;

/** Gateway 日志 · 耗时 ≥ threshold 或进行中已超过 threshold */
export function buildSlowGenerationWhere(
  thresholdMs: number = getGenerationSlowWarnMs(),
  nowMs: number = Date.now(),
): Prisma.GatewayRequestLogWhereInput {
  const cutoff = new Date(nowMs - thresholdMs);
  return {
    OR: [
      { durationMs: { gte: thresholdMs } },
      {
        status: { in: [...IN_FLIGHT_SLOW_STATUSES] },
        submittedAt: { lte: cutoff },
      },
    ],
  };
}

export function isSlowGenerationAge(
  submittedAt: Date | null | undefined,
  createdAt: Date,
  nowMs: number = Date.now(),
  thresholdMs: number = getGenerationSlowWarnMs(),
): boolean {
  const ts = (submittedAt ?? createdAt).getTime();
  return nowMs - ts >= thresholdMs;
}

function taskInputPayload(
  inputPayload: unknown,
): Record<string, unknown> | null {
  if (!inputPayload || typeof inputPayload !== "object") return null;
  return inputPayload as Record<string, unknown>;
}

/** SUBMITTED 画布视频 · 超 800s 仍卡住时强制 Gateway 同步 + runtime 恢复 */
export async function escalateSlowCanvasSubmittedTasks(opts?: {
  projectId?: string;
  limit?: number;
  thresholdMs?: number;
}): Promise<{ scanned: number; recovered: number }> {
  const thresholdMs =
    opts?.thresholdMs ?? (await resolveGenerationSlowWarnMs());
  const cutoff = new Date(Date.now() - thresholdMs);
  const limit = opts?.limit ?? 15;

  const tasks = await prisma.canvasGenerationTask.findMany({
    where: {
      status: "SUBMITTED",
      kieTaskId: { not: null },
      ...(opts?.projectId ? { projectId: opts.projectId } : {}),
      OR: [
        { submittedAt: { lte: cutoff } },
        { submittedAt: null, createdAt: { lte: cutoff } },
      ],
    },
    orderBy: [{ submittedAt: "asc" }, { createdAt: "asc" }],
    take: limit,
    select: {
      id: true,
      inputPayload: true,
    },
  });

  let recovered = 0;
  for (const task of tasks) {
    if (!isCanvasVolcengineVideoTaskPayload(taskInputPayload(task))) continue;
    const r = await recoverCanvasVideoTaskDisplay(task.id);
    if (
      r.ok &&
      (r.action === "patched_runtime" ||
        r.action === "applied_from_gateway" ||
        r.action === "recovered_vendor")
    ) {
      recovered++;
    }
  }

  return { scanned: tasks.length, recovered };
}
