/**
 * 全站积分清零 + 为指定用户发放个人至尊版（月付）首期积分。
 *
 *   cd book-mall && pnpm exec dotenv -e .env.local -- tsx scripts/reset-credits-grant-supreme.ts [--confirm]
 *
 * 默认 dry-run；加 --confirm 才写入数据库。
 */
import { prisma } from "../lib/prisma";
import { grantCredits } from "../lib/billing/credit-account-service";
import { subscriptionCreditPeriodEnd } from "../lib/billing/credit-lot-logic";
import { membershipPaidUntilFromPurchase } from "../lib/billing/membership-service-period";
import { resolvePlanCreditGrants } from "../lib/billing/plan-credit-grants";

const SUPREME_EMAILS = ["13808816802@126.com", "123456789@126.com"] as const;

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function main() {
  const confirm = hasFlag("confirm");
  console.log(`[reset-credits] ${confirm ? "执行" : "DRY-RUN"}`);

  const supremePlan = await prisma.membershipPlan.findFirst({
    where: { family: "PERSONAL", interval: "MONTH", tier: "至尊版", active: true },
  });
  if (!supremePlan) {
    throw new Error("未找到个人·月付·至尊版 MembershipPlan，请先执行 pricing:bootstrap");
  }

  const accounts = await prisma.creditAccount.findMany({
    select: {
      id: true,
      ownerType: true,
      ownerId: true,
      balanceCredits: true,
      videoBalanceCredits: true,
    },
  });
  console.log(`[reset-credits] 将清零 ${accounts.length} 个积分账户`);

  const toolPlans = await prisma.toolServiceFeePlan.count({ where: { active: true } });
  const activePeriods = await prisma.userToolServicePeriod.count({
    where: { status: "ACTIVE" },
  });
  console.log(
    `[reset-credits] 将下线 ${toolPlans} 个 ToolServiceFeePlan，过期 ${activePeriods} 条工具月费周期`,
  );

  const users = await prisma.user.findMany({
    where: { email: { in: [...SUPREME_EMAILS] } },
    select: { id: true, email: true },
  });
  for (const email of SUPREME_EMAILS) {
    const u = users.find((x) => x.email === email);
    if (!u) console.warn(`[reset-credits] 警告：未找到用户 ${email}`);
  }

  const grants = resolvePlanCreditGrants(supremePlan, 1);
  const now = new Date();
  const periodEnd = subscriptionCreditPeriodEnd(now);
  const membershipPaidUntil = membershipPaidUntilFromPurchase(supremePlan.interval, now);

  if (!confirm) {
    console.log("[reset-credits] 预览完成。加 --confirm 执行。");
    console.log(
      `[reset-credits] 至尊版发放：通用 ${grants.generalCredits} + 视频 ${grants.videoCredits} 积分/月`,
    );
    return;
  }

  await prisma.$transaction([
    prisma.toolServiceFeePlan.updateMany({ data: { active: false } }),
    prisma.userToolServicePeriod.updateMany({
      where: { status: "ACTIVE" },
      data: { status: "EXPIRED" },
    }),
    prisma.creditLot.updateMany({
      data: { remainingCredits: 0 },
    }),
    prisma.creditAccount.updateMany({
      data: {
        balanceCredits: 0,
        videoBalanceCredits: 0,
        reservedCredits: 0,
        videoReservedCredits: 0,
        monthlyGrantCredits: 0,
        videoMonthlyGrant: 0,
        planId: null,
        currentPeriodEnd: null,
        membershipPaidUntil: null,
        pricePerCreditYuan: null,
        perSeatCapCredits: null,
      },
    }),
  ]);

  for (const user of users) {
    await grantCredits({
      ref: { ownerType: "USER", ownerId: user.id },
      credits: grants.generalCredits,
      videoCredits: grants.videoCredits,
      monthlyGrantCredits: grants.monthlyGrantCredits,
      videoMonthlyGrantCredits: grants.videoMonthlyGrantCredits,
      pricePerCreditYuan: supremePlan.pricePerCreditYuan
        ? Number(supremePlan.pricePerCreditYuan)
        : null,
      planId: supremePlan.id,
      currentPeriodEnd: periodEnd,
      membershipPaidUntil,
      idempotencyKey: `bootstrap_supreme:${user.id}`,
      description: `运维重置：个人至尊版首期发放（${user.email}）`,
    });
    console.log(`[reset-credits] 已发放至尊版 → ${user.email}`);
  }

  console.log("[reset-credits] 完成。");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
