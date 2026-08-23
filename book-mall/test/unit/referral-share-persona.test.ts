import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    tenantMember: { findFirst: vi.fn() },
    creditAccount: { findUnique: vi.fn() },
    membershipPlan: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/billing/membership-service-period", () => ({
  isMembershipServiceActive: vi.fn(() => true),
}));

import { prisma } from "@/lib/prisma";
import { getReferralEligibility } from "@/lib/referral/referral-service";

describe("getReferralEligibility · sharePersona", () => {
  beforeEach(() => {
    vi.mocked(prisma.tenantMember.findFirst).mockReset();
    vi.mocked(prisma.creditAccount.findUnique).mockReset();
    vi.mocked(prisma.membershipPlan.findUnique).mockReset();
  });

  it("blocks team MEMBER with sharePersona null", async () => {
    vi.mocked(prisma.tenantMember.findFirst).mockResolvedValueOnce({ id: "m1" } as never);
    const r = await getReferralEligibility("u1");
    expect(r.eligible).toBe(false);
    expect(r.reason).toBe("团队成员不可分享");
    expect(r.sharePersona).toBeNull();
  });

  it("returns personal sharePersona for personal subscription", async () => {
    vi.mocked(prisma.tenantMember.findFirst).mockResolvedValueOnce(null);
    vi.mocked(prisma.creditAccount.findUnique).mockResolvedValueOnce({
      planId: "p1",
      monthlyGrantCredits: 100,
      membershipPaidUntil: new Date(Date.now() + 86400000),
    } as never);
    vi.mocked(prisma.membershipPlan.findUnique).mockResolvedValueOnce({
      family: "PERSONAL",
      tier: "标准版",
      interval: "MONTH",
    } as never);
    vi.mocked(prisma.tenantMember.findFirst).mockResolvedValueOnce(null);

    const r = await getReferralEligibility("u2");
    expect(r.eligible).toBe(true);
    expect(r.sharePersona).toBe("personal");
  });

  it("returns team_owner sharePersona for team OWNER", async () => {
    vi.mocked(prisma.tenantMember.findFirst)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        tenant: { name: "Acme", packageLevel: "标准版", interval: "MONTH" },
      } as never);
    vi.mocked(prisma.creditAccount.findUnique).mockResolvedValueOnce(null);

    const r = await getReferralEligibility("u3");
    expect(r.eligible).toBe(true);
    expect(r.sharePersona).toBe("team_owner");
  });
});
