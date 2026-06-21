/**
 * GatewayRequestLog 查询范围 — 唯一归口（Gateway 控制台日志 / 财务明细 / 用量中心）。
 *
 * 团队场景：log.userId 常为成员 GatewayUser；tenantId / actorBookUserId 才是对账键。
 * 勿在各模块重复拼 OR 条件。
 */
import type { GatewayRequestStatus, Prisma } from "@prisma/client";

import { buildSlowGenerationWhere } from "@/lib/generation/slow-generation";

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
  storyProjectId?: string;
  submittedFrom?: Date;
  /** 含上界（lte），供 Gateway 控制台自定义日期 */
  submittedTo?: Date;
  /** 不含上界（lt），与 `periodBounds` 账期 to 对齐 — 财务聚合优先用此字段 */
  submittedBefore?: Date;
  canonicalModelKey?: string;
  /** 日志页展示 modelKey（canonical 优先，否则 model） */
  model?: string;
  providerKind?: string;
  credentialId?: string;
  clientSource?: string;
  creditsChargedGt?: number;
  /** 耗时 ≥ GENERATION_SLOW_WARN_MS（默认 800s）或进行中已超该阈值 */
  slowWarn?: boolean;
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
    const teamScope = await buildGatewayLogScopeOrForTeamTenants([input.tenantId]);
    const actor = input.actorUserId ?? input.bookUserId;
    if (actor) {
      return { AND: [teamScope, { actorBookUserId: actor }] };
    }
    return teamScope;
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

  const parts: Prisma.GatewayRequestLogWhereInput[] = [];
  if (Object.keys(scope).length > 0) parts.push(scope);

  const extra: Prisma.GatewayRequestLogWhereInput = {};
  if (filters.status) extra.status = filters.status;
  if (filters.statuses?.length) extra.status = { in: filters.statuses };
  if (filters.storyProjectId) extra.storyProjectId = filters.storyProjectId;
  if (filters.submittedFrom || filters.submittedTo || filters.submittedBefore) {
    extra.submittedAt = {
      ...(filters.submittedFrom ? { gte: filters.submittedFrom } : {}),
      ...(filters.submittedTo ? { lte: filters.submittedTo } : {}),
      ...(filters.submittedBefore ? { lt: filters.submittedBefore } : {}),
    };
  }
  if (filters.canonicalModelKey) extra.canonicalModelKey = filters.canonicalModelKey;
  if (filters.providerKind) {
    extra.providerKind =
      filters.providerKind as Prisma.EnumGatewayProviderKindFilter;
  }
  if (filters.credentialId) extra.credentialId = filters.credentialId;
  if (filters.clientSource) {
    extra.clientSource =
      filters.clientSource as Prisma.EnumGatewayClientSourceFilter;
  }
  if (filters.creditsChargedGt != null) {
    extra.creditsCharged = { gt: filters.creditsChargedGt };
  }
  if (Object.keys(extra).length > 0) parts.push(extra);

  if (filters.slowWarn) {
    parts.push(buildSlowGenerationWhere());
  }

  if (filters.model) {
    parts.push({
      OR: [{ canonicalModelKey: filters.model }, { model: filters.model }],
    });
  }

  if (parts.length === 0) return {};
  if (parts.length === 1) return parts[0]!;
  return { AND: parts };
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
  const timeFilters: GatewayLogFilterInput = {
    submittedFrom: q.from,
    ...(q.to ? { submittedBefore: q.to } : {}),
    clientSource: q.clientSource,
    ...(q.model ? { model: q.model } : {}),
  };

  if (q.tenantId) {
    const teamWhere = await buildGatewayLogWhereForTeamTenant(q.tenantId, timeFilters);
    if (q.bookUserId) {
      return { AND: [teamWhere, { actorBookUserId: q.bookUserId }] };
    }
    return teamWhere;
  }

  if (!q.bookUserId) {
    return mergeGatewayLogFilters({}, timeFilters);
  }

  return buildGatewayLogWhere({ bookUserId: q.bookUserId }, timeFilters);
}

export type TeamGatewayScopeContext = {
  tenantIds: string[];
  memberIds: string[];
  apiKeyIds: string[];
  teamsByUser: Map<string, string[]>;
  apiKeyToTenantIds: Map<string, string[]>;
  /** 归属 TEAM 的 Canvas 项目 id（clientPage 归因 / scope 扩展） */
  canvasProjectIds: string[];
  canvasProjectToTenant: Map<string, string>;
};

