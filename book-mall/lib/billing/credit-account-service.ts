/**
 * 统一积分计费 — 积分账户与流水（unified-credit-billing）
 *
 * 模式 A（平台 Key / 会员）：从 CreditAccount 扣 creditsCharged；失败/取消全额返还。
 * 模式 B（BYOK）：不扣积分，写 ResourceMeterEvent 计量，按月结算 BYOK 费。
 *
 * 所有写操作在事务内更新余额 + 落流水（含 balanceAfter 与幂等键）。
 */
import type { CreditLedgerType, CreditOwnerType, Prisma, ResourceMeterType } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export interface AccountRef {
  ownerType: CreditOwnerType;
  ownerId: string;
}

/** 确保账户存在（个人或租户），返回账户。 */
export async function ensureCreditAccount(ref: AccountRef, planId?: string | null) {
  return prisma.creditAccount.upsert({
    where: { ownerType_ownerId: { ownerType: ref.ownerType, ownerId: ref.ownerId } },
    create: { ownerType: ref.ownerType, ownerId: ref.ownerId, planId: planId ?? null },
    update: {},
  });
}

export async function getCreditBalance(ref: AccountRef): Promise<number> {
  const acc = await prisma.creditAccount.findUnique({
    where: { ownerType_ownerId: { ownerType: ref.ownerType, ownerId: ref.ownerId } },
    select: { balanceCredits: true },
  });
  return acc?.balanceCredits ?? 0;
}

export class InsufficientCreditsError extends Error {
  constructor(public readonly balance: number, public readonly needed: number) {
    super(`积分不足：余额 ${balance}，需要 ${needed}`);
    this.name = "InsufficientCreditsError";
  }
}

interface LedgerWriteInput {
  ref: AccountRef;
  type: CreditLedgerType;
  credits: number; // 入正出负
  actorUserId?: string | null;
  refType?: string | null;
  refId?: string | null;
  costSnapshotYuan?: number | null;
  idempotencyKey?: string | null;
  description?: string | null;
  allowNegative?: boolean;
}

async function writeLedger(input: LedgerWriteInput) {
  // 幂等：相同 idempotencyKey 已存在则直接返回原流水
  if (input.idempotencyKey) {
    const existing = await prisma.creditLedger.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing) return { ledger: existing, balanceAfter: existing.balanceAfter, deduped: true as const };
  }

  return prisma.$transaction(async (tx) => {
    const account = await tx.creditAccount.upsert({
      where: { ownerType_ownerId: { ownerType: input.ref.ownerType, ownerId: input.ref.ownerId } },
      create: { ownerType: input.ref.ownerType, ownerId: input.ref.ownerId },
      update: {},
    });

    const balanceAfter = account.balanceCredits + input.credits;
    if (balanceAfter < 0 && !input.allowNegative) {
      throw new InsufficientCreditsError(account.balanceCredits, -input.credits);
    }

    const updated = await tx.creditAccount.update({
      where: { id: account.id },
      data: { balanceCredits: balanceAfter },
    });

    const ledger = await tx.creditLedger.create({
      data: {
        accountId: account.id,
        type: input.type,
        credits: input.credits,
        balanceAfter,
        actorUserId: input.actorUserId ?? null,
        refType: input.refType ?? null,
        refId: input.refId ?? null,
        costSnapshotYuan: input.costSnapshotYuan ?? null,
        idempotencyKey: input.idempotencyKey ?? null,
        description: input.description ?? null,
      },
    });

    return { ledger, balanceAfter: updated.balanceCredits, deduped: false as const };
  });
}

/** 套餐发放（GRANT），用于开通/续费/月度重置。 */
export async function grantCredits(input: {
  ref: AccountRef;
  credits: number;
  monthlyGrantCredits?: number;
  planId?: string | null;
  currentPeriodEnd?: Date | null;
  perSeatCapCredits?: number | null;
  idempotencyKey?: string | null;
  description?: string | null;
}) {
  const res = await writeLedger({
    ref: input.ref,
    type: "GRANT",
    credits: Math.max(0, Math.round(input.credits)),
    refType: "plan_grant",
    idempotencyKey: input.idempotencyKey,
    description: input.description ?? "套餐积分发放",
  });
  await prisma.creditAccount.update({
    where: { ownerType_ownerId: { ownerType: input.ref.ownerType, ownerId: input.ref.ownerId } },
    data: {
      monthlyGrantCredits: input.monthlyGrantCredits ?? undefined,
      planId: input.planId ?? undefined,
      currentPeriodEnd: input.currentPeriodEnd ?? undefined,
      perSeatCapCredits: input.perSeatCapCredits ?? undefined,
    },
  });
  return res;
}

