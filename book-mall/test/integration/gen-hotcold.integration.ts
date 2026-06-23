/**
 * Gen-HotCold-R2 — 并发压测集成（DB-backed，用 tsx 跑）。
 *
 *   pnpm --dir book-mall test:gen-hotcold-integration
 *
 * 验证 Phase 3（账户 advisory 串行写）与 Phase 2（状态投影自愈）核心保证：
 *  - TC-1 同账户 8 并发 reserve：无丢更新，余额/预占精确，8 条 RESERVE 的 balanceAfter 互不相同。
 *  - TC-2 同账户 8 并发 reserve+settle 混合：无负值、最终一致。
 *  - TC-3 不同账户 8 并发：互不阻塞，全部成功。
 *  - TC-4 状态投影自愈：reconcile 写入后，getProjectedDashboardCards 命中缓存返回同值。
 *
 * 用真随机 ownerId 直接操作 CreditAccount（不依赖外键），finally 清理本次创建数据，对现网零污染。
 */
import { randomUUID } from "node:crypto";

import {
  getPoolBalances,
  grantCredits,
  reserveCredits,
  settleReserved,
} from "@/lib/billing/credit-account-service";
import {
  getProjectedDashboardCards,
  reconcileGatewayStatsCounter,
} from "@/lib/gateway/stats-counter";
import { prisma } from "@/lib/prisma";

let failures = 0;
function check(label: string, cond: boolean, extra?: unknown) {
  if (cond) {
    console.log(`  ✓ ${label}`);
  } else {
    failures += 1;
    console.error(`  ✗ ${label}`, extra ?? "");
  }
}

async function accountId(ownerId: string): Promise<string> {
  const a = await prisma.creditAccount.findUniqueOrThrow({
    where: { ownerType_ownerId: { ownerType: "USER", ownerId } },
    select: { id: true },
  });
  return a.id;
}

async function main() {
  const createdAccountIds: string[] = [];
  const createdScopeKeys: string[] = [];

  try {
    // ———————————— TC-1 同账户 8 并发 reserve ————————————
    const u1 = `test-ghc-u1-${randomUUID()}`;
    await grantCredits({
      ref: { ownerType: "USER", ownerId: u1 },
      credits: 8000,
      description: "[test] ghc u1",
    });
    createdAccountIds.push(await accountId(u1));

    const N = 8;
    const reserves = await Promise.all(
      Array.from({ length: N }, () =>
        reserveCredits({
          ref: { ownerType: "USER", ownerId: u1 },
          credits: 100,
          pool: "GENERAL",
        }),
      ),
    );
    const balAfter1 = await getPoolBalances({ ownerType: "USER", ownerId: u1 });
    check("TC-1 余额 = 8000 − 800 = 7200", balAfter1.general.balance === 7200, balAfter1.general);
    check("TC-1 预占 = 800", balAfter1.general.reserved === 800, balAfter1.general);

    const balanceAfters = reserves
      .map((r) => r?.balanceAfter)
      .filter((v): v is number => typeof v === "number");
    const uniq = new Set(balanceAfters);
    check(
      "TC-1 8 条 RESERVE 的 balanceAfter 互不相同（无丢更新）",
      balanceAfters.length === N && uniq.size === N,
      balanceAfters,
    );
    check(
      "TC-1 balanceAfter 集合 = {7900..7200}",
      [7900, 7800, 7700, 7600, 7500, 7400, 7300, 7200].every((v) => uniq.has(v)),
      [...uniq].sort((a, b) => b - a),
    );

    // ———————————— TC-2 同账户 reserve+settle 混合并发 ————————————
    const u2 = `test-ghc-u2-${randomUUID()}`;
    await grantCredits({
      ref: { ownerType: "USER", ownerId: u2 },
      credits: 10000,
      description: "[test] ghc u2",
    });
    createdAccountIds.push(await accountId(u2));
    // 先预占 800（8×100），再并发结算其中 4 条
    await Promise.all(
      Array.from({ length: 8 }, () =>
        reserveCredits({ ref: { ownerType: "USER", ownerId: u2 }, credits: 100, pool: "GENERAL" }),
      ),
    );
    await Promise.all(
      Array.from({ length: 4 }, () =>
        settleReserved({ ref: { ownerType: "USER", ownerId: u2 }, credits: 100, pool: "GENERAL" }),
      ),
    );
    const balAfter2 = await getPoolBalances({ ownerType: "USER", ownerId: u2 });
    check("TC-2 预占 = 800 − 400 = 400", balAfter2.general.reserved === 400, balAfter2.general);
    check("TC-2 无负余额/负预占", balAfter2.general.balance >= 0 && balAfter2.general.reserved >= 0, balAfter2.general);

    // ———————————— TC-3 不同账户 8 并发互不阻塞 ————————————
    const others = Array.from({ length: 8 }, () => `test-ghc-u3-${randomUUID()}`);
    await Promise.all(
      others.map((o) =>
        grantCredits({ ref: { ownerType: "USER", ownerId: o }, credits: 1000, description: "[test] ghc u3" }),
      ),
    );
    for (const o of others) createdAccountIds.push(await accountId(o));
    const t0 = Date.now();
    const res3 = await Promise.all(
      others.map((o) =>
        reserveCredits({ ref: { ownerType: "USER", ownerId: o }, credits: 100, pool: "GENERAL" }),
      ),
    );
    check("TC-3 不同账户 8 并发全部成功", res3.every((r) => r != null));
    console.log(`  · TC-3 8 个独立账户并发 reserve 用时 ${Date.now() - t0}ms`);

    // ———————————— TC-4 状态投影自愈 ————————————
    const scopeKey = `test-ghc-scope-${randomUUID()}`;
    createdScopeKeys.push(scopeKey);
    const authoritative = {
      inProgress: 3,
      succeeded: 42,
      failed: 1,
      cancelled: 0,
      slowWarn: 2,
      backgroundWait: 1,
    };
    await reconcileGatewayStatsCounter(scopeKey, authoritative, 5);
    let recomputeCalled = 0;
    const cards = await getProjectedDashboardCards({
      scopeKey,
      ttlMs: 60_000,
      recompute: async () => {
        recomputeCalled += 1;
        return { inProgress: 0, succeeded: 0, failed: 0, cancelled: 0, slowWarn: 0, backgroundWait: 0 };
      },
    });
    check("TC-4 新鲜投影命中缓存（不重算）", recomputeCalled === 0);
    check("TC-4 返回权威值", cards.inProgress === 3 && cards.succeeded === 42 && cards.slowWarn === 2, cards);
  } finally {
    // 清理：流水 → 账户 → 投影
    if (createdAccountIds.length > 0) {
      await prisma.creditLedger.deleteMany({ where: { accountId: { in: createdAccountIds } } }).catch(() => undefined);
      await prisma.creditAccount.deleteMany({ where: { id: { in: createdAccountIds } } }).catch(() => undefined);
    }
    for (const scopeKey of createdScopeKeys) {
      await prisma.gatewayStatsCounter.deleteMany({ where: { scopeKey } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  }

  if (failures > 0) {
    console.error(`\n✗ Gen-HotCold 集成失败：${failures} 项`);
    process.exit(1);
  }
  console.log("\n✓ Gen-HotCold 集成全部通过");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
