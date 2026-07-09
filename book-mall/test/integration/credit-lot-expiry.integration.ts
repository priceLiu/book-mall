/**
 * 积分批次到期（CreditLot）集成测试（DB-backed，用 tsx 跑）。
 *
 *   pnpm test:credit-lot-integration
 *
 * 覆盖（积分清零 1.0 · docs/积分清零.md / doc/product/19-credit-expiry.md）：
 *  - TC-来源到期：订阅/充值/免费三类批次 source + expiresAt 正确。
 *  - TC-FIFO：消费优先扣最先到期批次，跨多批次。
 *  - TC-reserve→settle：冻结不动批次，结算才扣批次。
 *  - TC-reserve→release：释放全额，批次不变。
 *  - TC-refund：消费后 refund 回补批次。
 *  - TC-sweep：到期批次被清扫写 EXPIRE、批次归零、余额扣减。
 *  - TC-对账：sum(未过期 lot.remaining) == balance + reserved（不变量）。
 *  - TC-月度重置：清上一周期订阅批次、保留充值/免费、发本周期。
 *
 * 用真随机 ownerId 直接操作 CreditAccount（不依赖 User 外键），finally 清理，对现网零污染。
 */
import { randomUUID } from "node:crypto";

import { prisma } from "@/lib/prisma";
import {
  consumeCredits,
  expireDueLotsForAccount,
  getPoolBalances,
  grantCredits,
  refundCredits,
  releaseReserved,
  reserveCredits,
  resetMonthlyCredits,
  settleReserved,
  topupCredits,
} from "@/lib/billing/credit-account-service";
import { addDays, addMonths } from "@/lib/billing/credit-lot-logic";

let failures = 0;
function check(label: string, cond: boolean, extra?: unknown) {
  if (cond) {
    console.log(`  ✓ ${label}`);
  } else {
    failures += 1;
    console.error(`  ✗ ${label}`, extra ?? "");
  }
}

async function accId(ownerId: string): Promise<string> {
  const a = await prisma.creditAccount.findUniqueOrThrow({
    where: { ownerType_ownerId: { ownerType: "USER", ownerId } },
    select: { id: true },
  });
  return a.id;
}

async function lots(accountId: string, pool: "GENERAL" | "VIDEO" = "GENERAL") {
  return prisma.creditLot.findMany({
    where: { accountId, pool },
    orderBy: { grantedAt: "asc" },
    select: { source: true, remainingCredits: true, originalCredits: true, expiresAt: true, periodKey: true },
  });
}

