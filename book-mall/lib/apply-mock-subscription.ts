import { prisma } from "@/lib/prisma";

export type MockSubscribePlanSlug = "monthly" | "yearly";

/** 模拟订阅支付成功后的落库（ACTIVE 订阅 + PAID 订单）。 */
export async function applyMockSubscriptionPayment(
  userId: string,
  planSlug: MockSubscribePlanSlug,
): Promise<{ subscriptionId: string; orderId: string }> {
  const plan = await prisma.subscriptionPlan.findUnique({
    where: { slug: planSlug },
  });
  if (!plan) {
    throw new Error(`未找到计划「${planSlug}」，请先执行 pnpm db:seed`);
  }

  const start = new Date();
  const end = new Date(start);
  const addDays = plan.interval === "YEAR" ? 365 : 30;
  end.setDate(end.getDate() + addDays);

  const { subscriptionId, orderId } = await prisma.$transaction(async (tx) => {
    await tx.subscription.updateMany({
      where: { userId, status: "ACTIVE" },
      data: { status: "EXPIRED" },
    });
    const sub = await tx.subscription.create({
      data: {
        userId,
        planId: plan.id,
        status: "ACTIVE",
        currentPeriodStart: start,
        currentPeriodEnd: end,
      },
    });
    const order = await tx.order.create({
      data: {
        userId,
        type: "SUBSCRIPTION",
        status: "PAID",
        amountPoints: plan.pricePoints,
        paidAt: new Date(),
        meta: {
          mock: true,
          planSlug: plan.slug,
          subscriptionId: sub.id,
        },
      },
    });
    return { subscriptionId: sub.id, orderId: order.id };
  });

  return { subscriptionId, orderId };
}
