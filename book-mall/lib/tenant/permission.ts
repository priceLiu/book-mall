import type { TenantRole } from "@prisma/client";

/**
 * 租户 RBAC（gateway-multi-credential-and-tenant · 轨道 B）
 *
 * OWNER（主账号）：计费/充值、管理 Key、团队配置、转移所有权、删除团队、成员与资产管理、使用。
 * ADMIN（管理员）：成员/席位管理、邀请、公共资产管理、使用；**不可**计费充值/管 Key/改关键配置/转移/删除。
 * MEMBER（普通成员）：仅使用 + 自有私有资产。
 */
export type TenantAction =
  | "billing:manage" // 续费 / 充值 / 改套餐
  | "credential:manage" // 管理团队厂商 Key
  | "tenant:configure" // 改团队名称/席位上限/人均上限/并发
  | "tenant:transfer" // 转移所有权
  | "tenant:delete" // 删除/停用团队
  | "member:invite" // 邀请成员
  | "member:manage" // 改角色/分配席位/移除成员
  | "asset:manage_public" // 设为公共 / 编辑或删除公共资产
  | "asset:use"; // 生成 / 使用工具

const MATRIX: Record<TenantAction, TenantRole[]> = {
  "billing:manage": ["OWNER"],
  "credential:manage": ["OWNER"],
  "tenant:configure": ["OWNER"],
  "tenant:transfer": ["OWNER"],
  "tenant:delete": ["OWNER"],
  "member:invite": ["OWNER", "ADMIN"],
  "member:manage": ["OWNER", "ADMIN"],
  "asset:manage_public": ["OWNER", "ADMIN"],
  "asset:use": ["OWNER", "ADMIN", "MEMBER"],
};

export function canTenant(role: TenantRole, action: TenantAction): boolean {
  return MATRIX[action]?.includes(role) ?? false;
}

export class TenantPermissionError extends Error {
  constructor(
    public readonly role: TenantRole,
    public readonly action: TenantAction,
  ) {
    super(`当前角色（${role}）无权限执行：${action}`);
    this.name = "TenantPermissionError";
  }
}

export function assertTenantPermission(
  ctx: { role: TenantRole },
  action: TenantAction,
): void {
  if (!canTenant(ctx.role, action)) {
    throw new TenantPermissionError(ctx.role, action);
  }
}
