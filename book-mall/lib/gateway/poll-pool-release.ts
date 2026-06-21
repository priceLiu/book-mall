/**
 * 轮询池 · 手动释放 / 升格恢复卡住的 Gateway / Canvas 任务。
 */
import { recoverCanvasVideoTaskDisplay } from "@/lib/canvas/canvas-video-display-recover";
import { applyCanvasVolcengineVideoResult } from "@/lib/canvas/canvas-task-service";
import { extractVolcengineVideoUrlFromGatewaySummary } from "@/lib/canvas/canvas-volcengine-recover";
import { gatewayV1RecordInfo } from "@/lib/gateway/gateway-v1-http-client";
import { resolveGenerationSlowWarnMs } from "@/lib/generation/slow-warn-config";
import { prisma } from "@/lib/prisma";

const ESCALATION_POLL_TIMEOUT_MS = 20_000;
const FORCE_FAIL_AFTER_MS = 90 * 60 * 1000;

export type PollPoolReleaseAction = "recover" | "fail";
export type PollPoolReleaseTarget = "gateway" | "canvas";

export type PollPoolReleaseResult = {
  ok: boolean;
  action: PollPoolReleaseAction;
  target: PollPoolReleaseTarget;
  id: string;
  message: string;
  gatewayStatus?: string;
  canvasStatus?: string;
};

async function findCanvasTaskByGatewayLogId(gatewayLogId: string) {
  const tasks = await prisma.canvasGenerationTask.findMany({
    where: { status: { in: ["SUBMITTED", "PENDING"] } },
    orderBy: { updatedAt: "desc" },
    take: 200,
    select: { id: true, inputPayload: true, status: true },
  });
  for (const t of tasks) {
    const p =
      t.inputPayload && typeof t.inputPayload === "object"
        ? (t.inputPayload as Record<string, unknown>)
        : null;
    if (p?.gatewayLogId === gatewayLogId) return t;
  }
  return null;
}

async function fastGatewayRecordInfo(row: {
  id: string;
  apiKeyId: string | null;
  externalTaskId: string | null;
}): Promise<boolean> {
  if (!row.apiKeyId || !row.externalTaskId) return false;
  try {
    await Promise.race([
      gatewayV1RecordInfo({
        apiKeyId: row.apiKeyId,
        taskId: row.externalTaskId,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("escalation recordInfo timeout")),
          ESCALATION_POLL_TIMEOUT_MS,
        ),
      ),
    ]);
    await prisma.gatewayRequestLog.update({
      where: { id: row.id },
      data: { lastPolledAt: new Date(), pollCount: { increment: 1 } },
    });
    return true;
  } catch {
    await prisma.gatewayRequestLog.update({
      where: { id: row.id },
      data: { lastPolledAt: new Date(), pollCount: { increment: 1 } },
    });
    return false;
  }
}

