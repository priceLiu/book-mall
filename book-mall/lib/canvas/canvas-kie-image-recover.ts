/**
 * 画布 KIE 媒体（IMAGE / video-engine）· Gateway 已成功但 canvas 任务仍 SUBMITTED 时的写回。
 */
import type { Prisma } from "@prisma/client";

import { isCanvasKieVideoTaskPayload } from "@/lib/canvas/canvas-constants";
import { patchCanvasProjectNodeMediaFromTask } from "@/lib/canvas/canvas-media-patch";
import { scheduleCanvasKieImageOssBackfill } from "@/lib/canvas/canvas-oss-backfill";
import { applyCanvasKieTaskResult } from "@/lib/canvas/canvas-task-service";
import { GENERATION_INFLIGHT_STATUSES } from "@/lib/generation/traffic-control/constants";
import { prisma } from "@/lib/prisma";
import {
  extractKieResultUrl,
  isKieRecordFail,
  isKieRecordSuccess,
  type KieRecordResponse,
} from "@/lib/story/kie-client";

export { scheduleCanvasKieImageOssBackfill } from "@/lib/canvas/canvas-oss-backfill";

function normalizeKieRecordState(
  raw: string | undefined,
): KieRecordResponse["state"] | undefined {
  if (!raw) return undefined;
  const s = raw.trim().toLowerCase();
  if (s === "success" || s === "succeeded") return "success";
  if (s === "fail" || s === "failed") return "fail";
  if (s === "waiting" || s === "queuing" || s === "generating") return s;
  return raw as KieRecordResponse["state"];
}

function resultJsonFromSummaryObject(
  s: Record<string, unknown>,
): string | undefined {
  if (typeof s.resultJson === "string") return s.resultJson;
  const nested = s.data;
  if (nested && typeof nested === "object") {
    const d = nested as Record<string, unknown>;
    if (typeof d.resultJson === "string") return d.resultJson;
  }
  const urls = s.resultUrls;
  if (Array.isArray(urls)) {
    try {
      return JSON.stringify({ resultUrls: urls });
    } catch {
      return undefined;
    }
  }
  for (const key of ["url", "videoUrl", "video_url", "output"]) {
    const v = s[key];
    if (typeof v === "string" && /^https?:\/\//i.test(v)) {
      try {
        return JSON.stringify({ resultUrls: [v] });
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

export function kieRecordFromGatewaySummary(
  summary: unknown,
  taskId: string,
  model: string,
): KieRecordResponse | null {
  if (!summary || typeof summary !== "object") return null;
  const s = summary as Record<string, unknown>;
  const state =
    normalizeKieRecordState(
      typeof s.state === "string"
        ? s.state
        : typeof (s.data as Record<string, unknown> | undefined)?.state ===
            "string"
          ? ((s.data as Record<string, unknown>).state as string)
          : undefined,
    ) ?? undefined;
  const resultJson = resultJsonFromSummaryObject(s);
  const extTaskId =
    typeof s.taskId === "string"
      ? s.taskId
      : typeof (s.data as Record<string, unknown> | undefined)?.taskId ===
          "string"
        ? ((s.data as Record<string, unknown>).taskId as string)
        : taskId;
  if (!state && !resultJson) return null;
  return {
    taskId: extTaskId || taskId,
    model: typeof s.model === "string" ? s.model : model,
    state: state ?? "success",
    resultJson,
    failCode: typeof s.failCode === "string" ? s.failCode : undefined,
    failMsg: typeof s.failMsg === "string" ? s.failMsg : undefined,
  };
}

function isRecoverableCanvasKieMediaTask(
  task: Pick<
    import("@prisma/client").CanvasGenerationTask,
    "kind" | "inputPayload"
  >,
): boolean {
  if (task.kind !== "IMAGE") return false;
  const payload =
    task.inputPayload && typeof task.inputPayload === "object"
      ? (task.inputPayload as Record<string, unknown>)
      : null;
  if (!payload) return false;
  if (payload.providerKind === "KIE") return true;
  return isCanvasKieVideoTaskPayload(payload);
}

export type CanvasKieImageRecoverResult =
  | "succeeded"
  | "failed"
  | "pending"
  | "noop";

type KieGatewayLogRow = {
  id: string;
  status: string;
  failCode: string | null;
  failMessage: string | null;
  resultSummary: unknown;
  providerKind: string | null;
};

async function loadKieGatewayLogForTask(
  taskId: string,
  inputPayload: unknown,
  kieTaskId: string | null,
): Promise<KieGatewayLogRow | null> {
  const payload =
    inputPayload && typeof inputPayload === "object"
      ? (inputPayload as Record<string, unknown>)
      : {};
  const payloadLogId =
    typeof payload.gatewayLogId === "string" ? payload.gatewayLogId.trim() : "";

  const log = payloadLogId
    ? await prisma.gatewayRequestLog.findUnique({
        where: { id: payloadLogId },
        select: {
          id: true,
          status: true,
          failCode: true,
          failMessage: true,
          resultSummary: true,
          providerKind: true,
        },
      })
    : await prisma.gatewayRequestLog.findFirst({
        where: { storyTaskId: taskId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          status: true,
          failCode: true,
          failMessage: true,
          resultSummary: true,
          providerKind: true,
        },
      });

  if (!log) return null;
  if (log.providerKind && log.providerKind !== "KIE") return null;
  void kieTaskId;
  return log;
}

/** 读路径快速写回：Gateway 已成功时先写 ephemeralUrl + SUCCEEDED 并 patch 节点，OSS 后台补。 */
export async function recoverCanvasKieImageFromGatewayForRead(
  taskId: string,
): Promise<CanvasKieImageRecoverResult> {
  const task = await prisma.canvasGenerationTask.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      status: true,
      kind: true,
      model: true,
      kieTaskId: true,
      inputPayload: true,
      ossUrl: true,
      ephemeralUrl: true,
      projectId: true,
    },
  });
  if (!task || !isRecoverableCanvasKieMediaTask(task)) return "noop";
  if (
    task.status === "SUCCEEDED" &&
    (task.ossUrl?.trim() || task.ephemeralUrl?.trim())
  ) {
    return "succeeded";
  }
  if (task.status !== "SUBMITTED" && task.status !== "PENDING") return "noop";

  const log = await loadKieGatewayLogForTask(
    taskId,
    task.inputPayload,
    task.kieTaskId,
  );
  if (!log) return "noop";

  if (log.status === "SUCCEEDED") {
    const record = kieRecordFromGatewaySummary(
      log.resultSummary,
      task.kieTaskId ?? "",
      task.model,
    );
    if (!record || !isKieRecordSuccess(record.state)) return "pending";
    const ephemeralUrl = extractKieResultUrl(record);
    if (!ephemeralUrl) return "pending";

    const applied = await prisma.canvasGenerationTask.updateMany({
      where: {
        id: taskId,
        status: { in: [...GENERATION_INFLIGHT_STATUSES] },
      },
      data: {
        status: "SUCCEEDED",
        ephemeralUrl,
        resultPayload: record as unknown as Prisma.InputJsonValue,
        completedAt: new Date(),
      },
    });
    if (applied.count === 0) return "noop";

    const updated = await prisma.canvasGenerationTask.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        projectId: true,
        nodeId: true,
        ossUrl: true,
        ephemeralUrl: true,
        completedAt: true,
        resultPayload: true,
      },
    });
    if (updated) {
      await patchCanvasProjectNodeMediaFromTask(updated);
      if (!updated.ossUrl?.trim()) {
        scheduleCanvasKieImageOssBackfill(taskId, ephemeralUrl, updated.projectId);
      }
    }
    return "succeeded";
  }

  if (log.status === "FAILED") {
    return recoverCanvasKieImageFromGateway(taskId);
  }

  return "pending";
}

