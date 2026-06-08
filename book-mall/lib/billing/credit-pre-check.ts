/**
 * 生成前积分余额门禁（用完即停）。
 */
import { prisma } from "@/lib/prisma";
import { getCreditBalance, InsufficientCreditsError } from "./credit-account-service";
import { isUnifiedCreditBillingActive } from "./unified-credit-flag";
import { resolveCanonicalModelKey } from "@/lib/gateway/credit-billing-guard";

async function resolveBillingRef(input: {
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
}): Promise<void> {
  if (!isUnifiedCreditBillingActive()) return;

  const ref = await resolveBillingRef(input);
  if (!ref) return;

  const balance = await getCreditBalance(ref);
  let minNeeded = 1;

  const canonical = await resolveCanonicalModelKey(input.model).catch(() => null);
  if (canonical) {
    const price = await prisma.modelCreditPrice.findFirst({
      where: { canonicalModelKey: canonical, active: true },
      select: { creditsPerUnit: true },
    });
    if (price && price.creditsPerUnit > 0) minNeeded = price.creditsPerUnit;
  }

  if (balance < minNeeded) {
    throw new InsufficientCreditsError(balance, minNeeded);
  }
}
