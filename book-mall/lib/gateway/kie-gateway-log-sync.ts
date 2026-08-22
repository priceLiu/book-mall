/**
 * KIE Gateway 日志 · 进程内 vendor poll + finalize（避免 book-mall HTTP 自调用 recordInfo 漏收口）。
 */
import type { GatewayRequestLog } from "@prisma/client";

import { getDecryptedCredentialApiKey } from "@/lib/gateway/credential-service";
import { isKieSunoModelKey } from "@/lib/gateway/kie-audio-models";
import { inferGatewayFailCode } from "@/lib/gateway/log-fail-code";
import {
  buildGatewayLogProgressSummary,
  touchGatewayLogProgress,
} from "@/lib/gateway/log-progress";
import { recordGatewayPollLastAttempt } from "@/lib/gateway/gateway-poll-stall-diagnostics";
import { resolveKieApiRoot } from "@/lib/gateway/model-router";
import { finalizeRequestLog } from "@/lib/gateway/proxy-common";
import { prisma } from "@/lib/prisma";
import {
  getKieSunoTaskWithKey,
} from "@/lib/story/kie-suno-client";
import {
  getKieTaskWithKey,
  isKieRecordComplete,
  isKieRecordFail,
  isKieRecordSuccess,
  type KieRecordResponse,
} from "@/lib/story/kie-client";

type KieGatewayLogRow = Pick<
  GatewayRequestLog,
  | "id"
  | "status"
  | "model"
  | "credentialId"
  | "externalTaskId"
  | "submittedAt"
>;

export type KieGatewayLogSyncResult = {
  record: KieRecordResponse;
  status: GatewayRequestLog["status"];
};

async function pollKieVendorForGatewayLog(opts: {
  credentialId: string;
  taskId: string;
  model: string;
}): Promise<KieRecordResponse> {
  const cred = await getDecryptedCredentialApiKey(opts.credentialId);
  if (!cred) throw new Error("凭证不可用");
  const baseUrl = resolveKieApiRoot(cred.baseUrl);
  if (isKieSunoModelKey(opts.model)) {
    const suno = await getKieSunoTaskWithKey(cred.apiKey, opts.taskId, baseUrl);
    const st = (suno.status ?? "").trim().toLowerCase();
    const state =
      st === "success" || st === "succeeded"
        ? "success"
        : st === "fail" || st === "failed"
          ? "fail"
          : st === "generating"
            ? "generating"
            : st === "queuing"
              ? "queuing"
              : "waiting";
    return {
      taskId: suno.taskId,
      model: opts.model,
      state,
      resultJson: suno.resultJson ?? undefined,
      failCode: suno.failCode ?? undefined,
      failMsg: suno.failMsg ?? undefined,
    };
  }
  return getKieTaskWithKey(cred.apiKey, opts.taskId, baseUrl);
}

async function loadKieGatewayLog(logId: string): Promise<KieGatewayLogRow | null> {
  return prisma.gatewayRequestLog.findUnique({
    where: { id: logId },
    select: {
      id: true,
      status: true,
      model: true,
      credentialId: true,
      externalTaskId: true,
      submittedAt: true,
    },
  });
}

/** 直连 KIE recordInfo 并同步 GatewayRequestLog 终态（SUCCEEDED / FAILED / RUNNING）。 */
export async function syncKieGatewayLogFromVendorPoll(
  logId: string,
): Promise<KieGatewayLogSyncResult> {
  const log = await loadKieGatewayLog(logId);
  if (!log) {
    throw new Error("gateway log not found");
  }
  if (log.status === "SUCCEEDED" || log.status === "FAILED") {
    return {
      record: {
        taskId: log.externalTaskId ?? "",
        model: log.model,
        state: log.status === "SUCCEEDED" ? "success" : "fail",
      },
      status: log.status,
    };
  }
  if (!log.externalTaskId?.trim() || !log.credentialId) {
    return {
      record: {
        taskId: "",
        model: log.model,
        state: "waiting",
      },
      status: log.status,
    };
  }

  let data: KieRecordResponse;
  try {
    data = await pollKieVendorForGatewayLog({
      credentialId: log.credentialId,
      taskId: log.externalTaskId,
      model: log.model,
    });
    const row = await prisma.gatewayRequestLog.findUnique({
      where: { id: log.id },
      select: { resultSummary: true },
    });
    await recordGatewayPollLastAttempt({
      logId: log.id,
      resultSummary: row?.resultSummary ?? null,
      ok: true,
      kind: "vendor",
    }).catch(() => undefined);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const row = await prisma.gatewayRequestLog.findUnique({
      where: { id: log.id },
      select: { resultSummary: true },
    });
    await recordGatewayPollLastAttempt({
      logId: log.id,
      resultSummary: row?.resultSummary ?? null,
      ok: false,
      kind: /connection pool|timed out fetching/i.test(msg) ? "db" : "vendor",
      error: msg,
    }).catch(() => undefined);
    throw e;
  }

  if (isKieRecordSuccess(data.state) || isKieRecordComplete(data)) {
    await finalizeRequestLog(log.id, {
      status: "SUCCEEDED",
      durationMs: log.submittedAt ? Date.now() - log.submittedAt.getTime() : 0,
      vendorDurationMs:
        typeof data.costTime === "number" ? Math.round(data.costTime * 1000) : undefined,
      resultSummary: { state: "success", resultJson: data.resultJson },
      externalTaskId: data.taskId,
      model: data.model || log.model,
    });
    return { record: { ...data, state: "success" }, status: "SUCCEEDED" };
  }

  if (isKieRecordFail(data.state)) {
    await finalizeRequestLog(log.id, {
      status: "FAILED",
      durationMs: log.submittedAt ? Date.now() - log.submittedAt.getTime() : 0,
      failMessage: data.failMsg ?? data.failCode ?? "failed",
      failCode:
        inferGatewayFailCode({
          failMessage: data.failMsg,
          upstreamCode: data.failCode,
        }) ?? "KIE_TASK_FAILED",
      externalTaskId: data.taskId,
      model: data.model || log.model,
    });
    return { record: data, status: "FAILED" };
  }

  await touchGatewayLogProgress(
    log.id,
    buildGatewayLogProgressSummary({
      providerKind: "KIE",
      status: String(data.state ?? "running"),
    }),
  );
  return { record: data, status: "RUNNING" };
}
