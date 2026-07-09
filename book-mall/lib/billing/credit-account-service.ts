/**
 * 统一积分计费 — 积分账户与流水（unified-credit-billing）
 *
 * 模式 A（平台 Key / 会员）：从 CreditAccount 扣 creditsCharged；失败/取消全额返还。
 * 模式 B（BYOK）：不扣积分，写 ResourceMeterEvent 计量，按月结算 BYOK 费。
 *
 * 所有写操作在事务内更新余额 + 落流水（含 balanceAfter 与幂等键）。
 */
import { createHash } from "node:crypto";

import { Prisma, type BillingPersona, type CreditLedgerType, type CreditOwnerType, type CreditPool, type CreditSource, type ResourceMeterType } from "@prisma/client";
import {
  addDays,
  addMonths,
  computeOwnedDelta,
  FREE_VALIDITY_DAYS,
  type LotRow,
  monthPeriodKeyOf,
  planAllocation,
  planExpiry,
  planRestoreTargetId,
  TOPUP_VALIDITY_MONTHS,
} from "./credit-lot-logic";

export { TOPUP_VALIDITY_MONTHS, FREE_VALIDITY_DAYS, addDays, addMonths } from "./credit-lot-logic";

import { isStaffRole } from "@/lib/billing/billing-persona";
import { buildGatewayLogWhereFromUsageQuery } from "@/lib/gateway/log-query-scope";
import {
  BILLING_DB_TX_OPTIONS,
  runTxWithRetry,
} from "@/lib/db-tx-retry";
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

// ——————————————————— 积分批次（CreditLot）到期覆盖层 ———————————————————
//
// 账户池余额（balanceCredits / videoBalanceCredits）仍为快路径真相；批次用于
//   1) 扣费优先级（先到期先扣）；2) 到期清扫。
// 不变量：sum(未过期 lot.remaining, pool) == 账户该池「已拥有」额度 = 可用余额 + 冻结中
//   （balance + reserved）。因此：
//   - RESERVE：balance−c、reserved+c → 已拥有不变 → 批次不动；
//   - RELEASE：reserved−c、balance+c → 已拥有不变 → 批次不动；
//   - CONSUME / SETTLE：已拥有−c → 从批次 FIFO 扣减；
//   - GRANT / TOPUP：已拥有+c → 建批次；REFUND：已拥有+c → 回补批次。

type TxClient = Prisma.TransactionClient;

/** 建新批次（GRANT/TOPUP/免费赠送）。 */
async function createLot(
  tx: TxClient,
  accountId: string,
  pool: PoolKind,
  amount: number,
  source: CreditSource,
  expiresAt: Date | null,
  periodKey: string | null,
  refType: string | null,
  refId: string | null,
): Promise<void> {
  if (amount <= 0) return;
  await tx.creditLot.create({
    data: {
      accountId,
      pool,
      source,
      originalCredits: amount,
      remainingCredits: amount,
      expiresAt: expiresAt ?? null,
      periodKey: periodKey ?? null,
      refType: refType ?? null,
      refId: refId ?? null,
    },
  });
}

