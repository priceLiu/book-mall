/**
 * 统一积分计费 — 对帐归口（unified-credit-billing 第 7 点）
 *
 * 厂商对帐：阿里/KIE/火山账单 → canonicalKey 归口 → 与 GatewayRequestLog 聚合比对 → 差异表。
 * 用户对帐：会员=积分流水账单；BYOK=技术服务费 + 资源费账单。
 *
 * 复用既有归口能力（ModelAlias/canonicalKeysByAliases）与现网 reconciliation 流程。
 */
import type { CreditOwnerType } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { canonicalKeysByAliases } from "@/lib/model-catalog/resolve";
import {
  BILLING_CATEGORY_ORDER,
  billingCategoryLabel,
  resolveBillingCategory,
} from "@/lib/billing/billing-category";
import { getTenantOverview } from "@/lib/tenant/tenant-service";

import { sumResourceFees, type AccountRef } from "./credit-account-service";
import { diffReconciliation } from "./reconciliation-diff";

function num(v: unknown, fallback = 0): number {
  if (v == null) return fallback;
  const n = typeof v === "number" ? v : Number(v.toString());
  return Number.isFinite(n) ? n : fallback;
}

function periodBounds(periodKey: string): { from: Date; to: Date } {
  const [y, m] = periodKey.split("-").map((s) => Number(s));
  const from = new Date(Date.UTC(y, (m ?? 1) - 1, 1));
  const to = new Date(Date.UTC(y, m ?? 1, 1));
  return { from, to };
}

export interface InternalModelCost {
  canonicalModelKey: string;
  count: number;
  internalCostYuan: number; // 成本快照优先，回退估算
}

/**
 * 平台内部口径：某月各 canonicalModelKey 的调用次数与成本合计。
 * 成本取 costSnapshotYuan（净成本快照），缺失回退 estimatedVendorCostYuan。
 */
export async function aggregateInternalCostByModel(periodKey: string): Promise<InternalModelCost[]> {
  const { from, to } = periodBounds(periodKey);
  const logs = await prisma.gatewayRequestLog.findMany({
    where: {
      submittedAt: { gte: from, lt: to },
      status: "SUCCEEDED",
    },
    select: {
      canonicalModelKey: true,
      model: true,
      costSnapshotYuan: true,
      estimatedVendorCostYuan: true,
    },
  });

  const map = new Map<string, InternalModelCost>();
  for (const l of logs) {
    const key = l.canonicalModelKey ?? l.model ?? "(未归口)";
    const cost = l.costSnapshotYuan != null ? num(l.costSnapshotYuan) : num(l.estimatedVendorCostYuan);
    const cur = map.get(key) ?? { canonicalModelKey: key, count: 0, internalCostYuan: 0 };
    cur.count += 1;
    cur.internalCostYuan += cost;
    map.set(key, cur);
  }
  return [...map.values()].sort((a, b) => b.internalCostYuan - a.internalCostYuan);
}

export interface ChannelCostRow {
  channel: string; // 渠道名（凭证 channel 快照），无则归「(未标渠道)」
  count: number;
  internalCostYuan: number;
  creditsCharged: number;
}

/**
 * 按渠道（凭证 channelSnapshot）聚合某月内部成本与积分（多 Key 渠道对账）。
 * tenantId 可选：仅统计某租户。
 */
export async function aggregateInternalCostByChannel(input: {
  periodKey: string;
  tenantId?: string | null;
}): Promise<ChannelCostRow[]> {
  const { from, to } = periodBounds(input.periodKey);
  const logs = await prisma.gatewayRequestLog.findMany({
    where: {
      submittedAt: { gte: from, lt: to },
      status: "SUCCEEDED",
      ...(input.tenantId ? { tenantId: input.tenantId } : {}),
    },
    select: {
      channelSnapshot: true,
      costSnapshotYuan: true,
      estimatedVendorCostYuan: true,
      creditsCharged: true,
    },
  });
  const map = new Map<string, ChannelCostRow>();
  for (const l of logs) {
    const channel = l.channelSnapshot?.trim() || "(未标渠道)";
    const cost =
      l.costSnapshotYuan != null ? num(l.costSnapshotYuan) : num(l.estimatedVendorCostYuan);
    const cur =
      map.get(channel) ?? { channel, count: 0, internalCostYuan: 0, creditsCharged: 0 };
    cur.count += 1;
    cur.internalCostYuan += cost;
    cur.creditsCharged += num(l.creditsCharged);
    map.set(channel, cur);
  }
  return [...map.values()].sort((a, b) => b.internalCostYuan - a.internalCostYuan);
}

