import { describe, expect, it } from "vitest";
import {
  resolveDefaultTeamMaxConcurrency,
  teamTierMaxConcurrency,
} from "@/lib/tenant/team-concurrency";
import {
  getVideoPersonalMaxConcurrency,
  getVideoPersonalMaxQueue,
  getVideoTeamQueueMultiplier,
  resolveVideoLimitsFromBilling,
} from "@/lib/billing/video-risk-control";

describe("team-concurrency", () => {
  it("20 席团队默认 20 路（保底，无需 env）", () => {
    expect(
      resolveDefaultTeamMaxConcurrency({ seatLimit: 20, packageLevel: "标准版" }),
    ).toBe(20);
  });

  it("50 席团队随席位扩展到 50 路", () => {
    expect(
      resolveDefaultTeamMaxConcurrency({ seatLimit: 50, packageLevel: "标准版" }),
    ).toBe(50);
  });

  it("15 席团队按席位数（未满 20 保底）", () => {
    expect(
      resolveDefaultTeamMaxConcurrency({ seatLimit: 15, packageLevel: "标准版" }),
    ).toBe(15);
  });
});

describe("video-concurrency-limits", () => {
  it("个人账号默认 2 并发 / 10 排队", () => {
    const limits = resolveVideoLimitsFromBilling({
      ownerType: "USER",
      ownerId: "user-1",
      tier: "高级版",
    });
    expect(limits.maxConcurrency).toBe(getVideoPersonalMaxConcurrency());
    expect(limits.maxQueue).toBe(getVideoPersonalMaxQueue());
  });

  it("团队账号对齐 Tenant.maxConcurrency 并放大排队", () => {
    const limits = resolveVideoLimitsFromBilling({
      ownerType: "TENANT",
      ownerId: "tenant-1",
      tier: "至尊版",
      tenantMaxConcurrency: 15,
    });
    expect(limits.maxConcurrency).toBe(15);
    expect(limits.maxQueue).toBe(15 * getVideoTeamQueueMultiplier());
  });
});
