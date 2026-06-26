import { prisma } from "@/lib/prisma";
import type { GatewayClientSource, Prisma } from "@prisma/client";
import { resolveGenerationSlowWarnMs } from "@/lib/generation/slow-warn-config";
import { maybeRunSlowWarnAutoHandler } from "@/lib/generation/slow-warn-auto-handler";
import { mapWithConcurrency } from "@/lib/generation/poll-parallel";
import {
  promoteVolcengineTasksToBackgroundGeneration,
} from "@/lib/gateway/volcengine-background-promote";
import {
  autoRecoverPollStalledVolcengineGatewayLogs,
  recoverMisclassifiedVolcengineStallLogs,
  recoverVolcengineGatewayLogFromVendor,
} from "@/lib/gateway/volcengine-stall-recover";
import { gatewayV1RecordInfo } from "@/lib/gateway/gateway-v1-http-client";
import { createKieTaskWithKey, getKieTaskWithKey } from "@/lib/story/kie-client";
import {
  bailianR2vCreateTask,
  bailianR2vGetTask,
} from "@/lib/canvas/canvas-video-bailian-r2v";
import {
  dashscopeCreateTryOnTask,
  dashscopeCreateVideoTask,
  dashscopeCreateKlingV3ImageTask,
  dashscopeCreateWan27ImageTask,
  dashscopeCreateWanxTask,
  dashscopeGetTask,
  isDashscopeTaskFailed,
  isDashscopeTaskSuccess,
} from "./dashscope-client";
import { pollHunyuanTaskForLog, submitHunyuanJobForLog } from "./hunyuan-jobs";
import { getDecryptedCredentialApiKey } from "./credential-service";

import { SUBMIT_ORPHAN_FAIL } from "@/lib/gateway/gateway-submit-error-policy";
import {
  auditGatewayPollStallAfterBatch,
  countSlowRunningGatewayLogs,
  markGatewayPollWorkerTick,
  recordGatewayPollLastAttempt,
  type GatewayPollBatchSnapshot,
} from "@/lib/gateway/gateway-poll-stall-diagnostics";

const STALE_RUNNING_NO_TASK_MS = 3 * 60 * 1000;
/** 火山视频提交失败但未写入 externalTaskId 时，尽快收口 RUNNING（高负载下 submit 可能 >90s） */
const STALE_VOLCENGINE_NO_TASK_MS = 5 * 60 * 1000;
const STALE_RUNNING_WITH_TASK_MS = 6 * 60 * 60 * 1000;
/** 火山视频任务：过长仍 RUNNING 则先向厂商核对（彻底收口），核对不通过才失败 */
const STALE_VOLCENGINE_VIDEO_MS = 90 * 60 * 1000;
/**
 * 火山视频绝对硬上限：超过此时长且向厂商核对仍无法确认终态（仍 running / 厂商不可达）才强制
 * 收口为 STALE_TIMEOUT，杜绝「厂商早已出片却被 90min 盲超时误杀」。
 */
const STALE_VOLCENGINE_VIDEO_HARD_MS = (() => {
  const v = Number(process.env.STALE_VOLCENGINE_VIDEO_HARD_MS);
  return Number.isFinite(v) && v > 0 ? v : 4 * 60 * 60 * 1000;
})();
/** 每次 sweep 最多核对的火山在途视频条数（其余留待下一 tick，避免拖垮 tick 时长预算） */
const STALE_VOLCENGINE_RECONCILE_LIMIT = (() => {
  const v = Number(process.env.STALE_VOLCENGINE_RECONCILE_LIMIT);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : 8;
})();
/** 百炼 / KIE / 通义异步视频：超过此时长仍 RUNNING 则自动失败收口 */
const STALE_ASYNC_VIDEO_MS = 45 * 60 * 1000;