export interface VendorBillRow {
  /** 厂商账单原始模型/计费项名（用于归口） */
  vendorModelName: string;
  /** 已知 canonicalKey（若调用方已归口可直接传） */
  canonicalModelKey?: string;
  /** 可选：厂商账单所属渠道（与凭证 channel 对齐），用于按渠道对账 */
  channel?: string;
  amountYuan: number;
}

export interface ChannelReconciliationDiff {
  channel: string;
  internalCostYuan: number;
  vendorCostYuan: number;
  diffYuan: number;
  diffRate: number;
  status: "OK" | "OVER" | "UNDER" | "MISSING_INTERNAL" | "MISSING_VENDOR";
}

/**
 * 按渠道对账：厂商账单（带 channel）vs 平台内部按 channelSnapshot 聚合成本。
 * 用于「同厂商多 Key」按渠道核对各自账单。
 */
export async function reconcileByChannel(input: {
  periodKey: string;
  vendorRows: { channel: string; amountYuan: number }[];
  tenantId?: string | null;
  toleranceRate?: number;
}): Promise<{ diffs: ChannelReconciliationDiff[]; totalInternal: number; totalVendor: number }> {
  const tolerance = input.toleranceRate ?? 0.05;
  const internal = await aggregateInternalCostByChannel({
    periodKey: input.periodKey,
    tenantId: input.tenantId,
  });
  const internalByCh = new Map(internal.map((i) => [i.channel, i.internalCostYuan]));
  const vendorByCh = new Map<string, number>();
  for (const r of input.vendorRows) {
    const ch = r.channel?.trim() || "(未标渠道)";
    vendorByCh.set(ch, (vendorByCh.get(ch) ?? 0) + r.amountYuan);
  }

  const { rows, totalInternal, totalVendor } = diffReconciliation(internalByCh, vendorByCh, tolerance);
  const diffs: ChannelReconciliationDiff[] = rows.map((r) => ({
    channel: r.key,
    internalCostYuan: r.internalCostYuan,
    vendorCostYuan: r.vendorCostYuan,
    diffYuan: r.diffYuan,
    diffRate: r.diffRate,
    status: r.status,
  }));
  return { diffs, totalInternal, totalVendor };
}

export interface ReconciliationDiff {
  canonicalModelKey: string;
  internalCostYuan: number;
  vendorCostYuan: number;
  diffYuan: number; // vendor - internal（正=厂商收的比我们记的多）
  diffRate: number; // diff / vendor
  status: "OK" | "OVER" | "UNDER" | "MISSING_INTERNAL" | "MISSING_VENDOR";
}

/**
 * 厂商账单 vs 平台内部成本对帐。
 * vendorRows 未提供 canonicalKey 时，按厂商产品名（VENDOR_PRODUCT_NAME）归口。
 */
