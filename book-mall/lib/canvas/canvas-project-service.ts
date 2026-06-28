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
  canvasProjectEditionFromListHints,
  canvasProjectHasCollaboration,
  type CanvasProjectEdition,
} from "@/lib/canvas/canvas-story-edition";
import { getActiveTenantContext } from "@/lib/tenant/context";
import {
  pickPersistableProjectThumbnailUrl,
  pickProjectThumbnailUrl,
} from "@/lib/canvas/pick-project-thumbnail";
import { cloneCanvasGraphForDuplicate } from "@/lib/canvas/clone-canvas-graph";
import { mergePersistedMediaIntoCanvasGraph } from "@/lib/canvas/canvas-persist-merge";
import { extractManagedOssObjectKey } from "@/lib/oss-delete-object";
import { readOssEnv } from "@/lib/oss-client";

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
      | "GATEWAY_KEY_REQUIRED"
      | "INSUFFICIENT_CREDITS"
      | "UPSTREAM_ERROR",
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
  /** 已绑定脚本包 / 公告栏的协同画布，禁止删除 */
  collaborationLocked: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CanvasProjectDetail = CanvasProjectSummary & {
  canvas: unknown;
};

function isTrustworthyStoredThumbnail(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  const cfg = readOssEnv();
  if ("error" in cfg) {
    return /myqcloud\.com/i.test(trimmed) || /aliyuncs\.com/i.test(trimmed);
  }
  return extractManagedOssObjectKey(trimmed, cfg) !== null;
}

function resolveThumbnailUrl(p: {
  thumbnailUrl: string;
  canvas: unknown;
}): string {
  const stored = p.thumbnailUrl?.trim() ?? "";
  const persistable = pickPersistableProjectThumbnailUrl(p.canvas);

  if (persistable && (!stored || !isTrustworthyStoredThumbnail(stored))) {
    return persistable;
  }
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
  const canvas =
    p.canvas && typeof p.canvas === "object"
      ? (p.canvas as { meta?: unknown })
      : null;
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    thumbnailUrl: resolveThumbnailUrl(p),
    edition: canvasProjectEditionFromGraph(p.canvas),
    collaborationLocked: canvasProjectHasCollaboration(canvas?.meta),
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

type CanvasProjectListRow = {
  id: string;
  name: string;
  description: string;
  thumbnailUrl: string;
  meta: unknown;
  nodeTypes: string[] | null;
  createdAt: Date;
  updatedAt: Date;
};

function parseListNodeTypes(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  return raw.filter((t): t is string => typeof t === "string");
}

function listRowToSummary(row: CanvasProjectListRow): CanvasProjectSummary {
  const nodeTypes = parseListNodeTypes(row.nodeTypes);
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    thumbnailUrl: row.thumbnailUrl?.trim() ?? "",
    edition: canvasProjectEditionFromListHints(row.meta, nodeTypes),
    collaborationLocked: canvasProjectHasCollaboration(row.meta),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listCanvasProjectsForUser(
  userId: string,
): Promise<CanvasProjectSummary[]> {
  const rows = await prisma.$queryRaw<CanvasProjectListRow[]>`
    SELECT
      cp.id,
      cp.name,
      cp.description,
      cp."thumbnailUrl",
      cp.canvas->'meta' AS meta,
      (
        SELECT COALESCE(jsonb_agg(elem->>'type'), '[]'::jsonb)
        FROM jsonb_array_elements(
          CASE
            WHEN jsonb_typeof(cp.canvas->'nodes') = 'array'
            THEN cp.canvas->'nodes'
            ELSE '[]'::jsonb
          END
        ) AS elem
      ) AS "nodeTypes",
      cp."createdAt",
      cp."updatedAt"
    FROM "CanvasProject" cp
    WHERE cp."userId" = ${userId}
      AND cp."deletedAt" IS NULL
    ORDER BY cp."updatedAt" DESC
    LIMIT 200
  `;
  return rows.map(listRowToSummary);
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
    const mergedCanvas = mergePersistedMediaIntoCanvasGraph(
      patch.canvas,
      p.canvas,
    );
    data.canvas = mergedCanvas as Prisma.InputJsonValue;
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
  const rows = await prisma.$queryRaw<
    Array<{ id: string; thumbnailUrl: string; meta: unknown }>
  >`
    SELECT
      cp.id,
      cp."thumbnailUrl",
      cp.canvas->'meta' AS meta
    FROM "CanvasProject" cp
    WHERE cp.id = ${projectId}
      AND cp."userId" = ${userId}
      AND cp."deletedAt" IS NULL
    LIMIT 1
  `;
  const p = rows[0];
  if (!p) throw new CanvasProjectError("NOT_FOUND", "project not found", 404);
  if (canvasProjectHasCollaboration(p.meta)) {
    throw new CanvasProjectError(
      "FORBIDDEN",
      "协同画布已绑定脚本包，无法删除",
      403,
    );
  }

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
