/**
 * 状态驾驶舱 · 团队下拉与团队 scope 权限（与 listUserTenantMemberships / 团队财务一致）。
 */
import type { TenantRole } from "@prisma/client";

import { listUserTenantMemberships } from "@/lib/tenant/context";
import { prisma } from "@/lib/prisma";

export type DashboardTeamOption = {
  id: string;
  name: string;
  role: TenantRole;
  canViewAllMembers: boolean;
  /** 平台财务/超管查看、非本人加入的团队 */
  isPlatformScope?: boolean;
  ownerHint?: string | null;
};

function toMembershipOption(m: {
  tenantId: string;
  tenantName: string;
  role: TenantRole;
}): DashboardTeamOption {
  return {
    id: m.tenantId,
    name: m.tenantName,
    role: m.role,
    canViewAllMembers: m.role === "OWNER" || m.role === "ADMIN",
  };
}

export async function listDashboardTeamOptions(
  bookUserId: string,
  opts?: { isPlatformAdmin?: boolean },
): Promise<DashboardTeamOption[]> {
  const memberships = await listUserTenantMemberships(bookUserId);
  const memberTeams = memberships
    .filter((m) => m.tenantType === "TEAM")
    .map(toMembershipOption);

  if (!opts?.isPlatformAdmin) {
    return memberTeams;
  }

  const memberByTenantId = new Map(memberTeams.map((t) => [t.id, t]));
  const allTeams = await prisma.tenant.findMany({
    where: { type: "TEAM", status: "ACTIVE" },
    orderBy: [{ name: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      owner: { select: { phone: true, name: true } },
    },
  });

  return allTeams.map((t) => {
    const member = memberByTenantId.get(t.id);
    if (member) return member;
    return {
      id: t.id,
      name: t.name,
      role: "ADMIN",
      canViewAllMembers: true,
      isPlatformScope: true,
      ownerHint: t.owner.phone ?? t.owner.name ?? null,
    };
  });
}

export function formatDashboardTeamOptionLabel(team: DashboardTeamOption): string {
  if (team.isPlatformScope) {
    const base = team.ownerHint ? `${team.name} · ${team.ownerHint}` : team.name;
    return `${base}（全站）`;
  }
  if (team.role === "OWNER") return `${team.name}（主账号）`;
  if (team.role === "ADMIN") return `${team.name}（管理员）`;
  return `${team.name}（成员）`;
}
