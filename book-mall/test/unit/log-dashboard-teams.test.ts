import { describe, expect, it, vi } from "vitest";

import {
  formatDashboardTeamOptionLabel,
  listDashboardTeamOptions,
} from "@/lib/gateway/log-dashboard-teams";

vi.mock("@/lib/tenant/context", () => ({
  listUserTenantMemberships: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    tenant: {
      findMany: vi.fn(),
    },
  },
}));

import { listUserTenantMemberships } from "@/lib/tenant/context";
import { prisma } from "@/lib/prisma";

describe("log-dashboard-teams", () => {
  it("lists only TEAM tenants with role metadata", async () => {
    vi.mocked(listUserTenantMemberships).mockResolvedValue([
      {
        tenantId: "personal-1",
        tenantName: "Pilot 的个人空间",
        tenantType: "PERSONAL",
        role: "OWNER",
        seatId: null,
        isPrimary: true,
      },
      {
        tenantId: "team-a",
        tenantName: "设计组",
        tenantType: "TEAM",
        role: "ADMIN",
        seatId: "seat-1",
        isPrimary: false,
      },
      {
        tenantId: "team-b",
        tenantName: "运营组",
        tenantType: "TEAM",
        role: "MEMBER",
        seatId: "seat-2",
        isPrimary: false,
      },
    ]);

    const teams = await listDashboardTeamOptions("user-1");
    expect(teams).toEqual([
      {
        id: "team-a",
        name: "设计组",
        role: "ADMIN",
        canViewAllMembers: true,
      },
      {
        id: "team-b",
        name: "运营组",
        role: "MEMBER",
        canViewAllMembers: false,
      },
    ]);
    expect(prisma.tenant.findMany).not.toHaveBeenCalled();
  });

  it("platform admin sees all active teams with membership precedence", async () => {
    vi.mocked(listUserTenantMemberships).mockResolvedValue([
      {
        tenantId: "team-a",
        tenantName: "设计组",
        tenantType: "TEAM",
        role: "MEMBER",
        seatId: "seat-1",
        isPrimary: false,
      },
    ]);
    vi.mocked(prisma.tenant.findMany).mockResolvedValue([
      {
        id: "team-a",
        name: "设计组",
        owner: { phone: "13538662148", name: "jane" },
      },
      {
        id: "team-b",
        name: "运营组",
        owner: { phone: "13808816802", name: "Pilot" },
      },
    ] as never);

    const teams = await listDashboardTeamOptions("admin-1", {
      isPlatformAdmin: true,
    });
    expect(teams).toEqual([
      {
        id: "team-a",
        name: "设计组",
        role: "MEMBER",
        canViewAllMembers: false,
      },
      {
        id: "team-b",
        name: "运营组",
        role: "ADMIN",
        canViewAllMembers: true,
        isPlatformScope: true,
        ownerHint: "13808816802",
      },
    ]);
  });

  it("formats team option labels by role", () => {
    expect(
      formatDashboardTeamOptionLabel({
        id: "1",
        name: "设计组",
        role: "OWNER",
        canViewAllMembers: true,
      }),
    ).toBe("设计组（主账号）");
    expect(
      formatDashboardTeamOptionLabel({
        id: "2",
        name: "运营组",
        role: "ADMIN",
        canViewAllMembers: true,
        isPlatformScope: true,
        ownerHint: "13808816802",
      }),
    ).toBe("运营组 · 13808816802（全站）");
  });
});
