import { fulfillPaymentCheckout } from "@/lib/payments/fulfill-checkout";
import { appendPaymentEvent } from "@/lib/payments/payment-events";
import { prisma } from "@/lib/prisma";

export async function submitCheckoutPaid(input: {
  checkoutId: string;
  userId: string;
}) {
  const checkout = await prisma.paymentCheckout.findUnique({ where: { id: input.checkoutId } });
  if (!checkout) throw new Error("支付单不存在");
  if (checkout.userId !== input.userId) throw new Error("无权操作此支付单");
  if (checkout.status === "PAID") return checkout;
  if (checkout.status === "CANCELLED" || checkout.status === "EXPIRED") {
    throw new Error("支付单已失效");
  }
  if (checkout.expiresAt < new Date()) {
    await prisma.paymentCheckout.update({
      where: { id: checkout.id },
      data: { status: "EXPIRED" },
    });
    throw new Error("支付单已过期");
  }

  const updated = await prisma.paymentCheckout.update({
    where: { id: checkout.id },
    data: { status: "AWAITING_CONFIRM" },
  });

  await appendPaymentEvent({
    checkoutId: checkout.id,
    actorUserId: input.userId,
    action: "USER_SUBMITTED",
  });

  return updated;
}

export async function confirmCheckoutByAdmin(input: {
  checkoutId: string;
  confirmedByUserId: string;
  adminNote?: string | null;
}) {
  return fulfillPaymentCheckout({
    checkoutId: input.checkoutId,
    confirmMode: "ADMIN_MANUAL",
    confirmedByUserId: input.confirmedByUserId,
    adminNote: input.adminNote,
  });
}

export async function instantConfirmCheckoutByAdmin(input: {
  checkoutId: string;
  confirmedByUserId: string;
  adminNote?: string | null;
}) {
  return fulfillPaymentCheckout({
    checkoutId: input.checkoutId,
    confirmMode: "ADMIN_INSTANT",
    confirmedByUserId: input.confirmedByUserId,
    adminNote: input.adminNote,
  });
}

export async function lookupCheckoutByRemarkCode(code: string) {
  const checkout = await prisma.paymentCheckout.findFirst({
    where: {
      remarkCode: code,
      status: { in: ["PENDING", "AWAITING_CONFIRM"] },
    },
    include: {
      user: { select: { id: true, email: true, name: true, phone: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return checkout;
}

export async function cancelCheckout(input: {
  checkoutId: string;
  actorUserId: string;
}) {
  const checkout = await prisma.paymentCheckout.updateMany({
    where: {
      id: input.checkoutId,
      status: { in: ["PENDING", "AWAITING_CONFIRM"] },
    },
    data: { status: "CANCELLED" },
  });
  if (checkout.count === 1) {
    await appendPaymentEvent({
      checkoutId: input.checkoutId,
      actorUserId: input.actorUserId,
      action: "CANCEL",
    });
  }
  return checkout.count === 1;
}
