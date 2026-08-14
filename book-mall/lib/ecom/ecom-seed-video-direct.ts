import { randomUUID } from "node:crypto";

import { uploadCanvasUserBuffer } from "@/lib/canvas/canvas-oss";
import {
  buildDashscopeSbv1T2vVideoBody,
  isDashscopeWan30VideoModel,
} from "@/lib/canvas/dashscope-sbv1-t2v";
import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import {
  ECOM_SEED_VIDEO_MODULE,
  type SeedVideoDirectPlan,
} from "@/lib/ecom/ecom-seed-video-types";
import {
  getEcomSeedVideoProject,
  updateEcomSeedVideoProject,
} from "@/lib/ecom/ecom-seed-video-service";
import { ecomClientPage } from "@/lib/ecom/ecom-tool-keys";
import { ECOM_SEED_VIDEO_TOOL_KEY } from "@/lib/ecom/ecom-seed-video-types";
import {
  ecomGwCreateDashscopeJob,
  ecomGwPollDashscope,
} from "@/lib/gateway/ecom-tool-gateway-client";
import { prisma } from "@/lib/prisma";

export async function ecomSubmitSeedVideoDirectJob(opts: {
  userId: string;
  projectId: string;
  directVideo: SeedVideoDirectPlan;
  modelKey: string;
  aspectRatio?: string;
  resolution?: string;
  durationSec?: number;
}) {
  await assertEcomToolkitGatewayAccess(opts.userId);
  const modelKey = opts.modelKey.trim();
  const prompt = opts.directVideo.globalPrompt.trim();
  if (!prompt) throw new Error("全局视频提示词不能为空");

  const aspectRatio = opts.aspectRatio?.trim() || opts.directVideo.aspectRatio || "9:16";
  const durationSec = Math.min(
    30,
    Math.max(3, Math.round(opts.durationSec ?? opts.directVideo.durationSec ?? 30)),
  );
  const resolution = opts.resolution?.trim() || "720P";

  const { parameters, input } = buildDashscopeSbv1T2vVideoBody({
    prompt,
    aspectRatio,
    resolution,
    durationSec,
    modelKey,
  });

  if (!isDashscopeWan30VideoModel(modelKey) && !modelKey.includes("wan")) {
    throw new Error(`方案①直接成片暂不支持模型「${modelKey}」，请选用 wan3.0-video`);
  }

  const workspaceId = randomUUID().slice(0, 8);
  const clientPage = ecomClientPage(opts.userId, workspaceId, ECOM_SEED_VIDEO_TOOL_KEY);
  const { taskId, logId } = await ecomGwCreateDashscopeJob(opts.userId, {
    kind: "video",
    model: isDashscopeWan30VideoModel(modelKey) ? "wan3.0-video" : modelKey,
    body: { input, parameters },
    clientPage,
  });

  const startedAt = new Date().toISOString();
  await updateEcomSeedVideoProject(opts.userId, opts.projectId, {
    meta: {
      pendingDirectVideo: { taskId, logId, modelKey, startedAt },
    },
    plan: {
      directVideo: {
        ...opts.directVideo,
        taskId,
        durationSec,
        aspectRatio,
      },
    },
    status: "production",
  });

  return { taskId, logId, startedAt };
}

export async function ecomPollSeedVideoDirectJob(opts: {
  userId: string;
  projectId: string;
}) {
  const project = await getEcomSeedVideoProject(opts.userId, opts.projectId);
  if (!project) throw new Error("项目不存在");

  const pending = project.meta?.pendingDirectVideo as
    | { taskId: string; logId: string; modelKey: string; startedAt: string }
    | undefined;
  if (!pending?.taskId) return { status: "idle" as const };

  const polled = await ecomGwPollDashscope(opts.userId, {
    taskId: pending.taskId,
    gatewayLogId: pending.logId,
  });

  if (polled.status === "FAILED") {
    await updateEcomSeedVideoProject(opts.userId, opts.projectId, {
      meta: { pendingDirectVideo: null },
    });
    throw new Error(polled.failMessage ?? "视频任务失败");
  }

  if (polled.status !== "SUCCEEDED" || !polled.outputUrl) {
    return {
      status: "running" as const,
      taskId: pending.taskId,
      startedAt: pending.startedAt,
    };
  }

  const res = await fetch(polled.outputUrl);
  if (!res.ok) throw new Error(`下载视频失败 HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const ossUrl = await uploadCanvasUserBuffer({
    userId: opts.userId,
    ext: "mp4",
    buf,
    contentType: "video/mp4",
  });

  const asset = await prisma.ecomAsset.create({
    data: {
      userId: opts.userId,
      module: ECOM_SEED_VIDEO_MODULE,
      kind: "video",
      title: (project.title ?? "种草视频").slice(0, 80),
      prompt: project.plan?.directVideo?.globalPrompt ?? "",
      ossUrl,
      meta: { projectId: opts.projectId, kind: "direct_video", taskId: pending.taskId },
    },
  });

  await updateEcomSeedVideoProject(opts.userId, opts.projectId, {
    videoAssetId: asset.id,
    status: "done",
    meta: { pendingDirectVideo: null, workflow: { phase: "done" } },
    plan: {
      directVideo: {
        globalPrompt: project.plan?.directVideo?.globalPrompt ?? "",
        fullVoiceover: project.plan?.directVideo?.fullVoiceover ?? "",
        aspectRatio: project.plan?.directVideo?.aspectRatio ?? "9:16",
        durationSec: project.plan?.directVideo?.durationSec ?? 30,
        bgmPreset: project.plan?.directVideo?.bgmPreset,
        taskId: pending.taskId,
        videoUrl: ossUrl,
      },
      render: { finalVideoUrl: ossUrl, assetId: asset.id },
    },
  });

  return {
    status: "succeeded" as const,
    videoUrl: ossUrl,
    assetId: asset.id,
    taskId: pending.taskId,
  };
}
