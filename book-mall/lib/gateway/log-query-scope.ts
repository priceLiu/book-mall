/**
 * GatewayRequestLog 查询范围 — 唯一归口（Gateway 控制台日志 / 财务明细 / 用量中心）。
 *
 * 团队场景：log.userId 常为成员 GatewayUser；tenantId / actorBookUserId 才是对账键。
 * 勿在各模块重复拼 OR 条件。
 */
import type { GatewayRequestStatus, Prisma } from "@prisma/client";

import { phoneFromGatewayEmail } from "@/lib/auth/user-display";
import { canViewFinanceCost } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";

export type GatewayLogScopeInput = {
  /** Book User.id（个人明细 / 用量） */
  bookUserId?: string;
  /** 团队租户（团队明细 / 全员用量） */
  tenantId?: string;
  /** 团队内成员下钻（须配合 tenantId） */
  actorUserId?: string;
  /** Gateway 控制台 session */
  gatewaySessionUser?: { id: string; bookUserId: string | null; email: string };
};

export type GatewayLogFilterInput = {
  status?: GatewayRequestStatus;
  statuses?: GatewayRequestStatus[];
  submittedFrom?: Date;
  submittedTo?: Date;
  canonicalModelKey?: string;
  clientSource?: string;
  creditsChargedGt?: number;
};

/** 与 credit-account-service UsageQuery 对齐的过滤器（范围 + 时间/模型/source） */
export type GatewayLogUsageQuery = {
  bookUserId?: string;
  tenantId?: string;
  from?: Date;
  to?: Date;
  model?: string;
  clientSource?: string;
};

export async function resolveGatewaySessionBookUserId(gatewayUser: {
  id: string;
  bookUserId: string | null;
  email: string;
}): Promise<string | null> {
  if (gatewayUser.bookUserId) return gatewayUser.bookUserId;

  const phone = phoneFromGatewayEmail(gatewayUser.email);
  const bookUser = await prisma.user.findFirst({
    where: phone
      ? { OR: [{ email: gatewayUser.email }, { phone }] }
      : { email: gatewayUser.email },
    select: { id: true },
  });
  if (!bookUser) return null;

  await prisma.gatewayUser
    .update({
      where: { id: gatewayUser.id },
      data: { bookUserId: bookUser.id },
    })
    .catch(() => undefined);

  return bookUser.id;
}

export async function buildGatewayLogScopeForBookUser(
  bookUserId: string,
): Promise<Prisma.GatewayRequestLogWhereInput> {
  const bookUser = await prisma.user.findUnique({
    where: { id: bookUserId },
    select: { gatewayApiKeyId: true, role: true },
  });

  /** 平台财务/超管：Gateway 控制台查看全站日志（与财务总览一致） */
  if (canViewFinanceCost(bookUser?.role)) {
    return {};
  }

  const [gatewayUser, teamAdminMemberships, ownedApiKeys] = await Promise.all([
    prisma.gatewayUser.findUnique({
      where: { bookUserId },
      select: { id: true },
    }),
    prisma.tenantMember.findMany({
      where: {
        userId: bookUserId,
        status: "ACTIVE",
        role: { in: ["OWNER", "ADMIN"] },
      },
      select: {
        tenantId: true,
        tenant: { select: { gatewayApiKeyId: true } },
      },
    }),
    prisma.gatewayUser
      .findUnique({ where: { bookUserId }, select: { id: true } })
      .then(async (gw) =>
        gw
          ? prisma.gatewayApiKey.findMany({
              where: { userId: gw.id, revokedAt: null },
              select: { id: true },
            })
          : [],
      ),
  ]);

  const or: Prisma.GatewayRequestLogWhereInput[] = [
    { actorBookUserId: bookUserId },
  ];
  if (gatewayUser) {
    or.push({ userId: gatewayUser.id });
  }

  const apiKeyIds = new Set<string>();
  if (bookUser?.gatewayApiKeyId) apiKeyIds.add(bookUser.gatewayApiKeyId);
  for (const k of ownedApiKeys) apiKeyIds.add(k.id);
  for (const m of teamAdminMemberships) {
    if (m.tenant.gatewayApiKeyId) apiKeyIds.add(m.tenant.gatewayApiKeyId);
  }
  if (apiKeyIds.size > 0) {
    or.push({ apiKeyId: { in: [...apiKeyIds] } });
  }

  const adminTenantIds = [...new Set(teamAdminMemberships.map((t) => t.tenantId))];
  if (adminTenantIds.length > 0) {
    or.push({ tenantId: { in: adminTenantIds } });
    const teamMembers = await prisma.tenantMember.findMany({
      where: { tenantId: { in: adminTenantIds }, status: "ACTIVE" },
      select: { userId: true },
    });
    const memberUserIds = [
      ...new Set(teamMembers.map((m) => m.userId).filter((id) => id !== bookUserId)),
    ];
    if (memberUserIds.length > 0) {
      or.push({ actorBookUserId: { in: memberUserIds } });
    }
  }

  return { OR: or };
}

