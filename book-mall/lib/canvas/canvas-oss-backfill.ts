/**
 * 画布媒体：厂商已成功时先 SUCCEEDED + ephemeral 上节点，OSS 后台补写。
 * 避免同步上传拖垮轮询反馈、或 OSS 抖动误杀任务。
 */
import type { Prisma } from "@prisma/client";

import { patchCanvasProjectNodeMediaFromTask } from "@/lib/canvas/canvas-media-patch";
import type { CanvasOssKind } from "@/lib/canvas/canvas-constants";
import {
  persistCanvasBufferToOss,
  persistCanvasKieResultToOss,
  persistCanvasVideoResultToOss,
} from "@/lib/canvas/canvas-oss";
import { patchCanvasProjectNodeRuntimeFromTask } from "@/lib/canvas/canvas-volcengine-recover";
import { mergeResultPayloadPoster } from "@/lib/canvas/video-poster-ffmpeg";
import { prisma } from "@/lib/prisma";

const taskSelect = {
  id: true,
  projectId: true,
  nodeId: true,
  ossUrl: true,
  ephemeralUrl: true,
  completedAt: true,
  resultPayload: true,
} as const;

/** 图 / 音频：从 ephemeral URL 拉流落 OSS。 */
export function scheduleCanvasKieImageOssBackfill(
  taskId: string,
  ephemeralUrl: string,
  projectId: string,
  kind: "node-image" | "node-audio" = "node-image",
): void {
  void (async () => {
    try {
      const ossUrl = await persistCanvasKieResultToOss({
        ephemeralUrl,
        kind,
        projectId,
      });
      if (!ossUrl?.trim()) return;
      await prisma.canvasGenerationTask.updateMany({
        where: { id: taskId, status: "SUCCEEDED" },
        data: { ossUrl },
      });
      const updated = await prisma.canvasGenerationTask.findUnique({
        where: { id: taskId },
        select: taskSelect,
      });
      if (updated?.ossUrl?.trim()) {
        await patchCanvasProjectNodeMediaFromTask(updated);
      }
    } catch {
      // OSS 中转失败仍可用 ephemeralUrl 预览
    }
  })();
}

/** 视频：从 ephemeral URL 落 OSS + 封面，再 patch 节点 runtime。 */
export function scheduleCanvasVideoOssBackfill(
  taskId: string,
  ephemeralUrl: string,
  projectId: string,
  resultBase?: unknown,
): void {
  void (async () => {
    try {
      const persisted = await persistCanvasVideoResultToOss({
        ephemeralUrl,
        projectId,
      });
      if (!persisted.videoUrl?.trim()) return;
      await prisma.canvasGenerationTask.updateMany({
        where: { id: taskId, status: "SUCCEEDED" },
        data: {
          ossUrl: persisted.videoUrl,
          resultPayload: mergeResultPayloadPoster(
            resultBase ?? null,
            persisted.posterUrl,
          ) as Prisma.InputJsonValue,
        },
      });
      const updated = await prisma.canvasGenerationTask.findUnique({
        where: { id: taskId },
        select: taskSelect,
      });
      if (updated?.ossUrl?.trim()) {
        await patchCanvasProjectNodeRuntimeFromTask(updated);
      }
    } catch {
      // 仍可用 ephemeralUrl 预览
    }
  })();
}

/** TTS / Seedream b64 等：内存 buffer 后台落 OSS。 */
export function scheduleCanvasBufferOssBackfill(args: {
  taskId: string;
  buf: Buffer;
  contentType: string;
  kind: CanvasOssKind;
  projectId: string;
  userId?: string;
  ext: string;
  /** 视频节点用 runtime patch；默认 media */
  patch?: "media" | "runtime";
}): void {
  const { taskId, buf, contentType, kind, projectId, userId, ext } = args;
  const patch = args.patch ?? "media";
  void (async () => {
    try {
      const ossUrl = await persistCanvasBufferToOss({
        buf,
        contentType,
        kind,
        projectId,
        userId,
        ext,
      });
      if (!ossUrl?.trim()) return;
      await prisma.canvasGenerationTask.updateMany({
        where: { id: taskId, status: "SUCCEEDED" },
        data: { ossUrl },
      });
      const updated = await prisma.canvasGenerationTask.findUnique({
        where: { id: taskId },
        select: taskSelect,
      });
      if (!updated?.ossUrl?.trim()) return;
      if (patch === "runtime") {
        await patchCanvasProjectNodeRuntimeFromTask(updated);
      } else {
        await patchCanvasProjectNodeMediaFromTask(updated);
      }
    } catch {
      // ephemeral / data URL 仍可预览
    }
  })();
}
