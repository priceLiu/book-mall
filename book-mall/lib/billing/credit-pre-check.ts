/**
 * 生成前积分余额门禁（用完即停）。
 */
import { prisma } from "@/lib/prisma";
import {
  getAccountCreditBalances,
  InsufficientCreditsError,
  spendableCreditBalance,
  type AccountRef,
} from "./credit-account-service";
import { computeChargeCredits } from "./gateway-credit-settlement";
import { isUnifiedCreditBillingActive } from "./unified-credit-flag";
import { resolveBillingCanonicalKey, resolveCostSnapshot } from "@/lib/gateway/credit-billing-guard";
import { parseVideoPricingHints } from "@/lib/gateway/log-pricing-hints";
import { computeUnifiedChargeCredits, videoBillableSeconds } from "@/lib/pricing/credit-pricing-formulas";
import { resolveTeamBillingFallbackTenantId } from "./resolve-team-billing-fallback";
import { isPlatformOperationalApiKey } from "@/lib/gateway/platform-operational-api-key";

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

/**
 * 团队项目预检：团队池不够但个人池足够时，回落个人扣费（与主站充值默认进个人池一致）。
 * 返回写入 Gateway 日志的 tenantId（个人回落时为 null）。
 */
export function pickGenerationBillingPool(input: {
  teamSpendable: number;
  personalSpendable: number;
  minNeeded: number;
}): "team" | "personal" {
  if (input.teamSpendable >= input.minNeeded) return "team";
  if (input.personalSpendable >= input.minNeeded) return "personal";
  return input.personalSpendable > input.teamSpendable ? "personal" : "team";
}

export async function resolveGenerationBillingOwnerRef(input: {
  actorBookUserId: string;
  preferredTeamTenantId?: string | null;
  minNeeded: number;
}): Promise<{ ref: AccountRef; gatewayTenantId: string | null }> {
  const actorId = input.actorBookUserId;
  const personalRef: AccountRef = { ownerType: "USER", ownerId: actorId };
  const personalSnap = await getAccountCreditBalances(personalRef).catch(() => ({
    balance: 0,
    reserved: 0,
    pricePerCreditYuan: null,
  }));
  const personalSpendable = spendableCreditBalance(personalSnap);

  const preferred = input.preferredTeamTenantId?.trim() || null;
  if (preferred) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: preferred },
      select: { type: true, status: true },
    });
    if (tenant?.type === "TEAM" && tenant.status === "ACTIVE") {
      const teamRef: AccountRef = { ownerType: "TENANT", ownerId: preferred };
      const teamSnap = await getAccountCreditBalances(teamRef);
      const teamSpendable = spendableCreditBalance(teamSnap);
      const pool = pickGenerationBillingPool({
        teamSpendable,
        personalSpendable,
        minNeeded: input.minNeeded,
      });
      if (pool === "team") {
        return { ref: teamRef, gatewayTenantId: preferred };
      }
      return { ref: personalRef, gatewayTenantId: null };
    }
  }

  const teamFallback = await resolveTeamBillingFallbackTenantId(actorId);
  if (personalSpendable > 0) {
    return { ref: personalRef, gatewayTenantId: null };
  }
  if (teamFallback) {
    return {
      ref: { ownerType: "TENANT", ownerId: teamFallback },
      gatewayTenantId: teamFallback,
    };
  }
  return { ref: personalRef, gatewayTenantId: null };
}

export type AssertCreditsBeforeGenerateResult = {
  gatewayTenantId: string | null;
};

/** 统一积分激活时：余额不足则拒绝发起生成（预检，非事后欠费）。 */
export async function assertCreditsBeforeGenerate(input: {
  tenantId?: string | null;
  actorBookUserId?: string | null;
  apiKeyId: string;
  model: string;
  requestKind?: string | null;
  inputSummary?: unknown;
}): Promise<AssertCreditsBeforeGenerateResult | void> {
  if (!isUnifiedCreditBillingActive()) return;

  // 平台代付（AI 小智、AI 资讯等）走 Platform Admin Key，不扣用户积分
  if (await isPlatformOperationalApiKey(input.apiKeyId)) return;

  // 私域人像库入库走火山 AK/SK · 不计平台积分
  if (input.model.trim().startsWith("portrait:")) return;

  const provisionalRef = await resolveBillingRef(input);
  if (!provisionalRef) return;

  const actorId =
    input.actorBookUserId ??
    (
      await prisma.user.findFirst({
        where: { gatewayApiKeyId: input.apiKeyId },
        select: { id: true },
      })
    )?.id;
  if (!actorId) return;

  const isVideo = input.requestKind === "VIDEO";
  const canonical = await resolveBillingCanonicalKey({
    modelKey: input.model,
    inputSummary: input.inputSummary,
  }).catch(() => null);

  const provisionalSnap = await getAccountCreditBalances(provisionalRef);
  let minNeeded = 1;

  if (canonical) {
    const costSnap = await resolveCostSnapshot(canonical, {
      tierRaw: isVideo ? parseVideoPricingHints(input.inputSummary).tierRaw : undefined,
    }).catch(() => null);
    if (costSnap) {
      if (isVideo) {
        const units = videoBillableSeconds(null);
        if (costSnap.creditsPerUnit && costSnap.creditsPerUnit > 0) {
          minNeeded = computeUnifiedChargeCredits({
            creditsPerUnit: costSnap.creditsPerUnit,
            units,
          });
        } else if (
          provisionalSnap.pricePerCreditYuan &&
          provisionalSnap.pricePerCreditYuan > 0 &&
          costSnap.listPriceYuan &&
          costSnap.listPriceYuan > 0
        ) {
          minNeeded = Math.max(
            1,
            Math.round(
              (costSnap.listPriceYuan * units) / provisionalSnap.pricePerCreditYuan,
            ),
          );
        }
      } else {
        minNeeded = computeChargeCredits({
          snapshot: costSnap,
          units: 1,
          pricePerCreditYuan: provisionalSnap.pricePerCreditYuan,
        });
        if (minNeeded < 1) minNeeded = 1;
      }
    }
  }

  const { ref, gatewayTenantId } = await resolveGenerationBillingOwnerRef({
    actorBookUserId: actorId,
    preferredTeamTenantId: input.tenantId,
    minNeeded,
  });

  const accountSnap = await getAccountCreditBalances(ref);
  const balance = spendableCreditBalance(accountSnap);
  if (balance < minNeeded) {
    throw new InsufficientCreditsError(balance, minNeeded);
  }

  return { gatewayTenantId };
}
