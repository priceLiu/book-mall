/**
 * 状态驾驶舱 · scope / 时间 / filter 解析，复用 log-query-scope。
 */
import type { GatewayRequestStatus, Prisma } from "@prisma/client";

import { canViewFinanceCost } from "@/lib/auth/permissions";
import {
  parseDashboardHoursParam,
  parseLogStatusesParam,
  parseLogSubmittedFromParam,
  parseLogSubmittedToParam,
} from "@/lib/gateway/log-query-params";
import {
  buildGatewayLogScopeForGatewaySessionUser,
  buildGatewayLogWhereForTeamTenant,
  mergeGatewayLogFilters,
  resolveGatewaySessionBookUserId,
  type GatewayLogFilterInput,
} from "@/lib/gateway/log-query-scope";
import { prisma } from "@/lib/prisma";
import {
  emptyActorWhere,
  parseActorPhoneQuery,
  resolveBookUserIdsByPhoneQuery,
  resolveTeamMemberUserIds,
} from "@/lib/gateway/log-dashboard-actor";

export type DashboardScopeParam = "all" | "team" | "actor" | "project";

export class DashboardScopeError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "DashboardScopeError";
  }
}

export function parseDashboardScopeParam(
  value: string | null | undefined,
): DashboardScopeParam {
  const v = value?.trim().toLowerCase();
  if (v === "team" || v === "actor" || v === "project") return v;
  return "all";
}

export type DashboardQueryParams = {
  scope: DashboardScopeParam;
  tenantId?: string;
  actorBookUserId?: string;
  actorPhone?: string;
  storyProjectId?: string;
  filters: GatewayLogFilterInput;
};

export function parseDashboardFiltersFromSearchParams(
  params: URLSearchParams,
): GatewayLogFilterInput {
  const hours = parseDashboardHoursParam(params.get("hours"));
  const submittedFrom =
    hours != null
      ? new Date(Date.now() - hours * 3600 * 1000)
      : parseLogSubmittedFromParam(params.get("from"));
  const submittedTo = parseLogSubmittedToParam(params.get("to"));

  const statusRaw = params.get("status")?.trim();
  const statuses = parseLogStatusesParam(params.get("statuses"));
  const status =
    statusRaw && !statuses?.length
      ? (statusRaw.toUpperCase() as GatewayRequestStatus)
      : undefined;

  return {
    status,
    statuses,
    submittedFrom: submittedFrom ?? undefined,
    submittedTo: submittedTo ?? undefined,
    clientSource: params.get("clientSource")?.trim() || undefined,
    providerKind: params.get("providerKind")?.trim() || undefined,
    model: params.get("model")?.trim() || undefined,
    credentialId: params.get("credentialId")?.trim() || undefined,
    storyProjectId: params.get("storyProjectId")?.trim() || undefined,
  };
}

export function parseDashboardQueryFromSearchParams(
  params: URLSearchParams,
): DashboardQueryParams {
  const scope = parseDashboardScopeParam(params.get("scope"));
  const storyProjectId = params.get("storyProjectId")?.trim() || undefined;
  return {
    scope,
    tenantId: params.get("tenantId")?.trim() || undefined,
    actorBookUserId: params.get("actorBookUserId")?.trim() || undefined,
    actorPhone: parseActorPhoneQuery(params.get("actorPhone")),
    storyProjectId,
    filters: parseDashboardFiltersFromSearchParams(params),
  };
}

async function assertTeamDashboardAccess(
  bookUserId: string,
  tenantId: string,
  isPlatformAdmin: boolean,
) {
  if (isPlatformAdmin) return;
  const membership = await prisma.tenantMember.findFirst({
    where: {
      tenantId,
      userId: bookUserId,
      status: "ACTIVE",
      role: { in: ["OWNER", "ADMIN"] },
    },
    select: { id: true },
  });
  if (!membership) {
    throw new DashboardScopeError("无权查看该团队", 403);
  }
}

async function applyActorPhoneFilter(
  base: Prisma.GatewayRequestLogWhereInput,
  input: {
    scope: DashboardScopeParam;
    tenantId?: string;
    actorPhone?: string;
    bookUserId: string | null;
  },
): Promise<Prisma.GatewayRequestLogWhereInput> {
  const phoneQuery = input.actorPhone?.trim();
  if (!phoneQuery) return base;

  let restrictToUserIds: string[] | undefined;
  if (input.scope === "team" && input.tenantId) {
    restrictToUserIds = await resolveTeamMemberUserIds(input.tenantId);
  }

  const matchedIds = await resolveBookUserIdsByPhoneQuery(phoneQuery, {
    restrictToUserIds,
  });
  if (matchedIds.length === 0) {
    return { AND: [base, emptyActorWhere()] };
  }

  const actorFilter: Prisma.GatewayRequestLogWhereInput =
    matchedIds.length === 1
      ? { actorBookUserId: matchedIds[0] }
      : { actorBookUserId: { in: matchedIds } };

  return { AND: [base, actorFilter] };
}

export async function buildDashboardLogWhere(input: {
  gatewaySessionUser: { id: string; bookUserId: string | null; email: string };
  query: DashboardQueryParams;
}): Promise<Prisma.GatewayRequestLogWhereInput> {
  const bookUserId = await resolveGatewaySessionBookUserId(
    input.gatewaySessionUser,
  );
  const bookUser = bookUserId
    ? await prisma.user.findUnique({
        where: { id: bookUserId },
        select: { role: true },
      })
    : null;
  const isPlatformAdmin = canViewFinanceCost(bookUser?.role);

  let base: Prisma.GatewayRequestLogWhereInput;
  const filters = { ...input.query.filters };

  switch (input.query.scope) {
    case "team": {
      if (!input.query.tenantId) {
        throw new DashboardScopeError("团队筛选须指定 tenantId", 400);
      }
      if (!bookUserId) {
        throw new DashboardScopeError("未关联 Book 账号", 403);
      }
      await assertTeamDashboardAccess(
        bookUserId,
        input.query.tenantId,
        isPlatformAdmin,
      );
      base = await buildGatewayLogWhereForTeamTenant(input.query.tenantId);
      break;
    }
    case "actor": {
      if (!bookUserId) {
        throw new DashboardScopeError("个人筛选须登录 Book 账号", 403);
      }
      const sessionScope = await buildGatewayLogScopeForGatewaySessionUser(
        input.gatewaySessionUser,
      );
      const actorId = input.query.actorBookUserId ?? bookUserId;
      base = input.query.actorPhone?.trim()
        ? sessionScope
        : { AND: [sessionScope, { actorBookUserId: actorId }] };
      break;
    }
    case "project": {
      const projectId =
        input.query.storyProjectId ?? filters.storyProjectId;
      if (!projectId) {
        throw new DashboardScopeError("项目筛选须指定 storyProjectId", 400);
      }
      base = await buildGatewayLogScopeForGatewaySessionUser(
        input.gatewaySessionUser,
      );
      filters.storyProjectId = projectId;
      break;
    }
    case "all":
    default:
      base = await buildGatewayLogScopeForGatewaySessionUser(
        input.gatewaySessionUser,
      );
  }

  const withPhone = await applyActorPhoneFilter(base, {
    scope: input.query.scope,
    tenantId: input.query.tenantId,
    actorPhone: input.query.actorPhone,
    bookUserId,
  });

  return mergeGatewayLogFilters(withPhone, filters);
}
