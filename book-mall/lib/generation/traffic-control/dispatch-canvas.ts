import type { CanvasGenerationTask, Prisma } from "@prisma/client";

import {
  buildCanvasAiKieCallbackUrl,
} from "@/lib/canvas/canvas-constants";
import { canvasVideoPayloadWhere } from "@/lib/canvas/canvas-queue-without-log";
import { claimCanvasTaskKieSubmit } from "@/lib/canvas/canvas-kie-gateway-claim";
import {
  canvasGwCreateBailianR2vJob,
  canvasGwCreateKieJob,
  canvasGwCreateVolcengineVideoJob,
} from "@/lib/canvas/canvas-gateway-client";
import { CanvasProjectError } from "@/lib/canvas/canvas-project-service";
import { finalizeRequestLog } from "@/lib/gateway/proxy-common";
import { refundFailedGatewayLog } from "@/lib/billing/gateway-credit-settlement";
import { prisma } from "@/lib/prisma";
import { isTransientSystemBusyError, runTxWithRetry, CANVAS_DB_TX_OPTIONS } from "@/lib/db-tx-retry";

import {
  getDispatchBatch,
  getQueueTimeoutMin,
  isTrafficControlEnabled,
} from "./constants";
import { isCanvasVideoTrafficKind } from "./admit-canvas";
import {
  acquireTrafficSlotInTx,
  releaseTrafficSlot,
} from "./slot";
import { resolveCanvasProjectTrafficScope, resolveMaxConcurrencyForScope } from "./scope-key";
import { queueDispatchAfterFromIndex } from "./queue-dispatch-after";
import { nextDispatchAfterFromSpacing } from "./token-bucket";
import { releaseGatewayVideoTrafficSlotIfOccupying } from "./release-gateway-video-traffic-slot";
import { clearDispatchStaleRetryInPayload } from "./pre-submit-retry";

function taskInputPayload(
  task: Pick<CanvasGenerationTask, "inputPayload">,
): Record<string, unknown> {
  const p = task.inputPayload;
  if (!p || typeof p !== "object" || Array.isArray(p)) return {};
  return p as Record<string, unknown>;
}

function resolveCanvasClientPage(projectId: string, clientPage?: string): string {
  const cp = clientPage?.trim();
  if (cp) return cp;
  return `canvas/${projectId}`;
}

async function submitCanvasVideoToGateway(
  task: CanvasGenerationTask & { project: { userId: string } },
  payload: Record<string, unknown>,
): Promise<{ taskId: string; logId: string }> {
  const userId = task.project.userId;
  const clientPage = resolveCanvasClientPage(
    task.projectId,
    typeof payload.clientPage === "string" ? payload.clientPage : undefined,
  );
  const providerKind = payload.providerKind;

  if (providerKind === "BAILIAN_R2V") {
    const params = (payload.params as Record<string, unknown>) ?? {};
    const refs = Array.isArray(payload.referenceImageUrls)
      ? (payload.referenceImageUrls as string[])
      : [];
    const resolution =
      String(params.resolution ?? "1080P") === "720P" ? "720P" : "1080P";
    const job = await canvasGwCreateBailianR2vJob(userId, {
      model: task.model,
      prompt: String(payload.prompt ?? ""),
      referenceImageUrls: refs,
      resolution,
      ratio: String(params.ratio ?? "16:9"),
      duration: Number(params.duration ?? 5),
      seedStr: String(params.seed ?? ""),
      parameterExtras:
        task.model.startsWith("wan2.")
          ? { prompt_extend: params.prompt_extend !== false }
          : undefined,
      clientPage,
      projectId: task.projectId,
    });
    return { taskId: job.taskId, logId: job.logId };
  }

  if (providerKind === "VOLCENGINE") {
    const data = payload;
    const job = await canvasGwCreateVolcengineVideoJob(userId, {
      model: String(payload.volcengineModel ?? task.model),
      body: (payload.volcengineBody as Record<string, unknown>) ?? {},
      clientPage,
      projectId: task.projectId,
      providerId: typeof payload.providerId === "string" ? payload.providerId : undefined,
      gatewayCredentialId:
        typeof data.gatewayCredentialId === "string" && data.gatewayCredentialId.trim()
          ? data.gatewayCredentialId.trim()
          : undefined,
      sbv1Billing:
        data.sbv1Billing && typeof data.sbv1Billing === "object"
          ? (data.sbv1Billing as Record<string, unknown>)
          : undefined,
    });
    return { taskId: job.taskId, logId: job.logId };
  }

  const callBackUrl = buildCanvasAiKieCallbackUrl("video", task.id);
  const job = await canvasGwCreateKieJob(userId, {
    model: String(payload.kieModel ?? task.model),
    input: (payload.kieInput as Record<string, unknown>) ?? {},
    callBackUrl,
    clientPage,
    projectId: task.projectId,
  });
  return { taskId: job.taskId, logId: job.logId };
}