/** 团队财务 / 驾驶舱 scope 上下文（成员 actor + 团队托管 sk-gw） */
export async function loadTeamGatewayScopeContext(
  tenantIds: string[],
): Promise<TeamGatewayScopeContext> {
  if (tenantIds.length === 0) {
    return {
      tenantIds: [],
      memberIds: [],
      apiKeyIds: [],
      teamsByUser: new Map(),
      apiKeyToTenantIds: new Map(),
      canvasProjectIds: [],
      canvasProjectToTenant: new Map(),
    };
  }

  const [memberships, tenants, canvasProjects] = await Promise.all([
    prisma.tenantMember.findMany({
      where: { tenantId: { in: tenantIds }, status: "ACTIVE" },
      select: { tenantId: true, userId: true },
    }),
    prisma.tenant.findMany({
      where: { id: { in: tenantIds } },
      select: { id: true, gatewayApiKeyId: true },
    }),
    prisma.canvasProject.findMany({
      where: { tenantId: { in: tenantIds } },
      select: { id: true, tenantId: true },
    }),
  ]);

  const memberIds = [...new Set(memberships.map((m) => m.userId))];
  const teamsByUser = new Map<string, string[]>();
  for (const m of memberships) {
    const cur = teamsByUser.get(m.userId) ?? [];
    cur.push(m.tenantId);
    teamsByUser.set(m.userId, cur);
  }

  const apiKeyToTenantIds = new Map<string, string[]>();
  const apiKeyIds: string[] = [];
  for (const tenant of tenants) {
    const keyId = tenant.gatewayApiKeyId?.trim();
    if (!keyId) continue;
    apiKeyIds.push(keyId);
    const cur = apiKeyToTenantIds.get(keyId) ?? [];
    cur.push(tenant.id);
    apiKeyToTenantIds.set(keyId, cur);
  }

  const canvasProjectToTenant = new Map<string, string>();
  for (const project of canvasProjects) {
    if (project.tenantId) canvasProjectToTenant.set(project.id, project.tenantId);
  }

  return {
    tenantIds,
    memberIds,
    apiKeyIds: [...new Set(apiKeyIds)],
    teamsByUser,
    apiKeyToTenantIds,
    canvasProjectIds: canvasProjects.map((p) => p.id),
    canvasProjectToTenant,
  };
}

export function buildTeamGatewayLogScopeFromContext(
  ctx: TeamGatewayScopeContext,
): Prisma.GatewayRequestLogWhereInput {
  if (ctx.tenantIds.length === 0) return { id: { in: [] } };

  const canvasClauses: Prisma.GatewayRequestLogWhereInput[] = [];
  for (const projectId of ctx.canvasProjectIds) {
    canvasClauses.push({ clientPage: { startsWith: `canvas/${projectId}/` } });
    canvasClauses.push({ clientPage: `canvas/${projectId}` });
  }

  return {
    OR: [
      { tenantId: { in: ctx.tenantIds } },
      ...(ctx.memberIds.length > 0 ? [{ actorBookUserId: { in: ctx.memberIds } }] : []),
      ...(ctx.apiKeyIds.length > 0 ? [{ apiKeyId: { in: ctx.apiKeyIds } }] : []),
      ...canvasClauses,
    ],
  };
}

/** 团队用量 / 驾驶舱 team scope — 唯一 WHERE 归口（scope + 账期/状态等 filters） */
export async function buildTeamGatewayUsageWhere(input: {
  tenantIds: string[];
  filters?: GatewayLogFilterInput;
}): Promise<Prisma.GatewayRequestLogWhereInput> {
  const ctx = await loadTeamGatewayScopeContext(input.tenantIds);
  const scope = buildTeamGatewayLogScopeFromContext(ctx);
  return mergeGatewayLogFilters(scope, input.filters);
}

/** 从 Gateway clientPage 解析 Canvas 项目 id（如 canvas/{projectId}/story-pro）。 */
export function parseCanvasProjectIdFromClientPage(
  clientPage?: string | null,
): string | null {
  const page = clientPage?.trim();
  if (!page?.startsWith("canvas/")) return null;
  const projectId = page.split("/")[1]?.trim();
  return projectId || null;
}

/** 单条日志 → 应计入的 TEAM 租户 id（批量财务列表分摊用） */
export function resolveTeamTenantIdsForGatewayLog(
  log: {
    tenantId?: string | null;
    actorBookUserId?: string | null;
    apiKeyId?: string | null;
    clientPage?: string | null;
  },
  ctx: TeamGatewayScopeContext,
): string[] {
  const tenantIdSet = new Set(ctx.tenantIds);
  const targets = new Set<string>();

  if (log.tenantId && tenantIdSet.has(log.tenantId)) {
    targets.add(log.tenantId);
  }
  if (log.actorBookUserId) {
    for (const tenantId of ctx.teamsByUser.get(log.actorBookUserId) ?? []) {
      if (tenantIdSet.has(tenantId)) targets.add(tenantId);
    }
  }
  if (log.apiKeyId) {
    for (const tenantId of ctx.apiKeyToTenantIds.get(log.apiKeyId) ?? []) {
      if (tenantIdSet.has(tenantId)) targets.add(tenantId);
    }
  }
  const canvasProjectId = parseCanvasProjectIdFromClientPage(log.clientPage);
  if (canvasProjectId) {
    const teamTenantId = ctx.canvasProjectToTenant.get(canvasProjectId);
    if (teamTenantId && tenantIdSet.has(teamTenantId)) {
      targets.add(teamTenantId);
    }
  }

  return [...targets];
}

/** 批量团队财务列表：tenantId OR 成员 actor OR 团队托管 sk-gw（与单团队驾驶舱一致） */
export async function buildGatewayLogScopeOrForTeamTenants(
  tenantIds: string[],
): Promise<Prisma.GatewayRequestLogWhereInput> {
  const ctx = await loadTeamGatewayScopeContext(tenantIds);
  return buildTeamGatewayLogScopeFromContext(ctx);
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

/** 团队财务驾驶舱 / 团队明细：tenantId + 成员 actor + 团队 sk-gw + 团队 Canvas 项目 */
export async function buildGatewayLogWhereForTeamTenant(
  tenantId: string,
  filters?: GatewayLogFilterInput,
): Promise<Prisma.GatewayRequestLogWhereInput> {
  return buildTeamGatewayUsageWhere({ tenantIds: [tenantId], filters });
}