/** 仅 actor（个人中心「我的本月消耗」等 widget，不含 Owner 团队全员） */
export function buildGatewayLogActorOnlyScope(
  bookUserId: string,
): Prisma.GatewayRequestLogWhereInput {
  return { actorBookUserId: bookUserId };
}

export async function buildGatewayLogScopeForGatewaySessionUser(input: {
  id: string;
  bookUserId: string | null;
  email: string;
}): Promise<Prisma.GatewayRequestLogWhereInput> {
  const bookUserId =
    input.bookUserId ?? (await resolveGatewaySessionBookUserId(input));
  if (bookUserId) {
    return buildGatewayLogScopeForBookUser(bookUserId);
  }
  return { userId: input.id };
}

/** @deprecated 请用 resolveGatewayLogScope / buildGatewayLogWhere */
export async function buildGatewayLogScopeWhere(input: {
  userId?: string;
  tenantId?: string;
  actorUserId?: string;
}): Promise<Prisma.GatewayRequestLogWhereInput> {
  return resolveGatewayLogScope({
    bookUserId: input.userId,
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
  });
}

export async function resolveGatewayLogScope(
  input: GatewayLogScopeInput,
): Promise<Prisma.GatewayRequestLogWhereInput> {
  if (input.gatewaySessionUser) {
    return buildGatewayLogScopeForGatewaySessionUser(input.gatewaySessionUser);
  }
  if (input.tenantId) {
    const where: Prisma.GatewayRequestLogWhereInput = {
      tenantId: input.tenantId,
    };
    const actor = input.actorUserId ?? input.bookUserId;
    if (actor) where.actorBookUserId = actor;
    return where;
  }
  if (input.bookUserId) {
    return buildGatewayLogScopeForBookUser(input.bookUserId);
  }
  if (input.actorUserId) {
    return { actorBookUserId: input.actorUserId };
  }
  return {};
}

export function mergeGatewayLogFilters(
  scope: Prisma.GatewayRequestLogWhereInput,
  filters?: GatewayLogFilterInput,
): Prisma.GatewayRequestLogWhereInput {
  if (!filters) return scope;

  const extra: Prisma.GatewayRequestLogWhereInput = {};
  if (filters.status) extra.status = filters.status;
  if (filters.statuses?.length) extra.status = { in: filters.statuses };
  if (filters.submittedFrom || filters.submittedTo) {
    extra.submittedAt = {
      ...(filters.submittedFrom ? { gte: filters.submittedFrom } : {}),
      ...(filters.submittedTo ? { lte: filters.submittedTo } : {}),
    };
  }
  if (filters.canonicalModelKey) extra.canonicalModelKey = filters.canonicalModelKey;
  if (filters.clientSource) {
    extra.clientSource =
      filters.clientSource as Prisma.EnumGatewayClientSourceFilter;
  }
  if (filters.creditsChargedGt != null) {
    extra.creditsCharged = { gt: filters.creditsChargedGt };
  }

  if (Object.keys(extra).length === 0) return scope;
  if (Object.keys(scope).length === 0) return extra;
  return { AND: [scope, extra] };
}

