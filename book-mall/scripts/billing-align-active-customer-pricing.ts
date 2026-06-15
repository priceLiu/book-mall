/**
 * Pricing 2.0 · 在用客户价格对齐（不补差、不改余额/积分发放额）
 *
 * 1. 平台代付 CreditAccount.pricePerCreditYuan
 *    - 个人：MembershipPlan.pricePerCreditYuan
 *    - 团队：quoteTeamPlan(totalPrice / monthlyCreditsPool)
 * 2. 在用 BYOK 订阅 techServiceFeeYuan → ByokServiceConfig 现价
 *
 *   cd book-mall && pnpm billing:align-active-pricing              # dry-run
 *   cd book-mall && pnpm billing:align-active-pricing --confirm    # 写库
 */
import { prisma } from "../lib/prisma";
import { quoteTeamPlan } from "../lib/billing/seat-billing-service";
import { BYOK_SCOPE_PERSONAL, BYOK_SCOPE_TEAM_SEAT } from "../lib/billing/byok-pricing";

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

function feeEqual(a: number, b: number, eps = 0.01): boolean {
  return Math.abs(a - b) <= eps;
}

async function resolveTargetPpc(acc: {
  ownerType: "USER" | "TENANT";
  ownerId: string;
  planId: string | null;
}): Promise<number | null> {
  if (acc.ownerType === "USER") {
    if (!acc.planId) return null;
    const plan = await prisma.membershipPlan.findUnique({
      where: { id: acc.planId },
      select: { pricePerCreditYuan: true, active: true, tier: true, family: true, interval: true },
    });
    if (!plan?.pricePerCreditYuan) return null;
    return Number(plan.pricePerCreditYuan);
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: acc.ownerId },
    select: { planId: true, seatLimit: true, status: true, type: true },
  });
  if (!tenant?.planId || tenant.type !== "TEAM" || tenant.status !== "ACTIVE") {
    if (acc.planId) {
      const plan = await prisma.membershipPlan.findUnique({
        where: { id: acc.planId },
        select: { pricePerCreditYuan: true },
      });
      return plan?.pricePerCreditYuan != null ? Number(plan.pricePerCreditYuan) : null;
    }
    return null;
  }

  const quote = await quoteTeamPlan({
    planId: tenant.planId,
    totalSeats: tenant.seatLimit,
  });
  if (quote.monthlyCreditsPool <= 0) return null;
  return Math.round((quote.totalPriceYuan / quote.monthlyCreditsPool) * 1e6) / 1e6;
}

async function main() {
  const confirm = hasFlag("confirm");
  const onlyOwner = arg("owner"); // USER:id or TENANT:id

  console.log(
    `[align-pricing] ${confirm ? "执行" : "DRY-RUN"}${onlyOwner ? ` · ${onlyOwner}` : ""}`,
  );

  const now = new Date();

  const accounts = await prisma.creditAccount.findMany({
    where: onlyOwner
      ? {
          ownerType: onlyOwner.split(":")[0] as "USER" | "TENANT",
          ownerId: onlyOwner.split(":")[1]!,
        }
      : {
          OR: [
            { monthlyGrantCredits: { gt: 0 } },
            { balanceCredits: { gt: 0 } },
            { videoBalanceCredits: { gt: 0 } },
            { currentPeriodEnd: { gt: now } },
          ],
        },
    select: {
      id: true,
      ownerType: true,
      ownerId: true,
      planId: true,
      pricePerCreditYuan: true,
      monthlyGrantCredits: true,
      balanceCredits: true,
      currentPeriodEnd: true,
    },
  });

  let ppcUpdates = 0;
  let ppcSkipped = 0;

  for (const acc of accounts) {
    const target = await resolveTargetPpc(acc);
    if (target == null) {
      ppcSkipped += 1;
      console.log(`[ppc skip] ${acc.ownerType}:${acc.ownerId} 无法解析目标单价`);
      continue;
    }
    const current =
      acc.pricePerCreditYuan != null ? Number(acc.pricePerCreditYuan) : null;
    if (ppcEqual(current, target)) {
      ppcSkipped += 1;
      continue;
    }
    ppcUpdates += 1;
    console.log(
      `[ppc] ${acc.ownerType}:${acc.ownerId} plan=${acc.planId ?? "—"} · ${current ?? "null"} → ${target}`,
    );
    if (confirm) {
      await prisma.creditAccount.update({
        where: { id: acc.id },
        data: { pricePerCreditYuan: target },
      });
    }
  }

  const byokSubs = await prisma.byokSubscription.findMany({
    where: {
      status: "ACTIVE",
      periodEnd: { gt: now },
      ...(onlyOwner
        ? {
            ownerType: onlyOwner.split(":")[0] as "USER" | "TENANT",
            ownerId: onlyOwner.split(":")[1],
          }
        : {}),
    },
    select: {
      id: true,
      ownerType: true,
      ownerId: true,
      scopeKey: true,
      seats: true,
      techServiceFeeYuan: true,
    },
  });

  const configs = await prisma.byokServiceConfig.findMany({
    where: { active: true },
    select: { scopeKey: true, techServiceFeeYuan: true },
  });
  const cfgByScope = new Map(configs.map((c) => [c.scopeKey, Number(c.techServiceFeeYuan)]));

  let byokUpdates = 0;
  let byokSkipped = 0;

  for (const sub of byokSubs) {
    const scope =
      sub.scopeKey === BYOK_SCOPE_TEAM_SEAT
        ? BYOK_SCOPE_TEAM_SEAT
        : BYOK_SCOPE_PERSONAL;
    const target = cfgByScope.get(scope);
    if (target == null) {
      byokSkipped += 1;
      console.log(`[byok skip] ${sub.id} scope=${sub.scopeKey} 无配置`);
      continue;
    }
    const current = Number(sub.techServiceFeeYuan);
    if (feeEqual(current, target)) {
      byokSkipped += 1;
      continue;
    }
    byokUpdates += 1;
    console.log(
      `[byok] ${sub.ownerType}:${sub.ownerId} ${sub.scopeKey} · ¥${current} → ¥${target}/${
        sub.scopeKey === BYOK_SCOPE_TEAM_SEAT ? "席" : "月"
      }`,
    );
    if (confirm) {
      await prisma.byokSubscription.update({
        where: { id: sub.id },
        data: { techServiceFeeYuan: target },
      });
    }
  }

  console.log(
    `[align-pricing] done · creditAccounts=${accounts.length} ppcUpdate=${ppcUpdates} ppcSkip=${ppcSkipped} · byok=${byokSubs.length} byokUpdate=${byokUpdates} byokSkip=${byokSkipped}`,
  );
  if (!confirm && (ppcUpdates > 0 || byokUpdates > 0)) {
    console.log("[align-pricing] 加 --confirm 写库");
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
