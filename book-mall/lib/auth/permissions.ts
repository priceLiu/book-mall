/**
 * 平台五级角色 RBAC（财务 2.0 · Phase 6）— 纯函数，可单测，可服务端/客户端共用。
 *
 * 角色：USER / OPERATIONS / ADMIN(legacy) / FINANCE / SUPER_ADMIN
 * 关键约束：厂商成本与财务反向验算「仅财务 + 超管」可见（ADMIN legacy 视为全权，避免迁移期锁死）。
 */
export type PlatformRole = "USER" | "OPERATIONS" | "ADMIN" | "FINANCE" | "SUPER_ADMIN";

/** 角色等级（越大权限越高）。ADMIN 为历史管理员，视为运营+（兼顾迁移期不锁死）。 */
const RANK: Record<PlatformRole, number> = {
  USER: 0,
  OPERATIONS: 1,
  ADMIN: 2,
  FINANCE: 3,
  SUPER_ADMIN: 4,
};

export function roleRank(role: string | null | undefined): number {
  return RANK[(role as PlatformRole) ?? "USER"] ?? 0;
}

/** 是否平台内部员工（运营及以上）。 */
export function isPlatformStaff(role: string | null | undefined): boolean {
  return roleRank(role) >= RANK.OPERATIONS;
}

/** 是否财务或超管（含 legacy ADMIN）：可见厂商成本/毛利/反向验算。 */
export function canViewFinanceCost(role: string | null | undefined): boolean {
  const r = role as PlatformRole;
  return r === "FINANCE" || r === "SUPER_ADMIN" || r === "ADMIN";
}

/** 可维护成本档 / 发布报价（财务、超管、legacy admin）。 */
export function canManagePricing(role: string | null | undefined): boolean {
  return canViewFinanceCost(role);
}

/** 可提交调价提案（运营及以上）。 */
export function canCreateProposal(role: string | null | undefined): boolean {
  return isPlatformStaff(role);
}

/** 可做财务复核（财务、超管、legacy admin）。 */
export function canFinanceReview(role: string | null | undefined): boolean {
  return canViewFinanceCost(role);
}

/** 可终审生效（超管、legacy admin）。 */
export function canFinalApprove(role: string | null | undefined): boolean {
  const r = role as PlatformRole;
  return r === "SUPER_ADMIN" || r === "ADMIN";
}

/** 角色中文名（后台展示）。 */
export type FinancePermissions = {
  isPlatformStaff: boolean;
  canViewFinanceCost: boolean;
  canManagePricing: boolean;
  canCreateProposal: boolean;
  canFinanceReview: boolean;
  canFinalApprove: boolean;
};

/** 导出权限快照（供 finance-web viewer-session API 复用）。 */
export function permissionsForRole(role: string | null | undefined): FinancePermissions {
  return {
    isPlatformStaff: isPlatformStaff(role),
    canViewFinanceCost: canViewFinanceCost(role),
    canManagePricing: canManagePricing(role),
    canCreateProposal: canCreateProposal(role),
    canFinanceReview: canFinanceReview(role),
    canFinalApprove: canFinalApprove(role),
  };
}

export function roleLabel(role: string | null | undefined): string {
  switch (role as PlatformRole) {
    case "SUPER_ADMIN":
      return "超级管理员";
    case "FINANCE":
      return "财务";
    case "OPERATIONS":
      return "运营";
    case "ADMIN":
      return "管理员";
    default:
      return "普通用户";
  }
}