/** 读路径快速写回：Gateway 已成功但 canvas IMAGE 仍 SUBMITTED（限条数，避免拖慢 /tasks）。 */
export async function recoverProjectInflightKieImageTasksForRead(
  taskIds: string[],
  limit = 5,
): Promise<number> {
  let recovered = 0;
  for (const taskId of taskIds.slice(0, limit)) {
    const outcome = await recoverCanvasKieImageFromGatewayForRead(taskId);
    if (outcome === "succeeded" || outcome === "failed") recovered += 1;
  }
  return recovered;
}

/** 按 gatewayLogId / storyTaskId 从 Gateway KIE 日志恢复 IMAGE / video-engine 结果。 */
export async function recoverCanvasKieImageFromGateway(
  taskId: string,
): Promise<CanvasKieImageRecoverResult> {
  const task = await prisma.canvasGenerationTask.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      status: true,
      kind: true,
      model: true,
      kieTaskId: true,
      inputPayload: true,
    },
  });
  if (!task || !isRecoverableCanvasKieMediaTask(task)) return "noop";
  if (task.status !== "SUBMITTED" && task.status !== "PENDING") return "noop";

  const log = await loadKieGatewayLogForTask(
    taskId,
    task.inputPayload,
    task.kieTaskId,
  );
  if (!log) return "noop";

  if (log.status === "SUCCEEDED") {
    const record = kieRecordFromGatewaySummary(
      log.resultSummary,
      task.kieTaskId ?? "",
      task.model,
    );
    if (!record || !isKieRecordSuccess(record.state)) return "pending";
    await applyCanvasKieTaskResult(task.id, record);
    const after = await prisma.canvasGenerationTask.findUnique({
      where: { id: taskId },
      select: { status: true },
    });
    if (after?.status === "SUCCEEDED") return "succeeded";
    if (after?.status === "FAILED") return "failed";
    return "pending";
  }

  if (log.status === "FAILED") {
    const record = kieRecordFromGatewaySummary(
      log.resultSummary,
      task.kieTaskId ?? "",
      task.model,
    );
    if (record && isKieRecordFail(record.state)) {
      await applyCanvasKieTaskResult(task.id, {
        ...record,
        state: "fail",
        failMsg: log.failMessage ?? record.failMsg,
        failCode: log.failCode ?? record.failCode,
      });
      return "failed";
    }
    await prisma.canvasGenerationTask.update({
      where: { id: taskId },
      data: {
        status: "FAILED",
        failCode: log.failCode ?? "KIE_GATEWAY_FAILED",
        failMessage:
          log.failMessage?.slice(0, 500) ?? "Gateway KIE 任务失败",
        completedAt: new Date(),
      },
    });
    return "failed";
  }

  return "pending";
}

/** @deprecated 使用 recoverCanvasKieImageFromGateway（已含 KIE 视频） */
export const recoverCanvasKieMediaFromGateway = recoverCanvasKieImageFromGateway;