/** 清理无 taskId 或超时仍 RUNNING 的日志，避免界面一直 running */
export async function expireStaleGatewayLogs(): Promise<number> {
  const now = Date.now();
  const noTaskCutoff = new Date(now - STALE_RUNNING_NO_TASK_MS);
  const withTaskCutoff = new Date(now - STALE_RUNNING_WITH_TASK_MS);

  const r0 = await prisma.gatewayRequestLog.updateMany({
    where: {
      status: "RUNNING",
      OR: [
        { endpoint: { startsWith: "/debug" } },
        { endpoint: { contains: "debug" } },
      ],
    },
    data: {
      status: "FAILED",
      failCode: "DEBUG_ORPHAN",
      failMessage: "调试占位日志，非真实厂商任务",
      completedAt: new Date(),
    },
  });

  const r1 = await prisma.gatewayRequestLog.updateMany({
    where: {
      status: "RUNNING",
      externalTaskId: null,
      submittedAt: { lt: noTaskCutoff },
    },
    data: {
      status: "FAILED",
      failCode: "STALE_ORPHAN",
      failMessage: "请求未成功提交厂商任务（无 taskId），已自动关闭",
      completedAt: new Date(),
    },
  });

  const r2 = await prisma.gatewayRequestLog.updateMany({
    where: {
      status: "RUNNING",
      externalTaskId: { not: null },
      submittedAt: { lt: withTaskCutoff },
      OR: [
        { providerKind: { not: "VOLCENGINE" } },
        { requestKind: { not: "VIDEO" } },
      ],
    },
    data: {
      status: "FAILED",
      failCode: "STALE_TIMEOUT",
      failMessage: "任务轮询超时，请稍后重试或联系管理员",
      completedAt: new Date(),
    },
  });

  const volcengineNoTaskCutoff = new Date(now - STALE_VOLCENGINE_NO_TASK_MS);
  const r3a = await prisma.gatewayRequestLog.updateMany({
    where: {
      status: "RUNNING",
      providerKind: "VOLCENGINE",
      requestKind: "VIDEO",
      externalTaskId: null,
      submittedAt: { lt: volcengineNoTaskCutoff },
      OR: [{ failMessage: null }, { failMessage: "" }],
    },
    data: {
      status: "FAILED",
      failCode: SUBMIT_ORPHAN_FAIL.failCode,
      failMessage: SUBMIT_ORPHAN_FAIL.failMessage,
      completedAt: new Date(),
    },
  });

  const r3 = await reconcileStaleVolcengineVideoLogs(now);

  const asyncVideoCutoff = new Date(now - STALE_ASYNC_VIDEO_MS);
  const r3b = await prisma.gatewayRequestLog.updateMany({
    where: {
      status: "RUNNING",
      requestKind: "VIDEO",
      externalTaskId: { not: null },
      submittedAt: { lt: asyncVideoCutoff },
      providerKind: { in: ["BAILIAN", "KIE", "DASHSCOPE"] },
    },
    data: {
      status: "FAILED",
      failCode: "STALE_TIMEOUT",
      failMessage:
        "异步视频任务轮询超时（超过 45 分钟），请在厂商控制台核对任务状态后重试",
      completedAt: new Date(),
    },
  });

  let r4 = 0;
  try {
    r4 = await promoteVolcengineTasksToBackgroundGeneration(now);
  } catch (e) {
    console.warn(
      "[gateway-poll] promoteVolcengineTasksToBackgroundGeneration skipped",
      e instanceof Error ? e.message : String(e),
    );
  }

  return r0.count + r1.count + r2.count + r3a.count + r3 + r3b.count + r4;
}

/**
 * 火山在途视频「彻底收口」：到 90min 不再盲目失败，而是逐条向厂商核对：
 *  - 厂商已出片 → SUCCEEDED 收口（带视频，并同步画布）；
 *  - 厂商明确失败 → FAILED（VOLCENGINE_TASK_FAILED）；
 *  - 厂商仍 running / 不可达 → 保持 RUNNING，下一 tick 继续核对；
 *    仅当超过绝对硬上限（STALE_VOLCENGINE_VIDEO_HARD_MS）仍无法确认才强制 STALE_TIMEOUT。
 * 复核走 recoverVolcengineGatewayLogFromVendor（含 15s 厂商超时 + 去重 + 并发封顶），
 * 这里以有限并发执行：厂商 HTTP 并行、DB 写串行，墙钟受单次 15s 超时约束、不拖垮 tick。
 */