/**
 * 月度积分重置（周期末「重置发放」，见 14-tenant-team-design §8.3）。
 *
 * 语义：把账户余额重置为 `monthlyGrantCredits`（会员月积分为 use-it-or-lose-it），
 * 通过一条差额流水实现：delta>0 记 GRANT，delta<0 记 EXPIRE（清零未用部分）。
 * 幂等键 `monthly_grant:<accountId>:<periodKey>` 保证同一周期重复执行不重复发放。
 * 年付套餐的积分同样按「月」刷新（计费周期与积分刷新周期解耦）。
 */
export async function resetMonthlyCredits(input: {
  ref: AccountRef;
  monthlyGrantCredits: number;
  periodKey: string; // 目标周期 YYYY-MM
  planId?: string | null;
  nextPeriodEnd?: Date | null;
  perSeatCapCredits?: number | null;
}) {
  const account = await ensureCreditAccount(input.ref, input.planId);
  const target = Math.max(0, Math.round(input.monthlyGrantCredits));
  const delta = target - account.balanceCredits;
  const idempotencyKey = `monthly_grant:${account.id}:${input.periodKey}`;

  let deduped = true;
  if (delta !== 0) {
    const res = await writeLedger({
      ref: input.ref,
      type: delta > 0 ? "GRANT" : "EXPIRE",
      credits: delta,
      refType: "monthly_grant",
      idempotencyKey,
      description: `月度积分重置（${input.periodKey}）`,
      allowNegative: true,
    });
    deduped = res.deduped;
  }

  await prisma.creditAccount.update({
    where: { ownerType_ownerId: { ownerType: input.ref.ownerType, ownerId: input.ref.ownerId } },
    data: {
      monthlyGrantCredits: target,
      planId: input.planId ?? undefined,
      currentPeriodEnd: input.nextPeriodEnd ?? undefined,
      perSeatCapCredits: input.perSeatCapCredits ?? undefined,
    },
  });

  return { deduped, delta, target, balanceBefore: account.balanceCredits };
}

/** 充值积分包（TOPUP）。 */
export async function topupCredits(input: {
  ref: AccountRef;
  credits: number;
  refType?: string;
  refId?: string;
  idempotencyKey?: string;
}) {
  return writeLedger({
    ref: input.ref,
    type: "TOPUP",
    credits: Math.max(0, Math.round(input.credits)),
    refType: input.refType ?? "topup_order",
    refId: input.refId,
    idempotencyKey: input.idempotencyKey,
    description: "积分包充值",
  });
}

/**
 * 生成扣费（CONSUME）。idempotencyKey 建议用 `gateway_log:<logId>`，避免重复扣。
 * 同时把 creditsCharged / billingMode 写回对应 GatewayRequestLog（若提供 gatewayLogId）。
 */
export async function consumeCredits(input: {
  ref: AccountRef;
  credits: number;
  actorUserId?: string | null;
  seatId?: string | null;
  costSnapshotYuan?: number | null;
  gatewayLogId?: string | null;
  canonicalModelKey?: string | null;
  marginSnapshot?: number | null;
  idempotencyKey?: string | null;
  description?: string | null;
  /** 结算场景：已成功生成后扣费，允许扣成负值（欠费），避免漏记。 */
  allowNegative?: boolean;
}) {
  const credits = Math.max(0, Math.round(input.credits));
  const res = await writeLedger({
    ref: input.ref,
    type: "CONSUME",
    credits: -credits,
    actorUserId: input.actorUserId,
    refType: input.gatewayLogId ? "gateway_log" : "consume",
    refId: input.gatewayLogId ?? null,
    costSnapshotYuan: input.costSnapshotYuan,
    idempotencyKey: input.idempotencyKey ?? (input.gatewayLogId ? `gateway_log:${input.gatewayLogId}` : null),
    description: input.description ?? "生成扣费",
    allowNegative: input.allowNegative,
  });

  if (input.gatewayLogId && !res.deduped) {
    await prisma.gatewayRequestLog
      .update({
        where: { id: input.gatewayLogId },
        data: {
          billingMode: "PLATFORM_CREDIT",
          creditsCharged: credits,
          seatId: input.seatId ?? undefined,
          canonicalModelKey: input.canonicalModelKey ?? undefined,
          costSnapshotYuan: input.costSnapshotYuan ?? undefined,
          marginSnapshot: input.marginSnapshot ?? undefined,
        },
      })
      .catch(() => undefined);
  }
  return res;
}

