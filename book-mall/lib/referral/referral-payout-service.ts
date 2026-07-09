/**
 * 返佣单（分享返佣结算）· 领域服务
 *
 * 返佣怎么返 / 何时返（结算口径）：
 *   - 计算基数：下线用户在「结算周期」内 **实付**（订单 status=PAID，按 paidAt 落账；
 *     paidAt 为空回退 createdAt）的「套餐订阅 + 轻量包充值」金额合计。
 *   - 返佣金额 = 计算基数 × 分享人当前返佣比例（出单时定格快照）。
 *   - 结算节奏：按自然月出单（次月为上月结算），财务也可自定义起止手动出单。
 *   - 流程：财务在后台选周期 → 计算(preview) → 生成返佣单(PENDING) → 线下打款后
 *     标记「已支付」(PAID)；可作废(VOID)。返佣单可导出 CSV 作为打款依据。
 *   - 幂等：同一 (分享人, periodKey) 只保留一张返佣单，重复生成为覆盖式 upsert
 *     （已支付/已作废的返佣单不被覆盖）。
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

import { maskPhone } from "./referral-service";

const PLAN_ORDER_TYPES: Prisma.OrderWhereInput["type"] = {
  in: ["SUBSCRIPTION", "MEMBERSHIP", "PRODUCT_SUBSCRIPTION", "BYOK_SERVICE_FEE"],
};
const RECHARGE_ORDER_TYPES: Prisma.OrderWhereInput["type"] = {
  in: ["WALLET_TOPUP", "CREDIT_TOPUP"],
};

/** 结算周期落账时间过滤：优先 paidAt，paidAt 为空回退 createdAt。 */
function periodDateWhere(start: Date, end: Date): Prisma.OrderWhereInput {
  return {
    OR: [
      { paidAt: { gte: start, lt: end } },
      { AND: [{ paidAt: null }, { createdAt: { gte: start, lt: end } }] },
    ],
  };
}

/** 自然月周期：periodKey=YYYY-MM → [start, end)。 */
export function monthPeriodRange(periodKey: string): { start: Date; end: Date } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(periodKey.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 1, 0, 0, 0, 0);
  return { start, end };
}

async function sumOrdersByUserInPeriod(
  userIds: string[],
  typeFilter: Prisma.OrderWhereInput["type"],
  start: Date,
  end: Date,
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (userIds.length === 0) return map;
  const agg = await prisma.order.groupBy({
    by: ["userId"],
    where: {
      userId: { in: userIds },
      status: "PAID",
      type: typeFilter,
      ...periodDateWhere(start, end),
    },
    _sum: { amountYuan: true },
  });
  for (const row of agg) {
    map.set(row.userId, Number(row._sum.amountYuan ?? 0));
  }
  return map;
}

export type ReferralPayoutPreviewRow = {
  referrerUserId: string;
  referrerName: string | null;
  referrerPhoneMasked: string;
  code: string;
  enabled: boolean;
  commissionRate: number;
  referredCount: number;
  planAmountYuan: number;
  rechargeAmountYuan: number;
  baseAmountYuan: number;
  commissionYuan: number;
  /** 该周期是否已生成返佣单及其状态 */
  existingStatus: "PENDING" | "PAID" | "VOID" | null;
};

/** 计算某周期各分享人应返佣（预览，不落库）。 */
export async function computeReferralPayoutPreview(
  periodKey: string,
): Promise<{ periodKey: string; rows: ReferralPayoutPreviewRow[] } | { error: string }> {
  const range = monthPeriodRange(periodKey);
  if (!range) return { error: "周期格式应为 YYYY-MM" };

  const profiles = await prisma.referralProfile.findMany({
    select: {
      referrerUserId: true,
      code: true,
      enabled: true,
      commissionRate: true,
      referrer: { select: { name: true, phone: true } },
    },
  });
  if (profiles.length === 0) return { periodKey, rows: [] };

  const referrerIds = profiles.map((p) => p.referrerUserId);
  const referred = await prisma.user.findMany({
    where: { referredByUserId: { in: referrerIds } },
    select: { id: true, referredByUserId: true },
  });
  const referrerToUsers = new Map<string, string[]>();
  for (const u of referred) {
    if (!u.referredByUserId) continue;
    const arr = referrerToUsers.get(u.referredByUserId) ?? [];
    arr.push(u.id);
    referrerToUsers.set(u.referredByUserId, arr);
  }

  const allReferredIds = referred.map((u) => u.id);
  const [planMap, rechargeMap] = await Promise.all([
    sumOrdersByUserInPeriod(allReferredIds, PLAN_ORDER_TYPES, range.start, range.end),
    sumOrdersByUserInPeriod(allReferredIds, RECHARGE_ORDER_TYPES, range.start, range.end),
  ]);

  const existing = await prisma.referralPayout.findMany({
    where: { periodKey },
    select: { referrerUserId: true, status: true },
  });
  const statusMap = new Map(existing.map((e) => [e.referrerUserId, e.status]));

  const rows: ReferralPayoutPreviewRow[] = profiles.map((p) => {
    const ids = referrerToUsers.get(p.referrerUserId) ?? [];
    const planAmountYuan = ids.reduce((s, id) => s + (planMap.get(id) ?? 0), 0);
    const rechargeAmountYuan = ids.reduce((s, id) => s + (rechargeMap.get(id) ?? 0), 0);
    const baseAmountYuan = planAmountYuan + rechargeAmountYuan;
    const commissionRate = Number(p.commissionRate);
    const periodActiveCount = ids.filter(
      (id) => (planMap.get(id) ?? 0) + (rechargeMap.get(id) ?? 0) > 0,
    ).length;
    return {
      referrerUserId: p.referrerUserId,
      referrerName: p.referrer?.name ?? null,
      referrerPhoneMasked: maskPhone(p.referrer?.phone),
      code: p.code,
      enabled: p.enabled,
      commissionRate,
      referredCount: periodActiveCount,
      planAmountYuan,
      rechargeAmountYuan,
      baseAmountYuan,
      commissionYuan: Math.round(baseAmountYuan * commissionRate * 100) / 100,
      existingStatus: statusMap.get(p.referrerUserId) ?? null,
    };
  });

  // 仅返回有消费或已有返佣单的行，避免噪声
  return {
    periodKey,
    rows: rows.filter((r) => r.baseAmountYuan > 0 || r.existingStatus != null),
  };
}

