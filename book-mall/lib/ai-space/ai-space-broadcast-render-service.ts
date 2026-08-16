/**
 * 口播分镜 · 镜级渲染 + 总拼接
 */

import { MediaRenderJobStatus } from "@prisma/client";

import {
  createMediaRenderJob,
  enqueueMediaRenderJob,
} from "@/lib/media/media-render-service";
import { prisma } from "@/lib/prisma";

import { generateAiSpaceTtsAudio } from "./ai-space-tts-service";
import {
  AiSpaceBroadcastError,
  getAiSpaceBroadcastProject,
} from "./ai-space-broadcast-service";
import type { BroadcastProjectDto } from "./ai-space-broadcast-types";
import {
  createAiSpaceComposeTask,
  getAiSpaceComposeTask,
  pumpAiSpaceComposeQueue,
} from "./ai-space-compose-service";
import {
  createAiSpaceVideoMaterial,
  getAiSpaceVideoMaterial,
} from "./ai-space-video-material-service";

const SHOT_POLL_MS = 5000;
const SHOT_TIMEOUT_MS = 3 * 60 * 60 * 1000;
const RENDER_POLL_MS = 3000;
const RENDER_TIMEOUT_MS = 30 * 60 * 1000;

async function ensureShotAudio(args: {
  userId: string;
  shotId: string;
  voiceoverText: string;
}): Promise<string> {
  const shot = await prisma.aiSpaceBroadcastShot.findUnique({
    where: { id: args.shotId },
  });
  if (!shot) throw new AiSpaceBroadcastError("分镜不存在", 404);
  if (shot.audioAssetId) return shot.audioAssetId;

  const audio = await generateAiSpaceTtsAudio({
    userId: args.userId,
    modelKey: "cosyvoice-v3-flash",
    voice: "longxiaochun",
    text: args.voiceoverText,
    name: `镜${shot.index}口播`,
  });

  await prisma.aiSpaceBroadcastShot.update({
    where: { id: args.shotId },
    data: {
      audioAssetId: audio.id,
      durationSec: audio.durationSec,
      shotStatus: "tts_ready",
    },
  });

  return audio.id;
}

async function waitComposeTask(taskId: string, userId: string): Promise<string> {
  const deadline = Date.now() + SHOT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await pumpAiSpaceComposeQueue().catch(() => undefined);
    const task = await getAiSpaceComposeTask(userId, taskId);
    if (!task) throw new AiSpaceBroadcastError("合成任务丢失", 500);
    if (task.status === "completed" && task.finalVideoUrl) {
      return task.finalVideoUrl;
    }
    if (task.status === "failed") {
      throw new AiSpaceBroadcastError(task.errorMessage ?? "镜级合成失败", 502);
    }
    await new Promise((r) => setTimeout(r, SHOT_POLL_MS));
  }
  throw new AiSpaceBroadcastError("镜级合成超时", 504);
}

async function renderShot(args: {
  userId: string;
  tenantId: string | null;
  shotId: string;
}): Promise<string> {
  const shot = await prisma.aiSpaceBroadcastShot.findUnique({
    where: { id: args.shotId },
    include: { script: { include: { project: true } } },
  });
  if (!shot) throw new AiSpaceBroadcastError("分镜不存在", 404);

  await prisma.aiSpaceBroadcastShot.update({
    where: { id: args.shotId },
    data: { shotStatus: "rendering", errorMessage: null },
  });

  try {
    const presenter = shot.presenter as Record<string, unknown>;
    const enabled = presenter?.enabled === true;
    const digitalHumanId =
      shot.digitalHumanId ??
      (typeof presenter?.digitalHumanId === "string"
        ? presenter.digitalHumanId
        : null);

    const audioAssetId = await ensureShotAudio({
      userId: args.userId,
      shotId: args.shotId,
      voiceoverText: shot.voiceoverText,
    });

    if (enabled && digitalHumanId) {
      const overlayRaw =
        presenter?.overlay && typeof presenter.overlay === "object"
          ? (presenter.overlay as Record<string, unknown>)
          : {};
      const appearFromSec =
        typeof presenter?.appearFromSec === "number"
          ? presenter.appearFromSec
          : typeof overlayRaw.appearFromSec === "number"
            ? overlayRaw.appearFromSec
            : 0;
      const appearToSec =
        typeof presenter?.appearToSec === "number"
          ? presenter.appearToSec
          : presenter?.appearToSec === null
            ? null
            : undefined;

      const task = await createAiSpaceComposeTask({
        userId: args.userId,
        tenantId: args.tenantId,
        digitalHumanId,
        audioAssetId,
        videoMaterialId: shot.backgroundVideoId,
        options: {
          scale: overlayRaw.scale,
          position: overlayRaw.position,
          marginPx: overlayRaw.marginPx,
          burnSubtitle: overlayRaw.burnSubtitle,
          resolution: overlayRaw.resolution,
          appearFromSec,
          appearToSec,
        },
      });

      await prisma.aiSpaceBroadcastShot.update({
        where: { id: args.shotId },
        data: { composeTaskId: task.id },
      });

      const url = await waitComposeTask(task.id, args.userId);
      await prisma.aiSpaceBroadcastShot.update({
        where: { id: args.shotId },
        data: { shotStatus: "done", outputVideoUrl: url },
      });
      return url;
    }

    // 无数字人：若有背景视频直接引用；否则失败提示
    if (shot.backgroundVideoId) {
      const bg = await getAiSpaceVideoMaterial(args.userId, shot.backgroundVideoId);
      if (!bg) throw new AiSpaceBroadcastError("背景视频不存在", 404);
      await prisma.aiSpaceBroadcastShot.update({
        where: { id: args.shotId },
        data: { shotStatus: "done", outputVideoUrl: bg.videoUrl },
      });
      return bg.videoUrl;
    }

    throw new AiSpaceBroadcastError("该镜未启用数字人且无背景视频，无法渲染", 400);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await prisma.aiSpaceBroadcastShot.update({
      where: { id: args.shotId },
      data: { shotStatus: "failed", errorMessage: msg },
    });
    throw e;
  }
}

