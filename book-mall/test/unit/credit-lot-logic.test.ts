import { describe, expect, it } from "vitest";
import type { CreditSource } from "@prisma/client";

import {
  addDays,
  addMonths,
  computeOwnedDelta,
  FREE_VALIDITY_DAYS,
  type LotRow,
  monthPeriodKeyOf,
  planAllocation,
  planExpiry,
  planRestoreTargetId,
  resolveLotExpiry,
  sortLotsForSpend,
  SUBSCRIPTION_CREDIT_VALIDITY_DAYS,
  subscriptionCreditPeriodEnd,
  subscriptionCreditPeriodKey,
  TOPUP_VALIDITY_MONTHS,
} from "@/lib/billing/credit-lot-logic";

function lot(
  id: string,
  source: CreditSource,
  remainingCredits: number,
  expiresAt: Date | null,
  grantedAt = new Date("2026-01-01T00:00:00Z"),
): LotRow {
  return { id, source, remainingCredits, expiresAt, grantedAt };
}

const d = (iso: string) => new Date(iso);

describe("addDays / addMonths / monthPeriodKeyOf", () => {
  it("addDays 30 天", () => {
    expect(addDays(d("2026-01-01T00:00:00Z"), 30).getTime()).toBe(
      d("2026-01-31T00:00:00Z").getTime(),
    );
  });
  it("addMonths 12 个月跨年", () => {
    const r = addMonths(d("2026-07-09T00:00:00Z"), 12);
    expect(r.getFullYear()).toBe(2027);
    expect(r.getMonth()).toBe(6); // July (0-based)
  });
  it("monthPeriodKeyOf 补零", () => {
    expect(monthPeriodKeyOf(new Date(2026, 2, 15))).toBe("2026-03");
    expect(monthPeriodKeyOf(new Date(2026, 10, 1))).toBe("2026-11");
  });
});

describe("computeOwnedDelta（已拥有额度变化）", () => {
  it("RESERVE：balance-c + reserved+c = 0（批次不动）", () => {
    expect(computeOwnedDelta(-100, 100)).toBe(0);
  });
  it("RELEASE：balance+c + reserved-c = 0（批次不动）", () => {
    expect(computeOwnedDelta(100, -100)).toBe(0);
  });
  it("SETTLE：credits 0 + reserved-c = -c（扣批次）", () => {
    expect(computeOwnedDelta(0, -100)).toBe(-100);
  });
  it("CONSUME：-c（扣批次）", () => {
    expect(computeOwnedDelta(-50, 0)).toBe(-50);
  });
  it("GRANT/TOPUP/REFUND：+c（增额）", () => {
    expect(computeOwnedDelta(200, 0)).toBe(200);
  });
});

describe("sortLotsForSpend（先到期先扣）", () => {
  it("expiresAt 升序，null 最后", () => {
    const lots = [
      lot("perm", "TOPUP", 10, null),
      lot("late", "TOPUP", 10, d("2026-12-01T00:00:00Z")),
      lot("soon", "SUBSCRIPTION", 10, d("2026-08-01T00:00:00Z")),
    ];
    const ordered = [...lots].sort(sortLotsForSpend).map((l) => l.id);
    expect(ordered).toEqual(["soon", "late", "perm"]);
  });
  it("同到期按来源 订阅<免费<充值", () => {
    const t = d("2026-08-01T00:00:00Z");
    const lots = [
      lot("topup", "TOPUP", 10, t),
      lot("free", "FREE", 10, t),
      lot("sub", "SUBSCRIPTION", 10, t),
    ];
    const ordered = [...lots].sort(sortLotsForSpend).map((l) => l.id);
    expect(ordered).toEqual(["sub", "free", "topup"]);
  });
});

