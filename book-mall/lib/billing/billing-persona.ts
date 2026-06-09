import type { BillingPersona, EcomBillingMode, UserRole } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getActiveByokSubscription } from "@/lib/billing/byok-subscription-service";

export class BillingPersonaError extends Error {
  constructor(
    message: string,
    public code:
      | "PERSONA_REQUIRED"
      | "PERSONA_MISMATCH"
      | "CROSS_PRODUCT"
      | "PERSONA_LOCKED" = "PERSONA_MISMATCH",
  ) {
    super(message);
    this.name = "BillingPersonaError";
  }
}

const STAFF_ROLES: UserRole[] = ["ADMIN", "FINANCE", "OPERATIONS"];

export function isStaffRole(role: UserRole | string | null | undefined): boolean {
  return STAFF_ROLES.includes(role as UserRole);
}

export async function getUserBillingPersona(userId: string): Promise<BillingPersona | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { billingPersona: true, billingPersonaLockedAt: true },
  });
  if (!user?.billingPersonaLockedAt) return null;
  return user.billingPersona;
}

export async function requireUserBillingPersona(userId: string): Promise<BillingPersona> {
  const persona = await getUserBillingPersona(userId);
  if (!persona) {
    throw new BillingPersonaError(
      "请先完成计费身份选择（平台代付或自带 Key）",
      "PERSONA_REQUIRED",
    );
  }
  return persona;
}

export async function assertBillingPersona(
  userId: string,
  expected: BillingPersona | BillingPersona[],
): Promise<BillingPersona> {
  const persona = await requireUserBillingPersona(userId);
  const allowed = Array.isArray(expected) ? expected : [expected];
  if (!allowed.includes(persona)) {
    throw new BillingPersonaError(
      persona === "BYOK"
        ? "当前账号为自带 Key 身份，无法开通此平台代付产品"
        : "当前账号为平台代付身份，无法开通自带 Key 产品",
      "PERSONA_MISMATCH",
    );
  }
  return persona;
}

export async function assertNoCrossProduct(userId: string): Promise<void> {
  const persona = await requireUserBillingPersona(userId);
  const now = new Date();

  if (persona === "PLATFORM_CREDIT") {
    const byok = await getActiveByokSubscription({ ownerType: "USER", ownerId: userId });
    if (byok) {
      throw new BillingPersonaError(
        "平台代付账号不可同时拥有有效 BYOK 套餐",
        "CROSS_PRODUCT",
      );
    }
  } else {
    const creditAcc = await prisma.creditAccount.findUnique({
      where: { ownerType_ownerId: { ownerType: "USER", ownerId: userId } },
      select: { planId: true, monthlyGrantCredits: true, currentPeriodEnd: true },
    });
    if (
      creditAcc?.planId &&
      creditAcc.monthlyGrantCredits > 0 &&
      (!creditAcc.currentPeriodEnd || creditAcc.currentPeriodEnd > now)
    ) {
      throw new BillingPersonaError(
        "自带 Key 账号不可同时拥有有效会员积分套餐",
        "CROSS_PRODUCT",
      );
    }
  }
}

export function deriveEcomBillingMode(persona: BillingPersona): EcomBillingMode {
  return persona === "PLATFORM_CREDIT" ? "PLATFORM_METERED" : "BYOK_SERVICE_FEE";
}

export async function lockBillingPersona(
  userId: string,
  persona: BillingPersona,
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { billingPersonaLockedAt: true, billingPersona: true },
  });
  if (user?.billingPersonaLockedAt && user.billingPersona !== persona) {
    throw new BillingPersonaError("计费身份已锁定，无法更改", "PERSONA_LOCKED");
  }
  await prisma.user.update({
    where: { id: userId },
    data: {
      billingPersona: persona,
      billingPersonaLockedAt: user?.billingPersonaLockedAt ?? new Date(),
      ecomBillingMode: deriveEcomBillingMode(persona),
    },
  });
}

export async function resolveStaffFlagForUser(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  return isStaffRole(user?.role);
}
