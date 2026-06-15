/**
 * 财务 2.0 — 视频生成/个人/团队 集成测试（DB-backed，用 tsx 跑）。
 *
 *   pnpm test:finance-integration
 *
 * 覆盖验收用例（docs/财务2.0-测试用例.md / 验收标准 §1–§2）：
 *  - TC-个人视频：高级版冻结 → SUCCEEDED 结算，余额 = 月积分 − 单条扣分；流水含 RESERVE+SETTLE。
 *  - TC-个人退款：厂商全失败 → RELEASE 解冻全额返还，余额复原。
 *  - TC-视频池隔离：视频池耗尽拦截，通用池不受影响。
 *  - TC-团队分账：租户共享视频池，成员 A/B 各结算一条，SETTLE 流水按成员归口。
 *
 * 用真随机 ownerId 直接操作 CreditAccount（不依赖 User/GatewayRequestLog 外键），
 * 跑完 finally 清理本次创建的账户与流水，对现网数据零污染。
 */
import { randomUUID } from "node:crypto";

import { prisma } from "@/lib/prisma";
import {
  InsufficientCreditsError,
  getPoolBalances,
  grantCredits,
  releaseReserved,
  reserveCredits,
  settleReserved,
} from "@/lib/billing/credit-account-service";
import { computePricePerCredit, computeTierCredits } from "@/lib/pricing/credit-pricing-formulas";
import { deriveEcomBillingMode } from "@/lib/billing/billing-persona";

