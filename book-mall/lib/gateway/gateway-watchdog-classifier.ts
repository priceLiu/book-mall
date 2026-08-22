/**
 * Gateway 看门狗 · 三态判定：正常等待 / 平台阻塞 / 数据库连接异常。
 *
 * 设计原则（不一刀切）：
 *  - **正常等待**：厂商 in-flight + poll 通道健康 → 继续等，仅在检查点轻量复核；
 *  - **平台阻塞**：poll 停摆、漏 finalize、orphan、厂商终态未同步 → recover / fail；
 *  - **DB 连接异常**：P2024 / pool timeout → 释放连接压力，下轮重试，**不**误杀任务。
 */
import type { GatewayRequestKind } from "@prisma/client";

import { readPollLastAttempt } from "@/lib/gateway/gateway-poll-stall-diagnostics";
import {
  kieWatchdogChannelFailMax,
  kieWatchdogChannelFailMinAgeMs,
  kieWatchdogCheckpointSec,
  kieWatchdogHardMaxAgeMs,
  kieWatchdogOrphanMaxAgeMs,
  kieWatchdogPollStaleMinAgeMs,
  kieWatchdogSoftMaxAgeMs,
  kieWatchdogWorkerStaleMs,
  readKieWatchdogChannelMeta,
  type KieWatchdogChannelMeta,
} from "@/lib/gateway/gateway-kie-watchdog-policy";
import {
  decideWatchdogVendorCheck,
  readWatchdogLastRecoverAtMs,
} from "@/lib/gateway/gateway-video-watchdog-policy";
import {
  isKieRecordComplete,
  isKieRecordFail,
  isKieRecordInFlight,
  isKieRecordSuccess,
  type KieRecordResponse,
} from "@/lib/story/kie-client";
import { isPrismaPoolTimeoutError } from "@/lib/prisma-db-gate";

export type WatchdogBlockReason =
  | "orphan_no_task"
  | "poll_worker_stale"
  | "vendor_success_desync"
  | "vendor_fail_desync"
  | "channel_exhausted"
  | "absolute_timeout";

export type WatchdogWaitingReason =
  | "vendor_in_flight"
  | "poll_healthy"
  | "within_grace"
  | "checkpoint_not_due";

export type GatewayWatchdogVerdict =
  | {
      outcome: "continue";
      waiting: WatchdogWaitingReason;
      hint: string;
      vendorCheckDue: boolean;
    }
  | {
      outcome: "recover";
      blocked: WatchdogBlockReason;
      hint: string;
    }
  | {
      outcome: "fail";
      blocked: WatchdogBlockReason;
      failCode: string;
      hint: string;
    }
  | {
      outcome: "db_release_retry";
      hint: string;
    };

export type KieWatchdogRowInput = {
  id: string;
  requestKind: GatewayRequestKind | string | null;
  externalTaskId: string | null;
  credentialId: string | null;
  submittedAt: Date | null;
  lastPolledAt: Date | null;
  pollCount: number;
  resultSummary: unknown;
  nowMs?: number;
  /** 最近一次 vendor 复核结果（看门狗 recover 路径填入） */
  lastVendorRecord?: KieRecordResponse | null;
};

function readProgressVendorState(resultSummary: unknown): string | null {
  if (!resultSummary || typeof resultSummary !== "object") return null;
  const rs = resultSummary as Record<string, unknown>;
  if (rs.kind === "task_progress" && typeof rs.status === "string") {
    return rs.status;
  }
  const state = rs.state;
  if (typeof state === "string") return state;
  return null;
}

function isDbPollError(
  pollAttempt: ReturnType<typeof readPollLastAttempt>,
  channelMeta: KieWatchdogChannelMeta,
): boolean {
  if (pollAttempt && !pollAttempt.ok && pollAttempt.kind === "db") return true;
  const err = channelMeta.lastError ?? pollAttempt?.error ?? "";
  return isPrismaPoolTimeoutError(new Error(err));
}

function isVendorChannelError(
  pollAttempt: ReturnType<typeof readPollLastAttempt>,
  channelMeta: KieWatchdogChannelMeta,
): boolean {
  if (pollAttempt && !pollAttempt.ok && pollAttempt.kind === "vendor") return true;
  const failures = channelMeta.consecutiveVendorFailures ?? 0;
  return failures > 0 && !isDbPollError(pollAttempt, channelMeta);
}

function vendorShowsTerminalDesync(
  resultSummary: unknown,
  record?: KieRecordResponse | null,
): "success" | "fail" | null {
  if (record) {
    if (isKieRecordSuccess(record.state) || isKieRecordComplete(record)) {
      return "success";
    }
    if (isKieRecordFail(record.state)) return "fail";
  }
  const progress = readProgressVendorState(resultSummary);
  if (!progress) return null;
  if (isKieRecordSuccess(progress)) return "success";
  if (isKieRecordFail(progress)) return "fail";
  return null;
}

function vendorShowsInFlight(
  resultSummary: unknown,
  record?: KieRecordResponse | null,
): boolean {
  if (record) {
    return isKieRecordInFlight(record.state);
  }
  const progress = readProgressVendorState(resultSummary);
  if (!progress) return true;
  return isKieRecordInFlight(progress);
}

/**
 * 对单条 KIE RUNNING 日志做三态判定（不含 IO，纯策略）。
 */
