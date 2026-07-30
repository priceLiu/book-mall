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
import { MEDIA_RENDER_UPLOAD_ATTEMPT_TIMEOUT_SEC } from "@/lib/media/render-limits";
import { extractVideoFirstFrameJpegFromPath } from "@/lib/canvas/video-poster-ffmpeg";
import { onMediaRenderJobSucceeded } from "@/lib/media/media-render-after-success";

const UPLOAD_MAX_ATTEMPTS = 3;
const UPLOAD_ATTEMPT_TIMEOUT_MS = MEDIA_RENDER_UPLOAD_ATTEMPT_TIMEOUT_SEC * 1000;
/** 进度心跳超过此时间且仍无 OSS 结果，才允许 dev 热重启后续传 */
const UPLOAD_HEARTBEAT_STALE_MS = UPLOAD_ATTEMPT_TIMEOUT_MS + 30_000;
const PROGRESS_DB_WRITE_MIN_INTERVAL_MS = 2_500;

/** jobId → 当前 upload 协程开始时间 */
const activeUploads = new Map<string, number>();
/** jobId → 最近一次 onUploadProgress 时间 */
const uploadHeartbeats = new Map<string, number>();
/** 同一 job 只允许一个 upload 协程（防止 GET 轮询 + 重试叠加 10+ 路 PUT） */
const uploadInflight = new Map<string, Promise<void>>();

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

async function withUploadAttemptTimeout<T>(
  promise: Promise<T>,
  label: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(
            new Error(
              `${label} 超时（${MEDIA_RENDER_UPLOAD_ATTEMPT_TIMEOUT_SEC}s），请重试云端同步`,
            ),
          );
        }, UPLOAD_ATTEMPT_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function clearMediaRenderUploadSlot(jobId: string): void {
  activeUploads.delete(jobId);
  uploadHeartbeats.delete(jobId);
}

export function isMediaRenderUploadActive(jobId: string): boolean {
  if (uploadInflight.has(jobId)) return true;

  const startedAt = activeUploads.get(jobId);
  if (!startedAt) return false;
  if (Date.now() - startedAt > UPLOAD_ATTEMPT_TIMEOUT_MS * UPLOAD_MAX_ATTEMPTS) {
    clearMediaRenderUploadSlot(jobId);
    return false;
  }
  return true;
}

/** 本地成片已就绪但 OSS 未上传时，在轮询 GET 上自动续传（含 dev 热重启后） */
export async function ensureMediaRenderUploadRunning(args: {
  jobId: string;
  userId: string;
  bytesOut: number | null;
}): Promise<void> {
  if (uploadInflight.has(args.jobId)) return;
  if (!(await hasMediaRenderLocalOutput(args.jobId))) return;

  if (isMediaRenderUploadActive(args.jobId)) {
    const lastBeat = uploadHeartbeats.get(args.jobId);
    if (lastBeat && Date.now() - lastBeat < UPLOAD_HEARTBEAT_STALE_MS) {
      return;
    }
    clearMediaRenderUploadSlot(args.jobId);
  }

  if (uploadInflight.has(args.jobId)) return;

  enqueueMediaRenderJobUpload({
    jobId: args.jobId,
    userId: args.userId,
    localPath: mediaRenderLocalOutputPath(args.jobId),
    bytesOut: args.bytesOut ?? 0,
  });
}

async function runMediaRenderJobUpload(args: {
  jobId: string;
  userId: string;
  localPath: string;
  bytesOut: number;
}): Promise<void> {
  activeUploads.set(args.jobId, Date.now());
  let lastProgressDbWrite = 0;

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

        const { url: ossUrl, bytesOut } = await withUploadAttemptTimeout(
          uploadMediaRenderOutputFromPath({
            userId: args.userId,
            jobId: args.jobId,
            filePath: args.localPath,
            onUploadProgress: (ratio) => {
              uploadHeartbeats.set(args.jobId, Date.now());
              const now = Date.now();
              if (
                ratio < 0.999 &&
                now - lastProgressDbWrite < PROGRESS_DB_WRITE_MIN_INTERVAL_MS
              ) {
                return;
              }
              lastProgressDbWrite = now;
              const uploadPct = Math.round(Math.min(1, ratio) * 100);
              void prisma.mediaRenderJob
                .update({
                  where: { id: args.jobId },
                  data: {
                    progress: Math.min(99, 92 + Math.round(ratio * 7)),
                    progressLabel:
                      ratio >= 0.999
                        ? "上传完成，正在收尾"
                        : `上传中 ${uploadPct}%`,
                  },
                })
                .catch(() => undefined);
            },
          }),
          "成片上传 OSS",
        );

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
    clearMediaRenderUploadSlot(args.jobId);
  }
}

export function uploadMediaRenderJobOutput(args: {
  jobId: string;
  userId: string;
  localPath: string;
  bytesOut: number;
}): Promise<void> {
  const existing = uploadInflight.get(args.jobId);
  if (existing) return existing;

  const task = runMediaRenderJobUpload(args).finally(() => {
    uploadInflight.delete(args.jobId);
  });
  uploadInflight.set(args.jobId, task);
  return task;
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
  if (uploadInflight.has(args.jobId)) {
    await uploadInflight.get(args.jobId);
    return;
  }
  clearMediaRenderUploadSlot(args.jobId);
  await uploadMediaRenderJobOutput({
    jobId: args.jobId,
    userId: args.userId,
    localPath: mediaRenderLocalOutputPath(args.jobId),
    bytesOut: job.bytesOut ?? 0,
  });
}
