/**
 * Gateway 生成 → 统一积分结算（gateway-multi-credential-and-tenant · 里程碑 4）
 *
 * 在 finalizeRequestLog 中调用：
 *  - SUCCEEDED：按成本快照的 creditsPerUnit × 计费单位 扣减积分（个人账户 / 团队共享池）。
 *  - FAILED：按幂等键返还（若已扣）。
 *
 * 互斥：仅当 billingMode 解析为 PLATFORM_CREDIT 时扣积分；BYOK 走旧资源计量/月费，避免双扣。
 * 安全：扣费 allowNegative（成功后结算不阻断），永不向上抛错打断主流程；可用 CREDIT_BILLING_OFF=1 关闭。
 */
import type { CreditCostUnit, GatewayRequestLog } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { CostSnapshot } from "@/lib/gateway/credit-billing-guard";
import { resolveCostSnapshot, resolveCanonicalModelKey } from "@/lib/gateway/credit-billing-guard";
import {
  computeTierCredits,
  isVideoBillingUnit,
  videoBillableSeconds,
} from "@/lib/pricing/credit-pricing-formulas";
import {
  consumeCredits,
  getPoolBalances,
  refundCredits,
  releaseReserved,
  reserveCredits,
  resolveVideoPool,
  settleReserved,
  InsufficientCreditsError,
  type AccountRef,
  type PoolKind,
} from "./credit-account-service";
import { consumeTeamCredits } from "./seat-billing-service";
import { settleByokOverage } from "./byok-overage-service";
import { isUnifiedCreditBillingActive } from "./unified-credit-flag";

export function creditBillingEnabled(): boolean {
  return isUnifiedCreditBillingActive();
}

interface BillingTarget {
  kind: "USER" | "TEAM";
  ref: AccountRef;
  tenantId: string | null;
  actorUserId: string | null;
  seatId: string | null;
}

/** 该日志是否属于「视频」计费（按 requestKind 或单位 PER_SEC）。 */
function isVideoLog(log: { requestKind?: string | null }, unit?: CreditCostUnit | null): boolean {
  return log.requestKind === "VIDEO" || isVideoBillingUnit(unit ?? null);
}

/**
 * 逐档积分换算（方案 B-refined）：
 *   有档位单价快照 → credits = round(单位挂牌价 × 单位数 ÷ 档位单价)
 *   无快照（兼容旧账户） → 回退 creditsPerUnit × 单位数（锚定口径）
 */
export function computeChargeCredits(input: {
  snapshot: Pick<CostSnapshot, "listPriceYuan" | "creditsPerUnit">;
  units: number;
  pricePerCreditYuan: number | null;
}): number {
  const units = Math.max(1, input.units);
  const list = input.snapshot.listPriceYuan;
  if (input.pricePerCreditYuan && input.pricePerCreditYuan > 0 && list && list > 0) {
    return computeTierCredits(list * units, input.pricePerCreditYuan);
  }
  const cpu = input.snapshot.creditsPerUnit ?? 0;
  return Math.max(0, Math.round(cpu * units));
}

/** 解析某条日志的计费归属：团队共享池 or 个人账户。 */
export async function resolveLogBillingTarget(
  log: GatewayRequestLog,
): Promise<BillingTarget | null> {
  // 团队：日志显式带 tenantId 且该租户为 TEAM
  if (log.tenantId) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: log.tenantId },
      select: { type: true },
    });
    if (tenant?.type === "TEAM") {
      return {
        kind: "TEAM",
        ref: { ownerType: "TENANT", ownerId: log.tenantId },
        tenantId: log.tenantId,
        actorUserId: log.actorBookUserId ?? null,
        seatId: log.seatId ?? null,
      };
    }
  }
  // 个人：从 apiKey 关联的 Book 用户解析
  const bookUser = await prisma.user.findFirst({
    where: { gatewayApiKeyId: log.apiKeyId },
    select: { id: true },
  });
  const actorId = log.actorBookUserId ?? bookUser?.id ?? null;
  if (!actorId) return null;
  return {
    kind: "USER",
    ref: { ownerType: "USER", ownerId: actorId },
    tenantId: log.tenantId ?? null,
    actorUserId: actorId,
    seatId: null,
  };
}

