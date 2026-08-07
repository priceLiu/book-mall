import {
  MediaRenderJobStatus,
  MediaRenderSourceApp,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  MEDIA_RENDER_JOB_TIMEOUT_SEC,
  MEDIA_RENDER_STALE_PENDING_SEC,
  MEDIA_RENDER_UPLOAD_STALE_SEC,
} from "@/lib/media/render-limits";

type ActiveJobRow = {
  status: MediaRenderJobStatus;
  progress: number;
  progressLabel: string | null;
};

/** FFmpeg 合成阶段占用并发；上传阶段（≥90%）不占名额 */
export function isMediaRenderConcurrencySlot(job: ActiveJobRow): boolean {
  if (job.status === MediaRenderJobStatus.PENDING) return true;
  if (job.status === MediaRenderJobStatus.RUNNING && job.progress < 90) return true;
  return false;
}

function projectIdFromSourceRef(sourceRef: unknown): string | null {
  if (!sourceRef || typeof sourceRef !== "object") return null;
  const projectId = (sourceRef as { projectId?: unknown }).projectId;
  return typeof projectId === "string" && projectId.trim() ? projectId.trim() : null;
}

export async function findActiveMediaRenderJobForProject(args: {
  userId: string;
  projectId: string;
}): Promise<{ id: string; expiresAt: Date } | null> {
  const jobs = await prisma.mediaRenderJob.findMany({
    where: {
      userId: args.userId,
      sourceApp: MediaRenderSourceApp.canvas,
      status: {
        in: [MediaRenderJobStatus.PENDING, MediaRenderJobStatus.RUNNING],
      },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      expiresAt: true,
      sourceRef: true,
      status: true,
      progress: true,
      progressLabel: true,
    },
  });

  for (const job of jobs) {
    if (projectIdFromSourceRef(job.sourceRef) !== args.projectId) continue;
    if (isMediaRenderConcurrencySlot(job)) {
      return { id: job.id, expiresAt: job.expiresAt };
    }
  }
  return null;
}

/**
 * 同一画布项目再次提交时，取消仍在进行中的旧任务，避免重复点击占满并发。
 * 仅在客户端显式 replaceInFlight 时调用；默认改走 findActiveMediaRenderJobForProject 复用。
 */
export async function supersedeInFlightMediaRenderJobsForProject(args: {
  userId: string;
  projectId: string;
}): Promise<number> {
  const jobs = await prisma.mediaRenderJob.findMany({
    where: {
      userId: args.userId,
      sourceApp: MediaRenderSourceApp.canvas,
      status: {
        in: [MediaRenderJobStatus.PENDING, MediaRenderJobStatus.RUNNING],
      },
    },
    select: { id: true, sourceRef: true },
  });

  const ids = jobs
    .filter((job) => projectIdFromSourceRef(job.sourceRef) === args.projectId)
    .map((job) => job.id);
  if (ids.length === 0) return 0;

  const result = await prisma.mediaRenderJob.updateMany({
    where: { id: { in: ids } },
    data: {
      status: MediaRenderJobStatus.FAILED,
      errorMessage: "已被同一项目的新剪辑任务取代",
      completedAt: new Date(),
    },
  });
  return result.count;
}

/**
 * 回收异常挂起的任务（连接中断、进程重启、上传卡住等），避免误占并发上限。
 */
export async function reclaimStaleMediaRenderJobsForUser(
  userId: string,
): Promise<number> {
  const now = new Date();
  const pendingCutoff = new Date(
    now.getTime() - MEDIA_RENDER_STALE_PENDING_SEC * 1000,
  );
  const ffmpegCutoff = new Date(
    now.getTime() - MEDIA_RENDER_JOB_TIMEOUT_SEC * 1000,
  );
  const uploadCutoff = new Date(
    now.getTime() - MEDIA_RENDER_UPLOAD_STALE_SEC * 1000,
  );

  const result = await prisma.mediaRenderJob.updateMany({
    where: {
      userId,
      OR: [
        {
          status: MediaRenderJobStatus.PENDING,
          createdAt: { lt: pendingCutoff },
        },
        {
          status: MediaRenderJobStatus.RUNNING,
          progress: { lt: 90 },
          createdAt: { lt: ffmpegCutoff },
        },
        {
          status: MediaRenderJobStatus.RUNNING,
          progress: { gte: 90 },
          createdAt: { lt: uploadCutoff },
        },
      ],
    },
    data: {
      status: MediaRenderJobStatus.FAILED,
      errorMessage: "任务超时或异常中断，已自动释放名额",
      completedAt: now,
    },
  });

  return result.count;
}

export async function countActiveRenderJobs(
  userId: string,
  opts?: { reclaim?: boolean },
): Promise<number> {
  // 提交路径勿默认 reclaim（updateMany 在连接池紧张时会拖死「提交任务」）
  if (opts?.reclaim !== false) {
    await reclaimStaleMediaRenderJobsForUser(userId);
  }

  const rows = await prisma.mediaRenderJob.findMany({
    where: {
      userId,
      status: {
        in: [MediaRenderJobStatus.PENDING, MediaRenderJobStatus.RUNNING],
      },
    },
    select: { status: true, progress: true, progressLabel: true },
  });

  return rows.filter(isMediaRenderConcurrencySlot).length;
}
