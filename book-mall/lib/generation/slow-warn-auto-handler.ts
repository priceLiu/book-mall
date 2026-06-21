/**
 * 预警 · 全自动处理（无需轮询池手动点「恢复」）。
 *
 * 两档：
 * 1. Gateway 已 SUCCEEDED 但 Canvas 仍 SUBMITTED → 立即同步（修复 pollDelay）
 * 2. 耗时 ≥ 预警线 → 升格 fast poll + Canvas recover + Gateway recover
 */
import { recoverCanvasVideoTaskDisplay } from "@/lib/canvas/canvas-video-display-recover";
import { isCanvasVolcengineVideoTaskPayload } from "@/lib/canvas/canvas-constants";
import {
  releasePollPoolGatewayLog,
} from "@/lib/gateway/poll-pool-release";
import { prisma } from "@/lib/prisma";

import { resolveGenerationSlowWarnMs } from "./slow-warn-config";
import { escalateSlowCanvasSubmittedTasks } from "./slow-generation";

const AUTO_HANDLER_MIN_INTERVAL_MS = 15_000;
const GATEWAY_SUCCEEDED_SYNC_MIN_AGE_MS = 30_000;

let lastAutoHandlerAt = 0;

export type SlowWarnAutoHandlerResult = {
  skipped?: boolean;
  gatewaySucceededSync: number;
  slowCanvasRecovered: number;
  slowGatewayRecovered: number;
  scanned: number;
};

function taskInputPayload(
  inputPayload: unknown,
): Record<string, unknown> | null {
  if (!inputPayload || typeof inputPayload !== "object") return null;
  return inputPayload as Record<string, unknown>;
}

function isVolcengineVideoTask(
  task: Pick<{ inputPayload: unknown }, "inputPayload">,
): boolean {
  return isCanvasVolcengineVideoTaskPayload(taskInputPayload(task));
}

/** 限流：多用户同时打开轮询池时避免 15s 内重复全量升格 */
export async function maybeRunSlowWarnAutoHandler(opts?: {
  limit?: number;
  force?: boolean;
}): Promise<SlowWarnAutoHandlerResult> {
  const now = Date.now();
  if (!opts?.force && now - lastAutoHandlerAt < AUTO_HANDLER_MIN_INTERVAL_MS) {
    return {
      skipped: true,
      gatewaySucceededSync: 0,
      slowCanvasRecovered: 0,
      slowGatewayRecovered: 0,
      scanned: 0,
    };
  }
  lastAutoHandlerAt = now;
  return runSlowWarnAutoHandler(opts);
}

/** Gateway 已成功 · Canvas 仍 SUBMITTED → 自动写回（不等到 800s） */
async function autoSyncCanvasFromSucceededGateway(
  limit: number,
): Promise<number> {
  const minAgeCutoff = new Date(Date.now() - GATEWAY_SUCCEEDED_SYNC_MIN_AGE_MS);
  const tasks = await prisma.canvasGenerationTask.findMany({
    where: {
      status: "SUBMITTED",
      kieTaskId: { not: null },
      OR: [
        { submittedAt: { lte: minAgeCutoff } },
        { submittedAt: null, createdAt: { lte: minAgeCutoff } },
      ],
    },
    orderBy: [{ submittedAt: "asc" }, { createdAt: "asc" }],
    take: limit * 4,
    select: {
      id: true,
      inputPayload: true,
      submittedAt: true,
      createdAt: true,
    },
  });

  let synced = 0;
  for (const task of tasks) {
    if (!isVolcengineVideoTask(task)) continue;
    const payload = taskInputPayload(task);
    const gwId =
      typeof payload?.gatewayLogId === "string"
        ? payload.gatewayLogId.trim()
        : "";
    if (!gwId) continue;

    const log = await prisma.gatewayRequestLog.findUnique({
      where: { id: gwId },
      select: { status: true },
    });
    if (log?.status !== "SUCCEEDED") continue;

    const r = await recoverCanvasVideoTaskDisplay(task.id);
    if (
      r.ok &&
      (r.action === "patched_runtime" ||
        r.action === "applied_from_gateway" ||
        r.action === "recovered_vendor")
    ) {
      synced++;
    }
    if (synced >= limit) break;
  }
  return synced;
}

/** 全站预警自动处理（由 poll worker / 轮询池 调用） */
export async function runSlowWarnAutoHandler(opts?: {
  limit?: number;
}): Promise<SlowWarnAutoHandlerResult> {
  const limit = opts?.limit ?? 20;
  const thresholdMs = await resolveGenerationSlowWarnMs();
  const slowCutoff = new Date(Date.now() - thresholdMs);

  const gatewaySucceededSync =
    await autoSyncCanvasFromSucceededGateway(limit);

  const slowEsc = await escalateSlowCanvasSubmittedTasks({
    limit,
    thresholdMs,
  });

  const slowGateway = await prisma.gatewayRequestLog.findMany({
    where: {
      status: "RUNNING",
      externalTaskId: { not: null },
      submittedAt: { lte: slowCutoff },
    },
    orderBy: { submittedAt: "asc" },
    take: limit,
    select: { id: true },
  });

  let slowGatewayRecovered = 0;
  for (const row of slowGateway) {
    const r = await releasePollPoolGatewayLog(row.id, "recover");
    if (r.ok) slowGatewayRecovered++;
  }

  return {
    gatewaySucceededSync,
    slowCanvasRecovered: slowEsc.recovered,
    slowGatewayRecovered,
    scanned:
      slowEsc.scanned + slowGateway.length + gatewaySucceededSync,
  };
}
