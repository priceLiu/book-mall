/**
 * 画布节点 · 任务成片写回 canvas JSON（runtime + 图片节点 data.ossUrl）。
 */
import type { CanvasGenerationTask, Prisma } from "@prisma/client";

import { extractPosterUrlFromResultPayload } from "@/lib/canvas/video-poster-ffmpeg";
import {
  patchCanvasJsonNodeRuntime,
  type CanvasNodeRuntimePatch,
} from "@/lib/canvas/canvas-volcengine-recover";
import { prisma } from "@/lib/prisma";

export const CANVAS_IMAGE_MEDIA_NODE_TYPES = new Set([
  "sbv1-image",
  "story-pro2-image",
  "story-pro-image",
  "image-engine",
  "ai-image-engine",
  "three-view-engine",
  "story-pro2-three-view",
]);

export const CANVAS_VIDEO_MEDIA_NODE_TYPES = new Set([
  "sbv1-video-engine",
  "video-engine",
  "ai-video-engine",
]);

export const CANVAS_MEDIA_NODE_TYPES = new Set([
  ...CANVAS_IMAGE_MEDIA_NODE_TYPES,
  ...CANVAS_VIDEO_MEDIA_NODE_TYPES,
]);

export function canvasNodeShowsPersistedMedia(
  canvas: unknown,
  nodeId: string,
  taskId?: string,
): boolean {
  if (!canvas || typeof canvas !== "object") return false;
  const nodes = (canvas as { nodes?: Array<{ id: string; data?: unknown }> })
    .nodes;
  const node = nodes?.find((n) => n.id === nodeId);
  if (!node) return false;
  const d = node.data as {
    ossUrl?: string;
    runtime?: {
      status?: string;
      taskId?: string;
      ossUrl?: string;
      ephemeralUrl?: string;
    };
  };
  const url =
    d?.runtime?.ossUrl?.trim() ||
    d?.runtime?.ephemeralUrl?.trim() ||
    d?.ossUrl?.trim();
  if (!url) return false;
  const st = d?.runtime?.status;
  if (st && st !== "done") return false;
  if (taskId && d?.runtime?.taskId && d.runtime.taskId !== taskId) return false;
  return true;
}

export function patchCanvasJsonNodeMedia(
  canvas: unknown,
  nodeId: string,
  nodeType: string | undefined,
  mediaUrl: string,
  runtime: CanvasNodeRuntimePatch,
): unknown {
  let next = patchCanvasJsonNodeRuntime(canvas, nodeId, runtime);
  if (!CANVAS_IMAGE_MEDIA_NODE_TYPES.has(nodeType ?? "")) return next;
  if (!next || typeof next !== "object") return next;
  const c = next as {
    nodes?: Array<{ id: string; data?: Record<string, unknown> }>;
  };
  if (!Array.isArray(c.nodes)) return next;
  return {
    ...c,
    nodes: c.nodes.map((n) =>
      n.id === nodeId
        ? {
            ...n,
            data: {
              ...(n.data ?? {}),
              ossUrl: mediaUrl,
              blobUrl: undefined,
              uploading: false,
              uploadError: undefined,
            },
          }
        : n,
    ),
  };
}

export function buildMediaRuntimePatchFromTask(
  task: Pick<
    CanvasGenerationTask,
    "id" | "ossUrl" | "ephemeralUrl" | "resultPayload"
  >,
  mediaUrl: string,
): CanvasNodeRuntimePatch {
  const posterUrl =
    extractPosterUrlFromResultPayload(task.resultPayload) ?? undefined;
  return {
    status: "done",
    taskId: task.id,
    ossUrl: task.ossUrl?.trim() || mediaUrl,
    ephemeralUrl: task.ephemeralUrl ?? undefined,
    ...(posterUrl ? { posterUrl } : {}),
  };
}

/** 将 SUCCEEDED 任务写回节点（图片 + 视频 runtime；图片另写 data.ossUrl）。 */
export async function patchCanvasProjectNodeMediaFromTask(
  task: Pick<
    CanvasGenerationTask,
    | "id"
    | "projectId"
    | "nodeId"
    | "ossUrl"
    | "ephemeralUrl"
    | "completedAt"
    | "resultPayload"
  >,
  opts?: { canvas?: unknown; nodeType?: string },
): Promise<boolean> {
  const mediaUrl = task.ossUrl?.trim() || task.ephemeralUrl?.trim();
  if (!mediaUrl) return false;

  let canvas = opts?.canvas;
  let thumbnailUrl: string | null | undefined;
  if (!canvas) {
    const project = await prisma.canvasProject.findUnique({
      where: { id: task.projectId },
      select: { canvas: true, thumbnailUrl: true },
    });
    if (!project?.canvas) return false;
    canvas = project.canvas;
    thumbnailUrl = project.thumbnailUrl;
  }

  const nodes = (canvas as {
    nodes?: Array<{ id: string; type?: string; data?: { runtime?: { taskId?: string; status?: string } } }>;
  }).nodes;
  const node = nodes?.find((n) => n.id === task.nodeId);
  if (!node) return false;

  const nodeType = opts?.nodeType ?? node.type;
  const existingTaskId = node.data?.runtime?.taskId?.trim();
  const existingStatus = node.data?.runtime?.status;
  if (
    existingTaskId &&
    existingTaskId !== task.id &&
    existingStatus === "done"
  ) {
    const existing = await prisma.canvasGenerationTask.findUnique({
      where: { id: existingTaskId },
      select: { completedAt: true, status: true },
    });
    if (
      existing?.status === "SUCCEEDED" &&
      existing.completedAt &&
      task.completedAt &&
      existing.completedAt.getTime() > task.completedAt.getTime()
    ) {
      return false;
    }
  }

  const runtime = buildMediaRuntimePatchFromTask(task, mediaUrl);
  const nextCanvas = patchCanvasJsonNodeMedia(
    canvas,
    task.nodeId,
    nodeType,
    mediaUrl,
    runtime,
  );
  const posterUrl =
    extractPosterUrlFromResultPayload(task.resultPayload) ?? undefined;
  const thumb = posterUrl || task.ossUrl?.trim();
  const data: Prisma.CanvasProjectUpdateInput = {
    canvas: nextCanvas as Prisma.InputJsonValue,
  };
  if (thumbnailUrl === undefined) {
    const row = await prisma.canvasProject.findUnique({
      where: { id: task.projectId },
      select: { thumbnailUrl: true },
    });
    thumbnailUrl = row?.thumbnailUrl;
  }
  if (!thumbnailUrl && thumb) {
    data.thumbnailUrl = thumb;
  }
  await prisma.canvasProject.update({
    where: { id: task.projectId },
    data,
  });
  return true;
}
