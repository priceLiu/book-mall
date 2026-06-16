import type { Prisma } from "@prisma/client";

import { assertAccessibleCanvasProject } from "@/lib/canvas/canvas-project-access";
import { CanvasProjectError } from "./canvas-project-service";
import { prisma } from "@/lib/prisma";
import { pickProjectThumbnailUrl } from "@/lib/canvas/pick-project-thumbnail";

/** 自动保存与手动保存各自最多保留条数（互不覆盖）。 */
export const CANVAS_PROJECT_HISTORY_MAX = 20;
export const CANVAS_PROJECT_HISTORY_MAX_PER_SOURCE = CANVAS_PROJECT_HISTORY_MAX;

export type CanvasHistorySource = "autosave" | "manual" | "generation";

export const CANVAS_GENERATION_HISTORY_MAX = 100;

export type CanvasProjectHistorySummary = {
  id: string;
  projectId: string;
  label: string;
  source: string;
  thumbnailUrl: string;
  createdAt: string;
};

export type CanvasProjectHistoryDetail = CanvasProjectHistorySummary & {
  canvas: unknown;
};

export type CanvasProjectHistoryMeta = {
  autosaveCount: number;
  manualCount: number;
  maxPerSource: number;
  oldestManual: CanvasProjectHistorySummary | null;
};

function normalizeSource(raw: string | undefined): CanvasHistorySource {
  if (raw === "manual") return "manual";
  if (raw === "generation") return "generation";
  return "autosave";
}

function maxForSource(source: CanvasHistorySource): number {
  return source === "generation"
    ? CANVAS_GENERATION_HISTORY_MAX
    : CANVAS_PROJECT_HISTORY_MAX_PER_SOURCE;
}

function toSummary(row: {
  id: string;
  projectId: string;
  label: string;
  source: string;
  thumbnailUrl: string;
  canvas?: unknown;
  createdAt: Date;
}): CanvasProjectHistorySummary {
  const stored = row.thumbnailUrl?.trim() ?? "";
  const thumbnailUrl =
    stored || (row.canvas ? pickProjectThumbnailUrl(row.canvas) : "");
  return {
    id: row.id,
    projectId: row.projectId,
    label: row.label,
    source: row.source,
    thumbnailUrl,
    createdAt: row.createdAt.toISOString(),
  };
}

async function assertHistoryProjectAccessible(userId: string, projectId: string) {
  await assertAccessibleCanvasProject(userId, projectId);
}

export async function getCanvasProjectHistoryMetaForUser(
  userId: string,
  projectId: string,
): Promise<CanvasProjectHistoryMeta> {
  await assertHistoryProjectAccessible(userId, projectId);
  const [autosaveCount, manualCount, oldestManualRow] = await Promise.all([
    prisma.canvasProjectHistory.count({
      where: { projectId, source: "autosave" },
    }),
    prisma.canvasProjectHistory.count({
      where: { projectId, source: "manual" },
    }),
    prisma.canvasProjectHistory.findFirst({
      where: { projectId, source: "manual" },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        projectId: true,
        label: true,
        source: true,
        thumbnailUrl: true,
        canvas: true,
        createdAt: true,
      },
    }),
  ]);
  return {
    autosaveCount,
    manualCount,
    maxPerSource: CANVAS_PROJECT_HISTORY_MAX_PER_SOURCE,
    oldestManual: oldestManualRow ? toSummary(oldestManualRow) : null,
  };
}

export async function listCanvasProjectHistoryForUser(
  userId: string,
  projectId: string,
  opts?: { source?: CanvasHistorySource },
): Promise<CanvasProjectHistorySummary[]> {
  await assertHistoryProjectAccessible(userId, projectId);
  const rows = await prisma.canvasProjectHistory.findMany({
    where: {
      projectId,
      ...(opts?.source ? { source: opts.source } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: CANVAS_PROJECT_HISTORY_MAX_PER_SOURCE,
    select: {
      id: true,
      projectId: true,
      label: true,
      source: true,
      thumbnailUrl: true,
      canvas: true,
      createdAt: true,
    },
  });
  return rows.map(toSummary);
}

export async function getCanvasProjectHistoryForUser(
  userId: string,
  projectId: string,
  historyId: string,
): Promise<CanvasProjectHistoryDetail> {
  await assertHistoryProjectAccessible(userId, projectId);
  const row = await prisma.canvasProjectHistory.findFirst({
    where: { id: historyId, projectId },
  });
  if (!row) {
    throw new CanvasProjectError("NOT_FOUND", "history not found", 404);
  }
  return { ...toSummary(row), canvas: row.canvas };
}

async function trimHistoryOverflow(
  tx: Prisma.TransactionClient,
  projectId: string,
  source: CanvasHistorySource,
) {
  const overflow = await tx.canvasProjectHistory.findMany({
    where: { projectId, source },
    orderBy: { createdAt: "desc" },
    skip: maxForSource(source),
    select: { id: true },
  });
  if (overflow.length) {
    await tx.canvasProjectHistory.deleteMany({
      where: { id: { in: overflow.map((r) => r.id) } },
    });
  }
}

export async function createCanvasProjectHistoryForUser(
  userId: string,
  projectId: string,
  args: {
    canvas: unknown;
    thumbnailUrl?: string;
    source?: CanvasHistorySource;
    label?: string;
  },
): Promise<CanvasProjectHistorySummary> {
  await assertHistoryProjectAccessible(userId, projectId);
  if (!args.canvas || typeof args.canvas !== "object") {
    throw new CanvasProjectError("INVALID_INPUT", "canvas must be object", 400);
  }

  const source = normalizeSource(args.source);
  const label =
    args.label?.trim() ||
    (source === "manual"
      ? "手动保存"
      : source === "generation"
        ? "生成快照"
        : "自动保存");

  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.canvasProjectHistory.create({
      data: {
        userId,
        projectId,
        label,
        source,
        canvas: args.canvas as Prisma.InputJsonValue,
        thumbnailUrl:
          args.thumbnailUrl?.trim() ||
          pickProjectThumbnailUrl(args.canvas) ||
          "",
      },
    });

    await trimHistoryOverflow(tx, projectId, source);
    return created;
  });

  return toSummary(row);
}

export async function deleteCanvasProjectHistoryForUser(
  userId: string,
  projectId: string,
  historyId: string,
): Promise<void> {
  await assertHistoryProjectAccessible(userId, projectId);
  const row = await prisma.canvasProjectHistory.findFirst({
    where: { id: historyId, projectId },
    select: { id: true, source: true },
  });
  if (!row) {
    throw new CanvasProjectError("NOT_FOUND", "history not found", 404);
  }
  if (row.source !== "manual") {
    throw new CanvasProjectError(
      "INVALID_INPUT",
      "only manual history entries can be deleted",
      400,
    );
  }
  await prisma.canvasProjectHistory.delete({ where: { id: historyId } });
}
