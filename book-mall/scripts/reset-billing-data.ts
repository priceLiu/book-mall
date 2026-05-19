/**
 * v004（2026-05-17）：把"费用相关的运行时数据"清零，并按用户指定状态重新落 1 条充值 + 1 条月度订阅。
 *
 * 适用：从"v003 旧列结构"切到"v004 新列结构"时，让本地与开发库恢复"刚交付的干净态"。
 * 生产数据**不要**直接跑此脚本；如需迁移生产，请单独评估"按用户"分批回填路径。
 *
 * 范围（按依赖关系倒序删）：
 *   - ToolBillingDetailLine           （依赖 ToolUsageEvent 与 User）
 *   - BillingReconciliationLine       （依赖 BillingReconciliationRun）
 *   - BillingReconciliationRun
 *   - ToolUsageEvent                  （依赖 WalletHold 与 User）
 *   - WalletHold                      （依赖 User）
 *   - WalletEntry                     （依赖 Wallet）
 *   - WalletRefundRequest             （依赖 Wallet/User/Order）
 *   - SubscriptionRefundRequest       （依赖 Subscription）
 *   - Subscription                    （依赖 SubscriptionPlan/User）
 *   - Order                           （依赖 User）
 *
 * 不删：
 *   - Wallet 行本身（每个 user 一行）——重置 balancePoints/frozenPoints 为干净态
 *   - SubscriptionPlan（保留计划目录，包括归档版本）
 *   - User / 工具 SchemeA 价目（ToolBillablePrice）/ PricingSourceLine / ModelCatalog
 *
 * 用法（必须 dry-run 一遍再正式跑）：
 *   pnpm tsx scripts/reset-billing-data.ts --dry
 *   pnpm tsx scripts/reset-billing-data.ts --apply --user <userId> [--monthly-plan-slug pro-monthly]
 *
 * --user：留空则不创建"充值 3000 + 月度订阅" 种子数据；只清零所有计费表。
 * --monthly-plan-slug：默认查 active=true + interval=MONTH 第一条；找不到则跳过订阅。
 */
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";

const DRY = process.argv.includes("--dry") || !process.argv.includes("--apply");

function argValue(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx < 0) return undefined;
  return process.argv[idx + 1];
}

const SEED_USER_ID = argValue("user")?.trim() || "";
const PLAN_SLUG = argValue("monthly-plan-slug")?.trim() || "";

const SEED_TOPUP_POINTS = 300_000;
const SEED_TOPUP_DESC = "v004 重置 · 充值 ¥3000";

function log(...a: unknown[]) {
  console.log("[reset-billing]", ...a);
}

async function countAll() {
  const [tbdl, brl, brr, tue, wh, we, wrr, srr, sub, ord] = await Promise.all([
    prisma.toolBillingDetailLine.count(),
    prisma.billingReconciliationLine.count(),
    prisma.billingReconciliationRun.count(),
    prisma.toolUsageEvent.count(),
    prisma.walletHold.count(),
    prisma.walletEntry.count(),
    prisma.walletRefundRequest.count(),
    prisma.subscriptionRefundRequest.count(),
    prisma.subscription.count(),
    prisma.order.count(),
  ]);
  return { tbdl, brl, brr, tue, wh, we, wrr, srr, sub, ord };
}