export async function releasePollPoolGatewayLog(
  gatewayLogId: string,
  action: PollPoolReleaseAction,
): Promise<PollPoolReleaseResult> {
  const log = await prisma.gatewayRequestLog.findUnique({
    where: { id: gatewayLogId },
    select: {
      id: true,
      status: true,
      apiKeyId: true,
      externalTaskId: true,
      submittedAt: true,
      resultSummary: true,
    },
  });
  if (!log) {
    return {
      ok: false,
      action,
      target: "gateway",
      id: gatewayLogId,
      message: "gateway_log_not_found",
    };
  }

  const ageMs = log.submittedAt ? Date.now() - log.submittedAt.getTime() : 0;
  const slowWarnMs = await resolveGenerationSlowWarnMs();

  if (action === "recover") {
    if (log.status === "SUCCEEDED") {
      const videoUrl = extractVolcengineVideoUrlFromGatewaySummary(
        log.resultSummary,
      );
      const canvasTask = await findCanvasTaskByGatewayLogId(log.id);
      if (canvasTask && videoUrl) {
        await applyCanvasVolcengineVideoResult(canvasTask.id, videoUrl);
      } else if (canvasTask) {
        await recoverCanvasVideoTaskDisplay(canvasTask.id);
      }
      return {
        ok: true,
        action,
        target: "gateway",
        id: gatewayLogId,
        message: "gateway_already_succeeded_synced_canvas",
        gatewayStatus: log.status,
      };
    }

    if (log.status === "RUNNING") {
      await fastGatewayRecordInfo(log);
      const after = await prisma.gatewayRequestLog.findUnique({
        where: { id: log.id },
        select: { status: true, resultSummary: true },
      });
      if (after?.status === "SUCCEEDED") {
        const videoUrl = extractVolcengineVideoUrlFromGatewaySummary(
          after.resultSummary,
        );
        const canvasTask = await findCanvasTaskByGatewayLogId(log.id);
        if (canvasTask && videoUrl) {
          await applyCanvasVolcengineVideoResult(canvasTask.id, videoUrl);
        } else if (canvasTask) {
          await recoverCanvasVideoTaskDisplay(canvasTask.id);
        }
        return {
          ok: true,
          action,
          target: "gateway",
          id: gatewayLogId,
          message: "recovered_via_fast_poll",
          gatewayStatus: after.status,
        };
      }

      const canvasTask = await findCanvasTaskByGatewayLogId(log.id);
      if (canvasTask) {
        const r = await recoverCanvasVideoTaskDisplay(canvasTask.id);
        if (r.ok && r.action !== "failed") {
          return {
            ok: true,
            action,
            target: "gateway",
            id: gatewayLogId,
            message: `canvas_recover_${r.action}`,
            gatewayStatus: after?.status ?? log.status,
            canvasStatus: r.action,
          };
        }
      }
    }

    return {
      ok: false,
      action,
      target: "gateway",
      id: gatewayLogId,
      message: "recover_failed_try_fail_or_wait_vendor",
      gatewayStatus: log.status,
    };
  }

  if (log.status !== "RUNNING" && log.status !== "PENDING") {
    return {
      ok: false,
      action,
      target: "gateway",
      id: gatewayLogId,
      message: `status_${log.status}_not_releasable`,
      gatewayStatus: log.status,
    };
  }

  if (ageMs < slowWarnMs) {
    return {
      ok: false,
      action,
      target: "gateway",
      id: gatewayLogId,
      message: "below_slow_warn_threshold",
      gatewayStatus: log.status,
    };
  }

  await prisma.gatewayRequestLog.update({
    where: { id: log.id },
    data: {
      status: "FAILED",
      failCode: "POLL_POOL_MANUAL_RELEASE",
      failMessage:
        ageMs >= FORCE_FAIL_AFTER_MS
          ? "轮询池手动释放：超过 90 分钟仍 RUNNING，已标记失败"
          : "轮询池手动释放：超过预警线仍无法同步，已标记失败",
      completedAt: new Date(),
      durationMs: ageMs,
    },
  });

  const canvasTask = await findCanvasTaskByGatewayLogId(log.id);
  if (canvasTask) {
    await prisma.canvasGenerationTask.update({
      where: { id: canvasTask.id },
      data: {
        status: "FAILED",
        failCode: "POLL_POOL_MANUAL_RELEASE",
        failMessage: "关联 Gateway 日志已手动释放",
        completedAt: new Date(),
      },
    });
  }

  return {
    ok: true,
    action,
    target: "gateway",
    id: gatewayLogId,
    message: "released_as_failed",
    gatewayStatus: "FAILED",
  };
}

export async function releasePollPoolCanvasTask(
  canvasTaskId: string,
  action: PollPoolReleaseAction,
): Promise<PollPoolReleaseResult> {
  if (action === "recover") {
    const r = await recoverCanvasVideoTaskDisplay(canvasTaskId);
    return {
      ok: r.ok,
      action,
      target: "canvas",
      id: canvasTaskId,
      message: r.reason ?? r.action,
      canvasStatus: r.action,
    };
  }

  const task = await prisma.canvasGenerationTask.findUnique({
    where: { id: canvasTaskId },
    select: { status: true, submittedAt: true, createdAt: true },
  });
  if (!task) {
    return {
      ok: false,
      action,
      target: "canvas",
      id: canvasTaskId,
      message: "task_not_found",
    };
  }
  const ageMs = Date.now() - (task.submittedAt ?? task.createdAt).getTime();
  const slowWarnMs = await resolveGenerationSlowWarnMs();
  if (ageMs < slowWarnMs) {
    return {
      ok: false,
      action,
      target: "canvas",
      id: canvasTaskId,
      message: "below_slow_warn_threshold",
      canvasStatus: task.status,
    };
  }

  await prisma.canvasGenerationTask.update({
    where: { id: canvasTaskId },
    data: {
      status: "FAILED",
      failCode: "POLL_POOL_MANUAL_RELEASE",
      failMessage: "轮询池手动释放",
      completedAt: new Date(),
    },
  });

  return {
    ok: true,
    action,
    target: "canvas",
    id: canvasTaskId,
    message: "released_as_failed",
    canvasStatus: "FAILED",
  };
}
