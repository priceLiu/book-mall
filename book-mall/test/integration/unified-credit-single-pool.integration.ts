/**
 * 单积分 v2 — 双池合并与统一扣分集成测试（DB-backed）。
 *
 *   pnpm test:finance-integration
 */
import { randomUUID } from "node:crypto";

import { prisma } from "@/lib/prisma";
import {
  InsufficientCreditsError,
  getAccountCreditBalances,
  grantCredits,
  releaseReserved,
  reserveCredits,
  settleReserved,
} from "@/lib/billing/credit-account-service";
import {
  computePricePerCredit,
  computeUnifiedChargeCredits,
} from "@/lib/pricing/credit-pricing-formulas";

const SEEDANCE_U0_PER_SEC = 35;
const VIDEO_UNITS = 15;
const UNIFIED_CHARGE = computeUnifiedChargeCredits({
  creditsPerUnit: SEEDANCE_U0_PER_SEC,
  units: VIDEO_UNITS,
});

let failures = 0;
function check(label: string, cond: boolean, extra?: unknown) {
  if (cond) {
    console.log(`  ✓ ${label}`);
  } else {
    failures += 1;
    console.error(`  ✗ ${label}`, extra ?? "");
  }
}

async function ledgerTypesFor(accountId: string): Promise<Record<string, number>> {
  const rows = await prisma.creditLedger.groupBy({
    by: ["type"],
    where: { accountId },
    _count: { _all: true },
  });
  return Object.fromEntries(rows.map((r) => [r.type, r._count._all]));
}

async function accountId(ownerType: "USER" | "TENANT", ownerId: string): Promise<string> {
  const a = await prisma.creditAccount.findUniqueOrThrow({
    where: { ownerType_ownerId: { ownerType, ownerId } },
    select: { id: true },
  });
  return a.id;
}

