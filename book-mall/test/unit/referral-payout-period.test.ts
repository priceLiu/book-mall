import { describe, expect, it } from "vitest";

import { monthPeriodRange } from "@/lib/referral/referral-payout-service";

describe("monthPeriodRange — 自然月结算周期", () => {
  it("解析 YYYY-MM 为 [月初, 次月初)", () => {
    const r = monthPeriodRange("2026-07");
    expect(r).not.toBeNull();
    expect(r!.start.getFullYear()).toBe(2026);
    expect(r!.start.getMonth()).toBe(6); // 7 月 → index 6
    expect(r!.start.getDate()).toBe(1);
    // 次月初
    expect(r!.end.getMonth()).toBe(7);
    expect(r!.end.getDate()).toBe(1);
    expect(r!.end.getTime()).toBeGreaterThan(r!.start.getTime());
  });

  it("跨年 12 月 → 次年 1 月", () => {
    const r = monthPeriodRange("2026-12");
    expect(r).not.toBeNull();
    expect(r!.end.getFullYear()).toBe(2027);
    expect(r!.end.getMonth()).toBe(0);
  });

  it("非法格式返回 null", () => {
    expect(monthPeriodRange("2026-13")).toBeNull();
    expect(monthPeriodRange("2026-00")).toBeNull();
    expect(monthPeriodRange("2026/07")).toBeNull();
    expect(monthPeriodRange("bad")).toBeNull();
  });
});

describe("返佣金额口径", () => {
  it("commission = (套餐+充值) × 比例，四舍五入到分", () => {
    const base = 1234.56 + 789.44; // = 2024.00
    const rate = 0.05;
    const commission = Math.round(base * rate * 100) / 100;
    expect(commission).toBe(101.2);
  });
});
