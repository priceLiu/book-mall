import type { PaymentEventAction, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export async function appendPaymentEvent(input: {
  checkoutId: string;
  actorUserId?: string | null;
  action: PaymentEventAction;
  payload?: Prisma.InputJsonValue;
}) {
  return prisma.paymentEvent.create({
    data: {
      checkoutId: input.checkoutId,
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      payload: input.payload ?? undefined,
    },
  });
}
