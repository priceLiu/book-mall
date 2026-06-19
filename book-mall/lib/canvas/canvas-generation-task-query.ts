import type { CanvasGenerationKind, CanvasGenerationStatus, Prisma } from "@prisma/client";
import { Prisma as PrismaRuntime } from "@prisma/client";

import { prisma } from "@/lib/prisma";

/** 本地/远端库尚未执行 canvasHistoryId 迁移时降级，避免生成记录 API 500。 */
let canvasHistoryIdColumnReady: boolean | null = null;

export function isPrismaMissingCanvasHistoryIdColumn(err: unknown): boolean {
  if (
    err instanceof PrismaRuntime.PrismaClientKnownRequestError &&
    err.code === "P2022"
  ) {
    const col = String(err.meta?.column ?? "");
    const model = String(err.meta?.modelName ?? "");
    return col.includes("canvasHistoryId") || model.includes("CanvasGenerationTask");
  }
  const msg = err instanceof Error ? err.message : String(err);
  if (!msg.includes("canvasGenerationTask")) return false;
  return (
    msg.includes("canvasHistoryId") ||
    msg.includes("does not exist") ||
    msg.includes("Unknown field")
  );
}

export type GenerationTaskRecordRow = {
  id: string;
  projectId: string;
  nodeId: string;
  kind: CanvasGenerationKind;
  status: CanvasGenerationStatus;
  model: string;
  ossUrl: string | null;
  ephemeralUrl: string | null;
  textOutput: string | null;
  failCode: string | null;
  failMessage: string | null;
  submittedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  kieTaskId: string | null;
  inputPayload: unknown;
  resultPayload: unknown;
  canvasHistoryId: string | null;
  project?: { name: string };
};

const generationTaskSelectBase = {
  id: true,
  nodeId: true,
  kind: true,
  status: true,
  model: true,
  ossUrl: true,
  ephemeralUrl: true,
  textOutput: true,
  failCode: true,
  failMessage: true,
  submittedAt: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
  kieTaskId: true,
  inputPayload: true,
  resultPayload: true,
} as const;

export async function findGenerationTaskRows(args: {
  where: Prisma.CanvasGenerationTaskWhereInput;
  orderBy: Prisma.CanvasGenerationTaskOrderByWithRelationInput;
  take: number;
  includeProjectName?: boolean;
  projectIdForRows?: string;
}): Promise<GenerationTaskRecordRow[]> {
  const selectWithHistory = {
    ...generationTaskSelectBase,
    ...(args.includeProjectName
      ? { projectId: true, project: { select: { name: true } } }
      : {}),
    canvasHistoryId: true,
  } as const;

  const selectWithoutHistory = {
    ...generationTaskSelectBase,
    ...(args.includeProjectName
      ? { projectId: true, project: { select: { name: true } } }
      : {}),
  } as const;

  type RawRow = Omit<GenerationTaskRecordRow, "canvasHistoryId"> & {
    canvasHistoryId?: string | null;
  };

  let rows: RawRow[];

  if (canvasHistoryIdColumnReady !== false) {
    try {
      rows = (await prisma.canvasGenerationTask.findMany({
        where: args.where,
        orderBy: args.orderBy,
        take: args.take,
        select: selectWithHistory,
      })) as RawRow[];
      canvasHistoryIdColumnReady = true;
    } catch (err) {
      if (!isPrismaMissingCanvasHistoryIdColumn(err)) throw err;
      canvasHistoryIdColumnReady = false;
      rows = (await prisma.canvasGenerationTask.findMany({
        where: args.where,
        orderBy: args.orderBy,
        take: args.take,
        select: selectWithoutHistory,
      })) as RawRow[];
    }
  } else {
    rows = (await prisma.canvasGenerationTask.findMany({
      where: args.where,
      orderBy: args.orderBy,
      take: args.take,
      select: selectWithoutHistory,
    })) as RawRow[];
  }

  return rows.map((row) => ({
    ...row,
    projectId: row.projectId || args.projectIdForRows || "",
    canvasHistoryId: row.canvasHistoryId ?? null,
  }));
}

export async function linkTaskToGenerationCanvasHistory(
  taskId: string,
  historyId: string,
  inputPayload: unknown,
): Promise<void> {
  if (canvasHistoryIdColumnReady !== false) {
    try {
      await prisma.canvasGenerationTask.update({
        where: { id: taskId },
        data: { canvasHistoryId: historyId },
      });
      canvasHistoryIdColumnReady = true;
      return;
    } catch (err) {
      if (!isPrismaMissingCanvasHistoryIdColumn(err)) throw err;
      canvasHistoryIdColumnReady = false;
    }
  }

  const base =
    inputPayload && typeof inputPayload === "object" && !Array.isArray(inputPayload)
      ? (inputPayload as Record<string, unknown>)
      : {};
  await prisma.canvasGenerationTask.update({
    where: { id: taskId },
    data: {
      inputPayload: {
        ...base,
        canvasHistoryId: historyId,
      } as Prisma.InputJsonValue,
    },
  });
}
