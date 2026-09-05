/**
 * Gateway 日志与业务层收口对齐：避免「业务已成功、日志仍 RUNNING」。
 */
import {
  buildGatewayStreamChatResultSummary,
  buildGatewayTaskResultSummary,
} from "@/lib/gateway/log-result-summary";
import { finalizeRequestLog, type UsageFromResponse } from "@/lib/gateway/proxy-common";
import { recoverVolcengineGatewayLogFromVendor } from "@/lib/gateway/volcengine-stall-recover";
import { isGatewayLogTerminalStatus } from "@/lib/gateway/gateway-log-record-info";
import { prisma } from "@/lib/prisma";

/** 业务已拿到厂商成片 URL 后，确保指定 logId 收口为 SUCCEEDED */
export async function ensureGatewayLogSucceededAfterVendorUrl(input: {
  logId: string;
  taskId: string;
  videoUrl: string;
}): Promise<void> {
  const logId = input.logId.trim();
  const videoUrl = input.videoUrl.trim();
  if (!logId || !videoUrl) return;

  const log = await prisma.gatewayRequestLog.findUnique({
    where: { id: logId },
    select: {
      id: true,
      status: true,
      submittedAt: true,
      model: true,
      providerKind: true,
      externalTaskId: true,
    },
  });
  if (!log || isGatewayLogTerminalStatus(log.status)) return;

  const polledAtMs = Date.now();
  const resultSummary = buildGatewayTaskResultSummary(null, {
    videoUrl,
    status: "succeeded",
  });

  if (log.providerKind === "VOLCENGINE" && log.externalTaskId) {
    const recovered = await recoverVolcengineGatewayLogFromVendor(log.id);
    if (
      recovered.ok &&
      (recovered.action === "succeeded" || recovered.action === "vendor_failed")
    ) {
      return;
    }
  }

  await finalizeRequestLog(log.id, {
    status: "SUCCEEDED",
    durationMs: log.submittedAt ? polledAtMs - log.submittedAt.getTime() : 0,
    completedAt: new Date(polledAtMs),
    resultSummary,
    externalTaskId: log.externalTaskId ?? input.taskId,
    model: log.model,
  });
}

/** 流式 Chat 正常结束后，确保 Gateway 日志收口（BFF 落库后的兜底） */
export async function ensureGatewayChatLogSucceededAfterStream(input: {
  logId: string;
  usage?: UsageFromResponse;
}): Promise<void> {
  const logId = input.logId.trim();
  if (!logId) return;

  const log = await prisma.gatewayRequestLog.findUnique({
    where: { id: logId },
    select: { id: true, status: true, submittedAt: true, model: true },
  });
  if (!log || isGatewayLogTerminalStatus(log.status)) return;

  await finalizeRequestLog(log.id, {
    status: "SUCCEEDED",
    durationMs: log.submittedAt ? Date.now() - log.submittedAt.getTime() : 0,
    usage: input.usage,
    resultSummary: input.usage
      ? buildGatewayStreamChatResultSummary(input.usage)
      : undefined,
    model: log.model,
  });
}

const CANVAS_VIDEO_RECONCILE_LIMIT = 48;
const CANVAS_VIDEO_RECONCILE_MIN_AGE_MS = 60 * 1000;

function isVideoResultUrl(url: string): boolean {
  const u = url.trim();
  if (!u.startsWith("http")) return false;
  if (/\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(u)) return true;
  return /\/node-video\//i.test(u);
}

/**
 * 画布：CanvasGenerationTask 已成功且已有成片，但 Gateway 仍 RUNNING → 强制收口。
 */
