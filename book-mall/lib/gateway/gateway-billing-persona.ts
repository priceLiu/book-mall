import type { GatewayUser } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export async function resolveGatewayBillingPersona(
  user: GatewayUser,
): Promise<"PLATFORM_CREDIT" | "BYOK" | null> {
  if (!user.bookUserId) return null;
  const bookUser = await prisma.user.findUnique({
    where: { id: user.bookUserId },
    select: { billingPersona: true, billingPersonaLockedAt: true },
  });
  if (!bookUser?.billingPersonaLockedAt) return null;
  return bookUser.billingPersona;
}
