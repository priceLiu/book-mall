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
  archivePromptText?: string | null;
  archiveMediaKind?: string | null;
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

const generationTaskSelectArchive = {
  archivePromptText: true,
  archiveMediaKind: true,
} as const;

let canvasArchiveColumnsReady: boolean | null = null;

function isPrismaMissingArchiveColumns(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("archivePromptText") ||
    msg.includes("archiveMediaKind") ||
    (msg.includes("does not exist") && msg.includes("CanvasGenerationTask"))
  );
}

export async function findGenerationTaskRows(args: {
  where: Prisma.CanvasGenerationTaskWhereInput;
  orderBy: Prisma.CanvasGenerationTaskOrderByWithRelationInput;
  take: number;
  includeProjectName?: boolean;
  projectIdForRows?: string;
}): Promise<GenerationTaskRecordRow[]> {
  type RawRow = Omit<GenerationTaskRecordRow, "canvasHistoryId"> & {
    canvasHistoryId?: string | null;
    archivePromptText?: string | null;
    archiveMediaKind?: string | null;
  };

  let rows: RawRow[];

  const runFind = async (
    select: Record<string, unknown>,
  ): Promise<RawRow[]> =>
    (await prisma.canvasGenerationTask.findMany({
      where: args.where,
      orderBy: args.orderBy,
      take: args.take,
      select: select as never,
    })) as RawRow[];

  const selectCore = {
    ...generationTaskSelectBase,
    ...(args.includeProjectName
      ? { projectId: true, project: { select: { name: true } } }
      : {}),
  };

  const selectWithArchive = {
    ...selectCore,
    ...(canvasArchiveColumnsReady !== false ? generationTaskSelectArchive : {}),
  };

  const selectWithHistory = {
    ...selectWithArchive,
    canvasHistoryId: true,
  };

  if (canvasHistoryIdColumnReady !== false) {
    try {
      rows = await runFind(selectWithHistory);
      canvasHistoryIdColumnReady = true;
      canvasArchiveColumnsReady = canvasArchiveColumnsReady ?? true;
    } catch (err) {
      if (canvasArchiveColumnsReady !== false && isPrismaMissingArchiveColumns(err)) {
        canvasArchiveColumnsReady = false;
        try {
          rows = await runFind({ ...selectCore, canvasHistoryId: true });
          canvasHistoryIdColumnReady = true;
        } catch (err2) {
          if (!isPrismaMissingCanvasHistoryIdColumn(err2)) throw err2;
          canvasHistoryIdColumnReady = false;
          rows = await runFind(selectCore);
        }
      } else if (!isPrismaMissingCanvasHistoryIdColumn(err)) {
        throw err;
      } else {
        canvasHistoryIdColumnReady = false;
        try {
          rows = await runFind(selectWithArchive);
        } catch (err2) {
          if (isPrismaMissingArchiveColumns(err2)) {
            canvasArchiveColumnsReady = false;
            rows = await runFind(selectCore);
          } else {
            throw err2;
          }
        }
      }
    }
  } else {
    try {
      rows = await runFind(selectWithArchive);
      canvasArchiveColumnsReady = canvasArchiveColumnsReady ?? true;
    } catch (err) {
      if (isPrismaMissingArchiveColumns(err)) {
        canvasArchiveColumnsReady = false;
        rows = await runFind(selectCore);
      } else {
        throw err;
      }
    }
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
