/**
 * 画布媒体任务成功 → 关联 GatewayRequestLog 必须收口为 SUCCEEDED，
 * 避免「界面已出图/出片、Gateway 仍 RUNNING 轮询」。
 */
import {
  findCanvasGatewayLogForAudit,
  findCanvasLinkedGatewayLog,
} from "@/lib/generation/traffic-control/canvas-orphan-gateway-log";
import type { Prisma } from "@prisma/client";
import {
  ensureGatewayLogSucceededAfterVendorUrl,
  isGatewayMediaResultUrl,
} from "@/lib/gateway/gateway-log-reconcile";
import { isGatewayLogTerminalStatus } from "@/lib/gateway/gateway-log-record-info";
import { finalizeRequestLog } from "@/lib/gateway/proxy-common";
import { prisma } from "@/lib/prisma";

function readGatewayLogId(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const raw = (payload as { gatewayLogId?: unknown }).gatewayLogId;
  return typeof raw === "string" ? raw.trim() : "";
}

export function isCanvasVideoResultUrl(url: string): boolean {
  const u = url.trim();
  if (!u.startsWith("http")) return false;
  if (/\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(u)) return true;
  return /\/node-video\//i.test(u);
}

export function isCanvasImageResultUrl(url: string): boolean {
  const u = url.trim();
  if (u.startsWith("data:image/")) return true;
  if (!u.startsWith("http")) return false;
  if (isCanvasVideoResultUrl(u)) return false;
  if (/\.(png|jpe?g|webp|gif|avif)(\?|#|$)/i.test(u)) return true;
  return /\/node-image\//i.test(u) || /\/node-audio\//i.test(u);
}

async function resolveCanvasGatewayLogId(
  taskId: string,
  payload: unknown,
  opts?: { backfillPayload?: boolean },
): Promise<string> {
  const fromPayload = readGatewayLogId(payload);
  if (fromPayload) return fromPayload;
  const linked = await findCanvasLinkedGatewayLog(taskId);
  if (linked?.logId) return linked.logId;
  const audit = await findCanvasGatewayLogForAudit(taskId);
  if (!audit?.logId) return "";
  if (opts?.backfillPayload && payload && typeof payload === "object") {
    await prisma.canvasGenerationTask.update({
      where: { id: taskId },
      data: {
        inputPayload: {
          ...(payload as Record<string, unknown>),
          gatewayLogId: audit.logId,
        } as Prisma.InputJsonValue,
      },
    });
  }
  return audit.logId;
}

/** 画布任务已拿到媒体 URL 时，将仍 RUNNING 的 Gateway 日志收口。 */
export async function syncCanvasGatewayLogAfterMediaSuccess(
  taskId: string,
  mediaUrl: string,
): Promise<void> {
  const url = mediaUrl.trim();
  if (!url || !isGatewayMediaResultUrl(url)) return;

  const task = await prisma.canvasGenerationTask.findUnique({
    where: { id: taskId },
    select: { inputPayload: true, kieTaskId: true },
  });
  if (!task) return;

  const gatewayLogId = await resolveCanvasGatewayLogId(taskId, task.inputPayload);
  if (!gatewayLogId) return;

  const log = await prisma.gatewayRequestLog.findUnique({
    where: { id: gatewayLogId },
    select: { status: true, externalTaskId: true },
  });
  if (!log || isGatewayLogTerminalStatus(log.status)) return;

  const vendorTaskId =
    task.kieTaskId?.trim() || log.externalTaskId?.trim() || taskId;
  await ensureGatewayLogSucceededAfterVendorUrl({
    logId: gatewayLogId,
    taskId: vendorTaskId,
    ...(isCanvasVideoResultUrl(url) ? { videoUrl: url } : { imageUrl: url }),
  });
}

/** @deprecated 使用 syncCanvasGatewayLogAfterMediaSuccess */
export async function syncCanvasGatewayLogAfterVideoSuccess(
  taskId: string,
  videoUrl: string,
): Promise<void> {
  return syncCanvasGatewayLogAfterMediaSuccess(taskId, videoUrl);
}

/** 画布任务已失败 · 将仍 RUNNING 的 Gateway 日志收口为 FAILED（运维可查） */
export async function syncCanvasGatewayLogAfterTaskFailure(
  taskId: string,
  failMessage: string,
  failCode = "CANVAS_TASK_FAILED",
): Promise<void> {
  const msg = failMessage.trim();
  if (!msg) return;

  const task = await prisma.canvasGenerationTask.findUnique({
    where: { id: taskId },
    select: { inputPayload: true },
  });
  if (!task) return;

  const gatewayLogId = await resolveCanvasGatewayLogId(taskId, task.inputPayload, {
    backfillPayload: true,
  });
  if (!gatewayLogId) return;

  const log = await prisma.gatewayRequestLog.findUnique({
    where: { id: gatewayLogId },
    select: { status: true, submittedAt: true },
  });
  if (!log) return;
  if (isGatewayLogTerminalStatus(log.status)) return;

  const durationMs = log.submittedAt
    ? Math.max(0, Date.now() - log.submittedAt.getTime())
    : 0;
  await finalizeRequestLog(gatewayLogId, {
    status: "FAILED",
    durationMs,
    failCode,
    failMessage: msg.slice(0, 500),
    resultSummary: { message: msg.slice(0, 500), status: "failed" },
  });
}

/** 提交失败 / 轮询失败 · 补写 gatewayLogId 并收口 Gateway 日志（运维可查） */
export async function linkCanvasTaskGatewayLogOnFailure(
  taskId: string,
  failMessage: string,
  failCode = "CANVAS_TASK_FAILED",
): Promise<string | null> {
  await syncCanvasGatewayLogAfterTaskFailure(taskId, failMessage, failCode);
  const task = await prisma.canvasGenerationTask.findUnique({
    where: { id: taskId },
    select: { inputPayload: true },
  });
  const logId = task
    ? await resolveCanvasGatewayLogId(taskId, task.inputPayload)
    : "";
  return logId || null;
}
