/**
 * 平台五级角色 RBAC（与 book-mall/lib/auth/permissions.ts 保持同步）。
 */
export type PlatformRole = "USER" | "OPERATIONS" | "ADMIN" | "FINANCE" | "SUPER_ADMIN";

export type FinancePermissions = {
  isPlatformStaff: boolean;
  canViewFinanceCost: boolean;
  canManagePricing: boolean;
  canCreateProposal: boolean;
  canFinanceReview: boolean;
  canFinalApprove: boolean;
};

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

export function isPlatformStaff(role: string | null | undefined): boolean {
  return roleRank(role) >= RANK.OPERATIONS;
}

export function canViewFinanceCost(role: string | null | undefined): boolean {
  const r = role as PlatformRole;
  return r === "FINANCE" || r === "SUPER_ADMIN" || r === "ADMIN";
}

export function canManagePricing(role: string | null | undefined): boolean {
  return canViewFinanceCost(role);
}

export function canCreateProposal(role: string | null | undefined): boolean {
  return isPlatformStaff(role);
}

export function canFinanceReview(role: string | null | undefined): boolean {
  return canViewFinanceCost(role);
}

export function canFinalApprove(role: string | null | undefined): boolean {
  const r = role as PlatformRole;
  return r === "SUPER_ADMIN" || r === "ADMIN";
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