async function cancelQueueTimeouts(projectId?: string): Promise<number> {
  const cutoff = new Date(Date.now() - getQueueTimeoutMin() * 60_000);
  // 画布视频走 30s×6 次 pre-submit 自愈，不再用 10min QUEUE_TIMEOUT 弹「排队超过…」
  const res = await prisma.canvasGenerationTask.updateMany({
    where: {
      status: "QUEUED",
      queuedAt: { lt: cutoff },
      ...(projectId ? { projectId } : {}),
      NOT: canvasVideoPayloadWhere(),
    },
    data: {
      status: "CANCELLED",
      failCode: "QUEUE_TIMEOUT",
      failMessage: `排队超过 ${getQueueTimeoutMin()} 分钟，请重试`,
      completedAt: new Date(),
    },
  });
  return res.count;
}

async function recoverStaleDispatching(projectId?: string): Promise<number> {
  const { recoverStalePreSubmitVideoTasks } = await import(
    "./recover-stale-dispatching"
  );
  return recoverStalePreSubmitVideoTasks({ projectId });
}

/** DISPATCHING 但未 createTask：释放槽并退回 QUEUED（生产线卡死恢复） */
async function revertStuckDispatchingTask(
  taskId: string,
  scopeKey: string,
  payload?: Record<string, unknown>,
): Promise<void> {
  await releaseTrafficSlot(scopeKey);
  const p = payload ?? {};
  const stuckClaim =
    p.gatewayKieSubmitClaimed === true && !p.gatewayLogId;
  await prisma.canvasGenerationTask
    .update({
      where: { id: taskId, status: "DISPATCHING" },
      data: {
        status: "QUEUED",
        dispatchAfter: queueDispatchAfterFromIndex(0),
        failCode: null,
        failMessage: null,
        ...(stuckClaim
          ? {
              inputPayload: {
                ...p,
                gatewayKieSubmitClaimed: false,
                syncGatewaySubmit: true,
              },
            }
          : {}),
      },
    })
    .catch(() => undefined);
}

