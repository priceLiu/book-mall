/**
 * 生成前积分余额门禁（用完即停）。
 */
import { prisma } from "@/lib/prisma";
import {
  getCreditBalance,
  getPoolBalances,
  resolveVideoPool,
  InsufficientCreditsError,
} from "./credit-account-service";
import { computeChargeCredits } from "./gateway-credit-settlement";
import { isUnifiedCreditBillingActive } from "./unified-credit-flag";
import { resolveBillingCanonicalKey, resolveCostSnapshot } from "@/lib/gateway/credit-billing-guard";
import { computeTierCredits, videoBillableSeconds } from "@/lib/pricing/credit-pricing-formulas";

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

  const ref = await resolveBillingRef(input);
  if (!ref) return;

  const isVideo = input.requestKind === "VIDEO";
  const canonical = await resolveBillingCanonicalKey({
    modelKey: input.model,
    inputSummary: input.inputSummary,
  }).catch(() => null);

  // 视频：走视频池冻结预检（逐档单价 × 15s 封顶）
  if (isVideo) {
    const pools = await getPoolBalances(ref);
    const pool = await resolveVideoPool(ref);
    const available = pool === "VIDEO" ? pools.video.balance : pools.general.balance;
    let minNeeded = 1;
    if (canonical) {
      const snap = await resolveCostSnapshot(canonical).catch(() => null);
      const list = snap?.listPriceYuan ?? null;
      const units = videoBillableSeconds(null);
      if (pools.pricePerCreditYuan && pools.pricePerCreditYuan > 0 && list && list > 0) {
        minNeeded = computeTierCredits(list * units, pools.pricePerCreditYuan);
      } else if (snap?.creditsPerUnit && snap.creditsPerUnit > 0) {
        minNeeded = Math.round(snap.creditsPerUnit * units);
      }
    }
    if (available < minNeeded) throw new InsufficientCreditsError(available, minNeeded);
    return;
  }

  const pools = await getPoolBalances(ref);
  const balance = await getCreditBalance(ref);
  let minNeeded = 1;
  if (canonical) {
    const snap = await resolveCostSnapshot(canonical).catch(() => null);
    if (snap) {
      const units = 1;
      minNeeded = computeChargeCredits({
        snapshot: snap,
        units,
        pricePerCreditYuan: pools.pricePerCreditYuan,
      });
      if (minNeeded < 1) minNeeded = 1;
    }
  }

  if (balance < minNeeded) {
    throw new InsufficientCreditsError(balance, minNeeded);
  }
}
