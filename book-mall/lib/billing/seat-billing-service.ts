/**
 * 统一积分计费 — 团队席位 + BYOK 结算（unified-credit-billing）
 *
 * 席位（你的第 2 点）：
 *  - 团队套餐价 = 基础套餐价(黑) + Σ 增购席位带单价(紫)。
 *  - 积分归集：租户共享池（CreditAccount ownerType=TENANT）+ 可选人均上限 perSeatCapCredits。
 *  - UI 仍按「每席等额」展示。
 *
 * BYOK（你的第 6 点）：
 *  - 月结 = 技术服务费(按档/席位) + 资源费(用量×系数)。
 */
import { prisma } from "@/lib/prisma";
import { TEAM_MIN_INCLUDED_SEATS } from "@/lib/billing/team-membership-config";

import {
  consumeCredits,
  InsufficientCreditsError,
  sumResourceFees,
  type AccountRef,
} from "./credit-account-service";

function num(v: unknown, fallback = 0): number {
  if (v == null) return fallback;
  const n = typeof v === "number" ? v : Number(v.toString());
  return Number.isFinite(n) ? n : fallback;
}

function round2Local(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface TeamPlanQuote {
  planId: string;
  tier: string;
  basePriceYuan: number;
  includedSeats: number;
  extraSeats: number;
  extraSeatPriceYuan: number;
  totalPriceYuan: number;
  totalSeats: number;
  monthlyCreditsPool: number; // 共享池 = 每席积分 × 总席位
  perSeatCredits: number;
}

/** 选取覆盖 seatCount 的席位带（seatMin ≤ seatCount ≤ seatMax）。 */
function pickSeatTier(
  tiers: { seatMin: number; seatMax: number | null; perSeatPriceYuan: number; perSeatCredits: number }[],
  seatCount: number,
) {
  return (
    tiers.find((t) => seatCount >= t.seatMin && (t.seatMax == null || seatCount <= t.seatMax)) ??
    tiers[tiers.length - 1] ??
    null
  );
}

/** 计算团队套餐总价与共享积分池。 */
export async function quoteTeamPlan(input: {
  planId: string;
  totalSeats: number;
}): Promise<TeamPlanQuote> {
  const plan = await prisma.membershipPlan.findUnique({
    where: { id: input.planId },
    include: { seatTiers: { orderBy: { sortOrder: "asc" } } },
  });
  if (!plan) throw new Error(`套餐不存在：${input.planId}`);
  if (plan.family !== "TEAM") throw new Error("非团队套餐不支持席位计算");

  const minSeats = Math.max(TEAM_MIN_INCLUDED_SEATS, plan.includedSeats);
  const totalSeats = Math.max(minSeats, Math.round(input.totalSeats));

  const tiers = plan.seatTiers.map((t) => ({
    seatMin: t.seatMin,
    seatMax: t.seatMax,
    perSeatPriceYuan: num(t.perSeatPriceYuan),
    perSeatCredits: t.perSeatCredits,
  }));
  // 整单按席计价：命中席数所在量价档 → 每席价 × 席数（席数越多每席越便宜）
  const band = pickSeatTier(tiers, totalSeats);
  const perSeatPriceYuan = band?.perSeatPriceYuan ?? num(plan.priceYuan) / minSeats;
  const perSeatCredits = band?.perSeatCredits ?? plan.monthlyCredits;

  const basePriceYuan = num(plan.priceYuan);
  const totalPriceYuan = round2Local(perSeatPriceYuan * totalSeats);
  const extraSeats = Math.max(0, totalSeats - minSeats);
  const monthlyCreditsPool = perSeatCredits * totalSeats;

  return {
    planId: plan.id,
    tier: plan.tier,
    basePriceYuan,
    includedSeats: minSeats,
    extraSeats,
    extraSeatPriceYuan: perSeatPriceYuan,
    totalPriceYuan,
    totalSeats,
    monthlyCreditsPool,
    perSeatCredits,
  };
}

/** 某成员（actorUserId）本月已消耗积分（用于人均上限）。 */
export async function seatMonthlyConsumed(input: {
  tenantId: string;
  actorUserId: string;
  since: Date;
}): Promise<number> {
  const account = await prisma.creditAccount.findUnique({
    where: { ownerType_ownerId: { ownerType: "TENANT", ownerId: input.tenantId } },
    select: { id: true },
  });
  if (!account) return 0;
  const agg = await prisma.creditLedger.aggregate({
    where: {
      accountId: account.id,
      type: "CONSUME",
      actorUserId: input.actorUserId,
      createdAt: { gte: input.since },
    },
    _sum: { credits: true },
  });
  return Math.abs(num(agg._sum.credits, 0));
}

export class SeatCapExceededError extends Error {
  constructor(public readonly used: number, public readonly cap: number) {
    super(`席位人均额度超限：本月已用 ${used}，上限 ${cap}`);
    this.name = "SeatCapExceededError";
  }
}

/**
 * 团队共享池扣费（带人均上限）：
 *  - 校验该成员本月用量 + 本次 ≤ perSeatCapCredits（若设置）。
 *  - 从租户共享池扣 credits（actorUserId 记录到流水，便于人均统计/对成员展示）。
 */
export async function consumeTeamCredits(input: {
  tenantId: string;
  actorUserId: string;
  credits: number;
  seatId?: string | null;
  gatewayLogId?: string | null;
  canonicalModelKey?: string | null;
  costSnapshotYuan?: number | null;
  marginSnapshot?: number | null;
  periodStart: Date;
  /** 结算场景允许欠费（成功生成后扣费）。 */
  allowNegative?: boolean;
}) {
  const account = await prisma.creditAccount.findUnique({
    where: { ownerType_ownerId: { ownerType: "TENANT", ownerId: input.tenantId } },
  });
  const cap = account?.perSeatCapCredits ?? null;
  if (cap != null && !input.allowNegative) {
    const used = await seatMonthlyConsumed({
      tenantId: input.tenantId,
      actorUserId: input.actorUserId,
      since: input.periodStart,
    });
    if (used + input.credits > cap) {
      throw new SeatCapExceededError(used, cap);
    }
  }

  const ref: AccountRef = { ownerType: "TENANT", ownerId: input.tenantId };
  return consumeCredits({
    ref,
    credits: input.credits,
    actorUserId: input.actorUserId,
    seatId: input.seatId,
    gatewayLogId: input.gatewayLogId,
    canonicalModelKey: input.canonicalModelKey,
    costSnapshotYuan: input.costSnapshotYuan,
    marginSnapshot: input.marginSnapshot,
    allowNegative: input.allowNegative,
  });
}

export { InsufficientCreditsError };

// ——————————————————— BYOK 月结 ———————————————————

export interface ByokSettlement {
  periodKey: string;
  techServiceFeeYuan: number;
  resourceFeeYuan: number;
  totalYuan: number;
  resourceBreakdown: { resourceType: string; quantity: number; costYuan: number }[];
}

/**
 * BYOK 月结：仅资源费（积分换算 1.0 已退役技术服务费）。
 */
export async function settleByokMonthly(input: {
  ref: AccountRef;
  scopeKey: string;
  seats?: number;
  periodKey?: string;
}): Promise<ByokSettlement> {
  void input.scopeKey;
  void input.seats;
  const techServiceFeeYuan = 0;

  const resources = await sumResourceFees(input.ref, input.periodKey);
  const resourceFeeYuan = resources.totalYuan;

  return {
    periodKey: resources.periodKey,
    techServiceFeeYuan,
    resourceFeeYuan,
    totalYuan: techServiceFeeYuan + resourceFeeYuan,
    resourceBreakdown: resources.byType,
  };
}