function monthStartUtc(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

/** 计费单位数量：视频按秒、图片按张、LLM 按千 token。 */
export function billableUnitCount(
  unit: CreditCostUnit | null,
  metrics: {
    durationSec?: number | null;
    images?: number | null;
    totalTokens?: number | null;
  },
): number {
  switch (unit) {
    case "PER_SEC":
      // 财务 2.0：视频按秒计费，封顶 15s（业务恒传 15）
      return videoBillableSeconds(metrics.durationSec ?? null);
    case "PER_IMAGE":
      return Math.max(1, Math.round(metrics.images ?? 1));
    case "PER_KTOKEN":
      return Math.max(1, Math.ceil((metrics.totalTokens ?? 0) / 1000));
    default:
      return 1;
  }
}

/**
 * 成功结算积分。返回实际扣减积分（0 表示未扣）。
 * 仅在 PLATFORM_CREDIT 模式且存在 creditsPerUnit 报价时扣费。
 */
export async function settleSucceededGatewayLog(input: {
  log: GatewayRequestLog;
  snapshot: CostSnapshot | null;
  metrics: {
    durationSec?: number | null;
    images?: number | null;
    totalTokens?: number | null;
  };
}): Promise<number> {
  if (!creditBillingEnabled()) return 0;
  if (input.log.billingMode === "BYOK") {
    const r = await settleByokOverage(input.log);
    return r?.creditsCharged ?? 0;
  }

  const target = await resolveLogBillingTarget(input.log);
  if (!target) return 0;

  const snap = input.snapshot;
  const isVideo = isVideoLog(input.log, snap?.unit ?? null);

  // 视频：以 RESERVE 流水为唯一真值结算，避免「冻结额 ≠ 结算额」造成幻影冻结/重复扣。
  if (isVideo) {
    return settleVideoFromReserve(target, input.log, snap, input.metrics);
  }

  // 文本/图像：需有报价快照才扣费。
  if (!snap) return 0;

  const pools = await getPoolBalances(target.ref);
  const units = billableUnitCount(snap.unit, input.metrics);
  const credits = computeChargeCredits({
    snapshot: snap,
    units,
    pricePerCreditYuan: pools.pricePerCreditYuan,
  });
  if (credits === 0) return 0;

  try {
    if (target.kind === "TEAM") {
      await consumeTeamCredits({
        tenantId: target.ref.ownerId,
        actorUserId: target.actorUserId ?? target.ref.ownerId,
        credits,
        seatId: target.seatId,
        gatewayLogId: input.log.id,
        canonicalModelKey: snap.canonicalModelKey,
        costSnapshotYuan: snap.netCostYuan,
        marginSnapshot: snap.marginRate,
        periodStart: monthStartUtc(),
        allowNegative: true,
      });
    } else {
      await consumeCredits({
        ref: target.ref,
        credits,
        actorUserId: target.actorUserId,
        gatewayLogId: input.log.id,
        canonicalModelKey: snap.canonicalModelKey,
        costSnapshotYuan: snap.netCostYuan,
        marginSnapshot: snap.marginRate,
        allowNegative: true,
      });
    }
    return credits;
  } catch (e) {
    console.error("[credit-settlement] settle/consume 失败", input.log.id, e);
    return 0;
  }
}

/**
 * 视频结算：以发起时的 RESERVE 流水为冻结额真值。
 *  - 有 RESERVE：按冻结额 settle（reserve == settle，杜绝幻影冻结 / 重复扣 / 时长漂移）。
 *  - 无 RESERVE（冻结被跳过/为 0）：直接实扣，避免「成功却未扣费」漏记（需报价快照）。
 */
async function settleVideoFromReserve(
  target: BillingTarget,
  log: GatewayRequestLog,
  snap: CostSnapshot | null,
  metrics: { durationSec?: number | null; images?: number | null; totalTokens?: number | null },
): Promise<number> {
  const reserveLedger = await prisma.creditLedger.findUnique({
    where: { idempotencyKey: `reserve:${log.id}` },
    select: { credits: true, pool: true },
  });
  if (reserveLedger) {
    const frozen = Math.abs(reserveLedger.credits);
    if (frozen <= 0) return 0;
    try {
      await settleReserved({
        ref: target.ref,
        credits: frozen,
        pool: reserveLedger.pool,
        actorUserId: target.actorUserId,
        seatId: target.seatId,
        gatewayLogId: log.id,
        canonicalModelKey: snap?.canonicalModelKey ?? log.canonicalModelKey ?? null,
        costSnapshotYuan: snap?.netCostYuan ?? null,
        marginSnapshot: snap?.marginRate ?? null,
      });
      return frozen;
    } catch (e) {
      console.error("[credit-settlement] video settle 失败", log.id, e);
      return 0;
    }
  }

  if (!snap) return 0;
  const pools = await getPoolBalances(target.ref);
  const units = billableUnitCount(snap.unit, metrics);
  const credits = computeChargeCredits({
    snapshot: snap,
    units,
    pricePerCreditYuan: pools.pricePerCreditYuan,
  });
  if (credits <= 0) return 0;
  const pool: PoolKind = await resolveVideoPool(target.ref);
  try {
    await consumeCredits({
      ref: target.ref,
      credits,
      pool,
      actorUserId: target.actorUserId,
      seatId: target.seatId,
      gatewayLogId: log.id,
      canonicalModelKey: snap.canonicalModelKey,
      costSnapshotYuan: snap.netCostYuan,
      marginSnapshot: snap.marginRate,
      allowNegative: true,
    });
    return credits;
  } catch (e) {
    console.error("[credit-settlement] video consume(fallback) 失败", log.id, e);
    return 0;
  }
}

/**
 * 失败返还（幂等；未扣则 no-op）。
 *  - 视频：厂商失败 = 全额解冻返还（releaseReserved，按发起时冻结额）。
 *  - 文本/图像：保留「失败即退」（按已扣 creditsCharged 返还）。
 */
export async function refundFailedGatewayLog(
  log: GatewayRequestLog,
): Promise<void> {
  if (!creditBillingEnabled()) return;
  const target = await resolveLogBillingTarget(log);
  if (!target) return;

  // 视频：解冻返还（冻结额记录在 RESERVE 流水里）
  if (isVideoLog(log)) {
    const reserveLedger = await prisma.creditLedger.findUnique({
      where: { idempotencyKey: `reserve:${log.id}` },
      select: { credits: true, pool: true },
    });
    if (!reserveLedger) return; // 未冻结（如发起即失败）
    const frozen = Math.abs(reserveLedger.credits);
    if (frozen <= 0) return;
    try {
      await releaseReserved({
        ref: target.ref,
        credits: frozen,
        pool: reserveLedger.pool,
        gatewayLogId: log.id,
      });
    } catch (e) {
      console.error("[credit-settlement] video release 失败", log.id, e);
    }
    return;
  }

  // 文本/图像：失败即退（按已扣）
  if (!log.creditsCharged || log.creditsCharged <= 0) return;
  try {
    await refundCredits({
      ref: target.ref,
      credits: log.creditsCharged,
      gatewayLogId: log.id,
    });
  } catch (e) {
    console.error("[credit-settlement] refund 失败", log.id, e);
  }
}

/**
 * 视频发起时冻结预扣（先冻结后渲染）。在 createRequestLog 内、调厂商前调用。
 * 余额不足抛 InsufficientCreditsError（阻断发起）。返回冻结积分（0 = 未冻结）。
 */
export async function reserveVideoCreditsForLog(log: GatewayRequestLog): Promise<number> {
  if (!creditBillingEnabled()) return 0;
  if (log.billingMode === "BYOK") return 0;
  if (!isVideoLog(log)) return 0;

  const canonical = log.canonicalModelKey ?? (await resolveCanonicalModelKey(log.model).catch(() => null));
  if (!canonical) return 0;
  const snap = await resolveCostSnapshot(canonical);
  if (!snap) return 0;

  const target = await resolveLogBillingTarget(log);
  if (!target) return 0;

  const pools = await getPoolBalances(target.ref);
  // 视频固定按 15s 封顶冻结
  const units = videoBillableSeconds(null);
  const credits = computeChargeCredits({
    snapshot: snap,
    units,
    pricePerCreditYuan: pools.pricePerCreditYuan,
  });
  if (credits === 0) return 0;

  const pool = await resolveVideoPool(target.ref);
  await reserveCredits({
    ref: target.ref,
    credits,
    pool,
    actorUserId: target.actorUserId,
    gatewayLogId: log.id,
    costSnapshotYuan: snap.netCostYuan,
  });
  return credits;
}

export { InsufficientCreditsError };
