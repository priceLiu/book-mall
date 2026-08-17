import { createHash } from "crypto";

import type { PaymentCheckout, PaymentProductKind, Prisma } from "@prisma/client";

/** 同一用户同一商品维度串行建单，避免并发双 PENDING。 */
export function checkoutCreateAdvisoryLockKeys(userId: string, scope: string): [number, number] {
  const buf = createHash("sha256").update(`payment-checkout:${userId}:${scope}`).digest();
  return [buf.readInt32BE(0), buf.readInt32BE(4)];
}

export function checkoutDedupeScope(
  productKind: PaymentProductKind,
  productSnapshot: Record<string, unknown>,
): string {
  switch (productKind) {
    case "CREDIT_TOPUP":
      return `${productKind}:${productSnapshot.packId}:${productSnapshot.target ?? "personal"}`;
    case "VIP_PACKAGE":
      return `${productKind}:${productSnapshot.amountYuan}:${productSnapshot.scheme}:${productSnapshot.seats}`;
    case "MEMBERSHIP_PERSONAL":
    case "MEMBERSHIP_TEAM":
      return `${productKind}:${productSnapshot.planId}`;
    default:
      return productKind;
  }
}

export function paymentCheckoutsSameProduct(
  productKind: PaymentProductKind,
  existingSnap: Record<string, unknown> | null | undefined,
  productSnapshot: Record<string, unknown>,
): boolean {
  const snap = existingSnap ?? {};
  switch (productKind) {
    case "CREDIT_TOPUP":
      return (
        snap.packId === productSnapshot.packId && snap.target === productSnapshot.target
      );
    case "VIP_PACKAGE":
      return (
        snap.amountYuan === productSnapshot.amountYuan &&
        snap.scheme === productSnapshot.scheme &&
        snap.seats === productSnapshot.seats
      );
    case "MEMBERSHIP_PERSONAL":
    case "MEMBERSHIP_TEAM":
      return snap.planId === productSnapshot.planId;
    default:
      return false;
  }
}

export type ResolvePendingCheckoutResult =
  | { action: "reuse"; checkout: PaymentCheckout }
  | { action: "create" };

/**
 * 在 advisory 锁内：复用同价 pending、取消同商品重复 pending，再决定是否新建。
 */
export async function resolvePendingCheckoutDedupe(input: {
  tx: Prisma.TransactionClient;
  userId: string;
  productKind: PaymentProductKind;
  productSnapshot: Record<string, unknown>;
  amountYuan: number;
}): Promise<ResolvePendingCheckoutResult> {
  const scope = checkoutDedupeScope(input.productKind, input.productSnapshot);
  const [k1, k2] = checkoutCreateAdvisoryLockKeys(input.userId, scope);
  await input.tx.$executeRaw`SELECT pg_advisory_xact_lock(${k1}::int, ${k2}::int)`;

  const pending = await input.tx.paymentCheckout.findMany({
    where: {
      userId: input.userId,
      productKind: input.productKind,
      status: { in: ["PENDING", "AWAITING_CONFIRM"] },
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  const sameProduct = pending.filter((row) =>
    paymentCheckoutsSameProduct(
      input.productKind,
      row.productSnapshot as Record<string, unknown>,
      input.productSnapshot,
    ),
  );

  if (sameProduct.length === 0) {
    return { action: "create" };
  }

  const reusable =
    sameProduct.find((row) => Number(row.amountYuan) === input.amountYuan) ?? null;

  const cancelIds = sameProduct
    .filter((row) => row.id !== reusable?.id)
    .map((row) => row.id);

  if (cancelIds.length > 0) {
    await input.tx.paymentCheckout.updateMany({
      where: { id: { in: cancelIds } },
      data: { status: "CANCELLED" },
    });
  }

  if (reusable) {
    return { action: "reuse", checkout: reusable };
  }

  // 同商品但调价：取消剩余旧单后新建
  await input.tx.paymentCheckout.updateMany({
    where: { id: { in: sameProduct.map((row) => row.id) } },
    data: { status: "CANCELLED" },
  });
  return { action: "create" };
}

export function wechatAmountMatchesCheckout(
  checkoutAmountYuan: number | Prisma.Decimal,
  amountTotalFen: number,
): boolean {
  return Math.round(Number(checkoutAmountYuan) * 100) === amountTotalFen;
}