export async function reconcileVendorBill(input: {
  periodKey: string;
  vendorRows: VendorBillRow[];
  toleranceRate?: number; // 默认 5% 内视为 OK
}): Promise<{ diffs: ReconciliationDiff[]; totalInternal: number; totalVendor: number }> {
  const tolerance = input.toleranceRate ?? 0.05;

  // 归口厂商行
  const needResolve = input.vendorRows.filter((r) => !r.canonicalModelKey);
  const resolved = await canonicalKeysByAliases(
    needResolve.map((r) => ({ source: "VENDOR_PRODUCT_NAME", aliasValue: r.vendorModelName })),
  );
  const vendorByKey = new Map<string, number>();
  for (const r of input.vendorRows) {
    const key =
      r.canonicalModelKey ??
      resolved.get(`VENDOR_PRODUCT_NAME::${r.vendorModelName.trim()}`) ??
      `(未归口)${r.vendorModelName}`;
    vendorByKey.set(key, (vendorByKey.get(key) ?? 0) + r.amountYuan);
  }

  const internal = await aggregateInternalCostByModel(input.periodKey);
  const internalByKey = new Map(internal.map((i) => [i.canonicalModelKey, i.internalCostYuan]));

  const { rows, totalInternal, totalVendor } = diffReconciliation(internalByKey, vendorByKey, tolerance);
  const diffs: ReconciliationDiff[] = rows.map((r) => ({
    canonicalModelKey: r.key,
    internalCostYuan: r.internalCostYuan,
    vendorCostYuan: r.vendorCostYuan,
    diffYuan: r.diffYuan,
    diffRate: r.diffRate,
    status: r.status,
  }));
  return { diffs, totalInternal, totalVendor };
}

// ——————————————————— 用户对帐账单 ———————————————————

/**
 * 视频「先冻结后渲染」的实扣记录来自 SETTLE 流水（credits=0，金额记在 GatewayRequestLog.creditsCharged）。
 * 这里把 SETTLE 还原为「按成员/按模型」的消耗行，供账单聚合（与 CONSUME 合并统计）。
 */
async function settleConsumptionRows(
  accountId: string,
  from: Date,
  to: Date,
): Promise<{ actorUserId: string | null; canonicalModelKey: string; credits: number }[]> {
  const rows = await prisma.creditLedger.findMany({
    where: { accountId, type: "SETTLE", createdAt: { gte: from, lt: to } },
    select: { actorUserId: true, refId: true },
  });
  const ids = rows.map((r) => r.refId).filter((x): x is string => Boolean(x));
  const logs = ids.length
    ? await prisma.gatewayRequestLog.findMany({
        where: { id: { in: ids } },
        select: { id: true, canonicalModelKey: true, model: true, creditsCharged: true },
      })
    : [];
  const byLog = new Map(logs.map((l) => [l.id, l]));
  return rows
    .map((r) => {
      const log = r.refId ? byLog.get(r.refId) : null;
      return {
        actorUserId: r.actorUserId ?? null,
        canonicalModelKey: log?.canonicalModelKey ?? log?.model ?? "(未归口)",
        credits: num(log?.creditsCharged, 0),
      };
    })
    .filter((r) => r.credits > 0);
}

export interface UserCreditBill {
  periodKey: string;
  granted: number;
  consumed: number;
  refunded: number;
  topup: number;
  net: number;
  byModel: { canonicalModelKey: string; credits: number; count: number }[];
}

