/**
 * 个人标准版调价：曾按 ¥69 / 860 分开通的在服用户 → 对齐 ¥99 / 1230 分套餐。
 *
 * - 更新 monthlyGrantCredits、pricePerCreditYuan（跟现网 MembershipPlan）
 * - 本周期补发差额积分（ADJUST，不改 membershipPaidUntil / currentPeriodEnd）
 * - planId 已是同一条 MembershipPlan（seed 原地更新），无需换绑
 *
 *   cd book-mall && pnpm exec dotenv -e .env.local -- tsx scripts/billing-migrate-personal-std-69-to-99.ts
 *   cd book-mall && pnpm exec dotenv -e .env.local -- tsx scripts/billing-migrate-personal-std-69-to-99.ts --confirm
 */
import { prisma } from "../lib/prisma";
import { adjustCredits } from "../lib/billing/credit-account-service";
import { resolvePlanCreditGrants } from "../lib/billing/plan-credit-grants";
import { round2 } from "../lib/pricing/credit-pricing-formulas";

const OLD_PERIOD_GRANT = 860;

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function main() {
  const confirm = hasFlag("confirm");
  console.log(`[migrate-std-69→99] ${confirm ? "执行" : "DRY-RUN"}`);

  const plans = await prisma.membershipPlan.findMany({
    where: { family: "PERSONAL", tier: "标准版", active: true },
    select: {
      id: true,
      interval: true,
      priceYuan: true,
      monthlyCredits: true,
      pricePerCreditYuan: true,
      family: true,
    },
  });
  if (plans.length === 0) {
    console.log("未找到个人标准版套餐，退出。");
    return;
  }

  const planById = new Map(plans.map((p) => [p.id, p]));
  const planIds = plans.map((p) => p.id);

  const now = new Date();
  const accounts = await prisma.creditAccount.findMany({
    where: {
      ownerType: "USER",
      planId: { in: planIds },
      monthlyGrantCredits: OLD_PERIOD_GRANT,
      OR: [
        { membershipPaidUntil: { gt: now } },
        { currentPeriodEnd: { gt: now } },
      ],
    },
    select: {
      id: true,
      ownerId: true,
      planId: true,
      monthlyGrantCredits: true,
      balanceCredits: true,
      pricePerCreditYuan: true,
      membershipPaidUntil: true,
      currentPeriodEnd: true,
    },
  });

  console.log(`命中账户 ${accounts.length}`);

  let updated = 0;
  for (const acc of accounts) {
    const plan = acc.planId ? planById.get(acc.planId) : null;
    if (!plan?.pricePerCreditYuan) {
      console.log(`[skip] ${acc.ownerId} 无 plan`);
      continue;
    }
    const grants = resolvePlanCreditGrants(plan, 1);
    const targetGrant = grants.monthlyGrantCredits;
    const targetPpc = Number(plan.pricePerCreditYuan);
    const oldGrant = Number(acc.monthlyGrantCredits);
    const delta = round2(targetGrant - oldGrant);
    const user = await prisma.user.findUnique({
      where: { id: acc.ownerId },
      select: { phone: true, email: true },
    });

    console.log(
      [
        user?.phone ?? user?.email ?? acc.ownerId,
        `grant ${oldGrant} → ${targetGrant}`,
        `ppc ${acc.pricePerCreditYuan != null ? Number(acc.pricePerCreditYuan) : "null"} → ${targetPpc}`,
        delta > 0 ? `补发 +${delta}` : "无需补发",
        `bal=${Number(acc.balanceCredits)}`,
        `paidUntil=${acc.membershipPaidUntil?.toISOString().slice(0, 10) ?? "—"}`,
      ].join(" · "),
    );

    if (!confirm) continue;

    await prisma.creditAccount.update({
      where: { id: acc.id },
      data: {
        monthlyGrantCredits: targetGrant,
        pricePerCreditYuan: targetPpc,
      },
    });

    if (delta > 0) {
      await adjustCredits({
        ref: { ownerType: "USER", ownerId: acc.ownerId },
        credits: delta,
        idempotencyKey: `migrate-std-69-to-99:${acc.id}:${targetGrant}`,
        description: `个人标准版调价补发（¥69/860 → ¥99/${targetGrant}）`,
      });
    }
    updated += 1;
  }

  console.log(
    `[migrate-std-69→99] done · candidates=${accounts.length} updated=${confirm ? updated : 0}`,
  );
  if (!confirm && accounts.length > 0) {
    console.log("[migrate-std-69→99] 加 --confirm 写库");
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
