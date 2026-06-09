import { NextRequest } from "next/server";

import { listUserTenantMemberships } from "@/lib/tenant/context";
import {
  financeJson,
  financeOptions,
  financeUnauthorized,
  getFinanceSession,
  permissionsForRole,
} from "@/lib/finance/finance-api";

/**
 * finance-web 跨源读取「当前浏览器在 book-mall 的登录态」。
 * 含五级 RBAC 权限快照 + 团队成员关系（供个人/团队/管理三入口路由）。
 */
export async function OPTIONS(request: NextRequest) {
  return financeOptions(request);
}

export async function GET(request: NextRequest) {
  const user = await getFinanceSession();
  if (!user) return financeUnauthorized(request);

  const memberships = await listUserTenantMemberships(user.id);
  const teams = memberships
    .filter((m) => m.tenantType === "TEAM")
    .map((m) => ({
      tenantId: m.tenantId,
      tenantName: m.tenantName,
      role: m.role,
      canViewBilling: m.role === "OWNER" || m.role === "ADMIN",
    }));

  return financeJson(request, {
    user,
    permissions: permissionsForRole(user.role),
    teams,
    hasTeam: teams.length > 0,
  });
}
