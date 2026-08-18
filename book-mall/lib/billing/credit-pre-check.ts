/**
 * 生成前积分余额门禁（用完即停）。
 */
import { prisma } from "@/lib/prisma";
import {
  getAccountCreditBalances,
  InsufficientCreditsError,
} from "./credit-account-service";
import { computeChargeCredits } from "./gateway-credit-settlement";
import { isUnifiedCreditBillingActive } from "./unified-credit-flag";
import { resolveBillingCanonicalKey, resolveCostSnapshot } from "@/lib/gateway/credit-billing-guard";
import { computeUnifiedChargeCredits, videoBillableSeconds } from "@/lib/pricing/credit-pricing-formulas";
import { resolveTeamBillingFallbackTenantId } from "./resolve-team-billing-fallback";

export async function resolveBillingRef(input: {
  tenantId?: string | null;
  actorBookUserId?: string | null;
  apiKeyId: string;
}): Promise<{ ownerType: "USER" | "TENANT"; ownerId: string } | null> {
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

  const teamTenantId = await resolveTeamBillingFallbackTenantId(actorId);
  if (teamTenantId) {
    return { ownerType: "TENANT", ownerId: teamTenantId };
  }

  return { ownerType: "USER", ownerId: actorId };
}

/** 统一积分激活时：余额不足则拒绝发起生成（预检，非事后欠费）。 */
export async function assertCreditsBeforeGenerate(input: {
  tenantId?: string | null;
  actorBookUserId?: string | null;
  apiKeyId: string;
  model: string;
  requestKind?: string | null;
  inputSummary?: unknown;
}): Promise<void> {
  if (!isUnifiedCreditBillingActive()) return;

  // 私域人像库入库走火山 AK/SK · 不计平台积分
  if (input.model.trim().startsWith("portrait:")) return;

  const ref = await resolveBillingRef(input);
  if (!ref) return;

  const isVideo = input.requestKind === "VIDEO";
  const canonical = await resolveBillingCanonicalKey({
    modelKey: input.model,
    inputSummary: input.inputSummary,
  }).catch(() => null);

  const accountSnap = await getAccountCreditBalances(ref);
  const balance = Math.max(0, accountSnap.balance - accountSnap.reserved);
  let minNeeded = 1;

  if (canonical) {
    const costSnap = await resolveCostSnapshot(canonical).catch(() => null);
    if (costSnap) {
      if (isVideo) {
        const units = videoBillableSeconds(null);
        if (costSnap.creditsPerUnit && costSnap.creditsPerUnit > 0) {
          minNeeded = computeUnifiedChargeCredits({
            creditsPerUnit: costSnap.creditsPerUnit,
            units,
          });
        } else if (
          accountSnap.pricePerCreditYuan &&
          accountSnap.pricePerCreditYuan > 0 &&
          costSnap.listPriceYuan &&
          costSnap.listPriceYuan > 0
        ) {
          minNeeded = Math.max(
            1,
            Math.round((costSnap.listPriceYuan * units) / accountSnap.pricePerCreditYuan),
          );
        }
      } else {
        minNeeded = computeChargeCredits({
          snapshot: costSnap,
          units: 1,
          pricePerCreditYuan: accountSnap.pricePerCreditYuan,
        });
        if (minNeeded < 1) minNeeded = 1;
      }
    }
  }

  if (balance < minNeeded) {
    throw new InsufficientCreditsError(balance, minNeeded);
  }
}
