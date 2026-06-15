import { prisma } from "@/lib/prisma";

/** Canvas 项目归属 TEAM 租户时返回 tenantId（用于 Gateway 日志 tenantId 写入） */
export async function resolveCanvasProjectTeamTenantId(
  projectId: string | null | undefined,
): Promise<string | undefined> {
  const id = projectId?.trim();
  if (!id) return undefined;
  const project = await prisma.canvasProject.findUnique({
    where: { id },
    select: { tenantId: true },
  });
  if (!project?.tenantId) return undefined;
  const tenant = await prisma.tenant.findUnique({
    where: { id: project.tenantId },
    select: { type: true, status: true },
  });
  if (tenant?.type !== "TEAM" || tenant.status !== "ACTIVE") return undefined;
  return project.tenantId;
}
