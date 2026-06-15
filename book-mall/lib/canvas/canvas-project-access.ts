import type { Prisma } from "@prisma/client";

import { CanvasProjectError } from "@/lib/canvas/canvas-project-service";
import { prisma } from "@/lib/prisma";

async function isActiveTeamMember(userId: string, tenantId: string): Promise<boolean> {
  const member = await prisma.tenantMember.findFirst({
    where: {
      userId,
      tenantId,
      status: "ACTIVE",
      tenant: { type: "TEAM", status: "ACTIVE" },
    },
    select: { id: true },
  });
  return Boolean(member);
}

/** 与 project.userId 是否同属至少一个 ACTIVE 团队。 */
async function sharesActiveTeamWithProjectOwner(
  userId: string,
  ownerUserId: string,
): Promise<boolean> {
  if (userId === ownerUserId) return true;
  const ownerTeams = await prisma.tenantMember.findMany({
    where: {
      userId: ownerUserId,
      status: "ACTIVE",
      tenant: { type: "TEAM", status: "ACTIVE" },
    },
    select: { tenantId: true },
  });
  if (ownerTeams.length === 0) return false;
  const shared = await prisma.tenantMember.findFirst({
    where: {
      userId,
      status: "ACTIVE",
      tenantId: { in: ownerTeams.map((t) => t.tenantId) },
    },
    select: { id: true },
  });
  return Boolean(shared);
}

type CanvasProjectAccessRow = {
  id: string;
  userId: string;
  tenantId: string | null;
  visibility: string;
};

async function loadCanvasProjectAccessRow(
  projectId: string,
): Promise<CanvasProjectAccessRow | null> {
  return prisma.canvasProject.findFirst({
    where: { id: projectId, deletedAt: null },
    select: { id: true, userId: true, tenantId: true, visibility: true },
  });
}

async function userCanAccessCanvasProjectRow(
  userId: string,
  project: CanvasProjectAccessRow,
): Promise<boolean> {
  if (project.userId === userId) return true;

  if (project.tenantId && (await isActiveTeamMember(userId, project.tenantId))) {
    return true;
  }

  if (project.visibility === "TEAM_PUBLIC") {
    return sharesActiveTeamWithProjectOwner(userId, project.userId);
  }

  return false;
}

/** 用户是否可访问画布项目（创建者 / 团队项目 / 团队公共库）。 */
export async function findAccessibleCanvasProject(
  userId: string,
  projectId: string,
): Promise<{ id: string } | null> {
  const project = await loadCanvasProjectAccessRow(projectId);
  if (!project) return null;
  if (!(await userCanAccessCanvasProjectRow(userId, project))) return null;
  return { id: project.id };
}

export async function assertAccessibleCanvasProject(
  userId: string,
  projectId: string,
): Promise<{ id: string }> {
  const project = await loadCanvasProjectAccessRow(projectId);
  if (!project) {
    throw new CanvasProjectError("NOT_FOUND", "project not found", 404);
  }
  if (!(await userCanAccessCanvasProjectRow(userId, project))) {
    throw new CanvasProjectError("FORBIDDEN", "无权访问此画布项目", 403);
  }
  return { id: project.id };
}

/** listProjectTasks / poll worker 等项目级 where（含团队共享项目）。 */
export async function canvasProjectAccessWhere(
  userId: string,
  projectId: string,
): Promise<Prisma.CanvasProjectWhereInput | null> {
  const project = await findAccessibleCanvasProject(userId, projectId);
  if (!project) return null;
  return { id: projectId, deletedAt: null };
}
