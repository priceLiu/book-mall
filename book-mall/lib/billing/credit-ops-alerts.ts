/**
 * 积分清零运维台 · 预警纯函数 + 指标聚合。
 * 见 docs/积分清零控制台.md
 */
import type { CreditOpsJobStatus, CreditOpsWorkStatus } from "@prisma/client";

export type CreditOpsAlertLevel = "INFO" | "WARN" | "CRITICAL";

export type CreditOpsAlertCode =
  | "CRON_NOT_RUN"
  | "OVERDUE_ITEMS"
  | "PARTIAL_RUN"
  | "UNDER_PROCESSED"
  | "DRIFT_DETECTED"
  | "STALE_SUBSCRIPTION_LOTS";

export interface CreditOpsAlert {
  code: CreditOpsAlertCode;
  level: CreditOpsAlertLevel;
  message: string;
  value?: number;
}

export type CreditOpsJobRunSummary = {
  jobType: string;
  scheduledDate: string;
  status: CreditOpsJobStatus;
  startedAt: Date;
  statsJson: unknown;
};

export type CreditOpsAlertInput = {
  now: Date;
  todayCst: string;
  overdueCount: number;
  staleSubscriptionLotAccounts: number;
  latestExpireJob: CreditOpsJobRunSummary | null;
  latestResetJob: CreditOpsJobRunSummary | null;
  driftCount: number;
};

/** 01:00 CST = 前一天 17:00 UTC（非 DST；中国无夏令时）。 */
export function cstCronDeadlineUtc(businessDate: string): Date {
  const [y, m, d] = businessDate.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!, -8 + 1, 0, 0, 0));
}

export function evaluateCreditOpsAlerts(input: CreditOpsAlertInput): CreditOpsAlert[] {
  const alerts: CreditOpsAlert[] = [];
  const { now, todayCst, overdueCount, staleSubscriptionLotAccounts, driftCount } = input;

  if (overdueCount > 0) {
    alerts.push({
      code: "OVERDUE_ITEMS",
      level: "CRITICAL",
      message: `有 ${overdueCount} 条积分清零工单逾期未处理，请立即补跑。`,
      value: overdueCount,
    });
  }

  if (staleSubscriptionLotAccounts > 0) {
    alerts.push({
      code: "STALE_SUBSCRIPTION_LOTS",
      level: "WARN",
      message: `${staleSubscriptionLotAccounts} 个账户存在已过期但未清零的订阅批次。`,
      value: staleSubscriptionLotAccounts,
    });
  }

  if (driftCount > 0) {
    alerts.push({
      code: "DRIFT_DETECTED",
      level: "WARN",
      message: `${driftCount} 条工单标记完成但对账不一致，需人工核查。`,
      value: driftCount,
    });
  }

  const deadline = cstCronDeadlineUtc(todayCst);
  if (now >= deadline) {
    if (!input.latestExpireJob) {
      alerts.push({
        code: "CRON_NOT_RUN",
        level: "CRITICAL",
        message: `今日（${todayCst}）批次到期清扫尚未执行（预期 00:15 CST 后完成）。`,
      });
    }
    if (!input.latestResetJob) {
      alerts.push({
        code: "CRON_NOT_RUN",
        level: "CRITICAL",
        message: `今日（${todayCst}）订阅积分刷新尚未执行（预期 00:30 CST 后完成）。`,
      });
    }
  }

  for (const job of [input.latestExpireJob, input.latestResetJob]) {
    if (!job) continue;
    if (job.scheduledDate !== todayCst) continue;
    if (job.status === "PARTIAL") {
      alerts.push({
        code: "PARTIAL_RUN",
        level: "WARN",
        message: `今日 ${job.jobType} 部分失败，请查看执行历史。`,
      });
    }
    const stats = job.statsJson as { total?: number; done?: number } | null;
    if (
      job.status === "SUCCESS" &&
      stats &&
      typeof stats.total === "number" &&
      typeof stats.done === "number" &&
      stats.done < stats.total
    ) {
      alerts.push({
        code: "UNDER_PROCESSED",
        level: "WARN",
        message: `今日 ${job.jobType} 成功但仅处理 ${stats.done}/${stats.total} 条工单。`,
        value: stats.total - stats.done,
      });
    }
  }

  return alerts;
}

export function countOpenWorkStatuses(status: CreditOpsWorkStatus): boolean {
  return status === "PENDING" || status === "OVERDUE";
}
