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

import { sumResourceFees, type AccountRef } from "./credit-account-service";

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

  const allChannels = new Set<string>([...internalByCh.keys(), ...vendorByCh.keys()]);
  const diffs: ChannelReconciliationDiff[] = [];
  let totalInternal = 0;
  let totalVendor = 0;
  for (const channel of allChannels) {
    const internalCostYuan = internalByCh.get(channel) ?? 0;
    const vendorCostYuan = vendorByCh.get(channel) ?? 0;
    totalInternal += internalCostYuan;
    totalVendor += vendorCostYuan;
    const diffYuan = vendorCostYuan - internalCostYuan;
    const denom = vendorCostYuan || internalCostYuan || 1;
    const diffRate = diffYuan / denom;
    let status: ChannelReconciliationDiff["status"];
    if (internalCostYuan === 0) status = "MISSING_INTERNAL";
    else if (vendorCostYuan === 0) status = "MISSING_VENDOR";
    else if (Math.abs(diffRate) <= tolerance) status = "OK";
    else if (diffYuan > 0) status = "OVER";
    else status = "UNDER";
    diffs.push({
      channel,
      internalCostYuan: Math.round(internalCostYuan * 1e6) / 1e6,
      vendorCostYuan: Math.round(vendorCostYuan * 1e6) / 1e6,
      diffYuan: Math.round(diffYuan * 1e6) / 1e6,
      diffRate: Math.round(diffRate * 1e4) / 1e4,
      status,
    });
  }
  diffs.sort((a, b) => Math.abs(b.diffYuan) - Math.abs(a.diffYuan));
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

  const allKeys = new Set<string>([...internalByKey.keys(), ...vendorByKey.keys()]);
  const diffs: ReconciliationDiff[] = [];
  let totalInternal = 0;
  let totalVendor = 0;

  for (const key of allKeys) {
    const internalCostYuan = internalByKey.get(key) ?? 0;
    const vendorCostYuan = vendorByKey.get(key) ?? 0;
    totalInternal += internalCostYuan;
    totalVendor += vendorCostYuan;
    const diffYuan = vendorCostYuan - internalCostYuan;
    const denom = vendorCostYuan || internalCostYuan || 1;
    const diffRate = diffYuan / denom;

    let status: ReconciliationDiff["status"];
    if (internalCostYuan === 0) status = "MISSING_INTERNAL";
    else if (vendorCostYuan === 0) status = "MISSING_VENDOR";
    else if (Math.abs(diffRate) <= tolerance) status = "OK";
    else if (diffYuan > 0) status = "OVER";
    else status = "UNDER";

    diffs.push({
      canonicalModelKey: key,
      internalCostYuan: Math.round(internalCostYuan * 1e6) / 1e6,
      vendorCostYuan: Math.round(vendorCostYuan * 1e6) / 1e6,
      diffYuan: Math.round(diffYuan * 1e6) / 1e6,
      diffRate: Math.round(diffRate * 1e4) / 1e4,
      status,
    });
  }

  diffs.sort((a, b) => Math.abs(b.diffYuan) - Math.abs(a.diffYuan));
  return { diffs, totalInternal, totalVendor };
}

// ——————————————————— 用户对帐账单 ———————————————————

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

  return {
    periodKey: input.periodKey,
    granted,
    consumed,
    refunded,
    topup,
    net: granted + topup + refunded - consumed,
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

export type { AccountRef, CreditOwnerType };
