/**
 * 多级盈亏预警中心（财务 2.0 · Phase 5）
 *
 * 预警项：
 *  - 综合毛利 < 75%
 *  - 视频毛利 < 70%
 *  - 单日视频成本环比 + 50%
 *  - 积分损耗率 > 15%（退款 + 解冻 ÷ 冻结 + 消费）
 *
 * 阈值判定为纯函数（可单测）；指标聚合走 GatewayRequestLog / CreditLedger。
 */
import { prisma } from "@/lib/prisma";

export const PNL_THRESHOLDS = {
  blendedMargin: 0.75,
  videoMargin: 0.7,
  dailyVideoCostMoMRate: 0.5,
  lossRate: 0.15,
} as const;

export type AlertLevel = "INFO" | "WARN" | "CRITICAL";
export type AlertCode = "BLENDED_MARGIN" | "VIDEO_MARGIN" | "DAILY_VIDEO_COST_SPIKE" | "LOSS_RATE";

export interface PnlAlert {
  code: AlertCode;
  level: AlertLevel;
  message: string;
  value: number;
  threshold: number;
}

export interface PnlMetrics {
  periodKey: string;
  blendedMargin: number | null;
  videoMargin: number | null;
  todayVideoCostYuan: number;
  yesterdayVideoCostYuan: number;
  dailyVideoCostMoMRate: number | null;
  lossRate: number | null;
}

/** 纯阈值判定 → 预警列表。 */
export function evaluateAlerts(m: PnlMetrics): PnlAlert[] {
  const alerts: PnlAlert[] = [];
  if (m.blendedMargin != null && m.blendedMargin < PNL_THRESHOLDS.blendedMargin) {
    alerts.push({
      code: "BLENDED_MARGIN",
      level: m.blendedMargin < PNL_THRESHOLDS.blendedMargin - 0.05 ? "CRITICAL" : "WARN",
      message: `综合毛利 ${(m.blendedMargin * 100).toFixed(1)}% 低于 ${(PNL_THRESHOLDS.blendedMargin * 100).toFixed(0)}%`,
      value: m.blendedMargin,
      threshold: PNL_THRESHOLDS.blendedMargin,
    });
  }
  if (m.videoMargin != null && m.videoMargin < PNL_THRESHOLDS.videoMargin) {
    alerts.push({
      code: "VIDEO_MARGIN",
      level: m.videoMargin < PNL_THRESHOLDS.videoMargin - 0.05 ? "CRITICAL" : "WARN",
      message: `视频毛利 ${(m.videoMargin * 100).toFixed(1)}% 低于 ${(PNL_THRESHOLDS.videoMargin * 100).toFixed(0)}%`,
      value: m.videoMargin,
      threshold: PNL_THRESHOLDS.videoMargin,
    });
  }
  if (m.dailyVideoCostMoMRate != null && m.dailyVideoCostMoMRate >= PNL_THRESHOLDS.dailyVideoCostMoMRate) {
    alerts.push({
      code: "DAILY_VIDEO_COST_SPIKE",
      level: m.dailyVideoCostMoMRate >= 1 ? "CRITICAL" : "WARN",
      message: `单日视频成本环比 +${(m.dailyVideoCostMoMRate * 100).toFixed(0)}%（今日 ¥${m.todayVideoCostYuan.toFixed(2)} / 昨日 ¥${m.yesterdayVideoCostYuan.toFixed(2)}）`,
      value: m.dailyVideoCostMoMRate,
      threshold: PNL_THRESHOLDS.dailyVideoCostMoMRate,
    });
  }
  if (m.lossRate != null && m.lossRate > PNL_THRESHOLDS.lossRate) {
    alerts.push({
      code: "LOSS_RATE",
      level: m.lossRate > PNL_THRESHOLDS.lossRate * 2 ? "CRITICAL" : "WARN",
      message: `积分损耗率 ${(m.lossRate * 100).toFixed(1)}% 超过 ${(PNL_THRESHOLDS.lossRate * 100).toFixed(0)}%`,
      value: m.lossRate,
      threshold: PNL_THRESHOLDS.lossRate,
    });
  }
  return alerts;
}

