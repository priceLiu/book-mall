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
import {
  consumeCredits,
  refundCredits,
  type AccountRef,
} from "./credit-account-service";
import { consumeTeamCredits } from "./seat-billing-service";
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

/** 解析某条日志的计费归属：团队共享池 or 个人账户。 */
async function resolveLogBillingTarget(
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
      return Math.max(1, Math.round(metrics.durationSec ?? 0) || 1);
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
  // BYOK 不走积分（避免与旧资源计量/月费双扣）
  if (input.log.billingMode === "BYOK") return 0;
  const snap = input.snapshot;
  if (!snap?.creditsPerUnit || snap.creditsPerUnit <= 0) return 0;

  const units = billableUnitCount(snap.unit, input.metrics);
  const credits = Math.max(0, Math.round(snap.creditsPerUnit * units));
  if (credits === 0) return 0;

  const target = await resolveLogBillingTarget(input.log);
  if (!target) return 0;

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
    console.error("[credit-settlement] consume 失败", input.log.id, e);
    return 0;
  }
}

/** 失败/取消返还（幂等；未扣则 no-op）。 */
export async function refundFailedGatewayLog(
  log: GatewayRequestLog,
): Promise<void> {
  if (!creditBillingEnabled()) return;
  if (!log.creditsCharged || log.creditsCharged <= 0) return;
  const target = await resolveLogBillingTarget(log);
  if (!target) return;
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
