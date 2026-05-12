/**
 * 试点校准：为指定用户入账 ¥1000，并将其「AI试衣 try_on」流水补齐 costMinor（按当前生效单价）。
 *
 * 执行（book-mall 目录）：
 *   pnpm exec dotenv -e .env.local -- tsx scripts/calibrate-pilot-tool-billing.ts
 */
import { prisma } from "../lib/prisma";
import { resolveBillablePriceMinor } from "../lib/tool-billable-price";

const PILOT_EMAIL = "13808816802@126.com";
const RECHARGE_MINOR = 100_000; // ¥1000

async function main() {
  const email = PILOT_EMAIL.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true },
  });
  if (!user) {
    console.error(`用户不存在: ${PILOT_EMAIL}`);
    process.exit(1);
  }

  const recentPilotOrders = await prisma.order.findMany({
    where: { userId: user.id, type: "WALLET_TOPUP", status: "PAID" },
    select: { meta: true },
    take: 20,
    orderBy: { createdAt: "desc" },
  });
  const alreadyPilot = recentPilotOrders.some((o) => {
    const m = o.meta;
    return (
      m != null &&
      typeof m === "object" &&
      !Array.isArray(m) &&
      (m as Record<string, unknown>).pilot_calibration === true
    );
  });
  if (alreadyPilot) {
    console.error(
      "该用户已有 pilot_calibration 入账订单，避免重复充值；回填仍可手工 SQL / 改脚本执行。",
    );
    process.exit(2);
  }

  const unitMinor =
    (await resolveBillablePriceMinor("fitting-room__ai-fit", "try_on")) ?? 100;

  const result = await prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.upsert({
      where: { userId: user.id },
      create: { userId: user.id },
      update: {},
    });
    const nextBalance = wallet.balanceMinor + RECHARGE_MINOR;
    await tx.wallet.update({
      where: { id: wallet.id },
      data: { balanceMinor: nextBalance },
    });
    const order = await tx.order.create({
      data: {
        userId: user.id,
        type: "WALLET_TOPUP",
        status: "PAID",
        amountMinor: RECHARGE_MINOR,
        paidAt: new Date(),
        meta: {
          pilot_calibration: true,
          note: "试点校准入账 ¥1000",
        },
      },
    });
    await tx.walletEntry.create({
      data: {
        walletId: wallet.id,
        type: "RECHARGE",
        amountMinor: RECHARGE_MINOR,
        balanceAfterMinor: nextBalance,
        description: `校准入账 · 试点充值 ¥${(RECHARGE_MINOR / 100).toFixed(2)}`,
        orderId: order.id,
      },
    });

    const backfilled = await tx.toolUsageEvent.updateMany({
      where: {
        userId: user.id,
        action: "try_on",
        toolKey: "fitting-room__ai-fit",
        costMinor: null,
      },
      data: { costMinor: unitMinor },
    });

    return {
      nextBalance,
      backfilled: backfilled.count,
      orderId: order.id,
      unitMinor,
    };
  });

  console.log(
    JSON.stringify(
      {
        userId: user.id,
        email: user.email,
        rechargeMinor: RECHARGE_MINOR,
        balanceAfterMinor: result.nextBalance,
        backfilledTryOnRows: result.backfilled,
        unitMinorApplied: result.unitMinor,
        orderId: result.orderId,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
