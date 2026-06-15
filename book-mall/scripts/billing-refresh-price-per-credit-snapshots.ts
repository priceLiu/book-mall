/**
 * Pricing 2.0 后批量刷新 CreditAccount.pricePerCreditYuan 快照。
 *
 * 将各账户 planId 对应的 MembershipPlan.pricePerCreditYuan 写回账户，
 * 使预检 / 结算与当前 seed 价目一致（不改动余额与流水）。
 *
 *   cd book-mall && pnpm billing:refresh-ppc-snapshots              # dry-run
 *   cd book-mall && pnpm billing:refresh-ppc-snapshots --confirm    # 写库
 *   cd book-mall && pnpm billing:refresh-ppc-snapshots --account=<creditAccountId>
 */
import { prisma } from "../lib/prisma";

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function ppcEqual(a: number | null, b: number | null, eps = 1e-6): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return Math.abs(a - b) <= eps;
}

async function main() {
  const confirm = hasFlag("confirm");
  const onlyAccountId = arg("account");

  console.log(
    `[refresh-ppc] ${confirm ? "执行" : "DRY-RUN"}${onlyAccountId ? ` · 仅账户 ${onlyAccountId}` : ""}`,
  );

  const accounts = await prisma.creditAccount.findMany({
    where: {
      ...(onlyAccountId ? { id: onlyAccountId } : {}),
      planId: { not: null },
    },
    select: {
      id: true,
      ownerType: true,
      ownerId: true,
      planId: true,
      pricePerCreditYuan: true,
    },
  });

  if (!accounts.length) {
    console.log("[refresh-ppc] 无带 planId 的积分账户，跳过。");
    return;
  }

  const planIds = [...new Set(accounts.map((a) => a.planId!).filter(Boolean))];
  const plans = await prisma.membershipPlan.findMany({
    where: { id: { in: planIds } },
    select: {
      id: true,
      tier: true,
      family: true,
      interval: true,
      pricePerCreditYuan: true,
      active: true,
    },
  });
  const planById = new Map(plans.map((p) => [p.id, p]));

  let wouldUpdate = 0;
  let skippedNoPlan = 0;
  let skippedSame = 0;

  for (const acc of accounts) {
    const plan = planById.get(acc.planId!);
    if (!plan?.pricePerCreditYuan) {
      skippedNoPlan += 1;
      console.log(
        `[skip] ${acc.id} ${acc.ownerType}:${acc.ownerId} plan=${acc.planId} 无 plan.pricePerCreditYuan`,
      );
      continue;
    }
    const target = Number(plan.pricePerCreditYuan);
    const current =
      acc.pricePerCreditYuan != null ? Number(acc.pricePerCreditYuan) : null;
    if (ppcEqual(current, target)) {
      skippedSame += 1;
      continue;
    }
    wouldUpdate += 1;
    const label = `${plan.family}/${plan.interval}/${plan.tier}${plan.active ? "" : " (inactive)"}`;
    console.log(
      `[update] ${acc.id} ${acc.ownerType}:${acc.ownerId} · ${label} · ${current ?? "null"} → ${target}`,
    );
    if (confirm) {
      await prisma.creditAccount.update({
        where: { id: acc.id },
        data: { pricePerCreditYuan: target },
      });
    }
  }

  console.log(
    `[refresh-ppc] done · scanned=${accounts.length} update=${wouldUpdate} same=${skippedSame} noPlan=${skippedNoPlan}`,
  );
  if (!confirm && wouldUpdate > 0) {
    console.log("[refresh-ppc] 加 --confirm 写库");
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
