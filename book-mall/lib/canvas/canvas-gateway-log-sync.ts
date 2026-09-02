/**
 * 画布视频任务成功 → 关联 GatewayRequestLog 必须收口为 SUCCEEDED，
 * 避免「界面已出片、Gateway 仍 RUNNING 轮询」。
 */
import { findCanvasLinkedGatewayLog } from "@/lib/generation/traffic-control/canvas-orphan-gateway-log";
import { ensureGatewayLogSucceededAfterVendorUrl } from "@/lib/gateway/gateway-log-reconcile";
import { isGatewayLogTerminalStatus } from "@/lib/gateway/gateway-log-record-info";
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

async function resolveCanvasGatewayLogId(
  taskId: string,
  payload: unknown,
): Promise<string> {
  const fromPayload = readGatewayLogId(payload);
  if (fromPayload) return fromPayload;
  const linked = await findCanvasLinkedGatewayLog(taskId);
  return linked?.logId ?? "";
}

/** 画布任务已拿到 video URL 时，将仍 RUNNING 的 Gateway 日志收口。 */
export async function syncCanvasGatewayLogAfterVideoSuccess(
  taskId: string,
  videoUrl: string,
): Promise<void> {
  const url = videoUrl.trim();
  if (!url || !isCanvasVideoResultUrl(url)) return;

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
    videoUrl: url,
  });
}
