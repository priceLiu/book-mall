/**
 * 生成记录 ↔ 画布历史快照（恢复整图：节点、提示词、连线等）
 */
import { prisma } from "@/lib/prisma";
import { linkTaskToGenerationCanvasHistory } from "./canvas-generation-task-query";
import {
  createCanvasProjectHistoryForUser,
  type CanvasProjectHistorySummary,
} from "./canvas-project-history-service";
import { resolveGenerationRecordLabels } from "./generation-record-labels";

const NEAREST_HISTORY_WINDOW_MS = 10 * 60 * 1000;

function historyIdFromPayload(inputPayload: unknown): string | null {
  if (!inputPayload || typeof inputPayload !== "object") return null;
  const raw = (inputPayload as { canvasHistoryId?: unknown }).canvasHistoryId;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

function generationHistoryLabel(args: {
  nodeType?: string;
  model: string;
  inputPayload?: unknown;
  createdAt: Date;
}): string {
  const { modelLabel } = resolveGenerationRecordLabels({
    model: args.model,
    inputPayload: args.inputPayload,
  });
  const time = args.createdAt.toLocaleString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const nodeHint =
    args.nodeType === "sbv1-video-engine"
      ? "视频合成"
      : args.nodeType === "sbv1-image"
        ? "分镜图"
        : args.nodeType?.includes("video")
          ? "视频"
          : args.nodeType?.includes("image") || args.nodeType?.includes("engine")
            ? "生图"
            : "生成";
  return `生成快照 · ${nodeHint} · ${modelLabel} · ${time}`;
}

/** 生成任务创建时绑定画布快照（source=generation）。 */
export async function attachGenerationCanvasHistory(args: {
  userId: string;
  projectId: string;
  taskId: string;
  canvas: unknown;
  thumbnailUrl?: string;
  nodeType?: string;
  model: string;
  inputPayload?: unknown;
  createdAt?: Date;
}): Promise<CanvasProjectHistorySummary> {
  const createdAt = args.createdAt ?? new Date();
  const history = await createCanvasProjectHistoryForUser(args.userId, args.projectId, {
    canvas: args.canvas,
    thumbnailUrl: args.thumbnailUrl,
    source: "generation",
    label: generationHistoryLabel({
      nodeType: args.nodeType,
      model: args.model,
      inputPayload: args.inputPayload,
      createdAt,
    }),
  });

  await linkTaskToGenerationCanvasHistory(
    args.taskId,
    history.id,
    args.inputPayload,
  );

  return history;
}

/** 解析任务可恢复的画布 historyId（列 → payload → 时间邻近历史）。 */
export async function resolveCanvasHistoryIdForTask(args: {
  id: string;
  projectId: string;
  createdAt: Date;
  canvasHistoryId?: string | null;
  inputPayload?: unknown;
}): Promise<string | null> {
  if (args.canvasHistoryId?.trim()) {
    const ok = await prisma.canvasProjectHistory.findFirst({
      where: { id: args.canvasHistoryId.trim(), projectId: args.projectId },
      select: { id: true },
    });
    if (ok) return ok.id;
  }

  const fromPayload = historyIdFromPayload(args.inputPayload);
  if (fromPayload) {
    const ok = await prisma.canvasProjectHistory.findFirst({
      where: { id: fromPayload, projectId: args.projectId },
      select: { id: true },
    });
    if (ok) return ok.id;
  }

  const windowStart = new Date(args.createdAt.getTime() - NEAREST_HISTORY_WINDOW_MS);
  const nearest = await prisma.canvasProjectHistory.findFirst({
    where: {
      projectId: args.projectId,
      createdAt: { lte: args.createdAt, gte: windowStart },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  return nearest?.id ?? null;
}

export async function resolveCanvasHistoryIdsForTasks(
  tasks: Array<{
    id: string;
    projectId: string;
    createdAt: Date;
    canvasHistoryId?: string | null;
    inputPayload?: unknown;
  }>,
): Promise<Map<string, string | null>> {
  if (!tasks.length) return new Map();

  const projectIds = [...new Set(tasks.map((t) => t.projectId))];
  const explicitIds = tasks
    .map((t) => t.canvasHistoryId?.trim() || historyIdFromPayload(t.inputPayload))
    .filter((id): id is string => Boolean(id));

  const validRows =
    explicitIds.length > 0
      ? await prisma.canvasProjectHistory.findMany({
          where: { id: { in: [...new Set(explicitIds)] } },
          select: { id: true, projectId: true },
        })
      : [];
  const validById = new Map(validRows.map((r) => [r.id, r.projectId]));

  const minCreated = new Date(
    Math.min(...tasks.map((t) => t.createdAt.getTime())) -
      NEAREST_HISTORY_WINDOW_MS,
  );
  const maxCreated = new Date(
    Math.max(...tasks.map((t) => t.createdAt.getTime())),
  );
  const nearbyRows = await prisma.canvasProjectHistory.findMany({
    where: {
      projectId: { in: projectIds },
      createdAt: { gte: minCreated, lte: maxCreated },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, projectId: true, createdAt: true },
  });
  const nearbyByProject = new Map<string, typeof nearbyRows>();
  for (const row of nearbyRows) {
    const list = nearbyByProject.get(row.projectId) ?? [];
    list.push(row);
    nearbyByProject.set(row.projectId, list);
  }

  const out = new Map<string, string | null>();
  for (const task of tasks) {
    const direct =
      task.canvasHistoryId?.trim() || historyIdFromPayload(task.inputPayload);
    if (direct) {
      const pid = validById.get(direct);
      if (pid === task.projectId) {
        out.set(task.id, direct);
        continue;
      }
    }

    const tMs = task.createdAt.getTime();
    const list = nearbyByProject.get(task.projectId) ?? [];
    const nearest = list.find(
      (h) =>
        h.createdAt.getTime() <= tMs &&
        h.createdAt.getTime() >= tMs - NEAREST_HISTORY_WINDOW_MS,
    );
    out.set(task.id, nearest?.id ?? null);
  }
  return out;
}
