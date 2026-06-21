import type { ByokTaskKind, GatewayRequestLog } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  BYOK_SCOPE_PERSONAL,
  BYOK_SCOPE_TEAM_SEAT,
  BYOK_TEAM_MIN_SEATS,
  byokOverageCreditPool,
  mapLogToByokTaskKind,
} from "@/lib/billing/byok-pricing";
import { assertActiveByokSubscription } from "@/lib/billing/byok-subscription-service";
import {
  consumeCredits,
  getPoolBalances,
  InsufficientCreditsError,
  type AccountRef,
} from "@/lib/billing/credit-account-service";
import { recordBillingSettlement } from "@/lib/billing/billing-settlement-service";
import { classifyBillingCategory } from "@/lib/billing/billing-category";

function currentPeriodKey(d = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function resolveByokBillingRefFromLog(log: GatewayRequestLog): Promise<{
  ref: AccountRef;
  actorUserId: string | null;
  seatId: string | null;
} | null> {
  if (log.tenantId) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: log.tenantId },
      select: { type: true },
    });
    if (tenant?.type === "TEAM") {
      return {
        ref: { ownerType: "TENANT", ownerId: log.tenantId },
        actorUserId: log.actorBookUserId ?? null,
        seatId: log.seatId ?? null,
      };
    }
  }
  const bookUser = await prisma.user.findFirst({
    where: { gatewayApiKeyId: log.apiKeyId },
    select: { id: true },
  });
  const actorId = log.actorBookUserId ?? bookUser?.id ?? null;
  if (!actorId) return null;
  return {
    ref: { ownerType: "USER", ownerId: actorId },
    actorUserId: actorId,
    seatId: null,
  };
}

export async function resolveByokScope(ref: AccountRef): Promise<{
  scopeKey: string;
  seats: number;
}> {
  if (ref.ownerType === "USER") {
    return { scopeKey: BYOK_SCOPE_PERSONAL, seats: 1 };
  }
  const members = await prisma.tenantMember.count({
    where: { tenantId: ref.ownerId, status: "ACTIVE" },
  });
  const seats = Math.max(BYOK_TEAM_MIN_SEATS, members);
  return { scopeKey: BYOK_SCOPE_TEAM_SEAT, seats };
}

async function loadQuota(scopeKey: string, taskKind: ByokTaskKind) {
  return prisma.byokTaskQuota.findUnique({
    where: { scopeKey_taskKind: { scopeKey, taskKind } },
  });
}

/** BYOK 发起前：若将超额，检查对应积分池余额（视频 → VIDEO 加量包，其余 → GENERAL 轻量包）。 */
export async function assertByokQuotaBeforeGenerate(input: {
  tenantId?: string | null;
  actorBookUserId?: string | null;
  apiKeyId: string;
  requestKind?: string | null;
  inputSummary?: unknown;
}): Promise<void> {
  const taskKind = mapLogToByokTaskKind({
    requestKind: input.requestKind ?? "OTHER",
    inputSummary: input.inputSummary,
  });
  if (!taskKind) return;

  const ref = await resolveByokBillingRef({
    tenantId: input.tenantId,
    actorBookUserId: input.actorBookUserId,
    apiKeyId: input.apiKeyId,
  });
  if (!ref) return;

  await assertActiveByokSubscription(ref);

  const { scopeKey, seats } = await resolveByokScope(ref);
  const quota = await loadQuota(scopeKey, taskKind);
  if (!quota || !quota.active) return;

  const periodKey = currentPeriodKey();
  const row = await prisma.byokUsageMonthly.findUnique({
    where: {
      ownerType_ownerId_periodKey_taskKind: {
        ownerType: ref.ownerType,
        ownerId: ref.ownerId,
        periodKey,
        taskKind,
      },
    },
  });
  const used = (row?.includedUsed ?? 0) + (row?.overageUsed ?? 0);
  const limit = quota.monthlyIncluded * (scopeKey === BYOK_SCOPE_TEAM_SEAT ? seats : 1);

  if (used < limit) return;

  const pool = byokOverageCreditPool(taskKind);
  const pools = await getPoolBalances(ref);
  const needed = quota.overageCredits;
  const available =
    pool === "VIDEO" ? pools.video.balance : pools.general.balance;
  if (available < needed) {
    throw new InsufficientCreditsError(
      available,
      needed,
    );
  }
}

