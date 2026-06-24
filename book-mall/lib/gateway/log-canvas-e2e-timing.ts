import type { GatewayRequestLog } from "@prisma/client";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { isGatewayLogTerminalStatus } from "@/lib/gateway/log-progress";

/** 用户 E2E：画布点击生成 → 任务完成（含交通控流 / OSS / DB，不含纯 UI 渲染） */
export type CanvasE2eTimingRecord = {
  kind: "canvas_e2e";
  canvasTaskId: string;
  /** CanvasGenerationTask.createdAt */
  startedAtMs: number;
  /** 终态冻结：画布任务 completedAt */
  displayReadyAtMs?: number;
  /** createdAt → Gateway submittedAt（交通控流 + dispatch + createTask 前） */
  preGatewayMs?: number;
  /** Gateway durationMs 冻结快照 */
  gatewayMs?: number;
  /** Gateway completedAt → 画布 completedAt（OSS / 节点回写） */
  postGatewayMs?: number;
  /** displayReadyAt − startedAt（终态冻结） */
  e2eMs?: number;
};

export type CanvasTaskTimingInput = {
  id: string;
  createdAt: Date;
  queuedAt: Date | null;
  completedAt: Date | null;
};

export function readCanvasE2eTiming(
  resultSummary: unknown,
): CanvasE2eTimingRecord | null {
  if (!resultSummary || typeof resultSummary !== "object") return null;
  const gateway = (resultSummary as Record<string, unknown>)._gateway;
  if (!gateway || typeof gateway !== "object") return null;
  const raw = (gateway as Record<string, unknown>).canvasE2e;
  if (!raw || typeof raw !== "object") return null;
  const o = raw as CanvasE2eTimingRecord;
  return o.kind === "canvas_e2e" ? o : null;
}

function attachCanvasE2eToSummary(
  existing: unknown,
  record: CanvasE2eTimingRecord,
): Record<string, unknown> {
  const base =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? ({ ...(existing as Record<string, unknown>) } as Record<string, unknown>)
      : existing != null
        ? ({ value: existing } as Record<string, unknown>)
        : ({} as Record<string, unknown>);
  const gateway =
    base._gateway && typeof base._gateway === "object"
      ? { ...(base._gateway as Record<string, unknown>) }
      : {};
  gateway.canvasE2e = record;
  base._gateway = gateway;
  return base;
}

/** 由画布任务 + Gateway 日志计算 E2E 分段（可 live 或终态冻结）。 */
export function buildCanvasE2eTiming(input: {
  log: Pick<GatewayRequestLog, "submittedAt" | "completedAt" | "durationMs">;
  canvasTask: CanvasTaskTimingInput;
  /** 终态冻结时刻；进行中传 now */
  anchorMs: number;
  freeze?: boolean;
}): CanvasE2eTimingRecord {
  const startedAtMs = input.canvasTask.createdAt.getTime();
  const gatewaySubmittedMs = input.log.submittedAt.getTime();
  const preGatewayMs = Math.max(0, gatewaySubmittedMs - startedAtMs);

  const gatewayCompletedMs = input.log.completedAt?.getTime();
  const displayReadyMs = input.freeze
    ? input.canvasTask.completedAt?.getTime()
    : input.canvasTask.completedAt?.getTime() ?? input.anchorMs;

  let gatewayMs: number | undefined;
  if (
    input.log.durationMs != null &&
    input.log.durationMs > 0 &&
    input.log.completedAt != null
  ) {
    gatewayMs = input.log.durationMs;
  } else if (gatewayCompletedMs != null) {
    gatewayMs = Math.max(0, gatewayCompletedMs - gatewaySubmittedMs);
  } else {
    gatewayMs = Math.max(0, input.anchorMs - gatewaySubmittedMs);
  }

  let postGatewayMs: number | undefined;
  if (gatewayCompletedMs != null && displayReadyMs != null) {
    postGatewayMs = Math.max(0, displayReadyMs - gatewayCompletedMs);
  }

  const e2eMs =
    displayReadyMs != null
      ? Math.max(0, displayReadyMs - startedAtMs)
      : Math.max(0, input.anchorMs - startedAtMs);

  const record: CanvasE2eTimingRecord = {
    kind: "canvas_e2e",
    canvasTaskId: input.canvasTask.id,
    startedAtMs,
    preGatewayMs,
    gatewayMs,
    postGatewayMs,
    e2eMs,
  };

  if (input.freeze && input.canvasTask.completedAt) {
    record.displayReadyAtMs = input.canvasTask.completedAt.getTime();
  }

  return record;
}

