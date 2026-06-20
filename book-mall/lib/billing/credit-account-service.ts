/**
 * 统一积分计费 — 积分账户与流水（unified-credit-billing）
 *
 * 模式 A（平台 Key / 会员）：从 CreditAccount 扣 creditsCharged；失败/取消全额返还。
 * 模式 B（BYOK）：不扣积分，写 ResourceMeterEvent 计量，按月结算 BYOK 费。
 *
 * 所有写操作在事务内更新余额 + 落流水（含 balanceAfter 与幂等键）。
 */
import type { BillingPersona, CreditLedgerType, CreditOwnerType, CreditPool, Prisma, ResourceMeterType } from "@prisma/client";

import { isStaffRole } from "@/lib/billing/billing-persona";
import { buildGatewayLogWhereFromUsageQuery } from "@/lib/gateway/log-query-scope";
import { prisma } from "@/lib/prisma";

export interface AccountRef {
  ownerType: CreditOwnerType;
  ownerId: string;
}

/** 积分池：通用（文本/图像/其它）或视频专项。 */
export type PoolKind = CreditPool; // "GENERAL" | "VIDEO"

/** 池 → 账户字段映射（余额字段 / 冻结字段）。 */
function poolFields(pool: PoolKind): { balance: "balanceCredits" | "videoBalanceCredits"; reserved: "reservedCredits" | "videoReservedCredits" } {
  return pool === "VIDEO"
    ? { balance: "videoBalanceCredits", reserved: "videoReservedCredits" }
    : { balance: "balanceCredits", reserved: "reservedCredits" };
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

export interface PoolBalances {
  general: { balance: number; reserved: number };
  video: { balance: number; reserved: number };
  pricePerCreditYuan: number | null;
}

/** 读取双池余额与冻结、以及该账户档位单价快照。 */
export async function getPoolBalances(ref: AccountRef): Promise<PoolBalances> {
  const acc = await prisma.creditAccount.findUnique({
    where: { ownerType_ownerId: { ownerType: ref.ownerType, ownerId: ref.ownerId } },
    select: {
      balanceCredits: true,
      reservedCredits: true,
      videoBalanceCredits: true,
      videoReservedCredits: true,
      pricePerCreditYuan: true,
    },
  });
  return {
    general: { balance: acc?.balanceCredits ?? 0, reserved: acc?.reservedCredits ?? 0 },
    video: { balance: acc?.videoBalanceCredits ?? 0, reserved: acc?.videoReservedCredits ?? 0 },
    pricePerCreditYuan: acc?.pricePerCreditYuan != null ? Number(acc.pricePerCreditYuan) : null,
  };
}

/** 选择视频扣费的目标池：账户已分视频池（videoMonthlyGrant>0）走 VIDEO，否则回退 GENERAL。 */
export async function resolveVideoPool(ref: AccountRef): Promise<PoolKind> {
  const acc = await prisma.creditAccount.findUnique({
    where: { ownerType_ownerId: { ownerType: ref.ownerType, ownerId: ref.ownerId } },
    select: { videoMonthlyGrant: true, videoBalanceCredits: true },
  });
  const hasVideoPool = (acc?.videoMonthlyGrant ?? 0) > 0 || (acc?.videoBalanceCredits ?? 0) > 0;
  return hasVideoPool ? "VIDEO" : "GENERAL";
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
  credits: number; // 入正出负（对所选池余额字段的增减）
  /** 目标积分池（默认 GENERAL；视频走 VIDEO） */
  pool?: PoolKind;
  /** 冻结计数增减（reserve 入正，settle/release 入负） */
  reservedDelta?: number;
  actorUserId?: string | null;
  refType?: string | null;
  refId?: string | null;
  costSnapshotYuan?: number | null;
  marginSnapshot?: number | null;
  idempotencyKey?: string | null;
  description?: string | null;
  allowNegative?: boolean;
  staffFlag?: boolean;
  billingPersonaSnap?: BillingPersona | null;
}

async function resolveLedgerPersonaFields(input: LedgerWriteInput): Promise<{
  staffFlag: boolean;
  billingPersonaSnap: BillingPersona | null;
}> {
  if (input.staffFlag !== undefined && input.billingPersonaSnap !== undefined) {
    return { staffFlag: input.staffFlag, billingPersonaSnap: input.billingPersonaSnap };
  }
  const actorId = input.actorUserId;
  if (!actorId) {
    return {
      staffFlag: input.staffFlag ?? false,
      billingPersonaSnap: input.billingPersonaSnap ?? null,
    };
  }
  const user = await prisma.user.findUnique({
    where: { id: actorId },
    select: { role: true, billingPersona: true, billingPersonaLockedAt: true },
  });
  return {
    staffFlag: input.staffFlag ?? isStaffRole(user?.role),
    billingPersonaSnap:
      input.billingPersonaSnap ??
      (user?.billingPersonaLockedAt ? user.billingPersona : null),
  };
}

async function writeLedger(input: LedgerWriteInput) {
  const pool: PoolKind = input.pool ?? "GENERAL";
  const fields = poolFields(pool);
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

    const curBalance = (account[fields.balance] as number) ?? 0;
    const curReserved = (account[fields.reserved] as number) ?? 0;
    const balanceAfter = curBalance + input.credits;
    if (balanceAfter < 0 && !input.allowNegative) {
      throw new InsufficientCreditsError(curBalance, -input.credits);
    }
    const reservedAfter = Math.max(0, curReserved + (input.reservedDelta ?? 0));

    const updated = await tx.creditAccount.update({
      where: { id: account.id },
      data: {
        [fields.balance]: balanceAfter,
        [fields.reserved]: reservedAfter,
      } as Prisma.CreditAccountUpdateInput,
    });

    const personaFields = await resolveLedgerPersonaFields(input);

    const ledger = await tx.creditLedger.create({
      data: {
        accountId: account.id,
        type: input.type,
        credits: input.credits,
        balanceAfter,
        pool,
        actorUserId: input.actorUserId ?? null,
        refType: input.refType ?? null,
        refId: input.refId ?? null,
        costSnapshotYuan: input.costSnapshotYuan ?? null,
        idempotencyKey: input.idempotencyKey ?? null,
        description: input.description ?? null,
        staffFlag: personaFields.staffFlag,
        billingPersonaSnap: personaFields.billingPersonaSnap,
      },
    });

    return { ledger, balanceAfter: (updated[fields.balance] as number) ?? balanceAfter, deduped: false as const };
  });
}

