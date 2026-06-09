/**
 * 月度积分发放 / 重置（unified-credit-billing · 里程碑 4）
 *
 *   cd book-mall && pnpm exec dotenv -e .env.local -- tsx scripts/grant-monthly-credits.ts [--confirm] [--account=<id>] [--now=2026-07-01]
 *
 * 行为（见 doc/product/14-tenant-team-design.md §8.3「会员：周期末重置发放 monthlyGrantCredits」）：
 *   - 扫描所有「到期」积分账户（currentPeriodEnd 为空，或 ≤ 当前时间），且 monthlyGrantCredits > 0。
 *   - 把余额「重置」为该账户月发放额（会员月积分 use-it-or-lose-it）：delta>0 记 GRANT，delta<0 记 EXPIRE。
 *   - 积分按「月」刷新——年付套餐同样每月刷新（计费周期与积分刷新解耦），currentPeriodEnd 向后滚 1 个月。
 *   - 幂等：同一周期重复执行不重复发放（idempotencyKey=monthly_grant:<accountId>:<YYYY-MM>）。
 *   - 团队账户（ownerType=TENANT）仅当对应 Tenant.status=ACTIVE 且订阅未过期（Tenant.currentPeriodEnd）时发放。
 *
 * 默认 dry-run（仅预览），加 --confirm 才真正写入。
 */
import { prisma } from "../lib/prisma";
import { resetMonthlyCredits } from "../lib/billing/credit-account-service";

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}
function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

/** 周期 key（目标月）：YYYY-MM。 */
function periodKeyOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** 向后滚动 1 个自然月（保持「月初刷新」语义）。 */
function addOneMonth(d: Date): Date {
  const next = new Date(d);
  next.setMonth(next.getMonth() + 1);
  return next;
}

async function main() {
  const confirm = hasFlag("confirm");
  const onlyAccount = arg("account");
  const nowRaw = arg("now");
  const now = nowRaw ? new Date(nowRaw) : new Date();
  if (Number.isNaN(now.getTime())) throw new Error(`--now 非法日期：${nowRaw}`);

  console.log(
    `[grant-monthly] ${confirm ? "执行" : "DRY-RUN"} · 基准时间=${now.toISOString()}${onlyAccount ? ` · 仅账户 ${onlyAccount}` : ""}`,
  );

  const accounts = await prisma.creditAccount.findMany({
    where: {
      ...(onlyAccount ? { id: onlyAccount } : {}),
      monthlyGrantCredits: { gt: 0 },
      OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { lte: now } }],
    },
    select: {
      id: true,
      ownerType: true,
      ownerId: true,
      balanceCredits: true,
      monthlyGrantCredits: true,
      videoMonthlyGrant: true,
      perSeatCapCredits: true,
      planId: true,
      currentPeriodEnd: true,
    },
  });

  let granted = 0;
  let skipped = 0;
  let deduped = 0;

  for (const acc of accounts) {
    // 团队账户：仅当租户在用且订阅未过期才刷新积分
    if (acc.ownerType === "TENANT") {
      const tenant = await prisma.tenant.findUnique({
        where: { id: acc.ownerId },
        select: { status: true, currentPeriodEnd: true },
      });
      const subscriptionEnded =
        tenant?.currentPeriodEnd != null && tenant.currentPeriodEnd <= now;
      if (!tenant || tenant.status !== "ACTIVE" || subscriptionEnded) {
        skipped += 1;
        console.log(
          `  - 跳过 TENANT ${acc.ownerId}（status=${tenant?.status ?? "缺失"} 订阅末=${tenant?.currentPeriodEnd?.toISOString() ?? "—"}）`,
        );
        continue;
      }
    }

    // 目标周期 = 当前周期末（无则取基准时间），积分按月刷新
    const periodStart = acc.currentPeriodEnd ?? now;
    const periodKey = periodKeyOf(periodStart);
    const nextPeriodEnd = addOneMonth(periodStart);
    const delta = acc.monthlyGrantCredits - acc.balanceCredits;

    if (!confirm) {
      console.log(
        `  · [预览] ${acc.ownerType} ${acc.ownerId} 周期 ${periodKey} 余额 ${acc.balanceCredits} → ${acc.monthlyGrantCredits}（Δ${delta >= 0 ? "+" : ""}${delta}）下次末 ${nextPeriodEnd.toISOString().slice(0, 10)}`,
      );
      granted += 1;
      continue;
    }

    const res = await resetMonthlyCredits({
      ref: { ownerType: acc.ownerType, ownerId: acc.ownerId },
      monthlyGrantCredits: acc.monthlyGrantCredits,
      videoMonthlyGrantCredits: acc.videoMonthlyGrant ?? 0,
      periodKey,
      planId: acc.planId,
      nextPeriodEnd,
      perSeatCapCredits: acc.perSeatCapCredits,
    });
    if (res.deduped && res.delta === 0) {
      // 余额本就等于月额且本周期已发放
      deduped += 1;
    }
    granted += 1;
    console.log(
      `  · ${acc.ownerType} ${acc.ownerId} 周期 ${periodKey} ${res.balanceBefore} → ${res.target}（Δ${res.delta >= 0 ? "+" : ""}${res.delta}）${res.deduped ? "[幂等跳过流水]" : ""}`,
    );
  }

  console.log(
    `[grant-monthly] 完成：到期账户 ${accounts.length}，处理 ${granted}，跳过 ${skipped}${confirm ? `，幂等 ${deduped}` : "（DRY-RUN 未写入）"}`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
