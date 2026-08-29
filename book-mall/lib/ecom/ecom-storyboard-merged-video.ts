import { MediaRenderJobStatus, MediaRenderSourceApp } from "@prisma/client";

import { prisma } from "@/lib/prisma";

function isHttpUrl(url: string | undefined | null): url is string {
  return Boolean(url?.trim() && /^https?:\/\//.test(url.trim()));
}

type StoryboardMetaLike = {
  deliverableSnapshot?: {
    videoUrl?: string;
    renderJobId?: string;
    renderExpiresAt?: string;
    videoMode?: string;
  };
  workflow?: {
    renderJobId?: string;
    videoMode?: string;
  };
} | null;

/** 从交付快照或 MediaRenderJob 恢复分镜合并成片 URL（videoAssetId 为空时） */
export async function resolveStoryboardMergedVideoUrl(
  userId: string,
  projectId: string,
  meta: StoryboardMetaLike,
): Promise<string | null> {
  const snapUrl = meta?.deliverableSnapshot?.videoUrl?.trim();
  if (isHttpUrl(snapUrl)) return snapUrl;

  const jobIds = [
    meta?.deliverableSnapshot?.renderJobId?.trim(),
    meta?.workflow?.renderJobId?.trim(),
  ].filter((id): id is string => Boolean(id));

  for (const jobId of [...new Set(jobIds)]) {
    const job = await prisma.mediaRenderJob.findFirst({
      where: {
        id: jobId,
        userId,
        status: MediaRenderJobStatus.SUCCEEDED,
      },
      select: { resultOssUrl: true },
    });
    if (isHttpUrl(job?.resultOssUrl)) return job.resultOssUrl.trim();
  }

  const recent = await prisma.mediaRenderJob.findMany({
    where: {
      userId,
      sourceApp: MediaRenderSourceApp.ecom,
      status: MediaRenderJobStatus.SUCCEEDED,
    },
    orderBy: { createdAt: "desc" },
    take: 12,
    select: { sourceRef: true, resultOssUrl: true },
  });
  for (const job of recent) {
    const ref = job.sourceRef as { projectId?: string } | null;
    if (ref?.projectId?.trim() !== projectId) continue;
    if (isHttpUrl(job.resultOssUrl)) return job.resultOssUrl.trim();
  }

  return null;
}
