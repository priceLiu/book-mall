import type { TenantRole } from "@prisma/client";

import { canViewFinanceCost } from "@/lib/auth/permissions";
import type { FinanceSessionUser } from "@/lib/finance/finance-api";
import { listUserTenantMemberships, type TenantMembershipSummary } from "@/lib/tenant/context";

export class TeamFinanceForbiddenError extends Error {
  constructor(message = "无权查看团队财务") {
    super(message);
    this.name = "TeamFinanceForbiddenError";
  }
}

export type TeamFinanceTeamSummary = {
  tenantId: string;
  tenantName: string;
  role: TenantRole;
  canViewBilling: boolean;
};

export type TeamFinanceAccess = {
  hasTeam: boolean;
  teams: TeamFinanceTeamSummary[];
  selected: TeamFinanceTeamSummary | null;
  canViewBilling: boolean;
};

export function canViewTeamBilling(role: TenantRole): boolean {
  return role === "OWNER" || role === "ADMIN";
}

export function assertTeamBillingView(role: TenantRole): void {
  if (!canViewTeamBilling(role)) {
    throw new TeamFinanceForbiddenError("仅团队主账号或管理员可查看团队财务");
  }
}

export function assertAdminTeamAccess(user: FinanceSessionUser): void {
  if (!canViewFinanceCost(user.role)) {
    throw new TeamFinanceForbiddenError("需要财务/超管权限");
  }
}

export function recentPeriodKeys(count = 6): string[] {
  const now = new Date();
  const out: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

export function currentPeriodKey(d = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function toTeamSummary(m: TenantMembershipSummary): TeamFinanceTeamSummary {
  return {
    tenantId: m.tenantId,
    tenantName: m.tenantName,
    role: m.role,
    canViewBilling: canViewTeamBilling(m.role),
  };
}

/** 解析当前用户在团队财务上下文中的访问权限。 */
export async function resolveTeamFinanceAccess(
  userId: string,
  tenantId?: string | null,
): Promise<TeamFinanceAccess> {
  const memberships = await listUserTenantMemberships(userId);
  const teams = memberships.filter((m) => m.tenantType === "TEAM").map(toTeamSummary);

  if (teams.length === 0) {
    return { hasTeam: false, teams: [], selected: null, canViewBilling: false };
  }

  const selected = teams.find((t) => t.tenantId === tenantId) ?? teams[0];
  return {
    hasTeam: true,
    teams,
    selected,
    canViewBilling: selected.canViewBilling,
  };
}
