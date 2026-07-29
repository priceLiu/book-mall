/** 剧组协同 · 租户/角色门禁（tools-session introspect） */

export type TenantType = "PERSONAL" | "TEAM";
export type TenantRoleType = "OWNER" | "ADMIN" | "MEMBER";

export type CrewCollaborationAccess = {
  /** 当前为团队空间 */
  isTeamTenant: boolean;
  /** Book 平台管理员（tools_role: admin） */
  isPlatformAdmin: boolean;
  /** 可查看公告条、参与制作任务 */
  canUseCrewBulletin: boolean;
  /** 可发布剧本（团队 OWNER/ADMIN 或平台管理员） */
  canPublishScript: boolean;
  /** 发布时可勾选团队共享（须团队空间） */
  canTeamShareOnPublish: boolean;
};

function normalizeTenantType(raw: unknown): TenantType | null {
  return raw === "PERSONAL" || raw === "TEAM" ? raw : null;
}

function normalizeRoleType(raw: unknown): TenantRoleType | null {
  return raw === "OWNER" || raw === "ADMIN" || raw === "MEMBER" ? raw : null;
}

function isPlatformToolsAdmin(introspect: Record<string, unknown>): boolean {
  return introspect.tools_role === "admin";
}

/** 从 tools-session introspect 解析剧组协同权限 */
export function crewCollaborationAccessFromIntrospect(
  introspect: Record<string, unknown> | null | undefined,
): CrewCollaborationAccess {
  const tenantType = normalizeTenantType(introspect?.tenant_type);
  const roleType = normalizeRoleType(introspect?.role_type);
  const isTeamTenant = tenantType === "TEAM";
  const isPlatformAdmin = introspect
    ? isPlatformToolsAdmin(introspect)
    : false;
  const isTeamAdmin =
    isTeamTenant && (roleType === "OWNER" || roleType === "ADMIN");
  const canPublishScript = isPlatformAdmin || isTeamAdmin;
  return {
    isTeamTenant,
    isPlatformAdmin,
    canUseCrewBulletin: isTeamTenant || isPlatformAdmin,
    canPublishScript,
    canTeamShareOnPublish: canPublishScript && isTeamTenant,
  };
}

export const CREW_COLLABORATION_PERSONAL_HINT =
  "剧本团队协同仅在团队空间可用。请切换到团队空间后使用发布剧本与公告栏。";

export const CREW_PUBLISH_FORBIDDEN_HINT =
  "仅团队管理员/所有者或平台管理员可发布剧本。请联系团队管理员发布，或使用已发布剧本关联生产画布。";
