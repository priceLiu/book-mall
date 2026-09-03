/**
 * 电商分镜/种草 · Gateway recordInfo 进程内轮询（避免 dev 长请求 HTTP 自调用卡死）。
 */
import type { ResolvedGatewayApiKeyAuth } from "@/lib/gateway/api-key-service";
import {
  isBailianR2vFailed,
  isBailianR2vSucceeded,
} from "@/lib/canvas/canvas-gateway-client";
import type { BailianR2vTaskOutput } from "@/lib/canvas/canvas-video-bailian-r2v";
import { extractBailianR2vVideoUrlFromGatewaySummary } from "@/lib/canvas/canvas-video-bailian-r2v";
import { extractVideoUrlFromGatewayLogSummary, readGatewayLogVideoOutputUrl } from "@/lib/ecom/ecom-gateway-log-video-url";
import { syncDashscopePollToGatewayLog } from "@/lib/gateway/gateway-v1-dashscope-poll-sync";
import { resolveGatewayLogForRecordInfo } from "@/lib/gateway/gateway-log-record-info";
import { syncKieGatewayLogFromVendorPoll } from "@/lib/gateway/kie-gateway-log-sync";
import { pollMinimaxVideoTaskForLog } from "@/lib/gateway/minimax-video-jobs";
import { pickCredentialForKind } from "@/lib/gateway/proxy-common";
import {
  dashscopeExtractTaskVideoUrl,
  isDashscopeTaskFailed,
  isDashscopeTaskSuccess,
  type DashscopeTaskOutput,
} from "@/lib/gateway/dashscope-client";
import {
  extractKieResultUrl,
  isKieRecordFail,
  isKieRecordSuccess,
} from "@/lib/story/kie-client";
import { pollVolcengineVideoTaskForLog } from "@/lib/gateway/volcengine-jobs";
import { pollBailianR2vTaskForLog, pollDashscopeTaskForLog } from "@/lib/gateway/poll-service";
import { prisma } from "@/lib/prisma";

type EcomPollResult = { status: string; outputUrl?: string; failMessage?: string };

async function readEcomVideoPollFromLog(logId: string): Promise<EcomPollResult> {
  const log = await prisma.gatewayRequestLog.findUnique({
    where: { id: logId },
    select: {
      status: true,
      failMessage: true,
      resultSummary: true,
      providerKind: true,
    },
  });
  if (!log) return { status: "PENDING" };
  if (log.status === "SUCCEEDED") {
    const outputUrl =
      extractVideoUrlFromGatewayLogSummary(log.resultSummary, {
        providerKind: log.providerKind,
      }) ?? undefined;
    return { status: "SUCCEEDED", outputUrl };
  }
  if (log.status === "FAILED") {
    return { status: "FAILED", failMessage: log.failMessage?.trim() || "视频任务失败" };
  }
  return { status: "RUNNING" };
}

export async function ecomPollBailianR2vInProcess(
  auth: ResolvedGatewayApiKeyAuth,
  opts: { taskId: string; gatewayLogId: string },
): Promise<EcomPollResult> {
  const credentialId = pickCredentialForKind(auth.credentials, "BAILIAN");
  if (!credentialId) {
    throw new Error("Gateway Key 未绑定百炼 / DashScope（阿里云）凭证");
  }

  const log = await resolveGatewayLogForRecordInfo({
    authUserId: auth.userId,
    taskId: opts.taskId,
    logId: opts.gatewayLogId,
  });

  if (log?.status === "SUCCEEDED") {
    const cachedUrl =
      extractBailianR2vVideoUrlFromGatewaySummary(log.resultSummary) ??
      (await readGatewayLogVideoOutputUrl({
        logId: opts.gatewayLogId,
        pollProvider: "bailian",
      }));
    if (cachedUrl) {
      return { status: "SUCCEEDED", outputUrl: cachedUrl };
    }
  }
  if (log?.status === "FAILED") {
    return { status: "FAILED", failMessage: log.failMessage?.trim() || "视频任务失败" };
  }

  const polled = await pollBailianR2vTaskForLog({
    credentialId,
    taskId: opts.taskId,
  });
  const output = polled.output as BailianR2vTaskOutput;
  if (log) {
    await syncDashscopePollToGatewayLog({
      log,
      taskId: opts.taskId,
      output,
      raw: polled.raw,
      providerKind: "BAILIAN",
    });
  }

  if (isBailianR2vSucceeded(output)) {
    const outputUrl = output.video_url?.trim() ?? undefined;
    return { status: "SUCCEEDED", outputUrl };
  }
  if (isBailianR2vFailed(output)) {
    const failMessage =
      output.message ?? output.code ?? `status=${output.task_status ?? "FAILED"}`;
    return { status: "FAILED", failMessage };
  }
  return { status: output.task_status ?? "PENDING" };
}