export async function buildGatewayLogWhere(
  scope: GatewayLogScopeInput,
  filters?: GatewayLogFilterInput,
): Promise<Prisma.GatewayRequestLogWhereInput> {
  const base = await resolveGatewayLogScope(scope);
  return mergeGatewayLogFilters(base, filters);
}

/** 用量中心 listUsageRecords / aggregateUsageByModel */
export async function buildGatewayLogWhereFromUsageQuery(
  q: GatewayLogUsageQuery,
): Promise<Prisma.GatewayRequestLogWhereInput> {
  return buildGatewayLogWhere(
    {
      bookUserId: q.tenantId ? undefined : q.bookUserId,
      tenantId: q.tenantId,
      actorUserId: q.tenantId ? q.bookUserId : undefined,
    },
    {
      submittedFrom: q.from,
      submittedTo: q.to,
      canonicalModelKey: q.model,
      clientSource: q.clientSource,
    },
  );
}

/** 管理后台用量总览（可选 tenant / user 筛选；无 scope 时查全站） */
export async function buildGatewayLogOverviewWhere(input: {
  tenantId?: string;
  bookUserId?: string;
  actorUserId?: string;
  submittedFrom?: Date;
  status?: GatewayRequestStatus;
  billingMode?: "PLATFORM_CREDIT" | "BYOK";
  staffFlag?: boolean;
}): Promise<Prisma.GatewayRequestLogWhereInput> {
  let scope: Prisma.GatewayRequestLogWhereInput;
  if (input.tenantId) {
    scope = await resolveGatewayLogScope({
      tenantId: input.tenantId,
      actorUserId: input.actorUserId,
    });
  } else if (input.bookUserId) {
    scope = await buildGatewayLogScopeForBookUser(input.bookUserId);
  } else if (input.actorUserId) {
    scope = { actorBookUserId: input.actorUserId };
  } else {
    scope = {};
  }

  const extra: Prisma.GatewayRequestLogWhereInput = {};
  if (input.status) extra.status = input.status;
  if (input.submittedFrom) extra.submittedAt = { gte: input.submittedFrom };
  if (input.billingMode) extra.billingMode = input.billingMode;
  if (input.staffFlag === true) extra.staffFlag = true;
  if (input.staffFlag === false) extra.staffFlag = false;

  if (Object.keys(extra).length === 0) return scope;
  if (Object.keys(scope).length === 0) return extra;
  return { AND: [scope, extra] };
}

/** 个人中心 widget：仅 actor，不含 Owner 团队全员 */
export function buildGatewayLogActorWhere(
  bookUserId: string,
  filters?: GatewayLogFilterInput,
): Prisma.GatewayRequestLogWhereInput {
  return mergeGatewayLogFilters(buildGatewayLogActorOnlyScope(bookUserId), filters);
}

/** 团队财务驾驶舱 / 团队明细：tenantId + 全员 actor（兼容未写 tenantId 的历史日志） */
export async function buildGatewayLogWhereForTeamTenant(
  tenantId: string,
  filters?: GatewayLogFilterInput,
): Promise<Prisma.GatewayRequestLogWhereInput> {
  const members = await prisma.tenantMember.findMany({
    where: { tenantId, status: "ACTIVE" },
    select: { userId: true },
  });
  const memberIds = [...new Set(members.map((m) => m.userId))];
  const scope: Prisma.GatewayRequestLogWhereInput = {
    OR: [
      { tenantId },
      ...(memberIds.length > 0 ? [{ actorBookUserId: { in: memberIds } }] : []),
    ],
  };
  return mergeGatewayLogFilters(scope, filters);
}