async function dispatchOneCanvasQueuedTask(
  task: CanvasGenerationTask & { project: { userId: string } },
): Promise<"dispatched" | "skipped" | "failed"> {
  let scopeKey: string | null = null;
  try {
  const payload = taskInputPayload(task);
  if (!isCanvasVideoTrafficKind(payload)) return "skipped";

  const now = new Date();
  if (task.dispatchAfter && task.dispatchAfter.getTime() > now.getTime()) {
    return "skipped";
  }

  const actorUserId = task.actorUserId ?? task.project.userId;
  const scope = await resolveCanvasProjectTrafficScope(task.projectId, actorUserId);
  scopeKey = scope.scopeKey;
  const maxConcurrency = await resolveMaxConcurrencyForScope(scope);

  const slotResult = await runTxWithRetry(
    () =>
      prisma.$transaction(async (tx) => {
        const fresh = await tx.canvasGenerationTask.findUnique({ where: { id: task.id } });
        if (!fresh || fresh.status !== "QUEUED") return { action: "skipped" as const };

        const acquired = await acquireTrafficSlotInTx(tx, scope, maxConcurrency);
        if (!acquired.ok) {
          const retryAfter =
            acquired.retryAfter ?? nextDispatchAfterFromSpacing(new Date());
          await tx.canvasGenerationTask.update({
            where: { id: task.id },
            data: { dispatchAfter: retryAfter },
          });
          return { action: "skipped" as const };
        }

        await tx.canvasGenerationTask.update({
          where: { id: task.id },
          data: { status: "DISPATCHING", dispatchAfter: null },
        });
        return { action: "claimed" as const };
      }, CANVAS_DB_TX_OPTIONS),
    { label: "canvas-dispatch-slot", maxRetries: 3 },
  );

  if (slotResult.action !== "claimed") return "skipped";

  // 仅当 createTask 成功返回 logId 后为 true；503 预检失败时仍为 false，可安全退回队列。
  let vendorJob: { taskId: string; logId: string } | null = null;
  try {
    const { claimed, task: claimedTask } = await claimCanvasTaskKieSubmit(task.id);
    if (!claimed) {
      await releaseTrafficSlot(scope.scopeKey);
      const p = taskInputPayload(claimedTask);
      if (!claimedTask.kieTaskId && !p.gatewayLogId) {
        await prisma.canvasGenerationTask
          .update({
            where: { id: task.id },
            data: {
              status: "QUEUED",
              dispatchAfter: queueDispatchAfterFromIndex(0),
              failCode: null,
              failMessage: null,
              inputPayload: {
                ...p,
                gatewayKieSubmitClaimed: false,
                syncGatewaySubmit: true,
              },
            },
          })
          .catch(() => undefined);
      }
      return "skipped";
    }

    const job = await submitCanvasVideoToGateway(
      { ...claimedTask, project: task.project },
      taskInputPayload(claimedTask),
    );
    vendorJob = job;

    // 厂商已受理（gateway 日志已建、vendor 任务已在跑）：此处的状态落库务必重试，
    // 否则瞬时 DB 错误会把任务误判 FAILED，留下「日志在跑 / 任务失败」的孤儿（白烧成本）。
    await runTxWithRetry(
      () =>
        prisma.canvasGenerationTask.update({
          where: { id: task.id },
          data: {
            status: "SUBMITTED",
            kieTaskId: job.taskId,
            submittedAt: new Date(),
            lastPolledAt: new Date(),
            inputPayload: clearDispatchStaleRetryInPayload({
              ...taskInputPayload(claimedTask),
              gatewayLogId: job.logId,
              gatewayKieSubmitClaimed: true,
              syncGatewaySubmit: true,
              trafficScopeKey: scope.scopeKey,
            }) as Prisma.InputJsonValue,
          },
        }),
      { label: "canvas-dispatch-submitted-write", maxRetries: 5 },
    );

    // 厂商已受理：立即释放交通槽，让后续 QUEUED 任务出队（不等 RUNNING 终态 / 10min promote）。
    await releaseGatewayVideoTrafficSlotIfOccupying({
      logId: job.logId,
      scopeKey: scope.scopeKey,
      fireDispatch: true,
    }).catch((e) => {
      console.warn(
        "[canvas-dispatch] release slot after submit failed",
        job.logId.slice(0, 12),
        e instanceof Error ? e.message : String(e),
      );
    });

    return "dispatched";
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await releaseTrafficSlot(scope.scopeKey);

    // 厂商提交前 / createTask 503 预检失败：退回队列稍后重试，不判失败、不产生孤儿日志。
    if (!vendorJob && isTransientSystemBusyError(e)) {
      await revertStuckDispatchingTask(task.id, scope.scopeKey, taskInputPayload(task));
      return "skipped";
    }

    const code =
      e instanceof CanvasProjectError ? e.code : "VIDEO_DISPATCH_FAILED";
    await prisma.canvasGenerationTask.update({
      where: { id: task.id },
      data: {
        status: "FAILED",
        failCode: code,
        failMessage: msg.slice(0, 500),
        completedAt: new Date(),
      },
    });
    return "failed";
  }
  } catch (e) {
    if (scopeKey) {
      const fresh = await prisma.canvasGenerationTask.findUnique({
        where: { id: task.id },
        select: { status: true, inputPayload: true },
      });
      if (fresh?.status === "DISPATCHING") {
        await revertStuckDispatchingTask(
          task.id,
          scopeKey,
          taskInputPayload(fresh),
        );
      }
    }
    if (isTransientSystemBusyError(e)) return "skipped";
    console.warn(
      "[canvas-dispatch] task error",
      task.id.slice(0, 12),
      e instanceof Error ? e.message : String(e),
    );
    return "skipped";
  }
}

