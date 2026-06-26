/**
 * 火山视频 · 向厂商复核并恢复（历史误杀 / 后台生成完成后收口）。
 */
import { recoverCanvasVideoTaskDisplay } from "@/lib/canvas/canvas-video-display-recover";
import { applyCanvasVolcengineVideoResult } from "@/lib/canvas/canvas-task-service";
import { getDecryptedCredentialApiKey } from "@/lib/gateway/credential-service";
import { buildGatewayTaskResultSummary } from "@/lib/gateway/log-result-summary";
import {
  finalizeVolcengineVideoRequestLog,
  persistVolcengineTimingOnPoll,
} from "@/lib/gateway/log-volcengine-timing-persist";
import { readVolcengineTimingTrace } from "@/lib/gateway/log-volcengine-timing";
import { finalizeRequestLog } from "@/lib/gateway/proxy-common";
import { resolveVolcengineArkApiKey } from "@/lib/gateway/volcengine-gateway-credential";
import {
  isVolcengineVideoTaskFailed,
  isVolcengineVideoTaskSuccess,
  volcengineGetVideoTask,
  volcengineVideoTaskFailMessage,
} from "@/lib/gateway/volcengine-client";
import {
  isRecoverableVolcengineStallFailCode,
  readVideoBackgroundGeneration,
  VOLCENGINE_RECOVERABLE_STALL_FAIL_CODES,
} from "@/lib/gateway/video-background-generation";
import { prisma } from "@/lib/prisma";

export type VolcengineGatewayRecoverResult = {
  ok: boolean;
  action:
    | "succeeded"
    | "vendor_failed"
    | "still_running"
    | "not_found"
    | "no_task_id"
    | "skipped";
  message: string;
  gatewayStatus?: string;
  videoUrl?: string;
};

async function findCanvasTaskIdByGatewayLog(gatewayLogId: string): Promise<string | null> {
  const tasks = await prisma.canvasGenerationTask.findMany({
    where: {
      status: { in: ["SUBMITTED", "PENDING", "FAILED", "SUCCEEDED"] },
    },
    orderBy: { updatedAt: "desc" },
    take: 300,
    select: { id: true, inputPayload: true },
  });
  for (const t of tasks) {
    const p =
      t.inputPayload && typeof t.inputPayload === "object"
        ? (t.inputPayload as Record<string, unknown>)
        : null;
    if (p?.gatewayLogId === gatewayLogId) return t.id;
  }
  return null;
}

async function syncCanvasAfterGatewayRecover(
  gatewayLogId: string,
  videoUrl: string | null | undefined,
): Promise<void> {
  const canvasTaskId = await findCanvasTaskIdByGatewayLog(gatewayLogId);
  if (!canvasTaskId) return;
  if (videoUrl?.trim()) {
    await applyCanvasVolcengineVideoResult(canvasTaskId, videoUrl);
  } else {
    await recoverCanvasVideoTaskDisplay(canvasTaskId);
  }
}

/**
 * 复核并发上限。Logs 页自动复核会对每条在途行并行打 recover，叠加 canvas-queue 服务端
 * 自动复核 + 手动「核对厂商」，多路同时进入会在长厂商轮询周围串联多次 DB 操作，
 * 耗尽 Prisma 连接池（P2024）。这里做两层保护：
 *  1. 同一 logId 复用在途 Promise（去重，避免重复打厂商 / 重复写库）；
 *  2. 全局并发封顶，超出即快速返回 busy，下一轮再核对（绝不排队堆积拖垮请求）。
 */
const RECOVER_MAX_CONCURRENCY = (() => {
  const v = Number(process.env.VOLCENGINE_RECOVER_MAX_CONCURRENCY);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : 4;
})();

const inflightRecovers = new Map<
  string,
  Promise<VolcengineGatewayRecoverResult>
>();
let activeRecoverCount = 0;

/** 对单条 Gateway 日志 poll 厂商：succeeded → 收口；vendor failed → FAILED；running → 继续等 */
export function recoverVolcengineGatewayLogFromVendor(
  gatewayLogId: string,
): Promise<VolcengineGatewayRecoverResult> {
  const existing = inflightRecovers.get(gatewayLogId);
  if (existing) return existing;

  if (activeRecoverCount >= RECOVER_MAX_CONCURRENCY) {
    return Promise.resolve({
      ok: false,
      action: "skipped",
      message: "recover_busy",
    });
  }

  activeRecoverCount += 1;
  const p = runRecoverVolcengineGatewayLog(gatewayLogId).finally(() => {
    activeRecoverCount -= 1;
    inflightRecovers.delete(gatewayLogId);
  });
  inflightRecovers.set(gatewayLogId, p);
  return p;
}

