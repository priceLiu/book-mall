/**
 * Book 财务结算流水（非 Gateway 职责）。
 * Gateway 只记录调用；套餐扣次 / 积分扣减由 Book 在 finalize 后写入，供财务对帐。
 */
import type {
  BillingCategory,
  BillingSettlementKind,
  ByokTaskKind,
  GatewayRequestLog,
} from "@prisma/client";

import {
  billingCategoryLabel,
  classifyBillingCategory,
} from "@/lib/billing/billing-category";
import { extractTryonModelKey } from "@/lib/billing/byok-pricing";
import type { AccountRef } from "@/lib/billing/credit-account-service";
import { prisma } from "@/lib/prisma";

export type RecordBillingSettlementInput = {
  log: GatewayRequestLog;
  ref: AccountRef;
  settlementKind: BillingSettlementKind;
  byokTaskKind?: ByokTaskKind | null;
  billingCategory?: BillingCategory | null;
  quotaDelta?: number;
  monthlyIncluded?: number | null;
  includedUsedAfter?: number | null;
  includedRemainingAfter?: number | null;
  isOverage?: boolean;
  creditsCharged?: number;
  creditLedgerId?: string | null;
  feeDescription?: string | null;
};

function buildFeeDescription(input: RecordBillingSettlementInput): string {
  if (input.feeDescription) return input.feeDescription;
  const kind = input.settlementKind;
  const category =
    input.billingCategory ?? classifyBillingCategory(input.log);
  const catLabel = billingCategoryLabel(category);
  const remaining =
    input.includedRemainingAfter != null
      ? `，套餐剩余 ${input.includedRemainingAfter}`
      : "";
  switch (kind) {
    case "BYOK_QUOTA_INCLUDED":
      return `BYOK 套餐内 · ${catLabel} -1${remaining}`;
    case "BYOK_QUOTA_OVERAGE":
      return `BYOK 超额 · ${catLabel} 扣 ${input.creditsCharged ?? 0} 积分${remaining}`;
    case "PLATFORM_CREDIT":
      return `平台代付 · ${catLabel} · 扣 ${input.creditsCharged ?? 0} 积分`;
    case "PLATFORM_VIDEO":
      return `平台代付 · ${catLabel} · 视频扣 ${input.creditsCharged ?? 0} 积分`;
    case "METER_ONLY":
      return `BYOK 调用 · ${catLabel}（仅计量）`;
    case "NONE":
    default:
      return category === "OTHER" || category === "TEXT"
        ? `成功调用 · ${catLabel}（0 积分）`
        : "成功调用（无扣费/扣次）";
  }
}

/** 幂等：同一 gatewayLogId 只写一条结算流水，并镜像快照到 GatewayRequestLog。 */
export async function recordBillingSettlement(input: RecordBillingSettlementInput) {
  const log = input.log;
  const existing = await prisma.billingSettlementLine.findUnique({
    where: { gatewayLogId: log.id },
  });
  if (existing) return existing;

  const billingCategory =
    input.billingCategory ?? classifyBillingCategory(log);
  const tryonModelKey =
    log.requestKind === "TRYON" ? extractTryonModelKey(log) : null;
  const feeDescription = buildFeeDescription({ ...input, billingCategory });
  const creditsCharged = input.creditsCharged ?? 0;
  const quotaDelta = input.quotaDelta ?? 0;
  const periodKey = `${log.submittedAt.getUTCFullYear()}-${String(log.submittedAt.getUTCMonth() + 1).padStart(2, "0")}`;

  const line = await prisma.$transaction(async (tx) => {
    const created = await tx.billingSettlementLine.create({
      data: {
        gatewayLogId: log.id,
        ownerType: input.ref.ownerType,
        ownerId: input.ref.ownerId,
        actorBookUserId: log.actorBookUserId,
        periodKey,
        settlementKind: input.settlementKind,
        byokTaskKind: input.byokTaskKind ?? null,
        billingCategory,
        tryonModelKey,
        quotaDelta,
        monthlyIncluded: input.monthlyIncluded ?? null,
        includedUsedAfter: input.includedUsedAfter ?? null,
        includedRemainingAfter: input.includedRemainingAfter ?? null,
        isOverage: input.isOverage ?? false,
        creditsCharged,
        creditLedgerId: input.creditLedgerId ?? null,
        canonicalModelKey: log.canonicalModelKey ?? log.model ?? null,
        requestKind: log.requestKind,
        clientPage: log.clientPage,
        feeDescription,
        submittedAt: log.submittedAt,
      },
    });

    await tx.gatewayRequestLog.update({
      where: { id: log.id },
      data: {
        settlementKind: input.settlementKind,
        byokTaskKind: input.byokTaskKind ?? null,
        billingCategory,
        quotaDelta: quotaDelta > 0 ? quotaDelta : null,
        includedUsedAfter: input.includedUsedAfter ?? null,
        includedRemainingAfter: input.includedRemainingAfter ?? null,
        creditsCharged: creditsCharged > 0 ? creditsCharged : log.creditsCharged,
      },
    });

    return created;
  });

  return line;
}

export async function loadBillingSettlementsByLogIds(gatewayLogIds: string[]) {
  if (gatewayLogIds.length === 0) return new Map();
  const rows = await prisma.billingSettlementLine.findMany({
    where: { gatewayLogId: { in: gatewayLogIds } },
  });
  return new Map(rows.map((r) => [r.gatewayLogId, r]));
}
