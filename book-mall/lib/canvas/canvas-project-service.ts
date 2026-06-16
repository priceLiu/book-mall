/**
 * canvas-web 画布项目 CRUD 服务。
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  assertAccessibleCanvasProject,
} from "@/lib/canvas/canvas-project-access";
import {
  canvasProjectEditionFromGraph,
  type CanvasProjectEdition,
} from "@/lib/canvas/canvas-story-edition";
import { getActiveTenantContext } from "@/lib/tenant/context";
import { pickProjectThumbnailUrl } from "@/lib/canvas/pick-project-thumbnail";
import { cloneCanvasGraphForDuplicate } from "@/lib/canvas/clone-canvas-graph";

export class CanvasProjectError extends Error {
  constructor(
    public code:
      | "NOT_FOUND"
      | "INVALID_INPUT"
      | "FORBIDDEN"
      | "TOO_MANY_INFLIGHT"
      | "TASK_ALREADY_INFLIGHT"
      | "EMPTY_PROMPT"
      | "MODEL_NOT_AVAILABLE"
      | "PROVIDER_KEYS_REQUIRED"
      | "GATEWAY_KEY_REQUIRED",
    message: string,
    public httpStatus = 400,
  ) {
    super(message);
    this.name = "CanvasProjectError";
  }
}

const MAX_NAME = 80;

function canvasNodeCount(canvas: unknown): number {
  if (!canvas || typeof canvas !== "object") return 0;
  const nodes = (canvas as { nodes?: unknown }).nodes;
  return Array.isArray(nodes) ? nodes.length : 0;
}

export type CanvasProjectSummary = {
  id: string;
  name: string;
  description: string;
  thumbnailUrl: string;
  edition: CanvasProjectEdition;
  createdAt: string;
  updatedAt: string;
};

export type CanvasProjectDetail = CanvasProjectSummary & {
  canvas: unknown;
};

function resolveThumbnailUrl(p: {
  thumbnailUrl: string;
  canvas: unknown;
}): string {
  const stored = p.thumbnailUrl?.trim() ?? "";
  if (stored) return stored;
  return pickProjectThumbnailUrl(p.canvas);
}

function duplicateProjectName(sourceName: string): string {
  const suffix = " 副本";
  const base = sourceName.trim() || defaultCanvasProjectName();
  const next = `${base}${suffix}`;
  if (next.length <= MAX_NAME) return next;
  return `${base.slice(0, MAX_NAME - suffix.length)}${suffix}`;
}

function toSummary(p: {
  id: string;
  name: string;
  description: string;
  thumbnailUrl: string;
  canvas: unknown;
  createdAt: Date;
  updatedAt: Date;
}): CanvasProjectSummary {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    thumbnailUrl: resolveThumbnailUrl(p),
    edition: canvasProjectEditionFromGraph(p.canvas),
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

export async function listCanvasProjectsForUser(
  userId: string,
): Promise<CanvasProjectSummary[]> {
  const rows = await prisma.canvasProject.findMany({
    where: { userId, deletedAt: null },
    orderBy: { updatedAt: "desc" },
    take: 200,
    select: {
      id: true,
      name: true,
      description: true,
      thumbnailUrl: true,
      canvas: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return rows.map(toSummary);
}

function defaultCanvasProjectName(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const y = now.getFullYear();
  const mo = pad(now.getMonth() + 1);
  const d = pad(now.getDate());
  const h = pad(now.getHours());
  const mi = pad(now.getMinutes());
  const s = pad(now.getSeconds());
  return `画布 ${y}${mo}${d}-${h}${mi}${s}`;
}

export async function createCanvasProjectForUser(
  userId: string,
  args: {
    name: string;
    description?: string;
    canvas?: unknown;
  },
): Promise<CanvasProjectDetail> {
  const name = (args.name || "").trim() || defaultCanvasProjectName();
  if (name.length > MAX_NAME)
    throw new CanvasProjectError("INVALID_INPUT", "name too long");
  const description = (args.description ?? "").toString();
  const canvas =
    args.canvas && typeof args.canvas === "object"
      ? args.canvas
      : { schemaVersion: 1, nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } };

  const tenantCtx = await getActiveTenantContext(userId);

  const created = await prisma.canvasProject.create({
    data: {
      userId,
      ownerUserId: userId,
      name,
      description,
      canvas: canvas as Prisma.InputJsonValue,
      ...(tenantCtx?.tenantType === "TEAM"
        ? { tenantId: tenantCtx.tenantId }
        : {}),
    },
  });
  return {
    ...toSummary(created),
    canvas: created.canvas,
  };
}

export async function getCanvasProjectForUser(
  userId: string,
  projectId: string,
): Promise<CanvasProjectDetail> {
  await assertAccessibleCanvasProject(userId, projectId);
  const p = await prisma.canvasProject.findFirst({
    where: { id: projectId, deletedAt: null },
  });
  if (!p) throw new CanvasProjectError("NOT_FOUND", "project not found", 404);
  return {
    ...toSummary(p),
    canvas: p.canvas,
  };
}

export async function updateCanvasProjectForUser(
  userId: string,
  projectId: string,
  patch: { name?: string; description?: string; canvas?: unknown; thumbnailUrl?: string },
): Promise<CanvasProjectDetail> {
  await assertAccessibleCanvasProject(userId, projectId);
  const p = await prisma.canvasProject.findFirst({
    where: { id: projectId, deletedAt: null },
  });
  if (!p) throw new CanvasProjectError("NOT_FOUND", "project not found", 404);

  const data: Prisma.CanvasProjectUpdateInput = {};
  if (typeof patch.name === "string") {
    const name = patch.name.trim();
    if (!name) throw new CanvasProjectError("INVALID_INPUT", "name empty");
    if (name.length > MAX_NAME)
      throw new CanvasProjectError("INVALID_INPUT", "name too long");
    data.name = name;
  }
  if (typeof patch.description === "string") {
    data.description = patch.description;
  }
  if (typeof patch.thumbnailUrl === "string") {
    data.thumbnailUrl = patch.thumbnailUrl;
  }
  if (patch.canvas !== undefined) {
    if (!patch.canvas || typeof patch.canvas !== "object") {
      throw new CanvasProjectError("INVALID_INPUT", "canvas must be object");
    }
    const prevNodes = canvasNodeCount(p.canvas);
    const nextNodes = canvasNodeCount(patch.canvas);
    if (prevNodes > 0 && nextNodes === 0) {
      throw new CanvasProjectError(
        "INVALID_INPUT",
        "refusing to save empty canvas over existing nodes",
        409,
      );
    }
    data.canvas = patch.canvas as Prisma.InputJsonValue;
  }

  const updated = await prisma.canvasProject.update({
    where: { id: projectId },
    data,
  });
  return {
    ...toSummary(updated),
    canvas: updated.canvas,
  };
}

export async function softDeleteCanvasProjectForUser(
  userId: string,
  projectId: string,
): Promise<void> {
  const p = await prisma.canvasProject.findFirst({
    where: { id: projectId, userId, deletedAt: null },
    select: { id: true, thumbnailUrl: true },
  });
  if (!p) throw new CanvasProjectError("NOT_FOUND", "project not found", 404);

  const cleanupNotBefore = new Date(Date.now() + 5 * 60 * 1000);
  await prisma.$transaction(async (tx) => {
    await tx.canvasProject.update({
      where: { id: projectId },
      data: { deletedAt: new Date() },
    });
    if (p.thumbnailUrl) {
      await tx.canvasOssCleanupQueue.create({
        data: {
          source: `canvas_project_delete:${projectId}`,
          projectId,
          ossUrl: p.thumbnailUrl,
          notBefore: cleanupNotBefore,
        },
      });
    }
    // 该项目下所有 SUCCEEDED 任务的 ossUrl 也入清理队列
    const succeeded = await tx.canvasGenerationTask.findMany({
      where: { projectId, status: "SUCCEEDED", ossUrl: { not: null } },
      select: { ossUrl: true },
    });
    for (const t of succeeded) {
      if (!t.ossUrl) continue;
      await tx.canvasOssCleanupQueue.create({
        data: {
          source: `canvas_project_delete_task:${projectId}`,
          projectId,
          ossUrl: t.ossUrl,
          notBefore: cleanupNotBefore,
        },
      });
    }
  });
}

export async function duplicateCanvasProjectForUser(
  userId: string,
  sourceProjectId: string,
): Promise<CanvasProjectDetail> {
  const source = await getCanvasProjectForUser(userId, sourceProjectId);
  const canvas = cloneCanvasGraphForDuplicate(source.canvas);
  const thumbnailUrl =
    source.thumbnailUrl?.trim() ||
    pickProjectThumbnailUrl(source.canvas) ||
    "";
  const created = await createCanvasProjectForUser(userId, {
    name: duplicateProjectName(source.name),
    description: source.description,
    canvas,
  });
  if (!thumbnailUrl) return created;

  const updated = await prisma.canvasProject.update({
    where: { id: created.id },
    data: { thumbnailUrl },
  });
  return {
    ...toSummary(updated),
    canvas: updated.canvas,
  };
}