/** 画布任务终态：冻结 E2E 分段并写入 Gateway resultSummary（幂等）。 */
export async function persistCanvasE2eTimingToGatewayLog(
  gatewayLogId: string,
  canvasTask: CanvasTaskTimingInput,
): Promise<void> {
  const log = await prisma.gatewayRequestLog.findUnique({
    where: { id: gatewayLogId },
    select: {
      id: true,
      submittedAt: true,
      completedAt: true,
      durationMs: true,
      resultSummary: true,
      status: true,
    },
  });
  if (!log || !canvasTask.completedAt) return;

  const record = buildCanvasE2eTiming({
    log,
    canvasTask,
    anchorMs: canvasTask.completedAt.getTime(),
    freeze: true,
  });

  const nextSummary = attachCanvasE2eToSummary(log.resultSummary, record);
  await prisma.gatewayRequestLog.update({
    where: { id: gatewayLogId },
    data: { resultSummary: nextSummary as Prisma.InputJsonValue },
  });
}

export function resolveCanvasE2eForLogRow(input: {
  log: Pick<
    GatewayRequestLog,
    "submittedAt" | "completedAt" | "durationMs" | "status" | "resultSummary"
  >;
  canvasTask: (CanvasTaskTimingInput & { completedAt: Date | null }) | null;
  nowMs?: number;
}): {
  canvasStartedAt: string | null;
  canvasCompletedAt: string | null;
  e2eMs: number | null;
  preGatewayMs: number | null;
  postGatewayMs: number | null;
  gatewayMs: number | null;
  e2eFrozen: boolean;
} {
  const nowMs = input.nowMs ?? Date.now();
  const stored = readCanvasE2eTiming(input.log.resultSummary);

  if (stored?.e2eMs != null && stored.displayReadyAtMs != null) {
    return {
      canvasStartedAt: new Date(stored.startedAtMs).toISOString(),
      canvasCompletedAt: new Date(stored.displayReadyAtMs).toISOString(),
      e2eMs: stored.e2eMs,
      preGatewayMs: stored.preGatewayMs ?? null,
      postGatewayMs: stored.postGatewayMs ?? null,
      gatewayMs: stored.gatewayMs ?? null,
      e2eFrozen: true,
    };
  }

  if (!input.canvasTask) {
    return {
      canvasStartedAt: null,
      canvasCompletedAt: null,
      e2eMs: null,
      preGatewayMs: null,
      postGatewayMs: null,
      gatewayMs: null,
      e2eFrozen: false,
    };
  }

  const terminal =
    isGatewayLogTerminalStatus(input.log.status) &&
    input.canvasTask.completedAt != null;

  const built = buildCanvasE2eTiming({
    log: input.log,
    canvasTask: input.canvasTask,
    anchorMs: nowMs,
    freeze: terminal,
  });

  return {
    canvasStartedAt: input.canvasTask.createdAt.toISOString(),
    canvasCompletedAt: input.canvasTask.completedAt?.toISOString() ?? null,
    e2eMs: built.e2eMs ?? null,
    preGatewayMs: built.preGatewayMs ?? null,
    postGatewayMs: built.postGatewayMs ?? null,
    gatewayMs: built.gatewayMs ?? null,
    e2eFrozen: terminal,
  };
}

export async function persistCanvasE2eForTask(taskId: string): Promise<void> {
  const task = await prisma.canvasGenerationTask.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      createdAt: true,
      queuedAt: true,
      completedAt: true,
      inputPayload: true,
    },
  });
  if (!task?.completedAt) return;
  const payload = task.inputPayload as { gatewayLogId?: unknown };
  const gatewayLogId =
    typeof payload?.gatewayLogId === "string"
      ? payload.gatewayLogId.trim()
      : "";
  if (!gatewayLogId) return;
  await persistCanvasE2eTimingToGatewayLog(gatewayLogId, task);
}
