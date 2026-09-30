import { describe, expect, it } from "vitest";

import {
  addDays,
  subscriptionCreditPeriodEnd,
} from "@/lib/billing/credit-lot-logic";
import {
  extendMembershipPaidUntil,
  isMembershipServiceActive,
  membershipPaidUntilFromPurchase,
} from "@/lib/billing/membership-service-period";
import {
  resolvePlanCreditGrants,
  shouldDeferRenewalGrant,
} from "@/lib/billing/plan-credit-grants";

type Interval = "MONTH" | "YEAR";

function plan(family: "PERSONAL" | "TEAM", interval: Interval, monthlyCredits: number) {
  return { family, interval, monthlyCredits } as Parameters<typeof resolvePlanCreditGrants>[0];
}

describe("resolvePlanCreditGrants", () => {
  it("个人月付：每期 = 套餐月积分", () => {
    expect(resolvePlanCreditGrants(plan("PERSONAL", "MONTH", 860), 1).monthlyGrantCredits).toBe(860);
  });

  it("个人年付：每 31 天一期 = 全年 ÷ 12", () => {
    const g = resolvePlanCreditGrants(plan("PERSONAL", "YEAR", 10320), 1);
    expect(g.credits).toBe(860);
    expect(g.monthlyGrantCredits).toBe(860);
    expect(resolvePlanCreditGrants(plan("PERSONAL", "YEAR", 360000), 1).credits).toBe(30000);
  });

  it("团队：每席积分 × 席位；年付再 ÷ 12；席位带优先", () => {
    expect(resolvePlanCreditGrants(plan("TEAM", "MONTH", 2490), 3).credits).toBe(7470);
    expect(resolvePlanCreditGrants(plan("TEAM", "YEAR", 29880), 3).credits).toBe(7470);
    expect(resolvePlanCreditGrants(plan("TEAM", "MONTH", 2490), 3, 3000).credits).toBe(9000);
  });
});

/**
 * 模拟一个账户在若干次付款下的积分发放次数：
 * 付款走 fulfillMembership 的顺延 / 立即发放或延后规则；
 * 周期到期走 runMonthlyResetSweep（服务期内按 31 天刷新）。
 */
function simulate(opts: {
  interval: Interval;
  planIds?: string[];
  payDays: number[];
  horizonDays: number;
}) {
  const t0 = new Date("2026-01-01T00:00:00Z");
  const payments = opts.payDays.map((d, i) => ({ at: addDays(t0, d), planId: opts.planIds?.[i] ?? "p1" }));
  let accountPlanId: string | null = null;
  let paidUntil: Date | null = null;
  let periodEnd: Date | null = null;
  const grants: number[] = [];

  for (let day = 0; day <= opts.horizonDays; day++) {
    const now = addDays(t0, day);
    for (const pay of payments.filter((p) => p.at.getTime() === now.getTime())) {
      const defer = shouldDeferRenewalGrant({
        accountPlanId,
        planId: pay.planId,
        paidUntilBefore: paidUntil,
        creditPeriodEnd: periodEnd,
        now,
      });
      paidUntil = paidUntil
        ? extendMembershipPaidUntil(paidUntil, opts.interval, now)
        : membershipPaidUntilFromPurchase(opts.interval, now);
      if (!defer) {
        grants.push(day);
        periodEnd = subscriptionCreditPeriodEnd(now);
        accountPlanId = pay.planId;
      }
    }
    if (periodEnd && periodEnd <= now && isMembershipServiceActive(paidUntil, now)) {
      grants.push(day);
      periodEnd = subscriptionCreditPeriodEnd(periodEnd);
    }
  }
  return { grants, paidUntil };
}

describe("会员积分发放次数（付款 × 月度清扫）", () => {
  it("月付首购：31 天服务期只发 1 期", () => {
    expect(simulate({ interval: "MONTH", payDays: [0], horizonDays: 120 }).grants).toEqual([0]);
  });

  it("月付到期当天续费：2 次付款发 2 期", () => {
    const r = simulate({ interval: "MONTH", payDays: [0, 31], horizonDays: 150 });
    expect(r.grants).toHaveLength(2);
  });

  it("月付提前续费（第 20 天）：2 次付款仍只发 2 期，服务期顺延到第 62 天", () => {
    const r = simulate({ interval: "MONTH", payDays: [0, 20], horizonDays: 150 });
    expect(r.grants).toEqual([0, 31]);
    expect(r.paidUntil?.toISOString().slice(0, 10)).toBe("2026-03-04");
  });

  it("月付过期后续费：立即发放新一期", () => {
    const r = simulate({ interval: "MONTH", payDays: [0, 45], horizonDays: 150 });
    expect(r.grants).toEqual([0, 45]);
  });

  it("换档续费：立即按新档发放", () => {
    const r = simulate({ interval: "MONTH", planIds: ["p1", "p2"], payDays: [0, 20], horizonDays: 150 });
    expect(r.grants.slice(0, 2)).toEqual([0, 20]);
  });

  it("年付：365 天内共发 12 期（每期 = 全年 ÷ 12）", () => {
    const r = simulate({ interval: "YEAR", payDays: [0], horizonDays: 500 });
    expect(r.grants).toHaveLength(12);
    const perPeriod = resolvePlanCreditGrants(plan("PERSONAL", "YEAR", 10320), 1).credits;
    expect(perPeriod * r.grants.length).toBe(10320);
  });

  it("年付提前续费：两年共 24 期", () => {
    const r = simulate({ interval: "YEAR", payDays: [0, 300], horizonDays: 800 });
    expect(r.grants).toHaveLength(24);
  });
});
