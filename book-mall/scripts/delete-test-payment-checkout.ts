/**
 * 删除测试用重复支付单及其关联记录（Order、PaymentEvent、重复发放流水）。
 *
 *   pnpm exec dotenv -e .env.local -- tsx scripts/delete-test-payment-checkout.ts --checkout-id=cmq860kih000or03c25exs8tt --confirm
 */
import { prisma } from "../lib/prisma";

function arg(name: string): string | null {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function main() {
  const checkoutId = arg("checkout-id")?.trim();
  if (!checkoutId) throw new Error("请指定 --checkout-id=<PaymentCheckout.id>");

  const confirm = hasFlag("confirm");
  const checkout = await prisma.paymentCheckout.findUnique({
    where: { id: checkoutId },
    include: { order: true, events: { select: { id: true } } },
  });
  if (!checkout) throw new Error(`支付单不存在 ${checkoutId}`);

  const ledgerKeys = [
    `payment_checkout:${checkoutId}`,
    `payment_checkout:${checkoutId}:video`,
    `adjust:duplicate_plan_grant:${checkoutId}:general`,
    `adjust:duplicate_plan_grant:${checkoutId}:video`,
  ];
  const ledgers = await prisma.creditLedger.findMany({
    where: { idempotencyKey: { in: ledgerKeys } },
    select: { id: true, idempotencyKey: true, credits: true, pool: true },
  });

  console.log(`[delete-checkout] ${confirm ? "执行" : "DRY-RUN"}`);
  console.log(`[delete-checkout] 支付单 ${checkoutId} · ${checkout.status} · ¥${checkout.amountYuan}`);
  console.log(`[delete-checkout] Order: ${checkout.order?.id ?? "—"}`);
  console.log(`[delete-checkout] PaymentEvent: ${checkout.events.length} 条`);
  console.log(`[delete-checkout] CreditLedger: ${ledgers.length} 条`, ledgers);

  if (!confirm) {
    console.log("[delete-checkout] 预览完成。加 --confirm 执行。");
    return;
  }

  await prisma.$transaction(async (tx) => {
    if (ledgers.length > 0) {
      await tx.creditLedger.deleteMany({
        where: { id: { in: ledgers.map((l) => l.id) } },
      });
    }
    if (checkout.order) {
      await tx.order.delete({ where: { id: checkout.order.id } });
    }
    await tx.paymentCheckout.delete({ where: { id: checkoutId } });
  });

  console.log(`[delete-checkout] 已删除 ${checkoutId}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