/** 失败/取消返还（REFUND）。幂等键建议 `refund:<logId>`。 */
export async function refundCredits(input: {
  ref: AccountRef;
  credits: number;
  gatewayLogId?: string | null;
  idempotencyKey?: string | null;
  description?: string | null;
}) {
  const credits = Math.max(0, Math.round(input.credits));
  if (credits === 0) return null;
  const res = await writeLedger({
    ref: input.ref,
    type: "REFUND",
    credits,
    refType: input.gatewayLogId ? "gateway_log" : "refund",
    refId: input.gatewayLogId ?? null,
    idempotencyKey: input.idempotencyKey ?? (input.gatewayLogId ? `refund:${input.gatewayLogId}` : null),
    description: input.description ?? "失败/取消返还",
  });
  if (input.gatewayLogId && !res.deduped) {
    await prisma.gatewayRequestLog
      .update({ where: { id: input.gatewayLogId }, data: { creditsCharged: 0 } })
      .catch(() => undefined);
  }
  return res;
}

// ——————————————————— BYOK 资源计量 ———————————————————

function periodKeyOf(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** 记录一条 BYOK 资源用量事件（OSS / 出网 / 任务数）。 */
export async function recordResourceMeter(input: {
  ref: AccountRef;
  resourceType: ResourceMeterType;
  quantity: number;
  refType?: string | null;
  refId?: string | null;
  periodKey?: string;
}) {
  const rate = await prisma.resourceMeterRate.findUnique({ where: { resourceType: input.resourceType } });
  const coef = rate ? Number(rate.coefficientYuan) : 0;
  const costYuan = input.quantity * coef;
  return prisma.resourceMeterEvent.create({
    data: {
      ownerType: input.ref.ownerType,
      ownerId: input.ref.ownerId,
      resourceType: input.resourceType,
      quantity: input.quantity,
      costYuan,
      refType: input.refType ?? null,
      refId: input.refId ?? null,
      periodKey: input.periodKey ?? periodKeyOf(),
    },
  });
}

/** 某账户某月 BYOK 资源费汇总。 */
export async function sumResourceFees(ref: AccountRef, periodKey = periodKeyOf()) {
  const events = await prisma.resourceMeterEvent.groupBy({
    by: ["resourceType"],
    where: { ownerType: ref.ownerType, ownerId: ref.ownerId, periodKey },
    _sum: { quantity: true, costYuan: true },
  });
  const byType = events.map((e) => ({
    resourceType: e.resourceType,
    quantity: Number(e._sum.quantity ?? 0),
    costYuan: Number(e._sum.costYuan ?? 0),
  }));
  const totalYuan = byType.reduce((s, b) => s + b.costYuan, 0);
  return { periodKey, byType, totalYuan };
}

// ——————————————————— 用量中心查询 ———————————————————

export interface UsageQuery {
  userId: string;
  from?: Date;
  to?: Date;
  model?: string;
  clientSource?: string;
  take?: number;
  skip?: number;
}

/** 细颗粒用量记录（按时间倒序），用于「用量中心」。 */
export async function listUsageRecords(q: UsageQuery) {
  const where: Prisma.GatewayRequestLogWhereInput = { userId: q.userId };
  if (q.from || q.to) {
    where.submittedAt = {};
    if (q.from) (where.submittedAt as Prisma.DateTimeFilter).gte = q.from;
    if (q.to) (where.submittedAt as Prisma.DateTimeFilter).lte = q.to;
  }
  if (q.model) where.canonicalModelKey = q.model;

  const [rows, total] = await Promise.all([
    prisma.gatewayRequestLog.findMany({
      where,
      orderBy: { submittedAt: "desc" },
      take: q.take ?? 50,
      skip: q.skip ?? 0,
      select: {
        id: true,
        model: true,
        canonicalModelKey: true,
        requestKind: true,
        status: true,
        clientSource: true,
        clientPage: true,
        billingMode: true,
        creditsCharged: true,
        costSnapshotYuan: true,
        marginSnapshot: true,
        submittedAt: true,
        completedAt: true,
      },
    }),
    prisma.gatewayRequestLog.count({ where }),
  ]);
  return { rows, total };
}

/** 用量按模型聚合（积分与次数）。 */
export async function aggregateUsageByModel(q: UsageQuery) {
  const where: Prisma.GatewayRequestLogWhereInput = { userId: q.userId };
  if (q.from || q.to) {
    where.submittedAt = {};
    if (q.from) (where.submittedAt as Prisma.DateTimeFilter).gte = q.from;
    if (q.to) (where.submittedAt as Prisma.DateTimeFilter).lte = q.to;
  }
  const grouped = await prisma.gatewayRequestLog.groupBy({
    by: ["canonicalModelKey"],
    where,
    _count: { _all: true },
    _sum: { creditsCharged: true },
  });
  return grouped
    .map((g) => ({
      canonicalModelKey: g.canonicalModelKey ?? "(未归口)",
      count: g._count._all,
      creditsCharged: Number(g._sum.creditsCharged ?? 0),
    }))
    .sort((a, b) => b.creditsCharged - a.creditsCharged);
}