/** 不变量：sum(未过期 lot.remaining) == balance + reserved。 */
async function assertInvariant(accountId: string, label: string) {
  const acc = await prisma.creditAccount.findUniqueOrThrow({
    where: { id: accountId },
    select: { balanceCredits: true, reservedCredits: true, videoBalanceCredits: true, videoReservedCredits: true },
  });
  const now = new Date();
  for (const pool of ["GENERAL", "VIDEO"] as const) {
    const active = await prisma.creditLot.findMany({
      where: { accountId, pool, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      select: { remainingCredits: true },
    });
    const sumLots = active.reduce((s, l) => s + l.remainingCredits, 0);
    const owned =
      pool === "VIDEO"
        ? acc.videoBalanceCredits + acc.videoReservedCredits
        : acc.balanceCredits + acc.reservedCredits;
    check(`${label} · 对账 ${pool}：sum(lots)=${sumLots} == balance+reserved=${owned}`, sumLots === owned);
  }
}

async function main() {
  const createdAccountIds: string[] = [];
  try {
    // —————————————— TC-来源到期 + TC-FIFO ——————————————
    const uid = `test-lot-${randomUUID()}`;
    const ref = { ownerType: "USER" as const, ownerId: uid };

    // 订阅：500 通用，expiresAt=周期末（近期）
    const periodEnd = addDays(new Date(), 15);
    await grantCredits({
      ref,
      credits: 500,
      monthlyGrantCredits: 500,
      currentPeriodEnd: periodEnd,
      idempotencyKey: `grant:${uid}`,
    });
    // 免费：200，30 天
    await topupCredits({ ref, credits: 200, source: "FREE", idempotencyKey: `free:${uid}`, refType: "welcome_gift" });
    // 充值：1000，12 个月
    await topupCredits({ ref, credits: 1000, idempotencyKey: `topup:${uid}` });

    const id = await accId(uid);
    createdAccountIds.push(id);

    const l0 = await lots(id);
    check("三批次建立（订阅/免费/充值）", l0.length === 3, l0);
    const sub = l0.find((l) => l.source === "SUBSCRIPTION");
    const free = l0.find((l) => l.source === "FREE");
    const top = l0.find((l) => l.source === "TOPUP");
    check("订阅批次 expiresAt=周期末", !!sub && sub.expiresAt?.getTime() === periodEnd.getTime(), sub);
    check(
      "免费批次 30 天（±1 天容差）",
      !!free && !!free.expiresAt && Math.abs(free.expiresAt.getTime() - addDays(new Date(), 30).getTime()) < 864e5,
      free,
    );
    check(
      "充值批次 12 个月（±2 天容差）",
      !!top && !!top.expiresAt && Math.abs(top.expiresAt.getTime() - addMonths(new Date(), 12).getTime()) < 2 * 864e5,
      top,
    );
    const bal0 = await getPoolBalances(ref);
    check("初始余额 = 500+200+1000 = 1700", bal0.general.balance === 1700, bal0.general);
    await assertInvariant(id, "初始");

    // FIFO：消费 550 → 先扣订阅 500，再扣免费 50（订阅到期最近）
    await consumeCredits({ ref, credits: 550, idempotencyKey: `c1:${uid}` });
    const l1 = await lots(id);
    check("FIFO：订阅批次归零", l1.find((l) => l.source === "SUBSCRIPTION")?.remainingCredits === 0, l1);
    check("FIFO：免费批次剩 150", l1.find((l) => l.source === "FREE")?.remainingCredits === 150, l1);
    check("FIFO：充值批次不动 1000", l1.find((l) => l.source === "TOPUP")?.remainingCredits === 1000, l1);
    await assertInvariant(id, "FIFO 后");

    // —————————————— TC-reserve→settle ——————————————
    await reserveCredits({ ref, credits: 100, idempotencyKey: `r1:${uid}` });
    const lAfterReserve = await lots(id);
    check(
      "reserve 不动批次（免费仍 150 / 充值 1000）",
      lAfterReserve.find((l) => l.source === "FREE")?.remainingCredits === 150 &&
        lAfterReserve.find((l) => l.source === "TOPUP")?.remainingCredits === 1000,
      lAfterReserve,
    );
    await assertInvariant(id, "reserve 后");
    await settleReserved({ ref, credits: 100, idempotencyKey: `s1:${uid}` });
    const lAfterSettle = await lots(id);
    check(
      "settle 扣批次：免费 150→50（100 从免费扣）",
      lAfterSettle.find((l) => l.source === "FREE")?.remainingCredits === 50,
      lAfterSettle,
    );
    await assertInvariant(id, "settle 后");

    // —————————————— TC-reserve→release ——————————————
    await reserveCredits({ ref, credits: 40, idempotencyKey: `r2:${uid}` });
    await releaseReserved({ ref, credits: 40, idempotencyKey: `rel2:${uid}` });
    const lAfterRelease = await lots(id);
    check(
      "release 后批次复原（免费 50 / 充值 1000）",
      lAfterRelease.find((l) => l.source === "FREE")?.remainingCredits === 50 &&
        lAfterRelease.find((l) => l.source === "TOPUP")?.remainingCredits === 1000,
      lAfterRelease,
    );
    await assertInvariant(id, "release 后");

    // —————————————— TC-refund ——————————————
    // 当前免费 50 / 充值 1000。消费 60 → 免费 50→0，充值 1000→990。
    await consumeCredits({ ref, credits: 60, idempotencyKey: `c2:${uid}` });
    // refund 30 → 回补最早到期活跃批次（免费最早到期，回补免费）
    await refundCredits({ ref, credits: 30, idempotencyKey: `rf2:${uid}` });
    await assertInvariant(id, "refund 后");
    const balAfterRefund = await getPoolBalances(ref);
    // 1700 -550 -100(settle) -60 +30 = 1020
    check("refund 后余额 = 1020", balAfterRefund.general.balance === 1020, balAfterRefund.general);

    // —————————————— TC-sweep（到期清扫）——————————————
    const uid2 = `test-lot-sweep-${randomUUID()}`;
    const ref2 = { ownerType: "USER" as const, ownerId: uid2 };
    await topupCredits({ ref: ref2, credits: 300, source: "FREE", idempotencyKey: `free2:${uid2}`, refType: "welcome_gift" });
    await topupCredits({ ref: ref2, credits: 700, idempotencyKey: `topup2:${uid2}` });
    const id2 = await accId(uid2);
    createdAccountIds.push(id2);
    // 把免费批次强制改为已过期
    await prisma.creditLot.updateMany({
      where: { accountId: id2, source: "FREE" },
      data: { expiresAt: addDays(new Date(), -1) },
    });
    const r = await expireDueLotsForAccount(ref2);
    check("清扫过期免费 300", r.expiredGeneral === 300, r);
    const balAfterSweep = await getPoolBalances(ref2);
    check("清扫后余额 = 700（仅剩充值）", balAfterSweep.general.balance === 700, balAfterSweep.general);
    const expireLedger = await prisma.creditLedger.count({ where: { accountId: id2, type: "EXPIRE" } });
    check("写入 EXPIRE 流水", expireLedger >= 1, expireLedger);
    await assertInvariant(id2, "清扫后");

    // —————————————— TC-月度重置 ——————————————
    const uid3 = `test-lot-reset-${randomUUID()}`;
    const ref3 = { ownerType: "USER" as const, ownerId: uid3 };
    await grantCredits({
      ref: ref3,
      credits: 500,
      monthlyGrantCredits: 500,
      currentPeriodEnd: addDays(new Date(), -1),
      idempotencyKey: `grant3:${uid3}`,
    });
    await topupCredits({ ref: ref3, credits: 400, idempotencyKey: `topup3:${uid3}` });
    const id3 = await accId(uid3);
    createdAccountIds.push(id3);
    // 消费 100（先扣订阅到期最近？订阅 expiresAt 已过 → 不在活跃集，扣充值）——为稳定，消费前不动。
    await resetMonthlyCredits({
      ref: ref3,
      monthlyGrantCredits: 500,
      periodKey: "2026-08",
      nextPeriodEnd: addDays(new Date(), 29),
    });
    const l3 = await lots(id3);
    const subLots = l3.filter((l) => l.source === "SUBSCRIPTION" && l.remainingCredits > 0);
    check("月度重置：仅一个有效订阅批次（本周期）", subLots.length === 1 && subLots[0]!.periodKey === "2026-08", subLots);
    check("月度重置：保留充值批次 400", l3.find((l) => l.source === "TOPUP")?.remainingCredits === 400, l3);
    const bal3 = await getPoolBalances(ref3);
    check("月度重置后余额 = 500(新订阅)+400(充值) = 900", bal3.general.balance === 900, bal3.general);
    await assertInvariant(id3, "月度重置后");

    console.log("");
    if (failures === 0) console.log("✅ 全部集成断言通过");
    else console.error(`❌ ${failures} 项断言失败`);
  } finally {
    if (createdAccountIds.length) {
      await prisma.creditLot.deleteMany({ where: { accountId: { in: createdAccountIds } } });
      await prisma.creditLedger.deleteMany({ where: { accountId: { in: createdAccountIds } } });
      await prisma.creditAccount.deleteMany({ where: { id: { in: createdAccountIds } } });
      console.log(`(已清理 ${createdAccountIds.length} 个测试账户与其流水/批次)`);
    }
    await prisma.$disconnect();
  }
  if (failures > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
