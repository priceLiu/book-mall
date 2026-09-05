/**
 * 我的 AI 空间 · 合成任务只读查询
 *
 * 与状态机分家：状态机要拉 `media-render-service`（间接依赖 archiver / ffmpeg），
 * 而 Server Component 只需读列表。页面从本模块取数，避免把渲染流水线带进 RSC 编译图。
 */

import { prisma } from "@/lib/prisma";

import {
  buildComposeProgressSteps,
  computeComposeProgressPercent,
  currentComposeStepId,
} from "./ai-space-compose-progress";
import {
  AI_SPACE_COMPOSE_STATUS_LABEL,
  type AiSpaceComposeTaskDto,
} from "./ai-space-compose-types";
import { parseAiSpaceComposeOverlayOptions } from "./ai-space-compose-options";

type ComposeRow = {
  id: string;
  status: string;
  digitalHumanId: string;
  audioAssetId: string;
  videoMaterialId: string | null;
  tempHumanVideoUrl: string | null;
  finalVideoUrl: string | null;
  errorMessage: string | null;
  gatewayLogId: string | null;
  gatewayTaskId: string | null;
  mediaRenderJobId: string | null;
  options: unknown;
  createdAt: Date;
  updatedAt: Date;
};

type MediaJobSlice = {
  status: string;
  progress: number;
  progressLabel: string | null;
};

export function toAiSpaceComposeTaskDto(
  row: ComposeRow,
  mediaJob?: MediaJobSlice | null,
): AiSpaceComposeTaskDto {
  const steps = buildComposeProgressSteps({
    status: row.status,
    videoMaterialId: row.videoMaterialId,
    gatewayTaskId: row.gatewayTaskId,
    tempHumanVideoUrl: row.tempHumanVideoUrl,
    finalVideoUrl: row.finalVideoUrl,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt,
    mediaRenderJob: mediaJob ?? null,
  });
  const progress = computeComposeProgressPercent(steps);
  const runningStep = steps.find((s) => s.status === "running");
  const statusLabel =
    runningStep?.label ??
    AI_SPACE_COMPOSE_STATUS_LABEL[row.status] ??
    row.status;

  return {
    id: row.id,
    status: row.status,
    statusLabel,
    digitalHumanId: row.digitalHumanId,
    audioAssetId: row.audioAssetId,
    videoMaterialId: row.videoMaterialId,
    options: parseAiSpaceComposeOverlayOptions(row.options),
    tempHumanVideoUrl: row.tempHumanVideoUrl,
    finalVideoUrl: row.finalVideoUrl,
    errorMessage: row.errorMessage,
    gatewayLogId: row.gatewayLogId,
    progress,
    steps,
    currentStepId: currentComposeStepId(steps),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const composeSelect = {
  id: true,
  status: true,
  digitalHumanId: true,
  audioAssetId: true,
  videoMaterialId: true,
  tempHumanVideoUrl: true,
  finalVideoUrl: true,
  errorMessage: true,
  gatewayLogId: true,
  gatewayTaskId: true,
  mediaRenderJobId: true,
  options: true,
  createdAt: true,
  updatedAt: true,
} as const;

async function loadMediaJobs(
  jobIds: string[],
): Promise<Map<string, MediaJobSlice>> {
  const unique = [...new Set(jobIds.filter(Boolean))];
  if (unique.length === 0) return new Map();
  const jobs = await prisma.mediaRenderJob.findMany({
    where: { id: { in: unique } },
    select: { id: true, status: true, progress: true, progressLabel: true },
  });
  return new Map(jobs.map((j) => [j.id, j]));
}

function mapRowsToDtos(
  rows: ComposeRow[],
  jobs: Map<string, MediaJobSlice>,
): AiSpaceComposeTaskDto[] {
  return rows.map((row) =>
    toAiSpaceComposeTaskDto(
      row,
      row.mediaRenderJobId ? jobs.get(row.mediaRenderJobId) : null,
    ),
  );
}

export async function listAiSpaceComposeTasks(
  userId: string,
): Promise<AiSpaceComposeTaskDto[]> {
  const rows = await prisma.aiSpaceComposeTask.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: composeSelect,
  });
  const jobs = await loadMediaJobs(
    rows.map((r) => r.mediaRenderJobId).filter((id): id is string => !!id),
  );
  return mapRowsToDtos(rows, jobs);
}

export async function getAiSpaceComposeTask(
  userId: string,
  id: string,
): Promise<AiSpaceComposeTaskDto | null> {
  const row = await prisma.aiSpaceComposeTask.findFirst({
    where: { id, userId },
    select: composeSelect,
  });
  if (!row) return null;
  const jobs = row.mediaRenderJobId
    ? await loadMediaJobs([row.mediaRenderJobId])
    : new Map();
  return toAiSpaceComposeTaskDto(
    row,
    row.mediaRenderJobId ? jobs.get(row.mediaRenderJobId) : null,
  );
}
