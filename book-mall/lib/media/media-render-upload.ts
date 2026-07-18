import { MediaRenderJobStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  cleanupMediaRenderLocalOutput,
  hasMediaRenderLocalOutput,
  mediaRenderLocalOutputPath,
} from "@/lib/media/media-render-local-output";
import {
  uploadMediaRenderOutputFromPath,
  uploadMediaRenderPosterFromBuffer,
} from "@/lib/media/media-render-oss";
import { extractVideoFirstFrameJpegFromPath } from "@/lib/canvas/video-poster-ffmpeg";
import { onMediaRenderJobSucceeded } from "@/lib/media/media-render-after-success";

const UPLOAD_MAX_ATTEMPTS = 3;

const activeUploads = new Set<string>();

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

export async function uploadMediaRenderJobOutput(args: {
  jobId: string;
  userId: string;
  localPath: string;
  bytesOut: number;
}): Promise<void> {
  if (activeUploads.has(args.jobId)) return;
  activeUploads.add(args.jobId);
  try {
    let lastError = "上传失败";
    for (let attempt = 1; attempt <= UPLOAD_MAX_ATTEMPTS; attempt++) {
      try {
        await prisma.mediaRenderJob.update({
          where: { id: args.jobId },
          data: {
            progress: Math.max(91, 90 + attempt),
            progressLabel: `上传云端 (${attempt}/${UPLOAD_MAX_ATTEMPTS})`,
            errorMessage: null,
          },
        });

        let posterUrl: string | undefined;
        const posterBuf = await extractVideoFirstFrameJpegFromPath(args.localPath);
        if (posterBuf) {
          try {
            posterUrl = await uploadMediaRenderPosterFromBuffer({
              userId: args.userId,
              jobId: args.jobId,
              buf: posterBuf,
            });
          } catch {
            /* 封面失败不阻断成片 */
          }
        }

        const { url: ossUrl, bytesOut } = await uploadMediaRenderOutputFromPath({
          userId: args.userId,
          jobId: args.jobId,
          filePath: args.localPath,
          onUploadProgress: (ratio) => {
            const uploadPct = Math.round(Math.min(1, ratio) * 100);
            void prisma.mediaRenderJob
              .update({
                where: { id: args.jobId },
                data: {
                  progress: Math.min(99, 92 + Math.round(ratio * 7)),
                  progressLabel:
                    ratio >= 0.999 ? "上传完成，正在收尾" : `上传中 ${uploadPct}%`,
                },
              })
              .catch(() => undefined);
          },
        });

        const updated = await prisma.mediaRenderJob.update({
          where: { id: args.jobId },
          data: {
            status: MediaRenderJobStatus.SUCCEEDED,
            progress: 100,
            progressLabel: "剪辑完成",
            resultOssUrl: ossUrl,
            resultPosterOssUrl: posterUrl ?? null,
            bytesOut: bytesOut || args.bytesOut,
            errorMessage: null,
            completedAt: new Date(),
          },
        });

        await onMediaRenderJobSucceeded(updated).catch(() => undefined);
        await cleanupMediaRenderLocalOutput(args.jobId);
        return;
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e);
        if (attempt < UPLOAD_MAX_ATTEMPTS) {
          await sleep(4000 * attempt);
        }
      }
    }

    await prisma.mediaRenderJob.update({
      where: { id: args.jobId },
      data: {
        status: MediaRenderJobStatus.RUNNING,
        progress: 90,
        progressLabel: "云端上传失败，可重试",
        errorMessage: lastError.slice(0, 2000),
      },
    });
  } finally {
    activeUploads.delete(args.jobId);
  }
}

export function enqueueMediaRenderJobUpload(args: {
  jobId: string;
  userId: string;
  localPath: string;
  bytesOut: number;
}): void {
  void uploadMediaRenderJobOutput(args);
}

export async function retryMediaRenderJobUpload(args: {
  jobId: string;
  userId: string;
}): Promise<void> {
  const job = await prisma.mediaRenderJob.findFirst({
    where: { id: args.jobId, userId: args.userId },
    select: { id: true, status: true, resultOssUrl: true, bytesOut: true },
  });
  if (!job) throw new Error("剪辑任务不存在");
  if (job.resultOssUrl?.trim()) return;
  if (!(await hasMediaRenderLocalOutput(args.jobId))) {
    throw new Error("本地成片已清理，请重新剪辑");
  }
  enqueueMediaRenderJobUpload({
    jobId: args.jobId,
    userId: args.userId,
    localPath: mediaRenderLocalOutputPath(args.jobId),
    bytesOut: job.bytesOut ?? 0,
  });
}