async function main() {
  const createdAccountIds: string[] = [];

  try {
    check("Seedance 15s 统一扣分 = 525", UNIFIED_CHARGE === 525);

    // —————————————— 单池发放与结算 ——————————————
    const userId = `test-single-pool-${randomUUID()}`;
    const ppcAdvanced = computePricePerCredit(299, 6500);
    const ppcSupreme = computePricePerCredit(1199, 30000);
    console.log(
      `[个人] 高级 ppc=${ppcAdvanced.toFixed(6)} 至尊 ppc=${ppcSupreme.toFixed(6)} 扣分=${UNIFIED_CHARGE}`,
    );

    await grantCredits({
      ref: { ownerType: "USER", ownerId: userId },
      credits: 6500,
      monthlyGrantCredits: 6500,
      pricePerCreditYuan: ppcAdvanced,
      description: "[test] 单池发放",
    });
    const userAccId = await accountId("USER", userId);
    createdAccountIds.push(userAccId);

    const logSuccess = `test-log-${randomUUID()}`;
    await reserveCredits({
      ref: { ownerType: "USER", ownerId: userId },
      credits: UNIFIED_CHARGE,
      idempotencyKey: `reserve:${logSuccess}`,
    });
    let bal = await getAccountCreditBalances({ ownerType: "USER", ownerId: userId });
    check("冻结后总余额 = 6500 − 扣分", bal.balance === 6500 - UNIFIED_CHARGE, bal);

    await settleReserved({
      ref: { ownerType: "USER", ownerId: userId },
      credits: UNIFIED_CHARGE,
      idempotencyKey: `settle:${logSuccess}`,
    });
    bal = await getAccountCreditBalances({ ownerType: "USER", ownerId: userId });
    check("SETTLE 后余额不变", bal.balance === 6500 - UNIFIED_CHARGE, bal);

    // 退款路径
    const logFail = `test-log-${randomUUID()}`;
    await reserveCredits({
      ref: { ownerType: "USER", ownerId: userId },
      credits: UNIFIED_CHARGE,
      idempotencyKey: `reserve:${logFail}`,
    });
    await releaseReserved({
      ref: { ownerType: "USER", ownerId: userId },
      credits: UNIFIED_CHARGE,
      idempotencyKey: `release:${logFail}`,
    });
    bal = await getAccountCreditBalances({ ownerType: "USER", ownerId: userId });
    check("RELEASE 后余额复原", bal.balance === 6500 - UNIFIED_CHARGE, bal);

    const userTypes = await ledgerTypesFor(userAccId);
    check(
      "流水含 RESERVE×2 / SETTLE×1 / RELEASE×1",
      userTypes.RESERVE === 2 && userTypes.SETTLE === 1 && userTypes.RELEASE === 1,
      userTypes,
    );

    // —————————————— 单池余额不足拦截 ——————————————
    const lowUser = `test-low-${randomUUID()}`;
    await grantCredits({
      ref: { ownerType: "USER", ownerId: lowUser },
      credits: 100,
      monthlyGrantCredits: 100,
      pricePerCreditYuan: ppcAdvanced,
      description: "[test] 余额不足",
    });
    const lowAccId = await accountId("USER", lowUser);
    createdAccountIds.push(lowAccId);
    let blocked = false;
    try {
      await reserveCredits({
        ref: { ownerType: "USER", ownerId: lowUser },
        credits: UNIFIED_CHARGE,
        idempotencyKey: `reserve:test-${randomUUID()}`,
      });
    } catch (e) {
      blocked = e instanceof InsufficientCreditsError;
    }
    check("总积分不足 → 冻结被拦截", blocked);

    // —————————————— 团队共享池 ——————————————
    const tenantId = `test-team-${randomUUID()}`;
    const teamPpc = computePricePerCredit(3597, 33300);
    await grantCredits({
      ref: { ownerType: "TENANT", ownerId: tenantId },
      credits: 10000,
      monthlyGrantCredits: 10000,
      pricePerCreditYuan: teamPpc,
      description: "[test] 团队单池",
    });
    const teamAccId = await accountId("TENANT", tenantId);
    createdAccountIds.push(teamAccId);

    for (const member of ["memberA", "memberB"]) {
      const log = `test-log-${randomUUID()}`;
      await reserveCredits({
        ref: { ownerType: "TENANT", ownerId: tenantId },
        credits: UNIFIED_CHARGE,
        actorUserId: member,
        idempotencyKey: `reserve:${log}`,
      });
      await settleReserved({
        ref: { ownerType: "TENANT", ownerId: tenantId },
        credits: UNIFIED_CHARGE,
        actorUserId: member,
        idempotencyKey: `settle:${log}`,
      });
    }
    const teamBal = await getAccountCreditBalances({ ownerType: "TENANT", ownerId: tenantId });
    check(
      "团队池余额 = 10000 − 2×扣分",
      teamBal.balance === 10000 - 2 * UNIFIED_CHARGE,
      teamBal,
    );
    const settleByActor = await prisma.creditLedger.groupBy({
      by: ["actorUserId"],
      where: { accountId: teamAccId, type: "SETTLE" },
      _count: { _all: true },
    });
    check(
      "SETTLE 按成员归口：A/B 各 1 条",
      settleByActor.length === 2 && settleByActor.every((s) => s._count._all === 1),
      settleByActor,
    );

    console.log("");
    if (failures === 0) {
      console.log("✅ 单积分单池集成断言通过");
    } else {
      console.error(`❌ ${failures} 项断言失败`);
    }
  } finally {
    if (createdAccountIds.length) {
      await prisma.creditLot.deleteMany({ where: { accountId: { in: createdAccountIds } } });
      await prisma.creditLedger.deleteMany({ where: { accountId: { in: createdAccountIds } } });
      await prisma.creditAccount.deleteMany({ where: { id: { in: createdAccountIds } } });
      console.log(`(已清理 ${createdAccountIds.length} 个测试账户与其流水)`);
    }
    await prisma.$disconnect();
  }

  if (failures > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