async function reconcileStaleVolcengineVideoLogs(nowMs: number): Promise<number> {
  const cutoff = new Date(nowMs - STALE_VOLCENGINE_VIDEO_MS);
  const rows = await prisma.gatewayRequestLog.findMany({
    where: {
      status: "RUNNING",
      providerKind: "VOLCENGINE",
      requestKind: "VIDEO",
      externalTaskId: { not: null },
      submittedAt: { lt: cutoff },
    },
    orderBy: { submittedAt: "asc" },
    take: STALE_VOLCENGINE_RECONCILE_LIMIT,
    select: { id: true, submittedAt: true },
  });
  if (rows.length === 0) return 0;

  const hardCutoffMs = nowMs - STALE_VOLCENGINE_VIDEO_HARD_MS;
  let closed = 0;

  await mapWithConcurrency(
    rows,
    async (row) => {
      let confirmedTerminal = false;
      try {
        const result = await recoverVolcengineGatewayLogFromVendor(row.id);
        // succeeded / vendor_failed = 厂商终态已写库收口；其余（still_running / skipped / busy）= 未确认
        confirmedTerminal =
          result.ok &&
          (result.action === "succeeded" || result.action === "vendor_failed");
      } catch (e) {
        console.warn(
          "[gateway-poll] reconcileStaleVolcengineVideoLogs recover failed",
          row.id,
          e instanceof Error ? e.message : String(e),
        );
      }
      if (confirmedTerminal) {
        closed += 1;
        return;
      }
      // 厂商未确认终态：仅在超过绝对硬上限时才强制收口，否则保留 RUNNING 等下一轮
      if (row.submittedAt.getTime() < hardCutoffMs) {
        try {
          const r = await prisma.gatewayRequestLog.updateMany({
            where: { id: row.id, status: "RUNNING" },
            data: {
              status: "FAILED",
              failCode: "STALE_TIMEOUT",
              failMessage:
                "火山视频任务轮询超时（超过硬上限），向厂商核对仍未确认终态，请在厂商控制台核对 Vendor Task ID",
              completedAt: new Date(),
            },
          });
          closed += r.count;
        } catch (e) {
          console.warn(
            "[gateway-poll] reconcileStaleVolcengineVideoLogs hard-fail skipped",
            row.id,
            e instanceof Error ? e.message : String(e),
          );
        }
      }
    },
    Math.min(4, rows.length),
  );

  return closed;
}

export function parseGatewayClientSource(
  header: string | null | undefined,
): GatewayClientSource {
  const v = header?.toUpperCase();
  if (v === "STORY") return "STORY";
  if (v === "CANVAS") return "CANVAS";
  if (v === "TOOL") return "TOOL";
  if (v === "E_COMMERCE") return "E_COMMERCE";
  if (v === "QUICK_REPLICA") return "QUICK_REPLICA";
  if (v === "GATEWAY_CONSOLE") return "GATEWAY_CONSOLE";
  return "EXTERNAL";
}

const GATEWAY_POLL_PROVIDER_KINDS = [
  "KIE",
  "BAILIAN",
  "DASHSCOPE",
  "HUNYUAN",
  "VOLCENGINE",
] as const;

/**
 * 厂商按「完成感知方式」分流（差异化处理）：
 * - VOLCENGINE：纯轮询、支持 ~50 并发 → 最大 poll 预算 + 按「最久未 poll」公平调度。
 * - 回调型（KIE）：完成由 callBackUrl 推送收口，poll 仅低频兜底（漏回调时补捞）。
 * - 其它异步轮询（BAILIAN / DASHSCOPE / HUNYUAN）：中等预算，同样按公平调度。
 */
const CALLBACK_POLL_PROVIDER_KINDS = ["KIE"] as const;
const OTHER_POLL_PROVIDER_KINDS = ["BAILIAN", "DASHSCOPE", "HUNYUAN"] as const;

