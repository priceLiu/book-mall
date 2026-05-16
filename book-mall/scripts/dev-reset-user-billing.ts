/**
 * v002 一次性运维脚本：把指定**测试**用户的工具历史 / 钱包 / 订阅清零，并注入一笔 +¥3000 充值
 * 以及一条月度订阅扣费。仅用于「当前用户只有自己」的开发/测试场景。
 *
 * 用法：
 *   pnpm dotenv -e .env.local -- tsx scripts/dev-reset-user-billing.ts \
 *     --email=13808816802@126.com [--rechargeYuan=3000] [--planSlug=monthly] [--confirm]
 *
 * 默认 `--dry` 形式（即不带 --confirm 时），只打印将要做什么；
 * 加 `--confirm` 才在事务里真删并真写。
 *
 * 清除内容（按 userId 限定，不影响他人）：
 *   - ToolUsageEvent
 *   - ToolBillingDetailLine
 *   - WalletEntry（先按 walletId 清，再把 Wallet.balancePoints/frozenPoints 归零）
 *   - Order
 *   - Subscription
 *   - UserProductSubscription
 *   - UserRechargeCoupon
 *   - BillingReconciliationLine（仅该用户在某 run 中的行；不删 Run 本身）
 *
 * 注入：
 *   - WalletEntry RECHARGE +¥3000(=300000 点)
 *   - Order SUBSCRIPTION PAID（金额=plan.pricePoints）
 *   - Subscription（monthly, ACTIVE, 1 个月有效期）
 *   - WalletEntry CONSUME 扣订阅费（关联 orderId）
 */
import { prisma } from "../lib/prisma";

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit?.slice(prefix.length);
}

