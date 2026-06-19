import { getVideoPersonalMaxConcurrency } from "@/lib/billing/video-risk-control";
import { prisma } from "@/lib/prisma";
import { resolveDefaultTeamMaxConcurrency } from "@/lib/tenant/team-concurrency";

export type TrafficScope = {
  scopeKey: string;
  ownerType: "USER" | "TENANT";
  ownerId: string;
  tenantId?: string | null;
};

export function buildTenantScopeKey(tenantId: string): string {
  return `tenant:${tenantId}`;
}

export function buildUserScopeKey(userId: string): string {
  return `user:${userId}`;
}

/** Gateway log / 任务 → traffic scope */
export function resolveTrafficScopeFromIds(input: {
  tenantId?: string | null;
  actorUserId?: string | null;
  userId: string;
}): TrafficScope {
  const tenantId = input.tenantId?.trim();
  if (tenantId) {
    return {
      scopeKey: buildTenantScopeKey(tenantId),
      ownerType: "TENANT",
      ownerId: tenantId,
      tenantId,
    };
  }
  const actor = input.actorUserId?.trim() || input.userId;
  return {
    scopeKey: buildUserScopeKey(actor),
    ownerType: "USER",
    ownerId: actor,
    tenantId: null,
  };
}

export async function resolveCanvasProjectTrafficScope(
  projectId: string,
  actorUserId: string,
): Promise<TrafficScope> {
  const project = await prisma.canvasProject.findUnique({
    where: { id: projectId },
    select: { tenantId: true, userId: true },
  });
  if (!project) {
    return resolveTrafficScopeFromIds({ userId: actorUserId, actorUserId });
  }
  if (project.tenantId) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: project.tenantId },
      select: { type: true, status: true },
    });
    if (tenant?.type === "TEAM" && tenant.status === "ACTIVE") {
      return resolveTrafficScopeFromIds({
        tenantId: project.tenantId,
        actorUserId,
        userId: project.userId,
      });
    }
  }
  return resolveTrafficScopeFromIds({
    userId: project.userId,
    actorUserId,
  });
}

export async function resolveStoryProjectTrafficScope(
  projectId: string,
  actorUserId: string,
): Promise<TrafficScope> {
  const project = await prisma.storyProject.findUnique({
    where: { id: projectId },
    select: { tenantId: true, userId: true },
  });
  if (!project) {
    return resolveTrafficScopeFromIds({ userId: actorUserId, actorUserId });
  }
  if (project.tenantId) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: project.tenantId },
      select: { type: true, status: true },
    });
    if (tenant?.type === "TEAM" && tenant.status === "ACTIVE") {
      return resolveTrafficScopeFromIds({
        tenantId: project.tenantId,
        actorUserId,
        userId: project.userId,
      });
    }
  }
  return resolveTrafficScopeFromIds({
    userId: project.userId,
    actorUserId,
  });
}

export async function resolveMaxConcurrencyForScope(
  scope: TrafficScope,
): Promise<number> {
  if (scope.ownerType === "TENANT") {
    const tenant = await prisma.tenant.findUnique({
      where: { id: scope.ownerId },
      select: { maxConcurrency: true, seatLimit: true, packageLevel: true },
    });
    if (tenant?.maxConcurrency && tenant.maxConcurrency > 0) {
      return tenant.maxConcurrency;
    }
    return resolveDefaultTeamMaxConcurrency({
      seatLimit: tenant?.seatLimit ?? 1,
      packageLevel: tenant?.packageLevel,
    });
  }
  return getVideoPersonalMaxConcurrency();
}