export async function reconcileStaleCanvasVideoGatewayLogs(
  nowMs: number,
): Promise<number> {
  const cutoff = new Date(nowMs - CANVAS_VIDEO_RECONCILE_MIN_AGE_MS);
  const rows = await prisma.gatewayRequestLog.findMany({
    where: {
      status: "RUNNING",
      storyTaskId: { not: null },
      submittedAt: { lt: cutoff },
      OR: [
        { clientSource: "CANVAS" },
        { clientPage: { startsWith: "canvas/" } },
      ],
    },
    orderBy: { submittedAt: "asc" },
    take: CANVAS_VIDEO_RECONCILE_LIMIT,
    select: { id: true, storyTaskId: true, externalTaskId: true },
  });
  if (rows.length === 0) return 0;

  let closed = 0;
  for (const row of rows) {
    const canvasTaskId = row.storyTaskId?.trim();
    if (!canvasTaskId) continue;

    const task = await prisma.canvasGenerationTask.findUnique({
      where: { id: canvasTaskId },
      select: {
        status: true,
        ossUrl: true,
        ephemeralUrl: true,
        kieTaskId: true,
        completedAt: true,
      },
    });
    if (task?.status !== "SUCCEEDED") continue;

    const videoUrl =
      task.ossUrl?.trim() || task.ephemeralUrl?.trim() || "";
    if (!videoUrl || !isVideoResultUrl(videoUrl)) continue;

    const vendorTaskId =
      task.kieTaskId?.trim() || row.externalTaskId?.trim() || canvasTaskId;

    try {
      await ensureGatewayLogSucceededAfterVendorUrl({
        logId: row.id,
        taskId: vendorTaskId,
        videoUrl,
      });
      const after = await prisma.gatewayRequestLog.findUnique({
        where: { id: row.id },
        select: { status: true },
      });
      if (after && isGatewayLogTerminalStatus(after.status)) {
        closed += 1;
      }
    } catch (e) {
      console.warn(
        "[gateway-poll] reconcileStaleCanvasVideoGatewayLogs failed",
        row.id,
        e instanceof Error ? e.message : String(e),
      );
    }
  }
  return closed;
}

export function parseEcomClientPage(clientPage: string | null | undefined): {
  userId: string;
  workspaceId: string;
  toolKey: string;
} | null {
  if (!clientPage?.startsWith("ecom/")) return null;
  const parts = clientPage.split("/");
  if (parts.length < 4) return null;
  return {
    userId: parts[1]!,
    workspaceId: parts[2]!,
    toolKey: parts.slice(3).join("/"),
  };
}

/** chatHistory 是否在日志提交后已有助手回复（业务已落库） */
export function hasAssistantReplyAfterGatewayLog(
  chatHistory: unknown,
  logSubmittedAt: Date,
): boolean {
  if (!Array.isArray(chatHistory)) return false;
  const t0 = logSubmittedAt.getTime();
  for (let i = chatHistory.length - 1; i >= 0; i -= 1) {
    const msg = chatHistory[i];
    if (!msg || typeof msg !== "object") continue;
    const role = (msg as { role?: string }).role;
    if (role !== "assistant") continue;
    const content = (msg as { content?: string }).content;
    if (typeof content !== "string" || !content.trim()) continue;
    const createdAt = (msg as { createdAt?: string }).createdAt;
    const ts = createdAt ? Date.parse(createdAt) : NaN;
    if (Number.isFinite(ts) && ts >= t0 - 5000) return true;
  }
  return false;
}

const ECOM_CHAT_RECONCILE_LIMIT = 24;
const ECOM_CHAT_RECONCILE_MIN_AGE_MS = 60 * 1000;

/**
 * 电商助手 Chat：项目 chatHistory 已写入助手回复，但 Gateway 仍 RUNNING → 强制 SUCCEEDED。
 */
export async function reconcileStaleEcomChatGatewayLogs(
  nowMs: number,
): Promise<number> {
  const cutoff = new Date(nowMs - ECOM_CHAT_RECONCILE_MIN_AGE_MS);
  const rows = await prisma.gatewayRequestLog.findMany({
    where: {
      status: "RUNNING",
      requestKind: "CHAT",
      clientSource: "E_COMMERCE",
      externalTaskId: null,
      submittedAt: { lt: cutoff },
      clientPage: { startsWith: "ecom/" },
    },
    orderBy: { submittedAt: "asc" },
    take: ECOM_CHAT_RECONCILE_LIMIT,
    select: { id: true, submittedAt: true, clientPage: true, userId: true },
  });
  if (rows.length === 0) return 0;

  let closed = 0;
  for (const row of rows) {
    const parsed = parseEcomClientPage(row.clientPage);
    if (!parsed) continue;

    const project = await prisma.ecomStoryboardProject.findFirst({
      where: { id: parsed.workspaceId, userId: row.userId },
      select: { chatHistory: true },
    });
    if (!project) continue;
    if (!hasAssistantReplyAfterGatewayLog(project.chatHistory, row.submittedAt)) {
      continue;
    }

    try {
      await ensureGatewayChatLogSucceededAfterStream({ logId: row.id });
      const after = await prisma.gatewayRequestLog.findUnique({
        where: { id: row.id },
        select: { status: true },
      });
      if (after && isGatewayLogTerminalStatus(after.status)) {
        closed += 1;
      }
    } catch (e) {
      console.warn(
        "[gateway-poll] reconcileStaleEcomChatGatewayLogs failed",
        row.id,
        e instanceof Error ? e.message : String(e),
      );
    }
  }
  return closed;
}