export async function ecomPollDashscopeVideoInProcess(
  auth: ResolvedGatewayApiKeyAuth,
  opts: { taskId: string; gatewayLogId: string },
): Promise<EcomPollResult> {
  const credentialId = pickCredentialForKind(auth.credentials, "DASHSCOPE");
  if (!credentialId) {
    throw new Error("Gateway Key 未绑定百炼 / DashScope（阿里云）凭证");
  }

  const log = await resolveGatewayLogForRecordInfo({
    authUserId: auth.userId,
    taskId: opts.taskId,
    logId: opts.gatewayLogId,
  });

  if (log?.status === "SUCCEEDED") {
    const cachedUrl = await readGatewayLogVideoOutputUrl({
      logId: opts.gatewayLogId,
      pollProvider: "dashscope",
    });
    if (cachedUrl) return { status: "SUCCEEDED", outputUrl: cachedUrl };
  }
  if (log?.status === "FAILED") {
    return { status: "FAILED", failMessage: log.failMessage?.trim() || "视频任务失败" };
  }

  const polled = await pollDashscopeTaskForLog({
    credentialId,
    taskId: opts.taskId,
    model: log?.model ?? null,
  });
  const output = polled.output as DashscopeTaskOutput;
  if (log) {
    await syncDashscopePollToGatewayLog({
      log,
      taskId: opts.taskId,
      output,
      raw: polled.raw,
      providerKind: "DASHSCOPE",
    });
  }

  const status = output.task_status ?? "UNKNOWN";
  if (isDashscopeTaskSuccess(status)) {
    const outputUrl = dashscopeExtractTaskVideoUrl(output as Record<string, unknown>) ?? undefined;
    return { status: "SUCCEEDED", outputUrl };
  }
  if (isDashscopeTaskFailed(status)) {
    return { status: "FAILED", failMessage: output.message ?? output.code ?? "failed" };
  }
  return { status };
}

export async function ecomPollMinimaxInProcess(
  auth: ResolvedGatewayApiKeyAuth,
  opts: { taskId: string; gatewayLogId: string },
): Promise<EcomPollResult> {
  const credentialId = pickCredentialForKind(auth.credentials, "MINIMAX");
  if (!credentialId) {
    throw new Error("Gateway Key 未绑定 MiniMax 凭证");
  }

  const cached = await readEcomVideoPollFromLog(opts.gatewayLogId);
  if (cached.status === "SUCCEEDED" || cached.status === "FAILED") return cached;

  await pollMinimaxVideoTaskForLog({
    logId: opts.gatewayLogId,
    credentialId,
    taskId: opts.taskId,
    startedAt: Date.now(),
  });

  return readEcomVideoPollFromLog(opts.gatewayLogId);
}

export async function ecomPollVolcengineInProcess(
  auth: ResolvedGatewayApiKeyAuth,
  opts: { taskId: string; gatewayLogId: string },
): Promise<EcomPollResult> {
  const credentialId = pickCredentialForKind(auth.credentials, "VOLCENGINE");
  if (!credentialId) {
    throw new Error("Gateway Key 未绑定火山方舟凭证");
  }

  const cached = await readEcomVideoPollFromLog(opts.gatewayLogId);
  if (cached.status === "SUCCEEDED" || cached.status === "FAILED") return cached;

  await pollVolcengineVideoTaskForLog({
    logId: opts.gatewayLogId,
    credentialId,
    taskId: opts.taskId,
    startedAt: Date.now(),
  });

  return readEcomVideoPollFromLog(opts.gatewayLogId);
}

export async function ecomPollKieInProcess(
  _auth: ResolvedGatewayApiKeyAuth,
  opts: { taskId: string; gatewayLogId: string },
): Promise<EcomPollResult> {
  const synced = await syncKieGatewayLogFromVendorPoll(opts.gatewayLogId);
  if (synced.status === "SUCCEEDED") {
    return {
      status: "SUCCEEDED",
      outputUrl: extractKieResultUrl(synced.record) ?? undefined,
    };
  }
  if (synced.status === "FAILED") {
    return {
      status: "FAILED",
      failMessage: synced.record.failMsg ?? synced.record.failCode ?? "failed",
    };
  }
  if (isKieRecordSuccess(synced.record.state)) {
    return {
      status: "SUCCEEDED",
      outputUrl: extractKieResultUrl(synced.record) ?? undefined,
    };
  }
  if (isKieRecordFail(synced.record.state)) {
    return {
      status: "FAILED",
      failMessage: synced.record.failMsg ?? synced.record.failCode ?? "failed",
    };
  }
  return { status: synced.record.state ?? "PENDING" };
}
