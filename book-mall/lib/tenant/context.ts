import { cookies } from "next/headers";

import { prisma } from "@/lib/prisma";
import type { TenantRole, TenantType } from "@prisma/client";

export const ACTIVE_TENANT_COOKIE = "active_tenant_id";

/**
 * 租户上下文：在请求链路中传递「当前空间」信息。
 * 个人空间(PERSONAL) 计费走 CreditAccount(ownerType=USER)；
 * 团队空间(TEAM) 计费走 CreditAccount(ownerType=TENANT, ownerId=tenantId)。
 */
export type BillingOwnerRef = {
  ownerType: "USER" | "TENANT";
  ownerId: string;
};

export type TenantContext = {
  tenantId: string;
  tenantType: TenantType;
  role: TenantRole;
  seatId: string | null;
  /** 实际操作的 Book 用户 id（团队下区分成员） */
  actorUserId: string;
  /** 计费归属：按空间类型路由到 USER / TENANT 积分账户 */
  billingOwnerRef: BillingOwnerRef;
};

export type TenantMembershipSummary = {
  tenantId: string;
  tenantName: string;
  tenantType: TenantType;
  role: TenantRole;
  seatId: string | null;
  isPrimary: boolean;
};

function toBillingOwnerRef(
  tenantType: TenantType,
  tenantId: string,
  actorUserId: string,
): BillingOwnerRef {
  return tenantType === "TEAM"
    ? { ownerType: "TENANT", ownerId: tenantId }
    : { ownerType: "USER", ownerId: actorUserId };
}

/**
 * 解析某 Book 用户在指定（或默认）租户下的上下文。
 * 优先级：显式 preferredTenantId（须为该用户 ACTIVE 成员） → primaryTenantId → 第一个 ACTIVE 成员。
 * 若用户尚无任何租户成员（理论上回填后不会发生），返回 null。
 */
export async function resolveTenantContextForUser(
  userId: string,
  preferredTenantId?: string | null,
): Promise<TenantContext | null> {
  const memberships = await prisma.tenantMember.findMany({
    where: { userId, status: "ACTIVE" },
    include: { tenant: { select: { id: true, type: true, status: true } } },
  });
  if (memberships.length === 0) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { primaryTenantId: true },
  });

  const pickById = (tid?: string | null) =>
    tid
      ? memberships.find(
          (m) => m.tenantId === tid && m.tenant.status === "ACTIVE",
        )
      : undefined;

  const chosen =
    pickById(preferredTenantId) ??
    pickById(user?.primaryTenantId) ??
    memberships.find((m) => m.tenant.type === "PERSONAL") ??
    memberships[0];

  return {
    tenantId: chosen.tenantId,
    tenantType: chosen.tenant.type,
    role: chosen.role,
    seatId: chosen.seatId,
    actorUserId: userId,
    billingOwnerRef: toBillingOwnerRef(
      chosen.tenant.type,
      chosen.tenantId,
      userId,
    ),
  };
}

/**
 * 由 SSO 工具 JWT 的租户声明直接构造上下文（无 DB 查询）。
 * 旧 JWT 可能缺 tenant_id（返回 null，调用方回落 resolveTenantContextForUser）。
 */
export function tenantContextFromClaims(claims: {
  sub: string;
  tenant_id?: string;
  tenant_type?: TenantType;
  role_type?: TenantRole;
  seat_id?: string;
}): TenantContext | null {
  if (!claims.tenant_id || !claims.tenant_type) return null;
  return {
    tenantId: claims.tenant_id,
    tenantType: claims.tenant_type,
    role: claims.role_type ?? "MEMBER",
    seatId: claims.seat_id ?? null,
    actorUserId: claims.sub,
    billingOwnerRef: toBillingOwnerRef(claims.tenant_type, claims.tenant_id, claims.sub),
  };
}

/**
 * 读取浏览器「当前空间」cookie 并解析上下文（用于主站账户页 / 同域 BFF）。
 * 仅可在 Server Component / Route Handler / Server Action 中调用。
 */
export async function getActiveTenantContext(
  userId: string,
): Promise<TenantContext | null> {
  let preferred: string | null = null;
  try {
    preferred = cookies().get(ACTIVE_TENANT_COOKIE)?.value ?? null;
  } catch {
    preferred = null;
  }
  return resolveTenantContextForUser(userId, preferred);
}

/** 列出某用户全部可切换的空间（用于顶部空间切换器）。 */
export async function listUserTenantMemberships(
  userId: string,
): Promise<TenantMembershipSummary[]> {
  const [memberships, user] = await Promise.all([
    prisma.tenantMember.findMany({
      where: { userId, status: "ACTIVE" },
      include: { tenant: { select: { id: true, name: true, type: true } } },
      orderBy: { joinedAt: "asc" },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { primaryTenantId: true },
    }),
  ]);
  return memberships.map((m) => ({
    tenantId: m.tenantId,
    tenantName: m.tenant.name,
    tenantType: m.tenant.type,
    role: m.role,
    seatId: m.seatId,
    isPrimary: m.tenantId === user?.primaryTenantId,
  }));
}
