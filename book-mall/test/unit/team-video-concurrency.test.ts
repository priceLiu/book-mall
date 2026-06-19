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
  it("15 席至尊团队默认 15 路 Gateway 并发", () => {
    expect(
      resolveDefaultTeamMaxConcurrency({ seatLimit: 15, packageLevel: "至尊版" }),
    ).toBe(15);
  });

  it("15 席标准团队受档位封顶为 2", () => {
    expect(
      resolveDefaultTeamMaxConcurrency({ seatLimit: 15, packageLevel: "标准版" }),
    ).toBe(2);
    expect(teamTierMaxConcurrency("标准版")).toBe(2);
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