/** 从未过期批次按「先到期先扣」FIFO 扣减 amount（消费/结算）。 */
async function allocateFromLots(
  tx: TxClient,
  accountId: string,
  pool: PoolKind,
  amount: number,
  now: Date,
): Promise<void> {
  if (amount <= 0) return;
  const lots = (await tx.creditLot.findMany({
    where: {
      accountId,
      pool,
      remainingCredits: { gt: 0 },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    select: { id: true, source: true, remainingCredits: true, expiresAt: true, grantedAt: true },
  })) as LotRow[];
  const { steps } = planAllocation(lots, amount);
  for (const step of steps) {
    await tx.creditLot.update({ where: { id: step.id }, data: { remainingCredits: step.newRemaining } });
  }
  // planAllocation.shortfall>0 表示批次不足（不变量漂移 / allowNegative 欠费）——由对账/清扫纠偏，不阻断。
}

/** 回补批次（REFUND / 正向 ADJUST）：优先加回最早到期的未过期批次；无则建永久批次。 */
async function restoreToLots(
  tx: TxClient,
  accountId: string,
  pool: PoolKind,
  amount: number,
  now: Date,
): Promise<void> {
  if (amount <= 0) return;
  const lots = (await tx.creditLot.findMany({
    where: {
      accountId,
      pool,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    select: { id: true, source: true, remainingCredits: true, expiresAt: true, grantedAt: true },
  })) as LotRow[];
  const targetId = planRestoreTargetId(lots);
  if (targetId) {
    const target = lots.find((l) => l.id === targetId)!;
    await tx.creditLot.update({
      where: { id: targetId },
      data: { remainingCredits: target.remainingCredits + amount },
    });
    return;
  }
  await createLot(tx, accountId, pool, amount, "TOPUP", null, null, "refund_restore", null);
}

/**
 * 事务内：按本条流水的「已拥有额度变化」同步批次。
 * ownedDelta = credits + reservedDelta（见文件头不变量说明）。
 */
async function syncLotsForLedger(
  tx: TxClient,
  accountId: string,
  input: LedgerWriteInput,
  now: Date,
): Promise<void> {
  if (input.skipLotSync) return;
  const pool: PoolKind = input.pool ?? "GENERAL";
  const ownedDelta = computeOwnedDelta(input.credits, input.reservedDelta ?? 0);
  if (ownedDelta === 0) return; // RESERVE / RELEASE

  if (ownedDelta < 0) {
    await allocateFromLots(tx, accountId, pool, -ownedDelta, now);
    return;
  }
  // ownedDelta > 0：GRANT/TOPUP 带来源 → 建批次；否则（REFUND 等）→ 回补
  if (input.lotSource) {
    await createLot(
      tx,
      accountId,
      pool,
      ownedDelta,
      input.lotSource,
      input.lotExpiresAt ?? null,
      input.lotPeriodKey ?? null,
      input.refType ?? null,
      input.refId ?? null,
    );
  } else {
    await restoreToLots(tx, accountId, pool, ownedDelta, now);
  }
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
  /** 批次覆盖层：增额时（GRANT/TOPUP/免费）建批次的来源与到期。缺省则正向增额按 REFUND 回补处理。 */
  lotSource?: CreditSource;
  lotExpiresAt?: Date | null;
  lotPeriodKey?: string | null;
  /** 跳过批次同步（清扫/月度重置等自行管理批次的场景）。 */
  skipLotSync?: boolean;
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

/**
 * Gen-HotCold-R2 Phase 3：按账户的 advisory 锁键。
 *
 * 同账户的 reserve/settle/release/refund/grant 在事务内先抢同一把 advisory 锁，
 * 把「同一 CreditAccount 行的并发争用 + P2034 重试」变成「有序排队」；
 * 不同账户键不同 → 互不阻塞。命名空间前缀避免与 canvas 任务锁等其它域冲突。
 */
function accountAdvisoryLockKeys(ref: AccountRef): [number, number] {
  const buf = createHash("sha256")
    .update(`credit-account:${ref.ownerType}:${ref.ownerId}`)
    .digest();
  return [buf.readInt32BE(0), buf.readInt32BE(4)];
}

async function writeLedger(input: LedgerWriteInput) {
  const pool: PoolKind = input.pool ?? "GENERAL";
  const fields = poolFields(pool);
  const now = new Date();
  // 幂等：相同 idempotencyKey 已存在则直接返回原流水
  if (input.idempotencyKey) {
    const existing = await prisma.creditLedger.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing) return { ledger: existing, balanceAfter: existing.balanceAfter, deduped: true as const };
  }

  const personaFields = await resolveLedgerPersonaFields(input);

  const [lockK1, lockK2] = accountAdvisoryLockKeys(input.ref);

  return runTxWithRetry(
    () =>
      prisma.$transaction(async (tx) => {
        // 同账户串行：先抢 advisory 锁，余额行的并发写不再相互重试雪崩。
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockK1}::int, ${lockK2}::int)`;

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

        let ledger;
        try {
          ledger = await tx.creditLedger.create({
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
        } catch (e) {
          if (
            input.idempotencyKey &&
            e instanceof Prisma.PrismaClientKnownRequestError &&
            e.code === "P2002"
          ) {
            const existing = await tx.creditLedger.findUnique({
              where: { idempotencyKey: input.idempotencyKey },
            });
            if (existing) {
              return {
                ledger: existing,
                balanceAfter: existing.balanceAfter,
                deduped: true as const,
              };
            }
          }
          throw e;
        }

        await syncLotsForLedger(tx, account.id, input, now);

        return {
          ledger,
          balanceAfter: (updated[fields.balance] as number) ?? balanceAfter,
          deduped: false as const,
        };
      }, BILLING_DB_TX_OPTIONS),
    { label: "writeLedger" },
  );
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
  /** 批次来源（默认 SUBSCRIPTION；VIP 大额可传 TOPUP）。 */
  lotSource?: CreditSource;
  /** 批次到期（默认 = currentPeriodEnd；传 null = 永久，如 VIP）。 */
  lotExpiresAt?: Date | null;
  lotPeriodKey?: string | null;
}) {
  const lotSource: CreditSource = input.lotSource ?? "SUBSCRIPTION";
  const lotExpiresAt =
    input.lotExpiresAt !== undefined ? input.lotExpiresAt : (input.currentPeriodEnd ?? null);
  const res = await writeLedger({
    ref: input.ref,
    type: "GRANT",
    credits: Math.max(0, Math.round(input.credits)),
    pool: "GENERAL",
    refType: "plan_grant",
    idempotencyKey: input.idempotencyKey,
    description: input.description ?? "套餐积分发放",
    lotSource,
    lotExpiresAt,
    lotPeriodKey: input.lotPeriodKey ?? null,
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
      lotSource,
      lotExpiresAt,
      lotPeriodKey: input.lotPeriodKey ?? null,
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

/** 过期某账户某池「订阅批次（上一周期）」：写 EXPIRE 减余额并把该批次归零。 */
async function expireSubscriptionLotsForPool(
  ref: AccountRef,
  accountId: string,
  pool: PoolKind,
  targetPeriodKey: string,
): Promise<number> {
  const fields = poolFields(pool);
  const oldLots = await prisma.creditLot.findMany({
    where: {
      accountId,
      pool,
      source: "SUBSCRIPTION",
      remainingCredits: { gt: 0 },
      OR: [{ periodKey: null }, { periodKey: { not: targetPeriodKey } }],
    },
    select: { id: true, remainingCredits: true },
  });
  const sum = oldLots.reduce((s, l) => s + l.remainingCredits, 0);
  if (sum <= 0) return 0;
  // 上一周期订阅积分 use-it-or-lose-it：全额清零（余额可能已被消费，故 allowNegative 防漏记）。
  await writeLedger({
    ref,
    type: "EXPIRE",
    credits: -sum,
    pool,
    refType: "monthly_reset_expire",
    description: `订阅积分月度清零（清上一周期，${pool}）`,
    allowNegative: true,
    skipLotSync: true,
  });
  await prisma.creditLot.updateMany({
    where: { id: { in: oldLots.map((l) => l.id) } },
    data: { remainingCredits: 0 },
  });
  return sum;
}

/**
 * 月度积分重置（会员周期刷新，见 14-tenant-team-design §8.3）。
 *
 * 批次化语义（积分清零 1.0）：**仅**清零并重发「订阅」积分，**保留**充值 / 免费批次。
 *   1) 过期上一周期订阅批次（写 EXPIRE、余额扣减、批次归零）；
 *   2) 按 monthlyGrantCredits / videoMonthlyGrant 发放新订阅批次（expiresAt=nextPeriodEnd，periodKey=目标周期）。
 * 幂等键 `monthly_grant:<accountId>:<periodKey>` 保证同周期重复执行不重复发放。
 * 年付套餐的订阅积分同样按「月」刷新（计费周期与积分刷新周期解耦）。
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
  const balanceBefore = account.balanceCredits;
  const target = Math.max(0, Math.round(input.monthlyGrantCredits));
  const videoTarget = Math.max(
    0,
    Math.round(input.videoMonthlyGrantCredits ?? account.videoMonthlyGrant ?? 0),
  );
  const idempotencyKey = `monthly_grant:${account.id}:${input.periodKey}`;

  // 1) 清零上一周期订阅批次（通用 + 视频）。
  await expireSubscriptionLotsForPool(input.ref, account.id, "GENERAL", input.periodKey);
  await expireSubscriptionLotsForPool(input.ref, account.id, "VIDEO", input.periodKey);

  // 2) 发放本周期订阅批次。
  let deduped = true;
  if (target > 0) {
    const res = await writeLedger({
      ref: input.ref,
      type: "GRANT",
      credits: target,
      pool: "GENERAL",
      refType: "monthly_grant",
      idempotencyKey,
      description: `月度积分发放（${input.periodKey}）`,
      lotSource: "SUBSCRIPTION",
      lotExpiresAt: input.nextPeriodEnd ?? null,
      lotPeriodKey: input.periodKey,
    });
    deduped = res.deduped;
  }
  if (videoTarget > 0) {
    await writeLedger({
      ref: input.ref,
      type: "GRANT",
      credits: videoTarget,
      pool: "VIDEO",
      refType: "monthly_grant",
      idempotencyKey: `${idempotencyKey}:video`,
      description: `月度积分发放·视频池（${input.periodKey}）`,
      lotSource: "SUBSCRIPTION",
      lotExpiresAt: input.nextPeriodEnd ?? null,
      lotPeriodKey: input.periodKey,
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

  return { deduped, target, videoTarget, balanceBefore };
}

// ——————————————————— 批次到期清扫 ———————————————————

/** 过期某账户已到期批次（expiresAt<=now），写 EXPIRE、批次归零、扣减余额（按池上限封顶不为负）。 */
export async function expireDueLotsForAccount(
  ref: AccountRef,
  now: Date = new Date(),
): Promise<{ expiredGeneral: number; expiredVideo: number }> {
  const account = await prisma.creditAccount.findUnique({
    where: { ownerType_ownerId: { ownerType: ref.ownerType, ownerId: ref.ownerId } },
    select: { id: true, balanceCredits: true, videoBalanceCredits: true },
  });
  if (!account) return { expiredGeneral: 0, expiredVideo: 0 };

  const out = { expiredGeneral: 0, expiredVideo: 0 };
  for (const pool of ["GENERAL", "VIDEO"] as const) {
    const available = pool === "VIDEO" ? account.videoBalanceCredits : account.balanceCredits;
    if (available <= 0) continue;
    const dueLots = await prisma.creditLot.findMany({
      where: { accountId: account.id, pool, remainingCredits: { gt: 0 }, expiresAt: { lte: now } },
      orderBy: { expiresAt: "asc" },
      select: { id: true, remainingCredits: true },
    });
    const { toExpire, steps } = planExpiry(dueLots, available);
    if (toExpire <= 0) continue;
    await writeLedger({
      ref,
      type: "EXPIRE",
      credits: -toExpire,
      pool,
      refType: "expire_sweep",
      description: `积分到期清零（${pool}）`,
      skipLotSync: true,
    });
    for (const step of steps) {
      await prisma.creditLot.update({ where: { id: step.id }, data: { remainingCredits: step.newRemaining } });
    }
    if (pool === "VIDEO") out.expiredVideo = toExpire;
    else out.expiredGeneral = toExpire;
  }
  return out;
}

/** 全站清扫：扫所有含到期批次的账户并逐一过期。返回处理账户数与清零总额。 */
export async function sweepExpiredLots(now: Date = new Date()): Promise<{
  accounts: number;
  totalExpired: number;
}> {
  const dueAccounts = await prisma.creditLot.findMany({
    where: { remainingCredits: { gt: 0 }, expiresAt: { lte: now } },
    distinct: ["accountId"],
    select: { accountId: true },
  });
  const accountIds = dueAccounts.map((a) => a.accountId);
  if (accountIds.length === 0) return { accounts: 0, totalExpired: 0 };

  const accounts = await prisma.creditAccount.findMany({
    where: { id: { in: accountIds } },
    select: { id: true, ownerType: true, ownerId: true },
  });
  let totalExpired = 0;
  for (const a of accounts) {
    const r = await expireDueLotsForAccount({ ownerType: a.ownerType, ownerId: a.ownerId }, now);
    totalExpired += r.expiredGeneral + r.expiredVideo;
  }
  return { accounts: accounts.length, totalExpired };
}

/**
 * 月度重置清扫：找出 currentPeriodEnd 已到期且有订阅月额度的账户，逐一按月刷新订阅积分。
 * 每次每账户只推进 1 个月；跨多月欠账由每日 cron 逐日追平。VIP（monthlyGrant=0 / period=null）不受影响。
 */
export async function runMonthlyResetSweep(now: Date = new Date()): Promise<{ reset: number }> {
  const due = await prisma.creditAccount.findMany({
    where: { currentPeriodEnd: { lte: now }, monthlyGrantCredits: { gt: 0 } },
    select: {
      ownerType: true,
      ownerId: true,
      monthlyGrantCredits: true,
      videoMonthlyGrant: true,
      currentPeriodEnd: true,
      planId: true,
      perSeatCapCredits: true,
    },
  });
  let reset = 0;
  for (const a of due) {
    const base = a.currentPeriodEnd ?? now;
    const nextEnd = addMonths(base, 1);
    // periodKey 取「本次刷新所属周期起点」的月份（= 旧 currentPeriodEnd 所在月），保证每次 catch-up 幂等键不同。
    const periodKey = monthPeriodKeyOf(base);
    await resetMonthlyCredits({
      ref: { ownerType: a.ownerType, ownerId: a.ownerId },
      monthlyGrantCredits: a.monthlyGrantCredits,
      videoMonthlyGrantCredits: a.videoMonthlyGrant,
      periodKey,
      planId: a.planId,
      nextPeriodEnd: nextEnd,
      perSeatCapCredits: a.perSeatCapCredits,
    });
    reset += 1;
  }
  return { reset };
}

/** 账户中心：按池 + 来源 + 最近到期展示批次明细（透明化）。 */
export async function getLotBreakdown(ref: AccountRef, now: Date = new Date()) {
  const account = await prisma.creditAccount.findUnique({
    where: { ownerType_ownerId: { ownerType: ref.ownerType, ownerId: ref.ownerId } },
    select: { id: true },
  });
  if (!account) return [];
  const lots = await prisma.creditLot.findMany({
    where: {
      accountId: account.id,
      remainingCredits: { gt: 0 },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    orderBy: [{ expiresAt: "asc" }],
    select: { pool: true, source: true, remainingCredits: true, expiresAt: true },
  });
  return lots.map((l) => ({
    pool: l.pool,
    source: l.source,
    remainingCredits: l.remainingCredits,
    expiresAt: l.expiresAt,
  }));
}

/**
 * 充值积分包（TOPUP）。
 * 批次来源默认 TOPUP、有效期默认 12 个月；注册/活动赠送传 source="FREE"（默认 30 天），
 * VIP 大额传 expiresAt=null（永久）。
 */
export async function topupCredits(input: {
  ref: AccountRef;
  credits: number;
  pool?: PoolKind;
  refType?: string;
  refId?: string;
  idempotencyKey?: string;
  description?: string | null;
  /** 批次来源（TOPUP / FREE）。默认 TOPUP。 */
  source?: CreditSource;
  /** 批次到期。undefined = 按 source 取默认（TOPUP=+12月 / FREE=+30天）；null = 永久。 */
  expiresAt?: Date | null;
}) {
  const source: CreditSource = input.source ?? "TOPUP";
  let lotExpiresAt: Date | null;
  if (input.expiresAt !== undefined) {
    lotExpiresAt = input.expiresAt;
  } else if (source === "FREE") {
    lotExpiresAt = addDays(new Date(), FREE_VALIDITY_DAYS);
  } else {
    lotExpiresAt = addMonths(new Date(), TOPUP_VALIDITY_MONTHS);
  }
  return writeLedger({
    ref: input.ref,
    type: "TOPUP",
    credits: Math.max(0, Math.round(input.credits)),
    pool: input.pool ?? "GENERAL",
    refType: input.refType ?? "topup_order",
    refId: input.refId,
    idempotencyKey: input.idempotencyKey,
    description: input.description ?? (input.pool === "VIDEO" ? "视频专项积分包充值" : "积分包充值"),
    lotSource: source,
    lotExpiresAt,
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