/** 会员积分账单（某月）。 */
export async function buildUserCreditBill(input: {
  ref: AccountRef;
  periodKey: string;
}): Promise<UserCreditBill> {
  const { from, to } = periodBounds(input.periodKey);
  const account = await prisma.creditAccount.findUnique({
    where: { ownerType_ownerId: { ownerType: input.ref.ownerType, ownerId: input.ref.ownerId } },
    select: { id: true },
  });
  const empty: UserCreditBill = {
    periodKey: input.periodKey,
    granted: 0,
    consumed: 0,
    refunded: 0,
    topup: 0,
    net: 0,
    byModel: [],
  };
  if (!account) return empty;

  const entries = await prisma.creditLedger.groupBy({
    by: ["type"],
    where: { accountId: account.id, createdAt: { gte: from, lt: to } },
    _sum: { credits: true },
  });
  const sumOf = (t: string) => num(entries.find((e) => e.type === t)?._sum.credits, 0);
  const granted = sumOf("GRANT");
  const consumed = Math.abs(sumOf("CONSUME"));
  const refunded = sumOf("REFUND");
  const topup = sumOf("TOPUP");

  // 按模型（从 gateway_log 关联的扣费）
  const consumeLogs = await prisma.creditLedger.findMany({
    where: { accountId: account.id, type: "CONSUME", createdAt: { gte: from, lt: to }, refType: "gateway_log" },
    select: { credits: true, refId: true },
  });
  const logIds = consumeLogs.map((c) => c.refId).filter((x): x is string => Boolean(x));
  const logs = logIds.length
    ? await prisma.gatewayRequestLog.findMany({
        where: { id: { in: logIds } },
        select: { id: true, canonicalModelKey: true, model: true },
      })
    : [];
  const keyByLog = new Map(logs.map((l) => [l.id, l.canonicalModelKey ?? l.model ?? "(未归口)"]));
  const byModelMap = new Map<string, { credits: number; count: number }>();
  for (const c of consumeLogs) {
    const key = c.refId ? keyByLog.get(c.refId) ?? "(未归口)" : "(未归口)";
    const cur = byModelMap.get(key) ?? { credits: 0, count: 0 };
    cur.credits += Math.abs(num(c.credits));
    cur.count += 1;
    byModelMap.set(key, cur);
  }

  // 视频冻结结算（SETTLE）并入消耗与按模型统计
  const settleRows = await settleConsumptionRows(account.id, from, to);
  let videoConsumed = 0;
  for (const r of settleRows) {
    videoConsumed += r.credits;
    const cur = byModelMap.get(r.canonicalModelKey) ?? { credits: 0, count: 0 };
    cur.credits += r.credits;
    cur.count += 1;
    byModelMap.set(r.canonicalModelKey, cur);
  }
  const consumedTotal = consumed + videoConsumed;

  return {
    periodKey: input.periodKey,
    granted,
    consumed: consumedTotal,
    refunded,
    topup,
    net: granted + topup + refunded - consumedTotal,
    byModel: [...byModelMap.entries()]
      .map(([canonicalModelKey, v]) => ({ canonicalModelKey, credits: v.credits, count: v.count }))
      .sort((a, b) => b.credits - a.credits),
  };
}

export interface TeamMemberUsage {
  actorUserId: string;
  name: string | null;
  email: string | null;
  consumed: number; // 本月消耗积分（CONSUME 绝对值）
  count: number; // 生成次数
  byModel: { canonicalModelKey: string; credits: number; count: number }[];
}

export interface TeamCreditBill extends UserCreditBill {
  balanceCredits: number;
  monthlyGrantCredits: number;
  perSeatCapCredits: number | null;
  members: TeamMemberUsage[];
}

/**
 * 团队账单：租户共享池总账（发放/消耗/返还/充值 + 按模型）+ 按成员（actorUserId）下钻。
 * 复用 buildUserCreditBill 的总账口径，叠加成员维度。
 */