async function main() {
  const email = arg("email")?.trim();
  const planSlug = (arg("planSlug") || "monthly").trim();
  const rechargeYuan = parseInt(arg("rechargeYuan") || "3000", 10);
  const CONFIRM = process.argv.includes("--confirm");

  if (!email) {
    console.error("缺 --email=<user.email>");
    process.exit(2);
  }
  if (!Number.isFinite(rechargeYuan) || rechargeYuan <= 0) {
    console.error("--rechargeYuan 必须是正整数（元）");
    process.exit(2);
  }
  const rechargePoints = rechargeYuan * 100;

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      wallet: { select: { id: true, balancePoints: true, frozenPoints: true } },
    },
  });
  if (!user) {
    console.error(`未找到用户：${email}`);
    process.exit(2);
  }
  if (!user.wallet) {
    console.error(`用户 ${user.id} 没有 Wallet，先在产品流程里完成一次「我的钱包」初始化再重跑此脚本`);
    process.exit(2);
  }
  const uid = user.id;
  const walletId = user.wallet.id;

  const plan = await prisma.subscriptionPlan.findUnique({
    where: { slug: planSlug },
    select: { id: true, slug: true, name: true, pricePoints: true, interval: true, active: true },
  });
  if (!plan) {
    console.error(`未找到订阅 plan：slug=${planSlug}`);
    process.exit(2);
  }
  if (!plan.active) {
    console.warn(`[warn] plan ${plan.slug} 当前 active=false；仍继续。`);
  }

  const [ev, billLine, walEnt, recLine, ord, sub, ups, urc] = await Promise.all([
    prisma.toolUsageEvent.count({ where: { userId: uid } }),
    prisma.toolBillingDetailLine.count({ where: { userId: uid } }),
    prisma.walletEntry.count({ where: { walletId } }),
    prisma.billingReconciliationLine.count({ where: { userId: uid } }),
    prisma.order.count({ where: { userId: uid } }),
    prisma.subscription.count({ where: { userId: uid } }),
    prisma.userProductSubscription.count({ where: { userId: uid } }),
    prisma.userRechargeCoupon.count({ where: { userId: uid } }),
  ]);

  console.log("=== dev-reset-user-billing ===");
  console.log(JSON.stringify({
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    walletBefore: { balancePoints: user.wallet.balancePoints, frozenPoints: user.wallet.frozenPoints },
    plan: { slug: plan.slug, name: plan.name, pricePoints: plan.pricePoints, interval: plan.interval },
    rechargeYuan,
    rechargePoints,
    finalExpectedBalancePoints: rechargePoints - plan.pricePoints,
    counts: { ToolUsageEvent: ev, ToolBillingDetailLine: billLine, WalletEntry: walEnt, BillingReconciliationLine: recLine, Order: ord, Subscription: sub, UserProductSubscription: ups, UserRechargeCoupon: urc },
    mode: CONFIRM ? "CONFIRM (will delete & insert)" : "DRY (no writes)",
  }, null, 2));

  if (!CONFIRM) {
    console.log("\n未传 --confirm，仅预览。再次运行加上 --confirm 才真执行。");
    return;
  }

  const now = new Date();
  const periodEnd = new Date(now);
  if (plan.interval === "MONTH") {
    periodEnd.setMonth(periodEnd.getMonth() + 1);
  } else {
    periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  }

  await prisma.$transaction(async (tx) => {
    await tx.billingReconciliationLine.deleteMany({ where: { userId: uid } });
    await tx.toolBillingDetailLine.deleteMany({ where: { userId: uid } });
    await tx.toolUsageEvent.deleteMany({ where: { userId: uid } });
    await tx.userRechargeCoupon.deleteMany({ where: { userId: uid } });
    await tx.userProductSubscription.deleteMany({ where: { userId: uid } });
    await tx.subscription.deleteMany({ where: { userId: uid } });
    await tx.walletEntry.deleteMany({ where: { walletId } });
    await tx.order.deleteMany({ where: { userId: uid } });

    await tx.wallet.update({
      where: { id: walletId },
      data: { balancePoints: 0, frozenPoints: 0 },
    });

    /** ① 充值 ¥rechargeYuan，余额 0 → rechargePoints */
    await tx.walletEntry.create({
      data: {
        walletId,
        type: "RECHARGE",
        amountPoints: rechargePoints,
        balanceAfterPoints: rechargePoints,
        idempotencyKey: `dev-reset:${uid}:recharge:${now.getTime()}`,
        description: `开发重置 · 模拟充值 ¥${rechargeYuan}`,
      },
    });
    await tx.wallet.update({
      where: { id: walletId },
      data: { balancePoints: rechargePoints },
    });

    /** ② 月度订阅扣费 + Order + Subscription */
    const order = await tx.order.create({
      data: {
        userId: uid,
        type: "SUBSCRIPTION",
        status: "PAID",
        amountPoints: plan.pricePoints,
        meta: { planSlug: plan.slug, viaDevResetScript: true },
        paidAt: now,
      },
      select: { id: true },
    });
    const afterPoints = rechargePoints - plan.pricePoints;
    await tx.walletEntry.create({
      data: {
        walletId,
        type: "CONSUME",
        amountPoints: -plan.pricePoints,
        balanceAfterPoints: afterPoints,
        idempotencyKey: `dev-reset:${uid}:sub:${plan.slug}:${now.getTime()}`,
        description: `开发重置 · 开通月度订阅 (${plan.name})`,
        orderId: order.id,
      },
    });
    await tx.wallet.update({
      where: { id: walletId },
      data: { balancePoints: afterPoints },
    });
    await tx.subscription.create({
      data: {
        userId: uid,
        planId: plan.id,
        status: "ACTIVE",
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
      },
    });
  });

  const after = await prisma.wallet.findUnique({
    where: { id: walletId },
    select: { balancePoints: true, frozenPoints: true },
  });
  const subAfter = await prisma.subscription.findFirst({
    where: { userId: uid, status: "ACTIVE" },
    select: { id: true, plan: { select: { slug: true, name: true } }, currentPeriodStart: true, currentPeriodEnd: true },
  });
  const entries = await prisma.walletEntry.findMany({
    where: { walletId },
    orderBy: { createdAt: "asc" },
    select: { type: true, amountPoints: true, balanceAfterPoints: true, description: true, createdAt: true },
  });
  console.log("\n=== AFTER ===");
  console.log(JSON.stringify({ wallet: after, activeSubscription: subAfter, entries }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
