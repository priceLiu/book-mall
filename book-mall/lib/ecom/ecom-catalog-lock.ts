import type { ModelShotProject } from "@/lib/ecom/ecom-model-shot-types";
import { prisma } from "@/lib/prisma";

function collectCatalogIds(project: ModelShotProject): string[] {
  const ids = new Set<string>();
  for (const ref of project.references) {
    if (ref.catalogId) ids.add(ref.catalogId);
  }
  for (const item of project.plan.items) {
    if (item.sceneCatalogId) ids.add(item.sceneCatalogId);
    if (item.propCatalogId) ids.add(item.propCatalogId);
  }
  return [...ids];
}

async function lockIds(table: "pose" | "prop" | "scene", ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const now = new Date();
  if (table === "pose") {
    await prisma.ecomPoseLibraryEntry.updateMany({
      where: { id: { in: ids }, scope: "user", lockedAt: null },
      data: { lockedAt: now },
    });
  } else if (table === "prop") {
    await prisma.ecomPropLibraryEntry.updateMany({
      where: { id: { in: ids }, scope: "user", lockedAt: null },
      data: { lockedAt: now },
    });
  } else {
    await prisma.ecomSceneLibraryEntry.updateMany({
      where: { id: { in: ids }, scope: "user", lockedAt: null },
      data: { lockedAt: now },
    });
  }
}

/** 确认计划或成图成功后锁定被引用的用户 catalog 条目 */
export async function touchCatalogLockOnProjectUse(project: ModelShotProject): Promise<void> {
  const ids = collectCatalogIds(project);
  if (ids.length === 0) return;
  await Promise.all([
    lockIds("pose", ids),
    lockIds("prop", ids),
    lockIds("scene", ids),
  ]);
}

export async function assertUserCatalogEditable(
  table: "pose" | "prop" | "scene",
  id: string,
  userId: string,
): Promise<void> {
  const row =
    table === "pose"
      ? await prisma.ecomPoseLibraryEntry.findFirst({ where: { id, deletedAt: null } })
      : table === "prop"
        ? await prisma.ecomPropLibraryEntry.findFirst({ where: { id, deletedAt: null } })
        : await prisma.ecomSceneLibraryEntry.findFirst({ where: { id, deletedAt: null } });
  if (!row) throw new Error("条目不存在");
  if (row.scope !== "user" || row.userId !== userId) {
    throw new Error("无权修改系统库条目");
  }
  if (row.lockedAt) throw new Error("该条目已被项目使用，不可编辑或删除");
}