export type GenerateReferralPayoutsResult =
  | { ok: true; created: number; updated: number; skipped: number }
  | { ok: false; reason: string };

/** 生成/刷新某周期的返佣单（仅覆盖 PENDING；PAID/VOID 保留）。 */
export async function generateReferralPayouts(params: {
  periodKey: string;
  adminUserId: string;
}): Promise<GenerateReferralPayoutsResult> {
  const range = monthPeriodRange(params.periodKey);
  if (!range) return { ok: false, reason: "周期格式应为 YYYY-MM" };

  const preview = await computeReferralPayoutPreview(params.periodKey);
  if ("error" in preview) return { ok: false, reason: preview.error };

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of preview.rows) {
    if (row.commissionYuan <= 0 && row.existingStatus == null) {
      skipped += 1;
      continue;
    }
    const existing = await prisma.referralPayout.findUnique({
      where: {
        referrerUserId_periodKey: {
          referrerUserId: row.referrerUserId,
          periodKey: params.periodKey,
        },
      },
      select: { id: true, status: true },
    });
    if (existing && existing.status !== "PENDING") {
      skipped += 1; // 已支付/作废不覆盖
      continue;
    }
    const data = {
      periodStart: range.start,
      periodEnd: range.end,
      commissionRate: row.commissionRate,
      planAmountYuan: row.planAmountYuan,
      rechargeAmountYuan: row.rechargeAmountYuan,
      baseAmountYuan: row.baseAmountYuan,
      commissionYuan: row.commissionYuan,
      referredCount: row.referredCount,
    };
    if (existing) {
      await prisma.referralPayout.update({ where: { id: existing.id }, data });
      updated += 1;
    } else {
      await prisma.referralPayout.create({
        data: {
          referrerUserId: row.referrerUserId,
          periodKey: params.periodKey,
          status: "PENDING",
          createdByUserId: params.adminUserId,
          ...data,
        },
      });
      created += 1;
    }
  }
  return { ok: true, created, updated, skipped };
}

export type ReferralPayoutRow = {
  id: string;
  referrerUserId: string;
  referrerName: string | null;
  referrerPhoneMasked: string;
  periodKey: string;
  commissionRate: number;
  planAmountYuan: number;
  rechargeAmountYuan: number;
  baseAmountYuan: number;
  commissionYuan: number;
  referredCount: number;
  status: "PENDING" | "PAID" | "VOID";
  note: string | null;
  paidAt: Date | null;
  createdAt: Date;
};

/** 列出返佣单（可按 periodKey / status 过滤）。 */
export async function listReferralPayouts(params: {
  periodKey?: string;
  status?: "PENDING" | "PAID" | "VOID";
}): Promise<ReferralPayoutRow[]> {
  const rows = await prisma.referralPayout.findMany({
    where: {
      ...(params.periodKey ? { periodKey: params.periodKey } : {}),
      ...(params.status ? { status: params.status } : {}),
    },
    orderBy: [{ periodKey: "desc" }, { commissionYuan: "desc" }],
    select: {
      id: true,
      referrerUserId: true,
      periodKey: true,
      commissionRate: true,
      planAmountYuan: true,
      rechargeAmountYuan: true,
      baseAmountYuan: true,
      commissionYuan: true,
      referredCount: true,
      status: true,
      note: true,
      paidAt: true,
      createdAt: true,
      referrer: { select: { name: true, phone: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    referrerUserId: r.referrerUserId,
    referrerName: r.referrer?.name ?? null,
    referrerPhoneMasked: maskPhone(r.referrer?.phone),
    periodKey: r.periodKey,
    commissionRate: Number(r.commissionRate),
    planAmountYuan: Number(r.planAmountYuan),
    rechargeAmountYuan: Number(r.rechargeAmountYuan),
    baseAmountYuan: Number(r.baseAmountYuan),
    commissionYuan: Number(r.commissionYuan),
    referredCount: r.referredCount,
    status: r.status,
    note: r.note,
    paidAt: r.paidAt,
    createdAt: r.createdAt,
  }));
}

export type UpdatePayoutStatusResult = { ok: true } | { ok: false; reason: string };

/** 标记返佣单状态（PAID/VOID/PENDING）。 */
export async function updateReferralPayoutStatus(params: {
  id: string;
  status: "PENDING" | "PAID" | "VOID";
  adminUserId: string;
  note?: string | null;
}): Promise<UpdatePayoutStatusResult> {
  const existing = await prisma.referralPayout.findUnique({
    where: { id: params.id },
    select: { id: true },
  });
  if (!existing) return { ok: false, reason: "返佣单不存在" };
  await prisma.referralPayout.update({
    where: { id: params.id },
    data: {
      status: params.status,
      paidAt: params.status === "PAID" ? new Date() : null,
      paidByUserId: params.status === "PAID" ? params.adminUserId : null,
      ...(params.note !== undefined ? { note: params.note } : {}),
    },
  });
  return { ok: true };
}