async function main() {
  log(`mode=${DRY ? "DRY-RUN" : "APPLY"}; seedUser=${SEED_USER_ID || "(none)"}; planSlug=${PLAN_SLUG || "(auto)"}`);
  log("before:", await countAll());

  if (DRY) {
    log("DRY-RUN：列出将要执行的操作，但不写库。");
    log("- 删 ToolBillingDetailLine、BillingReconciliationLine、BillingReconciliationRun、ToolUsageEvent、WalletHold、WalletRefundRequest、SubscriptionRefundRequest、Subscription、Order 全表");
    log("- 删 WalletEntry 全表");
    log("- Wallet：所有用户 balancePoints=0, frozenPoints=0");
    if (SEED_USER_ID) {
      log(`- 给 user=${SEED_USER_ID} 补：Wallet 加 ${SEED_TOPUP_POINTS} 点 + 1 条 WalletEntry(RECHARGE)`);
      log(`- 给 user=${SEED_USER_ID} 补：1 条 Subscription（按 planSlug=${PLAN_SLUG || "auto MONTH active"}），period=now ~ +30d`);
    }
    log("结束。如确认无误，请加 --apply 重跑。");
    return;
  }

  await prisma.$transaction(async (tx) => {
    // 1) 计费/审计明细
    const deletedTbdl = await tx.toolBillingDetailLine.deleteMany({});
    const deletedBrl = await tx.billingReconciliationLine.deleteMany({});
    const deletedBrr = await tx.billingReconciliationRun.deleteMany({});
    log(`del TBDL=${deletedTbdl.count} BRL=${deletedBrl.count} BRR=${deletedBrr.count}`);

    // 2) 用量事件 + hold
    const deletedTue = await tx.toolUsageEvent.deleteMany({});
    const deletedWh = await tx.walletHold.deleteMany({});
    log(`del TUE=${deletedTue.count} WH=${deletedWh.count}`);

    // 3) 钱包流水（含 RECHARGE/REFUND/CONSUME/ADJUST 全清——清零的语义就是"重新开张"）
    const deletedWrr = await tx.walletRefundRequest.deleteMany({});
    const deletedSrr = await tx.subscriptionRefundRequest.deleteMany({});
    const deletedSub = await tx.subscription.deleteMany({});
    const deletedOrd = await tx.order.deleteMany({});
    const deletedWe = await tx.walletEntry.deleteMany({});
    log(`del WRR=${deletedWrr.count} SRR=${deletedSrr.count} Sub=${deletedSub.count} Ord=${deletedOrd.count} WE=${deletedWe.count}`);

    // 4) Wallet 行重置（不删，保留每用户 1 行）
    const resetWallets = await tx.wallet.updateMany({
      data: { balancePoints: 0, frozenPoints: 0 },
    });
    log(`reset wallets=${resetWallets.count}`);

    // 5) seed user 注入 3000 元充值 + 月度订阅
    if (!SEED_USER_ID) return;

    const u = await tx.user.findUnique({
      where: { id: SEED_USER_ID },
      select: { id: true, name: true, email: true },
    });
    if (!u) {
      throw new Error(`--user=${SEED_USER_ID} 在 User 表中不存在；中止种子注入`);
    }

    const wallet = await tx.wallet.upsert({
      where: { userId: u.id },
      create: { userId: u.id, balancePoints: SEED_TOPUP_POINTS, frozenPoints: 0 },
      update: { balancePoints: SEED_TOPUP_POINTS, frozenPoints: 0 },
    });
    await tx.walletEntry.create({
      data: {
        walletId: wallet.id,
        type: "RECHARGE",
        amountPoints: SEED_TOPUP_POINTS,
        balanceAfterPoints: SEED_TOPUP_POINTS,
        description: SEED_TOPUP_DESC,
        idempotencyKey: `reset-v004-recharge:${u.id}`,
      },
    });
    log(`seed wallet user=${u.id} balance=${SEED_TOPUP_POINTS} (¥${(SEED_TOPUP_POINTS / 100).toFixed(2)})`);

    const plan = PLAN_SLUG
      ? await tx.subscriptionPlan.findUnique({ where: { slug: PLAN_SLUG } })
      : await tx.subscriptionPlan.findFirst({
          where: { interval: "MONTH", active: true, archivedAt: null },
          orderBy: { id: "asc" },
        });

    if (!plan) {
      log(`未找到月度订阅计划（slug=${PLAN_SLUG || "auto MONTH active"}）；跳过订阅种子`);
      return;
    }

    const start = new Date();
    const end = new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);
    await tx.subscription.create({
      data: {
        userId: u.id,
        planId: plan.id,
        status: "ACTIVE",
        currentPeriodStart: start,
        currentPeriodEnd: end,
        cancelAtPeriodEnd: false,
      },
    });
    log(`seed subscription user=${u.id} planId=${plan.id} slug=${plan.slug} period=${start.toISOString()} ~ ${end.toISOString()}`);
  }, { maxWait: 10_000, timeout: 60_000 });

  log("after:", await countAll());
  log("APPLY done.");
}

main()
  .catch((e: unknown) => {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      console.error("[reset-billing] prisma error", e.code, e.message);
    } else {
      console.error(e);
    }
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
