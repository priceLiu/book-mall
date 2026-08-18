/**
 * 财务 2.0 — 视频生成/个人/团队 集成测试（v2 单池 + 统一 U₀）。
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
import { deriveEcomBillingMode } from "@/lib/billing/billing-persona";

const SEEDANCE_U0_PER_SEC = 35;
const VIDEO_UNITS = 15;
const UNIFIED_CHARGE = computeUnifiedChargeCredits({
  creditsPerUnit: SEEDANCE_U0_PER_SEC,
  units: VIDEO_UNITS,
});
const VIDEO_COST_YUAN = 15;

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
    const ppc = computePricePerCredit(299, 6500);
    console.log(`[个人] 高级版 ppc=${ppc.toFixed(6)}，统一扣分=${UNIFIED_CHARGE}`);

    const userId = `test-fin2-user-${randomUUID()}`;
    await grantCredits({
      ref: { ownerType: "USER", ownerId: userId },
      credits: 6500,
      monthlyGrantCredits: 6500,
      pricePerCreditYuan: ppc,
      description: "[test] 高级版单池",
    });
    const userAccId = await accountId("USER", userId);
    createdAccountIds.push(userAccId);

    const logSuccess = `test-log-${randomUUID()}`;
    await reserveCredits({
      ref: { ownerType: "USER", ownerId: userId },
      credits: UNIFIED_CHARGE,
      costSnapshotYuan: VIDEO_COST_YUAN,
      idempotencyKey: `reserve:${logSuccess}`,
    });
    let bal = await getAccountCreditBalances({ ownerType: "USER", ownerId: userId });
    check("冻结后余额 = 6500 − 扣分", bal.balance === 6500 - UNIFIED_CHARGE, bal);

    await settleReserved({
      ref: { ownerType: "USER", ownerId: userId },
      credits: UNIFIED_CHARGE,
      costSnapshotYuan: VIDEO_COST_YUAN,
      marginSnapshot: 0,
      idempotencyKey: `settle:${logSuccess}`,
    });
    bal = await getAccountCreditBalances({ ownerType: "USER", ownerId: userId });
    check("SETTLE 后余额 = 6500 − 扣分", bal.balance === 6500 - UNIFIED_CHARGE, bal);

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

    const isoUser = `test-fin2-iso-${randomUUID()}`;
    await grantCredits({
      ref: { ownerType: "USER", ownerId: isoUser },
      credits: 100,
      monthlyGrantCredits: 100,
      pricePerCreditYuan: ppc,
      description: "[test] 余额不足",
    });
    const isoAccId = await accountId("USER", isoUser);
    createdAccountIds.push(isoAccId);
    let blocked = false;
    try {
      await reserveCredits({
        ref: { ownerType: "USER", ownerId: isoUser },
        credits: UNIFIED_CHARGE,
        idempotencyKey: `reserve:test-${randomUUID()}`,
      });
    } catch (e) {
      blocked = e instanceof InsufficientCreditsError;
    }
    check("总积分不足 → 冻结被拦截", blocked);

    const tenantId = `test-fin2-team-${randomUUID()}`;
    const teamPpc = computePricePerCredit(3597, 33300);
    console.log(`[团队] ppc=${teamPpc.toFixed(6)}，统一扣分=${UNIFIED_CHARGE}`);
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
        costSnapshotYuan: VIDEO_COST_YUAN,
        marginSnapshot: 0,
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
    console.log("[persona] billingPersona → ecomBillingMode");
    check(
      "PLATFORM_CREDIT → PLATFORM_METERED",
      deriveEcomBillingMode("PLATFORM_CREDIT") === "PLATFORM_METERED",
    );
    check(
      "BYOK → BYOK_SERVICE_FEE",
      deriveEcomBillingMode("BYOK") === "BYOK_SERVICE_FEE",
    );

    console.log("");
    if (failures === 0) {
      console.log("✅ 全部集成断言通过");
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