export async function buildTeamCreditBill(input: {
  tenantId: string;
  periodKey: string;
}): Promise<TeamCreditBill> {
  const ref: AccountRef = { ownerType: "TENANT", ownerId: input.tenantId };
  const base = await buildUserCreditBill({ ref, periodKey: input.periodKey });
  const { from, to } = periodBounds(input.periodKey);

  const account = await prisma.creditAccount.findUnique({
    where: { ownerType_ownerId: { ownerType: "TENANT", ownerId: input.tenantId } },
    select: { id: true, balanceCredits: true, monthlyGrantCredits: true, perSeatCapCredits: true },
  });

  let members: TeamMemberUsage[] = [];
  if (account) {
    // 成员维度消耗：CONSUME 流水按 actorUserId 分组
    const consume = await prisma.creditLedger.findMany({
      where: {
        accountId: account.id,
        type: "CONSUME",
        createdAt: { gte: from, lt: to },
      },
      select: { credits: true, actorUserId: true, refId: true, refType: true },
    });

    // 取关联日志的归口模型
    const logIds = consume
      .filter((c) => c.refType === "gateway_log" && c.refId)
      .map((c) => c.refId as string);
    const logs = logIds.length
      ? await prisma.gatewayRequestLog.findMany({
          where: { id: { in: logIds } },
          select: { id: true, canonicalModelKey: true, model: true },
        })
      : [];
    const keyByLog = new Map(
      logs.map((l) => [l.id, l.canonicalModelKey ?? l.model ?? "(未归口)"]),
    );

    const byMember = new Map<
      string,
      { consumed: number; count: number; byModel: Map<string, { credits: number; count: number }> }
    >();
    for (const c of consume) {
      const uid = c.actorUserId ?? "(系统)";
      const cur =
        byMember.get(uid) ?? { consumed: 0, count: 0, byModel: new Map() };
      const credits = Math.abs(num(c.credits));
      cur.consumed += credits;
      cur.count += 1;
      const key = c.refId ? keyByLog.get(c.refId) ?? "(未归口)" : "(未归口)";
      const mk = cur.byModel.get(key) ?? { credits: 0, count: 0 };
      mk.credits += credits;
      mk.count += 1;
      cur.byModel.set(key, mk);
      byMember.set(uid, cur);
    }

    // 视频冻结结算（SETTLE）按成员并入
    const settleRows = await settleConsumptionRows(account.id, from, to);
    for (const r of settleRows) {
      const uid = r.actorUserId ?? "(系统)";
      const cur = byMember.get(uid) ?? { consumed: 0, count: 0, byModel: new Map() };
      cur.consumed += r.credits;
      cur.count += 1;
      const mk = cur.byModel.get(r.canonicalModelKey) ?? { credits: 0, count: 0 };
      mk.credits += r.credits;
      mk.count += 1;
      cur.byModel.set(r.canonicalModelKey, mk);
      byMember.set(uid, cur);
    }

    const userIds = [...byMember.keys()].filter((u) => u !== "(系统)");
    const users = userIds.length
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, email: true },
        })
      : [];
    const profile = new Map(users.map((u) => [u.id, u]));

    members = [...byMember.entries()]
      .map(([actorUserId, v]) => ({
        actorUserId,
        name: profile.get(actorUserId)?.name ?? null,
        email: profile.get(actorUserId)?.email ?? null,
        consumed: v.consumed,
        count: v.count,
        byModel: [...v.byModel.entries()]
          .map(([canonicalModelKey, m]) => ({ canonicalModelKey, ...m }))
          .sort((a, b) => b.credits - a.credits),
      }))
      .sort((a, b) => b.consumed - a.consumed);
  }

  return {
    ...base,
    balanceCredits: account?.balanceCredits ?? 0,
    monthlyGrantCredits: account?.monthlyGrantCredits ?? 0,
    perSeatCapCredits: account?.perSeatCapCredits ?? null,
    members,
  };
}

export interface UserByokBill {
  periodKey: string;
  techServiceFeeYuan: number;
  resourceFeeYuan: number;
  totalYuan: number;
  resourceBreakdown: { resourceType: string; quantity: number; costYuan: number }[];
}

/** BYOK 用户账单（技术服务费 + 资源费）。techServiceFeeYuan 由调用方按档/席位传入。 */
export async function buildUserByokBill(input: {
  ref: AccountRef;
  periodKey: string;
  techServiceFeeYuan: number;
}): Promise<UserByokBill> {
  const resources = await sumResourceFees(input.ref, input.periodKey);
  return {
    periodKey: input.periodKey,
    techServiceFeeYuan: input.techServiceFeeYuan,
    resourceFeeYuan: resources.totalYuan,
    totalYuan: input.techServiceFeeYuan + resources.totalYuan,
    resourceBreakdown: resources.byType,
  };
}

export interface TeamDashboardPayload {
  periodKey: string;
  bill: TeamCreditBill;
  seatUsage: { used: number; limit: number };
  byCategory: { category: string; label: string; count: number; credits: number }[];
  dailyTrend: { date: string; credits: number; count: number }[];
  recentLogs: {
    id: string;
    submittedAt: string;
    actorUserId: string | null;
    actorName: string | null;
    canonicalModelKey: string | null;
    creditsCharged: number | null;
    status: string;
    billingMode: string | null;
  }[];
  vendorCostYuan?: number;
  note?: string;
}

