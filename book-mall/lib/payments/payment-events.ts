import type { PaymentEventAction, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

type PaymentEventClient = Pick<typeof prisma, "paymentEvent">;

export async function appendPaymentEvent(
  input: {
    checkoutId: string;
    actorUserId?: string | null;
    action: PaymentEventAction;
    payload?: Prisma.InputJsonValue;
  },
  /** 事务内调用时必须传入，否则 FK 在 checkout 未提交前不可见 */
  tx?: PaymentEventClient,
) {
  const db = tx ?? prisma;
  return db.paymentEvent.create({
    data: {
      checkoutId: input.checkoutId,
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      payload: input.payload ?? undefined,
    },
  });
}
