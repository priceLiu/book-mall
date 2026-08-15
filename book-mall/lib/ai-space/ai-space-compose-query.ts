/**
 * 我的 AI 空间 · 合成任务只读查询
 *
 * 与状态机分家：状态机要拉 `media-render-service`（间接依赖 archiver / ffmpeg），
 * 而 Server Component 只需读列表。页面从本模块取数，避免把渲染流水线带进 RSC 编译图。
 */

import { prisma } from "@/lib/prisma";

import {
  AI_SPACE_COMPOSE_STATUS_LABEL,
  type AiSpaceComposeTaskDto,
} from "./ai-space-compose-types";

export function toAiSpaceComposeTaskDto(row: {
  id: string;
  status: string;
  digitalHumanId: string;
  audioAssetId: string;
  videoMaterialId: string | null;
  tempHumanVideoUrl: string | null;
  finalVideoUrl: string | null;
  errorMessage: string | null;
  gatewayLogId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): AiSpaceComposeTaskDto {
  const progress =
    row.status === "completed"
      ? 100
      : row.status === "composing"
        ? 70
        : row.status === "generating_human"
          ? 35
          : row.status === "failed"
            ? 0
            : 5;
  return {
    id: row.id,
    status: row.status,
    statusLabel: AI_SPACE_COMPOSE_STATUS_LABEL[row.status] ?? row.status,
    digitalHumanId: row.digitalHumanId,
    audioAssetId: row.audioAssetId,
    videoMaterialId: row.videoMaterialId,
    tempHumanVideoUrl: row.tempHumanVideoUrl,
    finalVideoUrl: row.finalVideoUrl,
    errorMessage: row.errorMessage,
    gatewayLogId: row.gatewayLogId,
    progress,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listAiSpaceComposeTasks(
  userId: string,
): Promise<AiSpaceComposeTaskDto[]> {
  const rows = await prisma.aiSpaceComposeTask.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return rows.map(toAiSpaceComposeTaskDto);
}

export async function getAiSpaceComposeTask(
  userId: string,
  id: string,
): Promise<AiSpaceComposeTaskDto | null> {
  const row = await prisma.aiSpaceComposeTask.findFirst({ where: { id, userId } });
  return row ? toAiSpaceComposeTaskDto(row) : null;
}