export function classifyKieGatewayWatchdogRow(
  input: KieWatchdogRowInput,
): GatewayWatchdogVerdict {
  const nowMs = input.nowMs ?? Date.now();
  const ageMs = input.submittedAt
    ? nowMs - input.submittedAt.getTime()
    : 0;
  const pollLagMs =
    nowMs - (input.lastPolledAt?.getTime() ?? input.submittedAt?.getTime() ?? nowMs);
  const pollAttempt = readPollLastAttempt(input.resultSummary);
  const channelMeta = readKieWatchdogChannelMeta(input.resultSummary);
  const workerStaleMs = kieWatchdogWorkerStaleMs();
  const pollHealthy = pollLagMs <= workerStaleMs;

  if (!input.externalTaskId?.trim() || !input.credentialId) {
    if (ageMs >= kieWatchdogOrphanMaxAgeMs()) {
      return {
        outcome: "fail",
        blocked: "orphan_no_task",
        failCode: "STALE_ORPHAN",
        hint: "提交未完成（无 taskId 或凭证），已超过 orphan 宽限期",
      };
    }
    return {
      outcome: "continue",
      waiting: "within_grace",
      hint: "等待提交回写 taskId / 凭证",
      vendorCheckDue: false,
    };
  }

  const dbFailures = channelMeta.consecutiveDbFailures ?? 0;
  if (pollAttempt && !pollAttempt.ok && pollAttempt.kind === "db") {
    return {
      outcome: "db_release_retry",
      hint: pollAttempt.error ?? "数据库写入/读取失败，释放连接后重试",
    };
  }
  if (
    dbFailures > 0 &&
    channelMeta.lastError &&
    isPrismaPoolTimeoutError(new Error(channelMeta.lastError))
  ) {
    return {
      outcome: "db_release_retry",
      hint: channelMeta.lastError,
    };
  }

  const desync = vendorShowsTerminalDesync(
    input.resultSummary,
    input.lastVendorRecord,
  );
  if (desync === "success") {
    return {
      outcome: "recover",
      blocked: "vendor_success_desync",
      hint: "厂商已成功但 Gateway 仍 RUNNING，需进程内 finalize",
    };
  }
  if (desync === "fail") {
    return {
      outcome: "recover",
      blocked: "vendor_fail_desync",
      hint: "厂商已失败但 Gateway 仍 RUNNING，需同步终态",
    };
  }

  const vendorFailures = channelMeta.consecutiveVendorFailures ?? 0;
  if (
    vendorFailures >= kieWatchdogChannelFailMax() &&
    ageMs >= kieWatchdogChannelFailMinAgeMs()
  ) {
    return {
      outcome: "fail",
      blocked: "channel_exhausted",
      failCode: "POLL_CHANNEL_ERROR",
      hint:
        channelMeta.lastError ??
        pollAttempt?.error ??
        "轮询通道多次失败（凭证/网络/厂商不可达）",
    };
  }

  const hardMaxMs = kieWatchdogHardMaxAgeMs(input.requestKind);
  if (ageMs >= hardMaxMs) {
    if (vendorShowsInFlight(input.resultSummary, input.lastVendorRecord)) {
      return {
        outcome: "fail",
        blocked: "absolute_timeout",
        failCode: "STALE_TIMEOUT",
        hint: `已超过硬上限 ${Math.round(hardMaxMs / 1000)}s，厂商仍 in-flight`,
      };
    }
    return {
      outcome: "recover",
      blocked: "poll_worker_stale",
      hint: "超龄且厂商状态不明，强制复核",
    };
  }

  const vendorCheck = decideWatchdogVendorCheck({
    submittedAtMs: input.submittedAt?.getTime() ?? nowMs,
    nowMs,
    lastPolledAtMs: input.lastPolledAt?.getTime() ?? null,
    lastWatchdogRecoverAtMs: readWatchdogLastRecoverAtMs(input.resultSummary),
    checkpointsSec: kieWatchdogCheckpointSec(input.requestKind),
    workerStaleMs,
    tooLongMs: kieWatchdogPollStaleMinAgeMs(),
  });

  if (!pollHealthy && ageMs >= kieWatchdogPollStaleMinAgeMs()) {
    return {
      outcome: "recover",
      blocked: "poll_worker_stale",
      hint: `poll 停摆 ${Math.round(pollLagMs / 1000)}s，需主动 vendor 复核`,
    };
  }

  const softMaxMs = kieWatchdogSoftMaxAgeMs(input.requestKind);
  const needsForcedVerify =
    ageMs >= softMaxMs ||
    isVendorChannelError(pollAttempt, channelMeta) ||
    (vendorCheck.due && !pollHealthy);

  if (needsForcedVerify) {
    return {
      outcome: "recover",
      blocked: "poll_worker_stale",
      hint:
        ageMs >= softMaxMs
          ? `超过软上限 ${Math.round(softMaxMs / 1000)}s，强制 vendor 复核`
          : vendorCheck.due
            ? `检查点到期（${vendorCheck.reason ?? "checkpoint"}）`
            : "通道异常，主动复核",
    };
  }

  if (vendorShowsInFlight(input.resultSummary, input.lastVendorRecord)) {
    return {
      outcome: "continue",
      waiting: "vendor_in_flight",
      hint: "厂商正常排队/生成中，poll 通道健康",
      vendorCheckDue: false,
    };
  }

  return {
    outcome: "continue",
    waiting: pollHealthy ? "poll_healthy" : "checkpoint_not_due",
    hint: pollHealthy ? "等待下一轮 poll" : "等待检查点",
    vendorCheckDue: false,
  };
}

export function classifyWatchdogSyncError(error: unknown): GatewayWatchdogVerdict {
  if (isPrismaPoolTimeoutError(error)) {
    return {
      outcome: "db_release_retry",
      hint: error instanceof Error ? error.message : String(error),
    };
  }
  return {
    outcome: "recover",
    blocked: "poll_worker_stale",
    hint: error instanceof Error ? error.message : String(error),
  };
}
