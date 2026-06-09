/**
 * 视频异常用户自动扫描（财务 2.0 风控）。
 */
import { prisma } from "@/lib/prisma";
import { VIDEO_DAILY_CAP_BY_TIER } from "@/lib/billing/video-risk-control";

export type AbnormalSignal = "DAILY_CAP_BURST" | "RAPID_BATCH" | "HIGH_FAIL_RATE";

export interface AbnormalUserRow {
  userId: string;
  tier: string;
  signals: AbnormalSignal[];
  videoCount24h: number;
  dailyCap: number;
}

export function detectAbnormalUserSignals(input: {
  tier: string;
  videoCount24h: number;
  failRate?: number;
  batchCount5m?: number;
}): AbnormalSignal[] {
  const signals: AbnormalSignal[] = [];
  const cap = VIDEO_DAILY_CAP_BY_TIER[input.tier] ?? 30;
  if (input.videoCount24h > cap * 1.2) signals.push("DAILY_CAP_BURST");
  if ((input.batchCount5m ?? 0) >= 10) signals.push("RAPID_BATCH");
  if ((input.failRate ?? 0) >= 0.5) signals.push("HIGH_FAIL_RATE");
  return signals;
}

/** 扫描近 24h 视频结算流水，输出异常用户列表。 */
export async function scanAbnormalUsers(limit = 100): Promise<AbnormalUserRow[]> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const rows = await prisma.creditLedger.groupBy({
    by: ["accountId"],
    where: {
      type: "SETTLE",
      pool: "VIDEO",
      createdAt: { gte: since },
    },
    _count: { _all: true },
  });

  const out: AbnormalUserRow[] = [];
  for (const r of rows.slice(0, limit)) {
    const account = await prisma.creditAccount.findUnique({
      where: { id: r.accountId },
      select: { ownerType: true, ownerId: true, planId: true },
    });
    if (!account || account.ownerType !== "USER") continue;
    const plan = account.planId
      ? await prisma.membershipPlan.findUnique({
          where: { id: account.planId },
          select: { tier: true },
        })
      : null;
    const tier = plan?.tier ?? "标准版";
    const videoCount24h = r._count._all;
    const signals = detectAbnormalUserSignals({ tier, videoCount24h });
    if (signals.length === 0) continue;
    out.push({
      userId: account.ownerId,
      tier,
      signals,
      videoCount24h,
      dailyCap: VIDEO_DAILY_CAP_BY_TIER[tier] ?? 30,
    });
  }
  return out;
}