describe("planAllocation（FIFO 扣减）", () => {
  it("跨多批次按顺序扣减，最后一个部分扣减", () => {
    const lots = [
      lot("a", "SUBSCRIPTION", 30, d("2026-08-01T00:00:00Z")),
      lot("b", "TOPUP", 100, d("2026-12-01T00:00:00Z")),
    ];
    const { steps, shortfall } = planAllocation(lots, 50);
    expect(shortfall).toBe(0);
    expect(steps).toEqual([
      { id: "a", take: 30, newRemaining: 0 },
      { id: "b", take: 20, newRemaining: 80 },
    ]);
  });
  it("批次不足返回 shortfall", () => {
    const lots = [lot("a", "FREE", 10, d("2026-08-01T00:00:00Z"))];
    const { steps, shortfall } = planAllocation(lots, 25);
    expect(steps).toEqual([{ id: "a", take: 10, newRemaining: 0 }]);
    expect(shortfall).toBe(15);
  });
  it("amount<=0 无步骤", () => {
    expect(planAllocation([lot("a", "TOPUP", 10, null)], 0).steps).toEqual([]);
  });
  it("跳过 remaining=0 批次", () => {
    const lots = [
      lot("empty", "SUBSCRIPTION", 0, d("2026-07-01T00:00:00Z")),
      lot("live", "TOPUP", 10, d("2026-09-01T00:00:00Z")),
    ];
    const { steps } = planAllocation(lots, 5);
    expect(steps).toEqual([{ id: "live", take: 5, newRemaining: 5 }]);
  });
});

describe("planRestoreTargetId（回补目标）", () => {
  it("选最早到期批次", () => {
    const lots = [
      lot("late", "TOPUP", 5, d("2026-12-01T00:00:00Z")),
      lot("soon", "FREE", 0, d("2026-08-01T00:00:00Z")),
    ];
    expect(planRestoreTargetId(lots)).toBe("soon");
  });
  it("无批次返回 null（需新建永久批次）", () => {
    expect(planRestoreTargetId([])).toBeNull();
  });
});

describe("planExpiry（到期清扫，按可用余额封顶）", () => {
  it("余额充足全额过期", () => {
    const due = [
      { id: "a", remainingCredits: 30 },
      { id: "b", remainingCredits: 20 },
    ];
    const { toExpire, steps } = planExpiry(due, 100);
    expect(toExpire).toBe(50);
    expect(steps).toEqual([
      { id: "a", take: 30, newRemaining: 0 },
      { id: "b", take: 20, newRemaining: 0 },
    ]);
  });
  it("余额不足时封顶（余下部分下轮再扫）", () => {
    const due = [
      { id: "a", remainingCredits: 30 },
      { id: "b", remainingCredits: 20 },
    ];
    const { toExpire, steps } = planExpiry(due, 40);
    expect(toExpire).toBe(40);
    expect(steps).toEqual([
      { id: "a", take: 30, newRemaining: 0 },
      { id: "b", take: 10, newRemaining: 10 },
    ]);
  });
  it("可用余额为 0 不过期", () => {
    expect(planExpiry([{ id: "a", remainingCredits: 30 }], 0)).toEqual({
      toExpire: 0,
      steps: [],
    });
  });
});

describe("resolveLotExpiry（按来源默认到期）", () => {
  const now = d("2026-07-09T00:00:00Z");
  it("显式 null = 永久（VIP）", () => {
    expect(resolveLotExpiry("TOPUP", null, now)).toBeNull();
  });
  it("显式日期原样返回", () => {
    const explicit = d("2026-08-01T00:00:00Z");
    expect(resolveLotExpiry("SUBSCRIPTION", explicit, now)).toBe(explicit);
  });
  it("FREE 默认 30 天", () => {
    expect(resolveLotExpiry("FREE", undefined, now)!.getTime()).toBe(
      addDays(now, FREE_VALIDITY_DAYS).getTime(),
    );
  });
  it("TOPUP 默认 12 个月", () => {
    expect(resolveLotExpiry("TOPUP", undefined, now)!.getTime()).toBe(
      addMonths(now, TOPUP_VALIDITY_MONTHS).getTime(),
    );
  });
  it("SUBSCRIPTION 默认 31 天", () => {
    expect(resolveLotExpiry("SUBSCRIPTION", undefined, now)!.getTime()).toBe(
      subscriptionCreditPeriodEnd(now).getTime(),
    );
    expect(SUBSCRIPTION_CREDIT_VALIDITY_DAYS).toBe(31);
  });
});

describe("subscriptionCreditPeriodEnd / subscriptionCreditPeriodKey", () => {
  it("31 天滚动到期", () => {
    const start = d("2026-07-11T03:16:06Z");
    expect(subscriptionCreditPeriodEnd(start).getTime()).toBe(
      addDays(start, 31).getTime(),
    );
  });
  it("periodKey 为到期日 YYYY-MM-DD", () => {
    expect(subscriptionCreditPeriodKey(d("2026-08-11T03:16:06Z"))).toBe("2026-08-11");
  });
});