/** 团队财务驾驶舱：聚合账单、七类分布、近 30 日趋势、近期流水。 */
export async function buildTeamDashboard(input: {
  tenantId: string;
  periodKey: string;
  includeCost?: boolean;
}): Promise<TeamDashboardPayload> {
  const { from, to } = periodBounds(input.periodKey);
  const trendFrom = new Date(to);
  trendFrom.setUTCDate(trendFrom.getUTCDate() - 30);

  const [bill, overview, logs, recentLogs] = await Promise.all([
    buildTeamCreditBill({ tenantId: input.tenantId, periodKey: input.periodKey }),
    getTenantOverview(input.tenantId),
    prisma.gatewayRequestLog.findMany({
      where: {
        tenantId: input.tenantId,
        submittedAt: { gte: from, lt: to },
        status: "SUCCEEDED",
      },
      select: {
        billingCategory: true,
        requestKind: true,
        inputSummary: true,
        creditsCharged: true,
        costSnapshotYuan: true,
        estimatedVendorCostYuan: true,
      },
    }),
    prisma.gatewayRequestLog.findMany({
      where: { tenantId: input.tenantId },
      orderBy: { submittedAt: "desc" },
      take: 50,
      select: {
        id: true,
        submittedAt: true,
        actorBookUserId: true,
        canonicalModelKey: true,
        model: true,
        creditsCharged: true,
        status: true,
        billingMode: true,
      },
    }),
  ]);

  const categoryMap = new Map<string, { count: number; credits: number }>();
  let vendorCostYuan = 0;
  for (const log of logs) {
    const cat = resolveBillingCategory(log, log.billingCategory);
    const label = billingCategoryLabel(cat);
    const cur = categoryMap.get(cat) ?? { count: 0, credits: 0 };
    cur.count += 1;
    cur.credits += num(log.creditsCharged);
    categoryMap.set(cat, cur);
    if (input.includeCost) {
      vendorCostYuan +=
        log.costSnapshotYuan != null ? num(log.costSnapshotYuan) : num(log.estimatedVendorCostYuan);
    }
  }

  const byCategory = BILLING_CATEGORY_ORDER.filter((c) => categoryMap.has(c)).map((c) => {
    const v = categoryMap.get(c)!;
    return { category: c, label: billingCategoryLabel(c), count: v.count, credits: v.credits };
  });

  const trendLogs = await prisma.gatewayRequestLog.findMany({
    where: {
      tenantId: input.tenantId,
      submittedAt: { gte: trendFrom, lt: to },
      status: "SUCCEEDED",
    },
    select: { submittedAt: true, creditsCharged: true },
  });
  const dailyMap = new Map<string, { credits: number; count: number }>();
  for (const log of trendLogs) {
    const date = log.submittedAt.toISOString().slice(0, 10);
    const cur = dailyMap.get(date) ?? { credits: 0, count: 0 };
    cur.credits += num(log.creditsCharged);
    cur.count += 1;
    dailyMap.set(date, cur);
  }
  const dailyTrend = [...dailyMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, ...v }));

  const actorIds = [
    ...new Set(recentLogs.map((l) => l.actorBookUserId).filter(Boolean)),
  ] as string[];
  const actors =
    actorIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, name: true, email: true },
        })
      : [];
  const actorMap = new Map(actors.map((u) => [u.id, u.name ?? u.email ?? u.id]));

  return {
    periodKey: input.periodKey,
    bill,
    seatUsage: {
      used: overview?.usedSeats ?? 0,
      limit: overview?.seatLimit ?? 0,
    },
    byCategory,
    dailyTrend,
    recentLogs: recentLogs.map((l) => ({
      id: l.id,
      submittedAt: l.submittedAt.toISOString(),
      actorUserId: l.actorBookUserId,
      actorName: l.actorBookUserId ? actorMap.get(l.actorBookUserId) ?? null : null,
      canonicalModelKey: l.canonicalModelKey ?? l.model,
      creditsCharged: l.creditsCharged,
      status: l.status,
      billingMode: l.billingMode,
    })),
    ...(input.includeCost ? { vendorCostYuan } : {}),
    note: "仅展示含团队 ID 的 Gateway 记录；历史无 tenantId 的调用不在此视图内。",
  };
}

export type { AccountRef, CreditOwnerType };