async function runRecoverVolcengineGatewayLog(
  gatewayLogId: string,
): Promise<VolcengineGatewayRecoverResult> {
  const log = await prisma.gatewayRequestLog.findUnique({
    where: { id: gatewayLogId },
    select: {
      id: true,
      status: true,
      failCode: true,
      externalTaskId: true,
      credentialId: true,
      submittedAt: true,
      completedAt: true,
      resultSummary: true,
      lastPolledAt: true,
      providerKind: true,
      requestKind: true,
    },
  });

  if (!log) {
    return { ok: false, action: "not_found", message: "gateway_log_not_found" };
  }
  if (log.providerKind !== "VOLCENGINE" || log.requestKind !== "VIDEO") {
    return { ok: false, action: "skipped", message: "not_volcengine_video" };
  }
  if (log.status === "SUCCEEDED") {
    return {
      ok: true,
      action: "succeeded",
      message: "already_succeeded",
      gatewayStatus: log.status,
    };
  }
  if (
    log.status === "FAILED" &&
    log.failCode &&
    !isRecoverableVolcengineStallFailCode(log.failCode) &&
    log.failCode !== "VOLCENGINE_TASK_FAILED"
  ) {
    return {
      ok: false,
      action: "skipped",
      message: `status_${log.status}_failCode_${log.failCode}`,
      gatewayStatus: log.status,
    };
  }

  const taskId = log.externalTaskId?.trim();
  if (!taskId) {
    return { ok: false, action: "no_task_id", message: "missing_external_task_id" };
  }
  if (!log.credentialId) {
    return { ok: false, action: "skipped", message: "missing_credential" };
  }

  const cred = await getDecryptedCredentialApiKey(log.credentialId);
  if (!cred) {
    return { ok: false, action: "skipped", message: "credential_unavailable" };
  }

  let polled: Awaited<ReturnType<typeof volcengineGetVideoTask>>;
  try {
    polled = await volcengineGetVideoTask({
      apiKey: resolveVolcengineArkApiKey(cred.apiKey),
      baseUrl: cred.baseUrl,
      taskId,
    });
  } catch (e) {
    return {
      ok: false,
      action: "still_running",
      message: e instanceof Error ? e.message : String(e),
      gatewayStatus: log.status,
    };
  }

  const row = polled.output;
  const vendorStatus = String(row.status ?? "running");
  const polledAtMs = Date.now();

  if (isVolcengineVideoTaskSuccess(row)) {
    const videoUrl = row.content?.video_url;
    const baseSummary = buildGatewayTaskResultSummary(
      polled.raw,
      videoUrl ? { videoUrl } : { status: row.status },
    );
    const { resultSummary } = await persistVolcengineTimingOnPoll({
      log: {
        id: log.id,
        submittedAt: log.submittedAt,
        completedAt: log.completedAt,
        resultSummary: log.resultSummary,
        status: log.status,
        lastPolledAt: log.lastPolledAt,
      },
      vendorStatus,
      vendorRaw: polled.raw,
      resultSummaryOverride: baseSummary,
    });
    const trace = readVolcengineTimingTrace(resultSummary);
    if (trace) {
      await finalizeVolcengineVideoRequestLog(log.id, {
        submittedAt: log.submittedAt,
        status: "SUCCEEDED",
        trace,
        resultSummaryBase: resultSummary,
        fallbackNowMs: polledAtMs,
        externalTaskId: taskId,
      });
    } else {
      await finalizeRequestLog(log.id, {
        status: "SUCCEEDED",
        durationMs: polledAtMs - log.submittedAt.getTime(),
        resultSummary,
        externalTaskId: taskId,
      });
    }
    await syncCanvasAfterGatewayRecover(log.id, videoUrl);
    return {
      ok: true,
      action: "succeeded",
      message: "recovered_from_vendor",
      gatewayStatus: "SUCCEEDED",
      videoUrl: videoUrl ?? undefined,
    };
  }

  if (isVolcengineVideoTaskFailed(row)) {
    const { resultSummary } = await persistVolcengineTimingOnPoll({
      log: {
        id: log.id,
        submittedAt: log.submittedAt,
        completedAt: log.completedAt,
        resultSummary: log.resultSummary,
        status: log.status,
        lastPolledAt: log.lastPolledAt,
      },
      vendorStatus,
      vendorRaw: polled.raw,
      resultSummaryOverride: buildGatewayTaskResultSummary(polled.raw, {
        status: row.status,
        error: row.error,
      }),
    });
    const trace = readVolcengineTimingTrace(resultSummary);
    if (trace) {
      await finalizeVolcengineVideoRequestLog(log.id, {
        submittedAt: log.submittedAt,
        status: "FAILED",
        trace,
        resultSummaryBase: resultSummary,
        fallbackNowMs: polledAtMs,
        failMessage: volcengineVideoTaskFailMessage(row).slice(0, 500),
        failCode: "VOLCENGINE_TASK_FAILED",
        externalTaskId: taskId,
      });
    } else {
      await finalizeRequestLog(log.id, {
        status: "FAILED",
        durationMs: polledAtMs - log.submittedAt.getTime(),
        failMessage: volcengineVideoTaskFailMessage(row).slice(0, 500),
        failCode: "VOLCENGINE_TASK_FAILED",
        externalTaskId: taskId,
        resultSummary,
      });
    }
    return {
      ok: true,
      action: "vendor_failed",
      message: volcengineVideoTaskFailMessage(row),
      gatewayStatus: "FAILED",
    };
  }

  await persistVolcengineTimingOnPoll({
    log: {
      id: log.id,
      submittedAt: log.submittedAt,
      completedAt: log.completedAt,
      resultSummary: log.resultSummary,
      status: "RUNNING",
      lastPolledAt: log.lastPolledAt,
    },
    vendorStatus,
    vendorRaw: polled.raw,
  });

  const bg = readVideoBackgroundGeneration(log.resultSummary);
  return {
    ok: false,
    action: "still_running",
    message: bg?.slotReleased
      ? "vendor_still_running_background"
      : "vendor_still_running",
    gatewayStatus: "RUNNING",
  };
}