const ESCALATION_POLL_TIMEOUT_MS = 20_000;

function pollEnvInt(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : fallback;
}

/** 单次 tick 各厂商 poll 预算。火山预算须 ≥ 厂商并发上限（~50），否则尾部任务被饿死。 */
function resolvePollBudgets(limitHint?: number): {
  volcengine: number;
  other: number;
  callbackBackstop: number;
  concurrency: number;
  callbackBackstopStaleMs: number;
  stallRecoverMs: number;
  stallRecoverLimit: number;
} {
  const isLight = limitHint != null;
  const volcengine = isLight
    ? limitHint
    : pollEnvInt("GATEWAY_POLL_VOLCENGINE_BUDGET", 60);
  return {
    volcengine,
    other: isLight
      ? Math.max(2, Math.ceil(volcengine * 0.4))
      : pollEnvInt("GATEWAY_POLL_OTHER_BUDGET", 24),
    callbackBackstop: isLight
      ? Math.max(1, Math.ceil(volcengine * 0.2))
      : pollEnvInt("GATEWAY_POLL_CALLBACK_BACKSTOP", 8),
    concurrency: pollEnvInt("GATEWAY_POLL_CONCURRENCY", 8),
    callbackBackstopStaleMs: pollEnvInt(
      "GATEWAY_POLL_CALLBACK_BACKSTOP_STALE_MS",
      90_000,
    ),
    stallRecoverMs: pollEnvInt("GATEWAY_VOLCENGINE_STALL_RECOVER_MS", 120_000),
    stallRecoverLimit: pollEnvInt("GATEWAY_VOLCENGINE_STALL_RECOVER_LIMIT", 12),
  };
}

const POLL_ROW_SELECT = {
  id: true,
  status: true,
  apiKeyId: true,
  externalTaskId: true,
} as const;

/** 公平调度：最久未 poll 的先 poll（null 即从未 poll，最优先），杜绝按 submittedAt 的尾部饿死。 */
const POLL_FAIRNESS_ORDER: Prisma.GatewayRequestLogOrderByWithRelationInput[] = [
  { lastPolledAt: { sort: "asc", nulls: "first" } },
  { submittedAt: "asc" },
];

type PollableGatewayRow = {
  id: string;
  status: string;
  apiKeyId: string | null;
  externalTaskId: string | null;
};