async function waitRenderJob(jobId: string): Promise<string> {
  const deadline = Date.now() + RENDER_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const job = await prisma.mediaRenderJob.findUnique({
      where: { id: jobId },
      select: { status: true, resultOssUrl: true, errorMessage: true },
    });
    if (!job) throw new AiSpaceBroadcastError("拼接任务不存在", 500);
    if (job.status === MediaRenderJobStatus.FAILED) {
      throw new AiSpaceBroadcastError(job.errorMessage ?? "总拼接失败", 502);
    }
    if (job.status === MediaRenderJobStatus.SUCCEEDED && job.resultOssUrl) {
      return job.resultOssUrl;
    }
    await new Promise((r) => setTimeout(r, RENDER_POLL_MS));
  }
  throw new AiSpaceBroadcastError("总拼接超时", 504);
}

export async function renderBroadcastProject(args: {
  userId: string;
  tenantId?: string | null;
  projectId: string;
}): Promise<BroadcastProjectDto> {
  const project = await getAiSpaceBroadcastProject(args.userId, args.projectId);
  if (!project) throw new AiSpaceBroadcastError("项目不存在", 404);
  if (project.status !== "locked") {
    throw new AiSpaceBroadcastError("请先锁定脚本再合成", 400);
  }
  if (!project.activeScriptId || !project.activeScript) {
    throw new AiSpaceBroadcastError("没有可渲染的分镜脚本", 400);
  }

  await prisma.aiSpaceBroadcastProject.update({
    where: { id: args.projectId },
    data: { status: "rendering" },
  });

  const renderJob = await prisma.aiSpaceBroadcastRenderJob.create({
    data: {
      projectId: args.projectId,
      scriptId: project.activeScriptId,
      status: "running",
    },
  });

  try {
    const clipUrls: string[] = [];
    for (const shot of project.activeScript.shots) {
      const url = await renderShot({
        userId: args.userId,
        tenantId: args.tenantId ?? null,
        shotId: shot.id,
      });
      clipUrls.push(url);
    }

    if (clipUrls.length === 0) {
      throw new AiSpaceBroadcastError("没有可拼接的镜级成片", 400);
    }

    const mediaJob = await createMediaRenderJob({
      userId: args.userId,
      sourceApp: "api",
      sourceRef: {
        aiSpaceBroadcastRenderJobId: renderJob.id,
        aiSpaceBroadcastProjectId: args.projectId,
      },
      timeline: {
        version: 1,
        clips: clipUrls.map((videoUrl, order) => ({ order, videoUrl })),
      },
      profile: {
        transition: { type: "none" },
        subtitle: { mode: "script", burnIn: false },
        video: { scaleMode: "fit720p" },
      },
    });

    enqueueMediaRenderJob(mediaJob.id);
    const finalUrl = await waitRenderJob(mediaJob.id);

    await createAiSpaceVideoMaterial({
      userId: args.userId,
      tenantId: args.tenantId ?? null,
      name: `${project.title} · 口播成片`,
      category: "compose",
      videoUrl: finalUrl,
      durationSec: project.activeScript.shots.reduce(
        (sum, s) => sum + s.durationSec,
        0,
      ),
      sourceKind: "compose_output",
      meta: { broadcastProjectId: args.projectId, renderJobId: renderJob.id },
    });

    await prisma.aiSpaceBroadcastRenderJob.update({
      where: { id: renderJob.id },
      data: { status: "completed", finalVideoUrl: finalUrl },
    });
    await prisma.aiSpaceBroadcastProject.update({
      where: { id: args.projectId },
      data: { status: "done" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await prisma.aiSpaceBroadcastRenderJob.update({
      where: { id: renderJob.id },
      data: { status: "failed", errorMessage: msg },
    });
    await prisma.aiSpaceBroadcastProject.update({
      where: { id: args.projectId },
      data: { status: "locked" },
    });
    throw e instanceof AiSpaceBroadcastError
      ? e
      : new AiSpaceBroadcastError(msg, 500);
  }

  const updated = await getAiSpaceBroadcastProject(args.userId, args.projectId);
  if (!updated) throw new AiSpaceBroadcastError("项目不存在", 404);
  return updated;
}

/** 单镜 TTS：生成配音并回写时长 */
export async function ttsBroadcastShot(args: {
  userId: string;
  shotId: string;
  modelKey?: string;
  voice?: string;
}): Promise<void> {
  const shot = await prisma.aiSpaceBroadcastShot.findUnique({
    where: { id: args.shotId },
    include: { script: { include: { project: true } } },
  });
  if (!shot || shot.script.project.userId !== args.userId) {
    throw new AiSpaceBroadcastError("分镜不存在", 404);
  }
  const audio = await generateAiSpaceTtsAudio({
    userId: args.userId,
    modelKey: args.modelKey ?? "cosyvoice-v3-flash",
    voice: args.voice ?? "longxiaochun",
    text: shot.voiceoverText,
    name: `镜${shot.index}口播`,
  });
  await prisma.aiSpaceBroadcastShot.update({
    where: { id: args.shotId },
    data: {
      audioAssetId: audio.id,
      durationSec: audio.durationSec,
      shotStatus: "tts_ready",
    },
  });
}