/**
 * 自动复核近期误杀（FAILED · 火山视频 · 可恢复 failCode）。
 *
 * **recencyMs**：仅回捞「最近收口」的失败（默认 2h）。STALE_TIMEOUT 加入可恢复集合后，
 * 历史上大量过期任务也会命中；若每 tick 无窗口地 `orderBy completedAt desc take N`，会反复
 * 重打那批永远恢复不了的过期 Vendor Task（厂商结果已过期）→ 空转。加近期窗口后：worker 短暂
 * 滞后/重启导致的「刚被误杀」能被自动捞回，老化失败则交由用户手动「核对厂商」一次性处理。
 */
export async function recoverMisclassifiedVolcengineStallLogs(opts?: {
  limit?: number;
  recencyMs?: number;
}): Promise<{ scanned: number; recovered: number }> {
  const limit = opts?.limit ?? 30;
  const recencyMs = (() => {
    if (opts?.recencyMs != null) return opts.recencyMs;
    const v = Number(process.env.VOLCENGINE_STALL_RECLAIM_RECENCY_MS);
    return Number.isFinite(v) && v > 0 ? v : 2 * 60 * 60 * 1000;
  })();
  const rows = await prisma.gatewayRequestLog.findMany({
    where: {
      status: "FAILED",
      failCode: { in: [...VOLCENGINE_RECOVERABLE_STALL_FAIL_CODES] },
      externalTaskId: { not: null },
      providerKind: "VOLCENGINE",
      requestKind: "VIDEO",
      completedAt: { gte: new Date(Date.now() - recencyMs) },
    },
    orderBy: { completedAt: "desc" },
    take: limit,
    select: { id: true },
  });

  let recovered = 0;
  for (const row of rows) {
    const r = await recoverVolcengineGatewayLogFromVendor(row.id);
    if (r.ok && r.action === "succeeded") recovered++;
  }
  return { scanned: rows.length, recovered };
}

/** 2min 轮询失联 · 自动向厂商核对 RUNNING 火山视频（Logs 页 / canvas-queue 触发） */
export async function autoRecoverPollStalledVolcengineGatewayLogs(opts?: {
  limit?: number;
  staleMs?: number;
}): Promise<{ scanned: number; recovered: number }> {
  const staleMs = opts?.staleMs ?? 2 * 60 * 1000;
  const limit = opts?.limit ?? 8;
  const lagCutoff = new Date(Date.now() - staleMs);

  const rows = await prisma.gatewayRequestLog.findMany({
    where: {
      status: "RUNNING",
      providerKind: "VOLCENGINE",
      requestKind: "VIDEO",
      externalTaskId: { not: null },
      OR: [
        { lastPolledAt: { lte: lagCutoff } },
        { lastPolledAt: null, submittedAt: { lte: lagCutoff } },
      ],
    },
    orderBy: [{ lastPolledAt: "asc" }, { submittedAt: "asc" }],
    take: limit,
    select: { id: true },
  });

  let recovered = 0;
  for (const row of rows) {
    const r = await recoverVolcengineGatewayLogFromVendor(row.id);
    if (
      r.ok &&
      (r.action === "succeeded" ||
        r.action === "vendor_failed" ||
        r.action === "still_running")
    ) {
      if (r.action === "succeeded" || r.action === "vendor_failed") {
        recovered++;
      }
    }
  }
  return { scanned: rows.length, recovered };
}
