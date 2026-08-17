/**
 * 一次性排查：管理员专用包支付与视频积分入账。
 * 用法：pnpm exec dotenv -e .env.local -- tsx scripts/check-admin-topup-status.ts
 */
import { prisma } from "../lib/prisma";

async function main() {
  const packId = "video-pack-admin-5000";

  const checkouts = await prisma.paymentCheckout.findMany({
    where: {
      productKind: "CREDIT_TOPUP",
      productSnapshot: { path: ["packId"], equals: packId },
    },
    orderBy: { createdAt: "desc" },
    take: 8,
    select: {
      id: true,
      outTradeNo: true,
      status: true,
      amountYuan: true,
      channel: true,
      createdAt: true,
      paidAt: true,
      productSnapshot: true,
      user: { select: { email: true, phone: true, name: true, role: true } },
    },
  });

  console.log("=== 管理员专用包 PaymentCheckout (最近8条) ===");
  if (checkouts.length === 0) console.log("(无记录)");
  for (const c of checkouts) {
    const snap = c.productSnapshot as Record<string, unknown>;
    console.log(
      JSON.stringify(
        {
          status: c.status,
          amountYuan: Number(c.amountYuan),
          channel: c.channel,
          paidAt: c.paidAt,
          createdAt: c.createdAt,
          outTradeNo: c.outTradeNo,
          user: c.user,
          credits: snap.credits,
          pool: snap.pool,
        },
        null,
        2,
      ),
    );
  }

  const adminEmail = "13808816802@126.com";
  const user = await prisma.user.findFirst({
    where: { email: adminEmail },
    select: { id: true, email: true, phone: true, role: true },
  });
  if (user) {
    const acct = await prisma.creditAccount.findFirst({
      where: { ownerType: "USER", ownerId: user.id },
      select: {
        id: true,
        videoBalanceCredits: true,
        balanceCredits: true,
        updatedAt: true,
      },
    });
    const recentLines = await prisma.creditLedger.findMany({
      where: {
        accountId: acct?.id,
        pool: "VIDEO",
        type: "TOPUP",
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        createdAt: true,
        credits: true,
        balanceAfter: true,
        description: true,
        refType: true,
        refId: true,
      },
    });
    console.log(`\n=== 管理员账号 (${adminEmail}) ===`);
    console.log(JSON.stringify({ user, account: acct }, null, 2));
    console.log("最近 VIDEO TOPUP 流水:");
    for (const line of recentLines) console.log(JSON.stringify(line));
  }

  const recentPaidTopups = await prisma.paymentCheckout.findMany({
    where: { status: "PAID", productKind: "CREDIT_TOPUP" },
    orderBy: { paidAt: "desc" },
    take: 5,
    select: {
      paidAt: true,
      amountYuan: true,
      productSnapshot: true,
      user: { select: { email: true, phone: true } },
    },
  });
  console.log("\n=== 全站最近5笔已支付 CREDIT_TOPUP ===");
  for (const c of recentPaidTopups) {
    const snap = c.productSnapshot as Record<string, unknown>;
    console.log(
      JSON.stringify(
        {
          packId: snap.packId,
          packLabel: snap.packLabel,
          credits: snap.credits,
          pool: snap.pool,
          amountYuan: Number(c.amountYuan),
          paidAt: c.paidAt,
          user: c.user,
        },
        null,
        2,
      ),
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