async function resolveByokBillingRef(input: {
  tenantId?: string | null;
  actorBookUserId?: string | null;
  apiKeyId: string;
}): Promise<AccountRef | null> {
  if (input.tenantId) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: input.tenantId },
      select: { type: true },
    });
    if (tenant?.type === "TEAM") {
      return { ownerType: "TENANT", ownerId: input.tenantId };
    }
  }
  const actorId =
    input.actorBookUserId ??
    (
      await prisma.user.findFirst({
        where: { gatewayApiKeyId: input.apiKeyId },
        select: { id: true },
      })
    )?.id;
  if (!actorId) return null;
  return { ownerType: "USER", ownerId: actorId };
}

export type ByokOverageResult = {
  taskKind: ByokTaskKind;
  scopeKey: string;
  isOverage: boolean;
  creditsCharged: number;
  includedUsed: number;
  overageUsed: number;
  monthlyIncluded: number;
  includedRemainingAfter: number;
};

function buildResultFromSettlement(
  settlement: {
    byokTaskKind: ByokTaskKind | null;
    isOverage: boolean;
    creditsCharged: number;
    includedUsedAfter: number | null;
    monthlyIncluded: number | null;
    includedRemainingAfter: number | null;
  },
  scopeKey: string,
): ByokOverageResult | null {
  if (!settlement.byokTaskKind) return null;
  return {
    taskKind: settlement.byokTaskKind,
    scopeKey,
    isOverage: settlement.isOverage,
    creditsCharged: settlement.creditsCharged,
    includedUsed: settlement.includedUsedAfter ?? 0,
    overageUsed: 0,
    monthlyIncluded: settlement.monthlyIncluded ?? 0,
    includedRemainingAfter: settlement.includedRemainingAfter ?? 0,
  };
}

async function findByokQuotaMeter(logId: string) {
  return prisma.resourceMeterEvent.findFirst({
    where: { refType: "gateway_log", refId: logId, resourceType: "TASK_COUNT" },
  });
}

/**
 * BYOK 成功结算：计入套餐额度或扣轻量包积分。
 * 返回扣分（0 = 套餐内免费）。
 */
