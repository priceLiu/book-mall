import type { BillingPersona, EcomBillingMode, UserRole } from "@prisma/client";

import { prisma } from "@/lib/prisma";

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
  return user.billingPersona === "BYOK" ? "PLATFORM_CREDIT" : user.billingPersona;
}

export async function requireUserBillingPersona(userId: string): Promise<BillingPersona> {
  const persona = await getUserBillingPersona(userId);
  if (!persona) {
    throw new BillingPersonaError("请先完成计费身份选择（平台代付）", "PERSONA_REQUIRED");
  }
  return persona;
}

export async function assertBillingPersona(
  userId: string,
  expected: BillingPersona | BillingPersona[],
): Promise<BillingPersona> {
  const persona = await requireUserBillingPersona(userId);
  const allowed = Array.isArray(expected) ? expected : [expected];
  const normalized = allowed.map((p) => (p === "BYOK" ? "PLATFORM_CREDIT" : p));
  if (!normalized.includes(persona)) {
    throw new BillingPersonaError("当前账号计费身份不符合此产品要求", "PERSONA_MISMATCH");
  }
  return persona;
}

export async function assertNoCrossProduct(_userId: string): Promise<void> {
  // 单一路径：平台代付 + 会员订阅
}

export function deriveEcomBillingMode(_persona: BillingPersona): EcomBillingMode {
  return "PLATFORM_METERED";
}

export async function lockBillingPersona(
  userId: string,
  persona: BillingPersona,
): Promise<void> {
  const lockedPersona = persona === "BYOK" ? "PLATFORM_CREDIT" : persona;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { billingPersonaLockedAt: true, billingPersona: true },
  });
  if (user?.billingPersonaLockedAt && user.billingPersona !== lockedPersona) {
    throw new BillingPersonaError("计费身份已锁定，无法更改", "PERSONA_LOCKED");
  }
  await prisma.user.update({
    where: { id: userId },
    data: {
      billingPersona: lockedPersona,
      billingPersonaLockedAt: user?.billingPersonaLockedAt ?? new Date(),
      ecomBillingMode: deriveEcomBillingMode(lockedPersona),
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
