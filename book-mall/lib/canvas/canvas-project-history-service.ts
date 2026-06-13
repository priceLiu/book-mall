import type { Prisma } from "@prisma/client";

import { CanvasProjectError } from "./canvas-project-service";
import { prisma } from "@/lib/prisma";

export const CANVAS_PROJECT_HISTORY_MAX = 15;

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

function toSummary(row: {
  id: string;
  projectId: string;
  label: string;
  source: string;
  thumbnailUrl: string;
  createdAt: Date;
}): CanvasProjectHistorySummary {
  return {
    id: row.id,
    projectId: row.projectId,
    label: row.label,
    source: row.source,
    thumbnailUrl: row.thumbnailUrl,
    createdAt: row.createdAt.toISOString(),
  };
}

async function assertProjectOwned(userId: string, projectId: string) {
  const p = await prisma.canvasProject.findFirst({
    where: { id: projectId, userId, deletedAt: null },
    select: { id: true },
  });
  if (!p) {
    throw new CanvasProjectError("NOT_FOUND", "project not found", 404);
  }
}

export async function listCanvasProjectHistoryForUser(
  userId: string,
  projectId: string,
): Promise<CanvasProjectHistorySummary[]> {
  await assertProjectOwned(userId, projectId);
  const rows = await prisma.canvasProjectHistory.findMany({
    where: { userId, projectId },
    orderBy: { createdAt: "desc" },
    take: CANVAS_PROJECT_HISTORY_MAX,
    select: {
      id: true,
      projectId: true,
      label: true,
      source: true,
      thumbnailUrl: true,
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
  await assertProjectOwned(userId, projectId);
  const row = await prisma.canvasProjectHistory.findFirst({
    where: { id: historyId, userId, projectId },
  });
  if (!row) {
    throw new CanvasProjectError("NOT_FOUND", "history not found", 404);
  }
  return { ...toSummary(row), canvas: row.canvas };
}

export async function createCanvasProjectHistoryForUser(
  userId: string,
  projectId: string,
  args: {
    canvas: unknown;
    thumbnailUrl?: string;
    source?: "autosave" | "manual";
    label?: string;
  },
): Promise<CanvasProjectHistorySummary> {
  await assertProjectOwned(userId, projectId);
  if (!args.canvas || typeof args.canvas !== "object") {
    throw new CanvasProjectError("INVALID_INPUT", "canvas must be object", 400);
  }

  const source = args.source ?? "autosave";
  const label =
    args.label?.trim() ||
    (source === "manual" ? "手动保存" : "自动保存");

  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.canvasProjectHistory.create({
      data: {
        userId,
        projectId,
        label,
        source,
        canvas: args.canvas as Prisma.InputJsonValue,
        thumbnailUrl: args.thumbnailUrl?.trim() ?? "",
      },
    });

    const overflow = await tx.canvasProjectHistory.findMany({
      where: { userId, projectId },
      orderBy: { createdAt: "desc" },
      skip: CANVAS_PROJECT_HISTORY_MAX,
      select: { id: true },
    });
    if (overflow.length) {
      await tx.canvasProjectHistory.deleteMany({
        where: { id: { in: overflow.map((r) => r.id) } },
      });
    }

    return created;
  });

  return toSummary(row);
}