export async function settleByokOverage(log: GatewayRequestLog): Promise<ByokOverageResult | null> {
  if (log.billingMode !== "BYOK") return null;

  const existingSettlement = await prisma.billingSettlementLine.findUnique({
    where: { gatewayLogId: log.id },
  });
  if (existingSettlement?.byokTaskKind) {
    const target = await resolveByokBillingRefFromLog(log);
    const scopeKey = target
      ? (await resolveByokScope(target.ref)).scopeKey
      : BYOK_SCOPE_PERSONAL;
    return buildResultFromSettlement(existingSettlement, scopeKey);
  }

  const taskKind = mapLogToByokTaskKind(log);
  if (!taskKind) {
    const target = await resolveByokBillingRefFromLog(log);
    if (target) {
      // TASK_COUNT 资源计量暂不启用（预充值模式无法后收调度费）
      await recordBillingSettlement({
        log,
        ref: target.ref,
        settlementKind: "METER_ONLY",
        creditsCharged: 0,
        billingCategory: classifyBillingCategory(log),
      }).catch(() => undefined);
    }
    return null;
  }

  const target = await resolveByokBillingRefFromLog(log);
  if (!target) return null;

  const { scopeKey, seats } = await resolveByokScope(target.ref);
  const quota = await loadQuota(scopeKey, taskKind);
  if (!quota || !quota.active) return null;

  const periodKey = currentPeriodKey();
  const limit = quota.monthlyIncluded * (scopeKey === BYOK_SCOPE_TEAM_SEAT ? seats : 1);

  const existingMeter = await findByokQuotaMeter(log.id);
  if (existingMeter) {
    const usageRow = await prisma.byokUsageMonthly.findUnique({
      where: {
        ownerType_ownerId_periodKey_taskKind: {
          ownerType: target.ref.ownerType,
          ownerId: target.ref.ownerId,
          periodKey,
          taskKind,
        },
      },
    });
    const includedUsed = usageRow?.includedUsed ?? log.includedUsedAfter ?? 0;
    const includedRemainingAfter =
      log.includedRemainingAfter ?? Math.max(0, limit - includedUsed);
    const repairResult: ByokOverageResult = {
      taskKind,
      scopeKey,
      isOverage: (usageRow?.includedUsed ?? 0) + (usageRow?.overageUsed ?? 0) >= limit,
      creditsCharged: log.creditsCharged ?? 0,
      includedUsed,
      overageUsed: usageRow?.overageUsed ?? 0,
      monthlyIncluded: limit,
      includedRemainingAfter,
    };
    await recordBillingSettlement({
      log,
      ref: target.ref,
      settlementKind: repairResult.isOverage ? "BYOK_QUOTA_OVERAGE" : "BYOK_QUOTA_INCLUDED",
      byokTaskKind: taskKind,
      billingCategory: taskKind,
      quotaDelta: repairResult.isOverage ? 0 : 1,
      monthlyIncluded: limit,
      includedUsedAfter: repairResult.includedUsed,
      includedRemainingAfter: repairResult.includedRemainingAfter,
      isOverage: repairResult.isOverage,
      creditsCharged: repairResult.creditsCharged,
    }).catch(() => undefined);
    return repairResult;
  }

  // TASK_COUNT 资源计量暂不启用（预充值模式无法后收调度费）

  const result = await prisma.$transaction(async (tx) => {
    const row = await tx.byokUsageMonthly.upsert({
      where: {
        ownerType_ownerId_periodKey_taskKind: {
          ownerType: target.ref.ownerType,
          ownerId: target.ref.ownerId,
          periodKey,
          taskKind,
        },
      },
      create: {
        ownerType: target.ref.ownerType,
        ownerId: target.ref.ownerId,
        scopeKey,
        periodKey,
        taskKind,
        seatsSnapshot: seats,
        includedUsed: 0,
        overageUsed: 0,
        overageCredits: 0,
      },
      update: {},
    });

    const totalUsed = row.includedUsed + row.overageUsed;
    const isOverage = totalUsed >= limit;
    let creditsCharged = 0;

    if (!isOverage) {
      await tx.byokUsageMonthly.update({
        where: { id: row.id },
        data: { includedUsed: { increment: 1 } },
      });
    } else {
      creditsCharged = quota.overageCredits;
      await tx.byokUsageMonthly.update({
        where: { id: row.id },
        data: {
          overageUsed: { increment: 1 },
          overageCredits: { increment: creditsCharged },
        },
      });
    }

    const fresh = await tx.byokUsageMonthly.findUniqueOrThrow({
      where: { id: row.id },
    });

    return {
      taskKind,
      scopeKey,
      isOverage,
      creditsCharged,
      includedUsed: fresh.includedUsed,
      overageUsed: fresh.overageUsed,
      monthlyIncluded: limit,
      includedRemainingAfter: Math.max(0, limit - fresh.includedUsed),
    };
  });

  if (result.creditsCharged > 0) {
    const overagePool = byokOverageCreditPool(taskKind);
    const consumeRes = await consumeCredits({
      ref: target.ref,
      credits: result.creditsCharged,
      pool: overagePool,
      actorUserId: target.actorUserId,
      seatId: target.seatId,
      gatewayLogId: log.id,
      idempotencyKey: `byok_overage:${log.id}`,
      description: `BYOK 超额·${taskKind}`,
      allowNegative: false,
    });
    await prisma.gatewayRequestLog.update({
      where: { id: log.id },
      data: { creditsCharged: result.creditsCharged },
    });
    await recordBillingSettlement({
      log,
      ref: target.ref,
      settlementKind: "BYOK_QUOTA_OVERAGE",
      byokTaskKind: taskKind,
      billingCategory: taskKind,
      quotaDelta: 0,
      monthlyIncluded: limit,
      includedUsedAfter: result.includedUsed,
      includedRemainingAfter: result.includedRemainingAfter,
      isOverage: true,
      creditsCharged: result.creditsCharged,
      creditLedgerId: consumeRes.ledger.id,
    });
  } else {
    await recordBillingSettlement({
      log,
      ref: target.ref,
      settlementKind: "BYOK_QUOTA_INCLUDED",
      byokTaskKind: taskKind,
      billingCategory: taskKind,
      quotaDelta: 1,
      monthlyIncluded: limit,
      includedUsedAfter: result.includedUsed,
      includedRemainingAfter: result.includedRemainingAfter,
      isOverage: false,
      creditsCharged: 0,
    });
  }

  return result;
}