function num(v: unknown, fallback = 0): number {
  if (v == null) return fallback;
  const n = typeof v === "number" ? v : Number(v.toString());
  return Number.isFinite(n) ? n : fallback;
}

function periodBounds(periodKey: string): { from: Date; to: Date } {
  const [y, m] = periodKey.split("-").map((s) => Number(s));
  return { from: new Date(Date.UTC(y, (m ?? 1) - 1, 1)), to: new Date(Date.UTC(y, m ?? 1, 1)) };
}

function dayBounds(daysAgo: number): { from: Date; to: Date } {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysAgo));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { from: start, to: end };
}

/** 用 per-log marginSnapshot 反推营收：revenue_i = cost_i / (1 - margin_i)。 */
async function marginFromLogs(where: Record<string, unknown>): Promise<number | null> {
  const logs = await prisma.gatewayRequestLog.findMany({
    where: where as never,
    select: { costSnapshotYuan: true, marginSnapshot: true },
  });
  let totalCost = 0;
  let totalRevenue = 0;
  for (const l of logs) {
    const cost = num(l.costSnapshotYuan);
    const margin = l.marginSnapshot != null ? num(l.marginSnapshot) : null;
    if (cost <= 0 || margin == null || margin >= 1) continue;
    totalCost += cost;
    totalRevenue += cost / (1 - margin);
  }
  if (totalRevenue <= 0) return null;
  return Math.round((1 - totalCost / totalRevenue) * 1e4) / 1e4;
}

async function videoCostBetween(from: Date, to: Date): Promise<number> {
  const agg = await prisma.gatewayRequestLog.aggregate({
    where: { requestKind: "VIDEO", status: "SUCCEEDED", completedAt: { gte: from, lt: to } } as never,
    _sum: { costSnapshotYuan: true },
  });
  return num(agg._sum.costSnapshotYuan);
}

/** 积分损耗率 = (退款 + 解冻) ÷ (冻结 + 消费)。 */
async function computeLossRate(from: Date, to: Date): Promise<number | null> {
  const grouped = await prisma.creditLedger.groupBy({
    by: ["type"],
    where: { createdAt: { gte: from, lt: to } },
    _sum: { credits: true },
  });
  const sumOf = (t: string) => Math.abs(num(grouped.find((g) => g.type === t)?._sum.credits, 0));
  const refunded = sumOf("REFUND");
  const released = sumOf("RELEASE");
  const consumed = sumOf("CONSUME");
  const reserved = sumOf("RESERVE");
  const denom = consumed + reserved;
  if (denom <= 0) return null;
  return Math.round(((refunded + released) / denom) * 1e4) / 1e4;
}

/** 聚合本月盈亏指标。 */
export async function computePnlMetrics(periodKey: string): Promise<PnlMetrics> {
  const { from, to } = periodBounds(periodKey);
  const today = dayBounds(0);
  const yesterday = dayBounds(1);

  const [blendedMargin, videoMargin, todayVideoCostYuan, yesterdayVideoCostYuan, lossRate] = await Promise.all([
    marginFromLogs({ status: "SUCCEEDED", submittedAt: { gte: from, lt: to } }),
    marginFromLogs({ status: "SUCCEEDED", requestKind: "VIDEO", submittedAt: { gte: from, lt: to } }),
    videoCostBetween(today.from, today.to),
    videoCostBetween(yesterday.from, yesterday.to),
    computeLossRate(from, to),
  ]);

  const dailyVideoCostMoMRate =
    yesterdayVideoCostYuan > 0
      ? Math.round(((todayVideoCostYuan - yesterdayVideoCostYuan) / yesterdayVideoCostYuan) * 1e4) / 1e4
      : null;

  return {
    periodKey,
    blendedMargin,
    videoMargin,
    todayVideoCostYuan,
    yesterdayVideoCostYuan,
    dailyVideoCostMoMRate,
    lossRate,
  };
}

/** 一站式：聚合指标 + 评估预警。 */
export async function getPnlAlerts(periodKey: string): Promise<{ metrics: PnlMetrics; alerts: PnlAlert[] }> {
  const metrics = await computePnlMetrics(periodKey);
  return { metrics, alerts: evaluateAlerts(metrics) };
}