/** poll worker 入口：出队 QUEUED 画布视频任务。
 *
 * `fastPath`：用户点击生成后的「即时派发」热路径。跳过排队超时取消，但仍回收僵死 DISPATCHING
 * （避免槽位泄漏导致出队前长时间卡在 dispatching）。 */
export async function dispatchQueuedCanvasTasks(opts?: {
  projectId?: string;
  fastPath?: boolean;
}): Promise<{ cancelled: number; recovered: number; dispatched: number; skipped: number; failed: number }> {
  const result = { cancelled: 0, recovered: 0, dispatched: 0, skipped: 0, failed: 0 };
  if (!isTrafficControlEnabled()) return result;

  if (!opts?.fastPath) {
    try {
      result.cancelled = await cancelQueueTimeouts(opts?.projectId);
    } catch (e) {
      console.warn(
        "[canvas-dispatch] cancelQueueTimeouts failed",
        e instanceof Error ? e.message : String(e),
      );
    }
  }

  try {
    result.recovered = await recoverStaleDispatching(opts?.projectId);
  } catch (e) {
    console.warn(
      "[canvas-dispatch] recoverStaleDispatching failed",
      e instanceof Error ? e.message : String(e),
    );
  }

  let queued: (CanvasGenerationTask & { project: { userId: string } })[] = [];
  try {
    const batch = getDispatchBatch();
    queued = await prisma.canvasGenerationTask.findMany({
      where: {
        status: "QUEUED",
        ...(opts?.projectId ? { projectId: opts.projectId } : {}),
        OR: [{ dispatchAfter: null }, { dispatchAfter: { lte: new Date() } }],
      },
      orderBy: [{ queuedAt: "asc" }, { createdAt: "asc" }],
      take: batch,
      include: { project: { select: { userId: true } } },
    });
  } catch (e) {
    console.warn(
      "[canvas-dispatch] skipped (db unavailable?)",
      e instanceof Error ? e.message : String(e),
    );
    return result;
  }

  for (const task of queued) {
    try {
      const r = await dispatchOneCanvasQueuedTask(task);
      if (r === "dispatched") result.dispatched++;
      else if (r === "failed") result.failed++;
      else result.skipped++;
    } catch (e) {
      result.skipped++;
      console.warn(
        "[canvas-dispatch] task loop error",
        task.id.slice(0, 12),
        e instanceof Error ? e.message : String(e),
      );
    }
  }

  return result;
}

/** DISPATCHING 失败且已 create log 时的清理（供扩展） */
export async function abortDispatchingGatewayLog(logId: string): Promise<void> {
  const log = await prisma.gatewayRequestLog.findUnique({ where: { id: logId } });
  if (!log || log.status !== "RUNNING") return;
  await finalizeRequestLog(log.id, {
    status: "FAILED",
    durationMs: 0,
    failCode: "DISPATCH_DISPATCH_ABORT",
    failMessage: "dispatch aborted",
  });
  await refundFailedGatewayLog(log);
}