const VIDEO_LIST_YUAN = 0.81 * 15; // 12.15（净 0.81/秒 × 15s × M=1.0 贵视频）
const VIDEO_COST_YUAN = 0.81 * 15; // 12.15

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
    // —————————————— TC-个人视频 + TC-个人退款 ——————————————
    const userId = `test-fin2-user-${randomUUID()}`;
    const ppc = computePricePerCredit(299, 6500); // 高级版个人
    const perVideo = computeTierCredits(VIDEO_LIST_YUAN, ppc); // 期望 264
    console.log(`[个人] 高级版单价 ¥${ppc.toFixed(6)}，单条 15s 视频扣分 = ${perVideo}`);

    await grantCredits({
      ref: { ownerType: "USER", ownerId: userId },
      credits: 0,
      videoCredits: 6500,
      videoMonthlyGrantCredits: 6500,
      pricePerCreditYuan: ppc,
      description: "[test] 高级版视频池",
    });
    const userAccId = await accountId("USER", userId);
    createdAccountIds.push(userAccId);

    const logSuccess = `test-log-${randomUUID()}`;
    await reserveCredits({
      ref: { ownerType: "USER", ownerId: userId },
      credits: perVideo,
      pool: "VIDEO",
      costSnapshotYuan: VIDEO_COST_YUAN,
      idempotencyKey: `reserve:${logSuccess}`,
    });
    let bal = await getPoolBalances({ ownerType: "USER", ownerId: userId });
    check("冻结后视频余额 = 6500 − 扣分", bal.video.balance === 6500 - perVideo, bal.video);
    check("冻结计数 = 扣分", bal.video.reserved === perVideo, bal.video);

    await settleReserved({
      ref: { ownerType: "USER", ownerId: userId },
      credits: perVideo,
      pool: "VIDEO",
      costSnapshotYuan: VIDEO_COST_YUAN,
      marginSnapshot: 0,
      idempotencyKey: `settle:${logSuccess}`,
    });
    bal = await getPoolBalances({ ownerType: "USER", ownerId: userId });
    check("SETTLE 后视频余额 = 6500 − 扣分（不再变）", bal.video.balance === 6500 - perVideo, bal.video);
    check("SETTLE 后冻结清零", bal.video.reserved === 0, bal.video);

    // 退款路径：再冻结一条，厂商全失败 → RELEASE 全额返还
    const logFail = `test-log-${randomUUID()}`;
    await reserveCredits({
      ref: { ownerType: "USER", ownerId: userId },
      credits: perVideo,
      pool: "VIDEO",
      idempotencyKey: `reserve:${logFail}`,
    });
    await releaseReserved({
      ref: { ownerType: "USER", ownerId: userId },
      credits: perVideo,
      pool: "VIDEO",
      idempotencyKey: `release:${logFail}`,
    });
    bal = await getPoolBalances({ ownerType: "USER", ownerId: userId });
    check("RELEASE 后视频余额复原 = 6500 − 首条扣分", bal.video.balance === 6500 - perVideo, bal.video);
    check("RELEASE 后冻结为 0", bal.video.reserved === 0, bal.video);

    const userTypes = await ledgerTypesFor(userAccId);
    check("流水含 RESERVE×2 / SETTLE×1 / RELEASE×1", userTypes.RESERVE === 2 && userTypes.SETTLE === 1 && userTypes.RELEASE === 1, userTypes);

    // —————————————— TC-视频池隔离 ——————————————
    const isoUser = `test-fin2-iso-${randomUUID()}`;
    await grantCredits({
      ref: { ownerType: "USER", ownerId: isoUser },
      credits: 5000, // 通用池充足
      videoCredits: 100, // 视频池很小，不足一条
      videoMonthlyGrantCredits: 100,
      pricePerCreditYuan: ppc,
      description: "[test] 池隔离",
    });
    const isoAccId = await accountId("USER", isoUser);
    createdAccountIds.push(isoAccId);
    let blocked = false;
    try {
      await reserveCredits({
        ref: { ownerType: "USER", ownerId: isoUser },
        credits: perVideo,
        pool: "VIDEO",
        idempotencyKey: `reserve:test-${randomUUID()}`,
      });
    } catch (e) {
      blocked = e instanceof InsufficientCreditsError;
    }
    check("视频池不足 → 冻结被拦截", blocked);
    const isoBal = await getPoolBalances({ ownerType: "USER", ownerId: isoUser });
    check("通用池余额不受影响 = 5000", isoBal.general.balance === 5000, isoBal.general);

    // —————————————— TC-团队分账 ——————————————
    const tenantId = `test-fin2-team-${randomUUID()}`;
    const teamPpc = computePricePerCredit(1199, 33300); // 团队高级版每席
    const teamPerVideo = computeTierCredits(VIDEO_LIST_YUAN, teamPpc); // 期望 337
    console.log(`[团队] 高级版每席单价 ¥${teamPpc.toFixed(6)}，单条扣分 = ${teamPerVideo}`);
    await grantCredits({
      ref: { ownerType: "TENANT", ownerId: tenantId },
      credits: 0,
      videoCredits: 10000, // 2 席共享池
      videoMonthlyGrantCredits: 10000,
      pricePerCreditYuan: teamPpc,
      description: "[test] 团队共享视频池",
    });
    const teamAccId = await accountId("TENANT", tenantId);
    createdAccountIds.push(teamAccId);

    for (const member of ["memberA", "memberB"]) {
      const log = `test-log-${randomUUID()}`;
      await reserveCredits({
        ref: { ownerType: "TENANT", ownerId: tenantId },
        credits: teamPerVideo,
        pool: "VIDEO",
        actorUserId: member,
        idempotencyKey: `reserve:${log}`,
      });
      await settleReserved({
        ref: { ownerType: "TENANT", ownerId: tenantId },
        credits: teamPerVideo,
        pool: "VIDEO",
        actorUserId: member,
        costSnapshotYuan: VIDEO_COST_YUAN,
        marginSnapshot: 0,
        idempotencyKey: `settle:${log}`,
      });
    }
    const teamBal = await getPoolBalances({ ownerType: "TENANT", ownerId: tenantId });
    check("团队共享池余额 = 10000 − 2×扣分", teamBal.video.balance === 10000 - 2 * teamPerVideo, teamBal.video);
    const settleByActor = await prisma.creditLedger.groupBy({
      by: ["actorUserId"],
      where: { accountId: teamAccId, type: "SETTLE" },
      _count: { _all: true },
    });
    check("SETTLE 按成员归口：A/B 各 1 条", settleByActor.length === 2 && settleByActor.every((s) => s._count._all === 1), settleByActor);

    console.log("");

    // —————————————— TC-billing-persona 映射 ——————————————
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