/** 套餐发放（GRANT），用于开通/续费/月度重置。 */
export async function grantCredits(input: {
  ref: AccountRef;
  credits: number;
  monthlyGrantCredits?: number;
  /** 视频专项池发放额（>0 时启用双池） */
  videoCredits?: number;
  videoMonthlyGrantCredits?: number;
  /** 该档「每积分单价」快照（逐档积分换算用） */
  pricePerCreditYuan?: number | null;
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
    pool: "GENERAL",
    refType: "plan_grant",
    idempotencyKey: input.idempotencyKey,
    description: input.description ?? "套餐积分发放",
  });
  // 视频专项池发放（独立流水，pool=VIDEO）
  const videoCredits = Math.max(0, Math.round(input.videoCredits ?? 0));
  if (videoCredits > 0) {
    await writeLedger({
      ref: input.ref,
      type: "GRANT",
      credits: videoCredits,
      pool: "VIDEO",
      refType: "plan_grant",
      idempotencyKey: input.idempotencyKey ? `${input.idempotencyKey}:video` : null,
      description: (input.description ?? "套餐积分发放") + "（视频池）",
    });
  }
  await prisma.creditAccount.update({
    where: { ownerType_ownerId: { ownerType: input.ref.ownerType, ownerId: input.ref.ownerId } },
    data: {
      monthlyGrantCredits: input.monthlyGrantCredits ?? undefined,
      videoMonthlyGrant: input.videoMonthlyGrantCredits ?? undefined,
      pricePerCreditYuan: input.pricePerCreditYuan ?? undefined,
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
  /** 视频专项池月额度（缺省时沿用账户既有 videoMonthlyGrant）。 */
  videoMonthlyGrantCredits?: number;
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

  // 视频专项池同样按月「重置发放」（use-it-or-lose-it）：把视频余额拉回 videoMonthlyGrant。
  // 注意：冻结中（videoReservedCredits）不计入余额，重置只动 balance，不影响进行中的冻结。
  const videoTarget = Math.max(0, Math.round(input.videoMonthlyGrantCredits ?? account.videoMonthlyGrant ?? 0));
  const videoDelta = videoTarget - account.videoBalanceCredits;
  if (videoDelta !== 0) {
    await writeLedger({
      ref: input.ref,
      type: videoDelta > 0 ? "GRANT" : "EXPIRE",
      credits: videoDelta,
      pool: "VIDEO",
      refType: "monthly_grant",
      idempotencyKey: `${idempotencyKey}:video`,
      description: `月度积分重置·视频池（${input.periodKey}）`,
      allowNegative: true,
    });
  }

  await prisma.creditAccount.update({
    where: { ownerType_ownerId: { ownerType: input.ref.ownerType, ownerId: input.ref.ownerId } },
    data: {
      monthlyGrantCredits: target,
      videoMonthlyGrant: input.videoMonthlyGrantCredits ?? undefined,
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
  pool?: PoolKind;
  refType?: string;
  refId?: string;
  idempotencyKey?: string;
  description?: string | null;
}) {
  return writeLedger({
    ref: input.ref,
    type: "TOPUP",
    credits: Math.max(0, Math.round(input.credits)),
    pool: input.pool ?? "GENERAL",
    refType: input.refType ?? "topup_order",
    refId: input.refId,
    idempotencyKey: input.idempotencyKey,
    description: input.description ?? (input.pool === "VIDEO" ? "视频专项积分包充值" : "积分包充值"),
  });
}

/**
 * 生成扣费（CONSUME）。idempotencyKey 建议用 `gateway_log:<logId>`，避免重复扣。
 * 同时把 creditsCharged / billingMode 写回对应 GatewayRequestLog（若提供 gatewayLogId）。
 */
export async function consumeCredits(input: {
  ref: AccountRef;
  credits: number;
  pool?: PoolKind;
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
    pool: input.pool ?? "GENERAL",
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

// ——————————————————— 视频冻结扣费状态机（先冻结后渲染） ———————————————————

/**
 * 冻结预扣（RESERVE）：从目标池余额冻结 credits（balance−=c，reserved+=c）。
 * 余额不足抛 InsufficientCreditsError。幂等键 `reserve:<logId>`。
 */
export async function reserveCredits(input: {
  ref: AccountRef;
  credits: number;
  pool?: PoolKind;
  actorUserId?: string | null;
  gatewayLogId?: string | null;
  costSnapshotYuan?: number | null;
  idempotencyKey?: string | null;
  description?: string | null;
}) {
  const credits = Math.max(0, Math.round(input.credits));
  if (credits === 0) return null;
  return writeLedger({
    ref: input.ref,
    type: "RESERVE",
    credits: -credits,
    reservedDelta: credits,
    pool: input.pool ?? "GENERAL",
    actorUserId: input.actorUserId,
    refType: input.gatewayLogId ? "gateway_log" : "reserve",
    refId: input.gatewayLogId ?? null,
    costSnapshotYuan: input.costSnapshotYuan,
    idempotencyKey: input.idempotencyKey ?? (input.gatewayLogId ? `reserve:${input.gatewayLogId}` : null),
    description: input.description ?? "视频生成冻结预扣",
  });
}

/**
 * 冻结转实扣（SETTLE）：渲染成功，释放冻结计数（reserved−=c），余额在 RESERVE 时已扣，故不再动余额。
 * 同步写回 GatewayRequestLog 的 creditsCharged/成本/毛利快照。幂等键 `settle:<logId>`。
 */
export async function settleReserved(input: {
  ref: AccountRef;
  credits: number;
  pool?: PoolKind;
  actorUserId?: string | null;
  seatId?: string | null;
  gatewayLogId?: string | null;
  canonicalModelKey?: string | null;
  costSnapshotYuan?: number | null;
  marginSnapshot?: number | null;
  idempotencyKey?: string | null;
  description?: string | null;
}) {
  const credits = Math.max(0, Math.round(input.credits));
  if (credits === 0) return null;
  const res = await writeLedger({
    ref: input.ref,
    type: "SETTLE",
    credits: 0,
    reservedDelta: -credits,
    pool: input.pool ?? "GENERAL",
    actorUserId: input.actorUserId,
    refType: input.gatewayLogId ? "gateway_log" : "settle",
    refId: input.gatewayLogId ?? null,
    costSnapshotYuan: input.costSnapshotYuan,
    idempotencyKey: input.idempotencyKey ?? (input.gatewayLogId ? `settle:${input.gatewayLogId}` : null),
    description: input.description ?? "视频生成结算（冻结转实扣）",
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

/**
 * 解冻返还（RELEASE）：厂商全失败，返还冻结额（balance+=c，reserved−=c）。
 * 幂等键 `release:<logId>`。creditsCharged 置 0。
 */
export async function releaseReserved(input: {
  ref: AccountRef;
  credits: number;
  pool?: PoolKind;
  gatewayLogId?: string | null;
  idempotencyKey?: string | null;
  description?: string | null;
}) {
  const credits = Math.max(0, Math.round(input.credits));
  if (credits === 0) return null;
  const res = await writeLedger({
    ref: input.ref,
    type: "RELEASE",
    credits,
    reservedDelta: -credits,
    pool: input.pool ?? "GENERAL",
    refType: input.gatewayLogId ? "gateway_log" : "release",
    refId: input.gatewayLogId ?? null,
    idempotencyKey: input.idempotencyKey ?? (input.gatewayLogId ? `release:${input.gatewayLogId}` : null),
    description: input.description ?? "厂商失败解冻返还",
  });
  if (input.gatewayLogId && !res.deduped) {
    await prisma.gatewayRequestLog
      .update({ where: { id: input.gatewayLogId }, data: { creditsCharged: 0 } })
      .catch(() => undefined);
  }
  return res;
}

/** 人工校正积分（ADJUST），用于回补多扣等场景。 */
export async function adjustCredits(input: {
  ref: AccountRef;
  credits: number;
  pool?: PoolKind;
  actorUserId?: string | null;
  gatewayLogId?: string | null;
  idempotencyKey?: string | null;
  description?: string | null;
}) {
  const credits = Math.round(input.credits);
  if (credits === 0) return null;
  return writeLedger({
    ref: input.ref,
    type: "ADJUST",
    credits,
    pool: input.pool ?? "GENERAL",
    actorUserId: input.actorUserId,
    refType: input.gatewayLogId ? "gateway_log" : "adjust",
    refId: input.gatewayLogId ?? null,
    idempotencyKey: input.idempotencyKey ?? null,
    description: input.description ?? "积分校正",
  });
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
  /** Book User.id — 个人查 buildGatewayLogScopeForBookUser；团队须配合 tenantId */
  bookUserId?: string;
  tenantId?: string;
  from?: Date;
  to?: Date;
  model?: string;
  clientSource?: string;
  take?: number;
  skip?: number;
}

/** 细颗粒用量记录（按时间倒序），用于「用量中心」。 */
export async function listUsageRecords(q: UsageQuery) {
  const where = await buildGatewayLogWhereFromUsageQuery(q);

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
        billingPersonaSnap: true,
        staffFlag: true,
        tenantId: true,
        actorBookUserId: true,
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
  const where = await buildGatewayLogWhereFromUsageQuery(q);
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

/** 团队共享池积分流水（CreditAccount ownerType=TENANT）。 */
export async function listTenantLedger(input: {
  tenantId: string;
  actorUserId?: string | null;
  take?: number;
  skip?: number;
}) {
  const account = await prisma.creditAccount.findUnique({
    where: { ownerType_ownerId: { ownerType: "TENANT", ownerId: input.tenantId } },
    select: { id: true },
  });
  if (!account) {
    return { rows: [], total: 0 };
  }

  const where: Prisma.CreditLedgerWhereInput = { accountId: account.id };
  if (input.actorUserId) where.actorUserId = input.actorUserId;

  const [rows, total] = await Promise.all([
    prisma.creditLedger.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: input.take ?? 100,
      skip: input.skip ?? 0,
    }),
    prisma.creditLedger.count({ where }),
  ]);
  return { rows, total };
}