async function pollGatewayLogWithTimeout(
  row: PollableGatewayRow,
  timeoutMs: number,
): Promise<"updated" | "pending" | "skipped"> {
  if (!row.externalTaskId || !row.apiKeyId) return "skipped";
  const beforeStatus = row.status;
  let resultSummary: unknown = null;
  try {
    await Promise.race([
      gatewayV1RecordInfo({
        apiKeyId: row.apiKeyId,
        taskId: row.externalTaskId,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("gateway recordInfo timeout")),
          timeoutMs,
        ),
      ),
    ]);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const logRow = await prisma.gatewayRequestLog.findUnique({
      where: { id: row.id },
      select: { resultSummary: true },
    });
    resultSummary = logRow?.resultSummary ?? null;
    await recordGatewayPollLastAttempt({
      logId: row.id,
      resultSummary,
      ok: false,
      kind: /connection pool|timed out fetching/i.test(msg) ? "db" : "vendor",
      error: msg,
    }).catch(() => undefined);
    try {
      await prisma.gatewayRequestLog.update({
        where: { id: row.id },
        data: { lastPolledAt: new Date(), pollCount: { increment: 1 } },
      });
    } catch (dbErr) {
      const dbMsg = dbErr instanceof Error ? dbErr.message : String(dbErr);
      await recordGatewayPollLastAttempt({
        logId: row.id,
        resultSummary,
        ok: false,
        kind: "db",
        error: dbMsg,
      }).catch(() => undefined);
    }
    return "pending";
  }

  try {
    await prisma.gatewayRequestLog.update({
      where: { id: row.id },
      data: { lastPolledAt: new Date(), pollCount: { increment: 1 } },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const logRow = await prisma.gatewayRequestLog.findUnique({
      where: { id: row.id },
      select: { resultSummary: true },
    });
    await recordGatewayPollLastAttempt({
      logId: row.id,
      resultSummary: logRow?.resultSummary ?? null,
      ok: false,
      kind: "db",
      error: msg,
    }).catch(() => undefined);
    return "pending";
  }
  const after = await prisma.gatewayRequestLog.findUnique({
    where: { id: row.id },
    select: { status: true },
  });
  if (beforeStatus === "RUNNING" && after?.status !== "RUNNING") {
    return "updated";
  }
  return "pending";
}

/** 视频槽位自愈：按实际 RUNNING 视频日志重算 runningVideoCount，修复泄漏/卡死残留的占槽。
 * 全量扫描 traffic state 较重，限频每 5min 一次。 */
const SLOT_RECONCILE_INTERVAL_MS = 5 * 60 * 1000;
let lastSlotReconcileAt = 0;

async function maybeReconcileRunningSlotCounts(): Promise<void> {
  const now = Date.now();
  if (now - lastSlotReconcileAt < SLOT_RECONCILE_INTERVAL_MS) return;
  lastSlotReconcileAt = now;
  try {
    const { reconcileRunningSlotCounts } = await import(
      "@/lib/generation/traffic-control/reconcile"
    );
    const fixed = await reconcileRunningSlotCounts();
    if (fixed > 0) {
      console.info("[gateway-poll] reconciled video slot counts", { fixed });
    }
  } catch (e) {
    console.warn(
      "[gateway-poll] slot reconcile skipped",
      e instanceof Error ? e.message : String(e),
    );
  }
}

export async function runGatewayPollWorker(opts?: { limit?: number }) {
  const tickAt = Date.now();
  const tickDbErrors: string[] = [];
  let workerOk = true;

  try {
    await expireStaleGatewayLogs();
  } catch (e) {
    workerOk = false;
    tickDbErrors.push(e instanceof Error ? e.message : String(e));
    console.warn(
      "[gateway-poll] expireStaleGatewayLogs skipped",
      e instanceof Error ? e.message : String(e),
    );
  }

  await maybeReconcileRunningSlotCounts();

  let autoHandler: Awaited<
    ReturnType<typeof maybeRunSlowWarnAutoHandler>
  > | undefined;

  try {
    autoHandler = await maybeRunSlowWarnAutoHandler({ limit: 20, force: true });
    if (
      autoHandler.gatewaySucceededSync > 0 ||
      autoHandler.slowCanvasRecovered > 0 ||
      autoHandler.slowGatewayRecovered > 0
    ) {
      console.info("[gateway-poll] slow-warn auto", autoHandler);
    }
  } catch (e) {
    workerOk = false;
    tickDbErrors.push(e instanceof Error ? e.message : String(e));
    console.warn(
      "[gateway-poll] slow-warn auto skipped",
      e instanceof Error ? e.message : String(e),
    );
    autoHandler = undefined;
  }

  const budgets = resolvePollBudgets(opts?.limit);
  const slowMs = await resolveGenerationSlowWarnMs();
  const slowCutoff = new Date(Date.now() - slowMs);
  const callbackStaleCutoff = new Date(
    Date.now() - budgets.callbackBackstopStaleMs,
  );

  let volcRows: PollableGatewayRow[] = [];
  let otherRows: PollableGatewayRow[] = [];
  let callbackRows: PollableGatewayRow[] = [];
  let slowRunningTotal = 0;

  try {
    [volcRows, otherRows, callbackRows] = await Promise.all([
      // 火山：纯轮询、~50 并发 → 大预算 + 公平调度
      prisma.gatewayRequestLog.findMany({
        where: {
          status: "RUNNING",
          externalTaskId: { not: null },
          providerKind: "VOLCENGINE",
        },
        orderBy: POLL_FAIRNESS_ORDER,
        take: budgets.volcengine,
        select: POLL_ROW_SELECT,
      }),
      // 其它异步轮询厂商
      prisma.gatewayRequestLog.findMany({
        where: {
          status: "RUNNING",
          externalTaskId: { not: null },
          providerKind: { in: [...OTHER_POLL_PROVIDER_KINDS] },
        },
        orderBy: POLL_FAIRNESS_ORDER,
        take: budgets.other,
        select: POLL_ROW_SELECT,
      }),
      // 回调型（KIE）：完成由 callback 收口，poll 仅补捞「久未 poll」的，省预算给火山
      prisma.gatewayRequestLog.findMany({
        where: {
          status: "RUNNING",
          externalTaskId: { not: null },
          providerKind: { in: [...CALLBACK_POLL_PROVIDER_KINDS] },
          OR: [
            { lastPolledAt: null },
            { lastPolledAt: { lte: callbackStaleCutoff } },
          ],
        },
        orderBy: POLL_FAIRNESS_ORDER,
        take: budgets.callbackBackstop,
        select: POLL_ROW_SELECT,
      }),
    ]);
    slowRunningTotal =
      volcRows.length >= budgets.volcengine
        ? await countSlowRunningGatewayLogs(slowCutoff)
        : volcRows.length;
  } catch (e) {
    workerOk = false;
    tickDbErrors.push(e instanceof Error ? e.message : String(e));
    markGatewayPollWorkerTick(false, tickDbErrors[0]);
    throw e;
  }

  const batchSnapshot: GatewayPollBatchSnapshot = {
    tickAt,
    limit: budgets.volcengine,
    slowRunningTotal,
    selectedSlowIds: volcRows.map((r) => r.id),
    selectedNormalIds: [...otherRows, ...callbackRows].map((r) => r.id),
    tickDbErrors,
    workerOk,
  };

  // 火山优先入队，统一在有限并发下 poll（单条 hung 调用不拖垮整 tick）
  const orderedRows = [...volcRows, ...otherRows, ...callbackRows];
  let updated = 0;
  await mapWithConcurrency(
    orderedRows,
    async (row) => {
      const r = await pollGatewayLogWithTimeout(row, ESCALATION_POLL_TIMEOUT_MS);
      if (r === "updated") updated++;
    },
    budgets.concurrency,
  );

  // L2 兜底安全网：任何 2min 未 poll 到的火山 RUNNING 主动向厂商核对并收口（不依赖 Logs 页触发）。
  // 公平调度下正常已 poll 过的 lastPolledAt 是新的，不会被此处重复 poll。
  let stallRecovered = 0;
  try {
    const auto = await autoRecoverPollStalledVolcengineGatewayLogs({
      staleMs: budgets.stallRecoverMs,
      limit: budgets.stallRecoverLimit,
    });
    stallRecovered += auto.recovered;
    if (auto.recovered > 0) {
      console.info("[gateway-poll] auto-recovered stalled volcengine logs", auto);
    }
  } catch (e) {
    workerOk = false;
    tickDbErrors.push(e instanceof Error ? e.message : String(e));
    console.warn(
      "[gateway-poll] autoRecoverPollStalledVolcengineGatewayLogs skipped",
      e instanceof Error ? e.message : String(e),
    );
  }

  try {
    const stall = await recoverMisclassifiedVolcengineStallLogs({ limit: 20 });
    stallRecovered += stall.recovered;
    if (stall.recovered > 0) {
      console.info("[gateway-poll] recovered misclassified stall logs", stall);
    }
  } catch (e) {
    workerOk = false;
    tickDbErrors.push(e instanceof Error ? e.message : String(e));
    console.warn(
      "[gateway-poll] recoverMisclassifiedVolcengineStallLogs skipped",
      e instanceof Error ? e.message : String(e),
    );
  }

  markGatewayPollWorkerTick(workerOk, tickDbErrors[0]);

  try {
    const { runGatewayVideoWatchdog } = await import(
      "@/lib/gateway/gateway-video-watchdog"
    );
    await runGatewayVideoWatchdog({ source: "gateway-poll-worker" });
  } catch (e) {
    console.warn(
      "[gateway-poll] gateway video watchdog skipped",
      e instanceof Error ? e.message : String(e),
    );
  }

  try {
    const audit = await auditGatewayPollStallAfterBatch(batchSnapshot);
    if (audit.audited > 0) {
      console.warn("[gateway-poll] stall audit", audit);
    }
  } catch (e) {
    console.warn(
      "[gateway-poll] stall audit skipped",
      e instanceof Error ? e.message : String(e),
    );
  }

  return {
    scanned: orderedRows.length,
    updated,
    escalation: volcRows.length,
    stallRecovered,
    autoHandler,
  };
}

export async function submitKieJobForLog(opts: {
  logId: string;
  credentialId: string;
  model: string;
  input: Record<string, unknown>;
  callBackUrl?: string | null;
}) {
  const cred = await getDecryptedCredentialApiKey(opts.credentialId);
  if (!cred) throw new Error("凭证不可用");
  const { taskId } = await createKieTaskWithKey(cred.apiKey, {
    model: opts.model,
    input: opts.input as never,
    callBackUrl: opts.callBackUrl ?? null,
  });
  await prisma.gatewayRequestLog.update({
    where: { id: opts.logId },
    data: { externalTaskId: taskId, status: "RUNNING" },
  });
  return taskId;
}

export async function submitBailianR2vJobForLog(opts: {
  logId: string;
  credentialId: string;
  model: string;
  prompt: string;
  referenceImageUrls: string[];
  resolution: "720P" | "1080P";
  ratio: string;
  duration: number;
  seedStr?: string;
  parameterExtras?: Record<string, unknown>;
}) {
  const cred = await getDecryptedCredentialApiKey(opts.credentialId);
  if (!cred) throw new Error("凭证不可用");
  const created = await bailianR2vCreateTask({
    apiKey: cred.apiKey,
    model: opts.model,
    prompt: opts.prompt,
    referenceImageUrls: opts.referenceImageUrls,
    resolution: opts.resolution,
    ratio: opts.ratio,
    duration: opts.duration,
    seedStr: opts.seedStr,
    parameterExtras: opts.parameterExtras,
  });
  if (!created.ok) throw new Error(created.error);
  await prisma.gatewayRequestLog.update({
    where: { id: opts.logId },
    data: { externalTaskId: created.taskId, status: "RUNNING" },
  });
  return created.taskId;
}

export async function pollKieTaskForLog(opts: {
  logId: string;
  credentialId: string;
  taskId: string;
}) {
  const cred = await getDecryptedCredentialApiKey(opts.credentialId);
  if (!cred) throw new Error("凭证不可用");
  return getKieTaskWithKey(cred.apiKey, opts.taskId);
}

export async function pollBailianR2vTaskForLog(opts: {
  credentialId: string;
  taskId: string;
}) {
  const cred = await getDecryptedCredentialApiKey(opts.credentialId);
  if (!cred) throw new Error("凭证不可用");
  const polled = await bailianR2vGetTask({
    apiKey: cred.apiKey,
    taskId: opts.taskId,
  });
  if (!polled.ok) throw new Error(polled.error);
  return { output: polled.output, raw: polled.raw };
}

export async function submitDashscopeTryOnJobForLog(opts: {
  logId: string;
  credentialId: string;
  model: string;
  personImageUrl: string;
  topGarmentUrl?: string;
  bottomGarmentUrl?: string;
}) {
  const cred = await getDecryptedCredentialApiKey(opts.credentialId);
  if (!cred) throw new Error("凭证不可用");
  const created = await dashscopeCreateTryOnTask({
    apiKey: cred.apiKey,
    model: opts.model,
    personImageUrl: opts.personImageUrl,
    topGarmentUrl: opts.topGarmentUrl,
    bottomGarmentUrl: opts.bottomGarmentUrl,
  });
  if (!created.ok) throw new Error(created.error);
  await prisma.gatewayRequestLog.update({
    where: { id: opts.logId },
    data: { externalTaskId: created.taskId, status: "RUNNING" },
  });
  return created.taskId;
}

export async function submitDashscopeWan27ImageJobForLog(opts: {
  logId: string;
  credentialId: string;
  model: string;
  content: Array<{ text: string } | { image: string }>;
  size?: string;
  n?: number;
  contentOrder?: "text-first" | "images-first";
}) {
  const cred = await getDecryptedCredentialApiKey(opts.credentialId);
  if (!cred) throw new Error("凭证不可用");
  const created = await dashscopeCreateWan27ImageTask({
    apiKey: cred.apiKey,
    model: opts.model,
    content: opts.content,
    size: opts.size,
    n: opts.n,
    contentOrder: opts.contentOrder,
  });
  if (!created.ok) throw new Error(created.error);
  await prisma.gatewayRequestLog.update({
    where: { id: opts.logId },
    data: { externalTaskId: created.taskId, status: "RUNNING" },
  });
  return created.taskId;
}

export async function submitDashscopeKlingV3ImageJobForLog(opts: {
  logId: string;
  credentialId: string;
  model: string;
  content: Array<{ text: string } | { image: string }>;
  aspectRatio?: "16:9" | "9:16" | "1:1";
  resolution?: "1k" | "2k" | "4k";
  n?: number;
}) {
  const cred = await getDecryptedCredentialApiKey(opts.credentialId);
  if (!cred) throw new Error("凭证不可用");
  const created = await dashscopeCreateKlingV3ImageTask({
    apiKey: cred.apiKey,
    model: opts.model,
    content: opts.content,
    aspectRatio: opts.aspectRatio,
    resolution: opts.resolution,
    n: opts.n,
  });
  if (!created.ok) throw new Error(created.error);
  await prisma.gatewayRequestLog.update({
    where: { id: opts.logId },
    data: { externalTaskId: created.taskId, status: "RUNNING" },
  });
  return created.taskId;
}

export async function submitDashscopeWanxJobForLog(opts: {
  logId: string;
  credentialId: string;
  model: string;
  prompt: string;
  negativePrompt?: string;
  n: number;
  size?: string;
  refImg?: string;
  refMode?: "repaint" | "refonly";
  refStrength?: number;
}) {
  const cred = await getDecryptedCredentialApiKey(opts.credentialId);
  if (!cred) throw new Error("凭证不可用");
  const created = await dashscopeCreateWanxTask({
    apiKey: cred.apiKey,
    model: opts.model,
    prompt: opts.prompt,
    negativePrompt: opts.negativePrompt,
    n: opts.n,
    size: opts.size,
    refImg: opts.refImg,
    refMode: opts.refMode,
    refStrength: opts.refStrength,
  });
  if (!created.ok) throw new Error(created.error);
  await prisma.gatewayRequestLog.update({
    where: { id: opts.logId },
    data: { externalTaskId: created.taskId, status: "RUNNING" },
  });
  return created.taskId;
}

export async function submitDashscopeVideoJobForLog(opts: {
  logId: string;
  credentialId: string;
  model: string;
  body: Record<string, unknown>;
}) {
  const cred = await getDecryptedCredentialApiKey(opts.credentialId);
  if (!cred) throw new Error("凭证不可用");
  const created = await dashscopeCreateVideoTask({
    apiKey: cred.apiKey,
    model: opts.model,
    body: opts.body,
  });
  if (!created.ok) throw new Error(created.error);
  await prisma.gatewayRequestLog.update({
    where: { id: opts.logId },
    data: { externalTaskId: created.taskId, status: "RUNNING" },
  });
  return created.taskId;
}

export async function pollDashscopeTaskForLog(opts: {
  credentialId: string;
  taskId: string;
}) {
  const cred = await getDecryptedCredentialApiKey(opts.credentialId);
  if (!cred) throw new Error("凭证不可用");
  const polled = await dashscopeGetTask({
    apiKey: cred.apiKey,
    taskId: opts.taskId,
  });
  if (!polled.ok) throw new Error(polled.error);
  return { output: polled.output, raw: polled.raw };
}

export { submitHunyuanJobForLog, pollHunyuanTaskForLog };
