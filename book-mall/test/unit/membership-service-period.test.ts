import { describe, expect, it } from "vitest";

import { addDays } from "@/lib/billing/credit-lot-logic";
import {
  extendMembershipPaidUntil,
  isMembershipServiceActive,
  membershipPaidUntilFromPurchase,
  membershipServicePeriodStart,
  MEMBERSHIP_SERVICE_DAYS,
} from "@/lib/billing/membership-service-period";

function d(iso: string): Date {
  return new Date(iso);
}

describe("MEMBERSHIP_SERVICE_DAYS", () => {
  it("月付 31 天、年付 365 天", () => {
    expect(MEMBERSHIP_SERVICE_DAYS.MONTH).toBe(31);
    expect(MEMBERSHIP_SERVICE_DAYS.YEAR).toBe(365);
  });
});

describe("membershipPaidUntilFromPurchase", () => {
  it("月付自 anchor 起 +31 天点到点", () => {
    const anchor = d("2026-07-10T06:30:00Z");
    expect(membershipPaidUntilFromPurchase("MONTH", anchor).getTime()).toBe(
      addDays(anchor, 31).getTime(),
    );
  });
  it("年付自 anchor 起 +365 天点到点", () => {
    const anchor = d("2026-07-10T06:30:00Z");
    expect(membershipPaidUntilFromPurchase("YEAR", anchor).getTime()).toBe(
      addDays(anchor, 365).getTime(),
    );
  });
});

describe("extendMembershipPaidUntil", () => {
  const now = d("2026-08-01T00:00:00Z");

  it("无历史截止日从 now 起算", () => {
    expect(extendMembershipPaidUntil(null, "MONTH", now).getTime()).toBe(
      addDays(now, 31).getTime(),
    );
  });

  it("未过期从当前截止日顺延", () => {
    const current = d("2026-09-01T00:00:00Z");
    expect(extendMembershipPaidUntil(current, "MONTH", now).getTime()).toBe(
      addDays(current, 31).getTime(),
    );
  });

  it("已过期从 now 重算", () => {
    const current = d("2026-07-01T00:00:00Z");
    expect(extendMembershipPaidUntil(current, "YEAR", now).getTime()).toBe(
      addDays(now, 365).getTime(),
    );
  });
});

describe("membershipServicePeriodStart", () => {
  it("由截止日反推月付起始", () => {
    const end = d("2026-08-10T14:00:00Z");
    expect(membershipServicePeriodStart(end, "MONTH").getTime()).toBe(
      addDays(end, -31).getTime(),
    );
  });
});

describe("isMembershipServiceActive", () => {
  const now = d("2026-08-01T00:00:00Z");

  it("null 视为有效（存量过渡）", () => {
    expect(isMembershipServiceActive(null, now)).toBe(true);
  });
  it("截止日在未来为有效", () => {
    expect(isMembershipServiceActive(d("2026-09-01T00:00:00Z"), now)).toBe(true);
  });
  it("截止日已过为无效", () => {
    expect(isMembershipServiceActive(d("2026-07-01T00:00:00Z"), now)).toBe(false);
  });
});
