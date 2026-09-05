import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindUnique = vi.fn();
const mockFindFirst = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    creditAccount: { findUnique: (...args: unknown[]) => mockFindUnique(...args) },
    tenantMember: { findFirst: (...args: unknown[]) => mockFindFirst(...args) },
  },
}));

import {
  appendReturnToQuery,
  resolveRechargeEntryPath,
} from "@/lib/payments/recharge-entry-route";

describe("resolveRechargeEntryPath", () => {
  beforeEach(() => {
    mockFindUnique.mockReset();
    mockFindFirst.mockReset();
    mockFindFirst.mockResolvedValue(null);
  });

  it("routes active personal membership to billing", async () => {
    mockFindUnique.mockResolvedValue({
      planId: "plan_pro",
      membershipPaidUntil: new Date("2099-01-01T00:00:00Z"),
    });
    await expect(resolveRechargeEntryPath("u1")).resolves.toBe("/account/billing");
  });

  it("routes expired personal membership to pricing", async () => {
    mockFindUnique.mockResolvedValue({
      planId: "plan_pro",
      membershipPaidUntil: new Date("2020-01-01T00:00:00Z"),
    });
    await expect(resolveRechargeEntryPath("u1")).resolves.toBe("/pricing");
  });

  it("routes active team membership to billing", async () => {
    mockFindUnique.mockResolvedValue({ planId: null, membershipPaidUntil: null });
    mockFindFirst.mockResolvedValue({
      tenant: { currentPeriodEnd: new Date("2099-01-01T00:00:00Z") },
    });
    await expect(resolveRechargeEntryPath("u1")).resolves.toBe("/account/billing");
  });

  it("routes expired team membership to pricing", async () => {
    mockFindUnique.mockResolvedValue({ planId: null, membershipPaidUntil: null });
    mockFindFirst.mockResolvedValue({
      tenant: { currentPeriodEnd: new Date("2020-01-01T00:00:00Z") },
    });
    await expect(resolveRechargeEntryPath("u1")).resolves.toBe("/pricing");
  });

  it("routes never-subscribed users to billing", async () => {
    mockFindUnique.mockResolvedValue({ planId: null, membershipPaidUntil: null });
    await expect(resolveRechargeEntryPath("u1")).resolves.toBe("/account/billing");
  });
});

describe("appendReturnToQuery", () => {
  it("appends returnTo when provided", () => {
    expect(
      appendReturnToQuery("/account/billing", "http://localhost:3003/projects/1"),
    ).toBe("/account/billing?returnTo=http%3A%2F%2Flocalhost%3A3003%2Fprojects%2F1");
  });

  it("returns path unchanged when returnTo empty", () => {
    expect(appendReturnToQuery("/pricing", null)).toBe("/pricing");
  });
});