async function findEcomVideoAssetForGatewayLog(row: {
  id: string;
  externalTaskId: string | null;
}): Promise<{ ossUrl: string; meta: unknown } | null> {
  const byLogId = await prisma.ecomAsset.findFirst({
    where: {
      kind: "video",
      meta: { path: ["logId"], equals: row.id },
    },
    select: { ossUrl: true, meta: true },
  });
  if (byLogId?.ossUrl?.trim()) return byLogId;

  const taskId = row.externalTaskId?.trim();
  if (!taskId) return null;

  const byTaskId = await prisma.ecomAsset.findFirst({
    where: {
      kind: "video",
      meta: { path: ["taskId"], equals: taskId },
    },
    select: { ossUrl: true, meta: true },
    orderBy: { createdAt: "desc" },
  });
  if (byTaskId?.ossUrl?.trim()) return byTaskId;
  return null;
}

const ECOM_VIDEO_RECONCILE_LIMIT = 48;
const ECOM_VIDEO_RECONCILE_MIN_AGE_MS = 2 * 60 * 1000;
const ECOM_VIDEO_RECONCILE_BATCHES = 3;

async function reconcileStaleEcomVideoGatewayLogsOnce(
  nowMs: number,
): Promise<number> {
  const cutoff = new Date(nowMs - ECOM_VIDEO_RECONCILE_MIN_AGE_MS);
  const rows = await prisma.gatewayRequestLog.findMany({
    where: {
      status: "RUNNING",
      clientSource: "E_COMMERCE",
      requestKind: "VIDEO",
      submittedAt: { lt: cutoff },
    },
    orderBy: { submittedAt: "asc" },
    take: ECOM_VIDEO_RECONCILE_LIMIT,
    select: { id: true, externalTaskId: true, submittedAt: true },
  });
  if (rows.length === 0) return 0;

  let closed = 0;
  for (const row of rows) {
    const asset = await findEcomVideoAssetForGatewayLog(row);
    if (!asset?.ossUrl?.trim()) continue;

    const meta =
      asset.meta && typeof asset.meta === "object"
        ? (asset.meta as Record<string, unknown>)
        : {};
    const taskId =
      typeof meta.taskId === "string" && meta.taskId.trim()
        ? meta.taskId.trim()
        : row.externalTaskId ?? "";

    try {
      await ensureGatewayLogSucceededAfterVendorUrl({
        logId: row.id,
        taskId,
        videoUrl: asset.ossUrl.trim(),
      });
      const after = await prisma.gatewayRequestLog.findUnique({
        where: { id: row.id },
        select: { status: true },
      });
      if (after && isGatewayLogTerminalStatus(after.status)) {
        closed += 1;
      }
    } catch (e) {
      console.warn(
        "[gateway-poll] reconcileStaleEcomVideoGatewayLogs failed",
        row.id,
        e instanceof Error ? e.message : String(e),
      );
    }
  }
  return closed;
}

/**
 * 电商分镜：业务已落库 video asset（meta.logId / meta.taskId）但 Gateway 仍 RUNNING → 强制收口。
 * 作为 recordInfo logId 修复之外的兜底，清理历史孤儿日志。
 */
export async function reconcileStaleEcomVideoGatewayLogs(
  nowMs: number,
): Promise<number> {
  let closed = 0;
  for (let i = 0; i < ECOM_VIDEO_RECONCILE_BATCHES; i += 1) {
    const batch = await reconcileStaleEcomVideoGatewayLogsOnce(nowMs);
    closed += batch;
    if (batch < ECOM_VIDEO_RECONCILE_LIMIT) break;
  }
  return closed;
}
