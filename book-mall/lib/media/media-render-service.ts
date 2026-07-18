import type { Prisma } from "@prisma/client";
import {
  MediaRenderJobStatus,
  MediaRenderSourceApp,
  MediaRenderStorageTier,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { deleteManagedOssObjectByUrl } from "@/lib/oss-delete-object";
import { copyMediaRenderToPinned } from "@/lib/media/media-render-oss";
import { assertFfmpegForMediaRender } from "@/lib/media/ffmpeg-preflight";
import { prismaJsonValue } from "@/lib/media/prisma-json";
import { runFfmpegMediaRender } from "@/lib/media/render-ffmpeg";
import {
  MEDIA_RENDER_JOB_TIMEOUT_SEC,
  MEDIA_RENDER_MAX_CONCURRENT_PER_USER,
  mediaRenderExpiresAt,
  validateTimelineLimits,
} from "@/lib/media/render-limits";
import {
  parseMediaTimelineV1,
  parseRenderProfile,
  type MediaTimelineV1,
  type RenderProfile,
} from "@/lib/media/timeline-types";
import {
  enqueueMediaRenderJobUpload,
  retryMediaRenderJobUpload,
} from "@/lib/media/media-render-upload";
import { hasMediaRenderLocalOutput } from "@/lib/media/media-render-local-output";

export type CreateMediaRenderJobInput = {
  userId: string;
  sourceApp: MediaRenderSourceApp;
  sourceRef?: Record<string, unknown>;
  timeline: MediaTimelineV1;
  profile?: RenderProfile;
};

export async function countActiveRenderJobs(userId: string): Promise<number> {
  return prisma.mediaRenderJob.count({
    where: {
      userId,
      status: { in: [MediaRenderJobStatus.PENDING, MediaRenderJobStatus.RUNNING] },
    },
  });
}

export async function createMediaRenderJob(
  input: CreateMediaRenderJobInput,
): Promise<{ id: string; expiresAt: Date }> {
  await assertFfmpegForMediaRender();
  const timeline = parseMediaTimelineV1(input.timeline);
  const profile = input.profile ?? parseRenderProfile(null);
  const limitErr = validateTimelineLimits(timeline);
  if (limitErr) {
    throw new Error(limitErr.message);
  }

  const active = await countActiveRenderJobs(input.userId);
  if (active >= MEDIA_RENDER_MAX_CONCURRENT_PER_USER) {
    throw new Error(
      `同时进行的剪辑任务不能超过 ${MEDIA_RENDER_MAX_CONCURRENT_PER_USER} 个，请稍后再试`,
    );
  }

  const expiresAt = mediaRenderExpiresAt();
  const job = await prisma.mediaRenderJob.create({
    data: {
      userId: input.userId,
      sourceApp: input.sourceApp,
      sourceRef:
        input.sourceRef != null ? prismaJsonValue(input.sourceRef) : undefined,
      timelineJson: prismaJsonValue(timeline),
      profileJson: prismaJsonValue(profile),
      expiresAt,
      progressLabel: "排队中",
    },
    select: { id: true, expiresAt: true },
  });
  return job;
}

export async function processMediaRenderJob(jobId: string): Promise<void> {
  const job = await prisma.mediaRenderJob.findUnique({ where: { id: jobId } });
  if (!job) return;
  if (
    job.status !== MediaRenderJobStatus.PENDING &&
    job.status !== MediaRenderJobStatus.RUNNING
  ) {
    return;
  }

  const startedAt = Date.now();
  await prisma.mediaRenderJob.update({
    where: { id: jobId },
    data: {
      status: MediaRenderJobStatus.RUNNING,
      progress: 1,
      progressLabel: "开始剪辑",
    },
  });

  const timeline = parseMediaTimelineV1(job.timelineJson);
  const profile = parseRenderProfile(job.profileJson);

  try {
    const result = await runFfmpegMediaRender({
      userId: job.userId,
      jobId: job.id,
      timeline,
      profile,
      onProgress: (pct, label) => {
        if (Date.now() - startedAt > MEDIA_RENDER_JOB_TIMEOUT_SEC * 1000) {
          throw new Error("剪辑任务超时");
        }
        void prisma.mediaRenderJob
          .update({
            where: { id: jobId },
            data: {
              progress: Math.min(89, pct),
              progressLabel: label,
            },
          })
          .catch(() => undefined);
      },
    });

    await prisma.mediaRenderJob.update({
      where: { id: jobId },
      data: {
        status: MediaRenderJobStatus.RUNNING,
        progress: 90,
        progressLabel: "剪辑完成，可下载",
        bytesOut: result.bytesOut,
        errorMessage: null,
      },
    });

    enqueueMediaRenderJobUpload({
      jobId: job.id,
      userId: job.userId,
      localPath: result.localPath,
      bytesOut: result.bytesOut,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "剪辑失败";
    await prisma.mediaRenderJob.update({
      where: { id: jobId },
      data: {
        status: MediaRenderJobStatus.FAILED,
        errorMessage: message.slice(0, 2000),
        completedAt: new Date(),
      },
    });
  }
}

export function enqueueMediaRenderJob(jobId: string): void {
  void processMediaRenderJob(jobId);
}

export async function waitForMediaRenderJob(
  jobId: string,
  timeoutMs = MEDIA_RENDER_JOB_TIMEOUT_SEC * 1000,
): Promise<MediaRenderJobDto> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const dto = await getMediaRenderJobForUser(jobId, null);
    if (!dto) throw new Error("剪辑任务不存在");
    if (
      dto.status === MediaRenderJobStatus.SUCCEEDED ||
      dto.status === MediaRenderJobStatus.FAILED ||
      dto.status === MediaRenderJobStatus.EXPIRED
    ) {
      return dto;
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error("剪辑任务超时，请稍后查询任务状态");
}

export type MediaRenderJobDto = {
  id: string;
  userId: string;
  sourceApp: MediaRenderSourceApp;
  status: MediaRenderJobStatus;
  progress: number;
  progressLabel: string | null;
  downloadUrl: string | null;
  /** 本地剪辑已完成、OSS 未就绪时的同源下载路径（相对 book-mall API） */
  localDownloadPath: string | null;
  uploadFailed: boolean;
  posterUrl: string | null;
  expiresAt: string;
  storageTier: MediaRenderStorageTier;
  pinnedAt: string | null;
  errorMessage: string | null;
  bytesOut: number | null;
  createdAt: string;
  completedAt: string | null;
};

export async function getMediaRenderJobForUser(
  jobId: string,
  userId: string | null,
): Promise<MediaRenderJobDto | null> {
  const job = await prisma.mediaRenderJob.findFirst({
    where: {
      id: jobId,
      ...(userId ? { userId } : {}),
    },
  });
  if (!job) return null;

  const expired =
    job.storageTier === MediaRenderStorageTier.ephemeral &&
    job.status === MediaRenderJobStatus.SUCCEEDED &&
    job.expiresAt < new Date();

  if (expired && job.resultOssUrl) {
    await expireMediaRenderJob(job.id, job.resultOssUrl).catch(() => undefined);
    return getMediaRenderJobForUser(jobId, userId);
  }

  const downloadUrl =
    job.status === MediaRenderJobStatus.SUCCEEDED && job.resultOssUrl
      ? job.resultOssUrl
      : null;
  const localReady =
    !downloadUrl && (await hasMediaRenderLocalOutput(job.id));
  const localDownloadPath = localReady
    ? `/api/canvas/media/render/${job.id}/download`
    : null;
  const uploadFailed = Boolean(
    localReady &&
      job.status === MediaRenderJobStatus.RUNNING &&
      job.progressLabel?.includes("上传失败"),
  );
  const posterUrl =
    job.status === MediaRenderJobStatus.SUCCEEDED && job.resultPosterOssUrl
      ? job.resultPosterOssUrl
      : null;

  return {
    id: job.id,
    userId: job.userId,
    sourceApp: job.sourceApp,
    status: job.status,
    progress: job.progress,
    progressLabel: job.progressLabel,
    downloadUrl,
    localDownloadPath,
    uploadFailed,
    posterUrl,
    expiresAt: job.expiresAt.toISOString(),
    storageTier: job.storageTier,
    pinnedAt: job.pinnedAt?.toISOString() ?? null,
    errorMessage: job.errorMessage,
    bytesOut: job.bytesOut,
    createdAt: job.createdAt.toISOString(),
    completedAt: job.completedAt?.toISOString() ?? null,
  };
}

export async function expireMediaRenderJob(
  jobId: string,
  ossUrl: string,
): Promise<void> {
  await deleteManagedOssObjectByUrl(ossUrl).catch(() => undefined);
  await prisma.mediaRenderJob.update({
    where: { id: jobId },
    data: {
      status: MediaRenderJobStatus.EXPIRED,
      resultOssUrl: null,
      progress: 0,
    },
  });
}

export async function expireDueMediaRenderJobs(limit = 50): Promise<number> {
  const now = new Date();
  const due = await prisma.mediaRenderJob.findMany({
    where: {
      storageTier: MediaRenderStorageTier.ephemeral,
      status: MediaRenderJobStatus.SUCCEEDED,
      expiresAt: { lt: now },
      resultOssUrl: { not: null },
    },
    take: limit,
    select: { id: true, resultOssUrl: true },
  });

  for (const row of due) {
    if (row.resultOssUrl) {
      await expireMediaRenderJob(row.id, row.resultOssUrl);
    }
  }
  return due.length;
}

export async function pinMediaRenderJob(args: {
  userId: string;
  jobId: string;
  createEcomAsset?: {
    module: string;
    title: string;
    meta?: Record<string, unknown>;
  };
}): Promise<MediaRenderJobDto> {
  const job = await prisma.mediaRenderJob.findFirst({
    where: { id: args.jobId, userId: args.userId },
  });
  if (!job) throw new Error("剪辑任务不存在");
  if (job.status !== MediaRenderJobStatus.SUCCEEDED || !job.resultOssUrl) {
    throw new Error("仅成功的成片可延期保留");
  }
  if (job.storageTier === MediaRenderStorageTier.pinned) {
    throw new Error("成片已延期保留");
  }
  if (job.expiresAt < new Date()) {
    throw new Error("成片已过期，无法延期");
  }

  const bytesNeeded = BigInt(job.bytesOut ?? 0);
  const grant = await prisma.userMediaStorageGrant.findFirst({
    where: {
      userId: args.userId,
      expiresAt: { gt: new Date() },
    },
    orderBy: { expiresAt: "desc" },
  });
  if (!grant) {
    throw new Error("请先购买容量包后再延期保留成片");
  }
  const remaining = grant.bytesQuota - grant.bytesUsed;
  if (remaining < bytesNeeded) {
    throw new Error("容量包余额不足，请升级容量包");
  }

  const pinnedUrl = await copyMediaRenderToPinned({
    sourceUrl: job.resultOssUrl,
    userId: args.userId,
    jobId: job.id,
  });

  const pinnedExpiresAt = grant.expiresAt;
  await prisma.$transaction([
    prisma.mediaRenderJob.update({
      where: { id: job.id },
      data: {
        storageTier: MediaRenderStorageTier.pinned,
        pinnedAt: new Date(),
        expiresAt: pinnedExpiresAt,
        resultOssUrl: pinnedUrl,
      },
    }),
    prisma.userMediaStorageGrant.update({
      where: { id: grant.id },
      data: { bytesUsed: grant.bytesUsed + bytesNeeded },
    }),
  ]);

  if (args.createEcomAsset) {
    await prisma.ecomAsset.create({
      data: {
        userId: args.userId,
        module: args.createEcomAsset.module,
        kind: "video",
        title: args.createEcomAsset.title.slice(0, 80),
        prompt: "media render pinned",
        ossUrl: pinnedUrl,
        meta: (args.createEcomAsset.meta ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  const dto = await getMediaRenderJobForUser(job.id, args.userId);
  if (!dto) throw new Error("剪辑任务不存在");
  return dto;
}

export { retryMediaRenderJobUpload };
