import { randomUUID } from "node:crypto";

import { uploadCanvasUserBuffer } from "@/lib/canvas/canvas-oss";
import { buildCanvasVideoKieInput } from "@/lib/canvas/canvas-video-kie";
import { buildCanvasVideoVolcengineInput } from "@/lib/canvas/canvas-video-volcengine";
import { buildEcomStoryboardKling30DashscopeVideoJob } from "@/lib/canvas/dashscope-kling-v3-video";
import { bailianResolutionFromEcom } from "@/lib/ecom/ecom-storyboard-gen-params";
import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import {
  ensureStoryboardBailianR2vRefImage,
  ensureStoryboardVideoRefImage,
} from "@/lib/ecom/ecom-storyboard-ref-image";
import {
  isStoryboardKling30VideoModel,
  resolveStoryboardKieVideoUpstreamModel,
  resolveStoryboardVideoModel,
  resolveStoryboardVideoProvider,
} from "@/lib/ecom/ecom-storyboard-video-models";
import { resolveStoryboardPanelVideoRefPlan, getStoryboardVideoInvokeRules } from "@/lib/ecom/ecom-storyboard-video-ref-rules";
import { resolveEcomVideoGenerateAudio } from "@/lib/ecom/ecom-storyboard-gen-params";
import { resolveSeedVideoChatImageUrls } from "@/lib/ecom/ecom-seed-video-mention";
import {
  ECOM_SEED_VIDEO_MODULE,
  type SeedVideoReference,
  type SeedVideoShot,
} from "@/lib/ecom/ecom-seed-video-types";
import {
  clearEcomSeedVideoPendingShot,
  getEcomSeedVideoProject,
  markEcomSeedVideoPendingShot,
  updateEcomSeedVideoPendingShotEntry,
  updateEcomSeedVideoProject,
} from "@/lib/ecom/ecom-seed-video-service";
import type { SeedVideoPanelPollProvider } from "@/lib/ecom/ecom-seed-video-panel-resume";
import { mergeSeedVideoShotsPreserveMedia } from "@/lib/ecom/ecom-seed-video-shot-merge";
import { ecomClientPage } from "@/lib/ecom/ecom-tool-keys";
import { ECOM_SEED_VIDEO_TOOL_KEY } from "@/lib/ecom/ecom-seed-video-types";
import {
  ecomGwCreateBailianR2vJob,
  ecomGwCreateDashscopeJob,
  ecomGwCreateKieJob,
  ecomGwCreateVolcengineVideoJob,
  ecomGwPollBailianR2v,
  ecomGwPollDashscope,
  ecomGwPollKie,
  ecomGwPollVolcengine,
} from "@/lib/gateway/ecom-tool-gateway-client";
import { ECOM_SEED_VIDEO_DEFAULT_VIDEO_MODEL } from "@/lib/ecom/ecom-seed-video-types";
import { prisma } from "@/lib/prisma";

type VideoResolution = "720p" | "1080p";

function resolveVideoResolution(raw?: string): VideoResolution {
  const v = raw?.trim().toLowerCase() ?? "";
  if (v.includes("720")) return "720p";
  return "1080p";
}

async function pollVolcengineToOss(opts: {
  userId: string;
  projectId: string;
  modelKey: string;
  prompt: string;
  imageUrl: string;
  referenceImageUrls: string[];
  durationSec: number;
  aspectRatio: "16:9" | "9:16";
  resolution: VideoResolution;
  generateAudio?: boolean;
  onSubmitted?: (task: { taskId: string; logId: string }) => void | Promise<void>;
}): Promise<{ ossUrl: string; taskId: string }> {
  const workspaceId = randomUUID().slice(0, 8);
  const clientPage = ecomClientPage(opts.userId, workspaceId, ECOM_SEED_VIDEO_TOOL_KEY);
  const generateAudio = resolveEcomVideoGenerateAudio(opts.modelKey, opts.generateAudio);
  const { body } = buildCanvasVideoVolcengineInput({
    modelKey: opts.modelKey,
    prompt: opts.prompt,
    imageUrl: opts.imageUrl,
    referenceImageUrls: opts.referenceImageUrls,
    options: { resolution: opts.resolution, duration: opts.durationSec, generateAudio },
    aspectRatio: opts.aspectRatio,
  });
  const { taskId, logId } = await ecomGwCreateVolcengineVideoJob(opts.userId, {
    model: opts.modelKey,
    body,
    clientPage,
  });
  await opts.onSubmitted?.({ taskId, logId });
  for (let i = 0; i < 120; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const polled = await ecomGwPollVolcengine(opts.userId, { taskId, gatewayLogId: logId });
    if (polled.status === "SUCCEEDED" && polled.outputUrl) {
      const res = await fetch(polled.outputUrl);
      if (!res.ok) throw new Error(`下载视频失败 HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      const ossUrl = await uploadCanvasUserBuffer({
        userId: opts.userId,
        ext: "mp4",
        buf,
        contentType: "video/mp4",
      });
      return { ossUrl, taskId };
    }
    if (polled.status === "FAILED") {
      throw new Error(polled.failMessage ?? "视频任务失败");
    }
  }
  throw new Error("视频生成超时");
}

async function pollBailianToOss(opts: {
  userId: string;
  projectId: string;
  modelKey: string;
  prompt: string;
  referenceImageUrls: string[];
  durationSec: number;
  ratio: string;
  resolution: VideoResolution;
  onSubmitted?: (task: { taskId: string; logId: string }) => void | Promise<void>;
}): Promise<{ ossUrl: string; taskId: string }> {
  const workspaceId = randomUUID().slice(0, 8);
  const clientPage = ecomClientPage(opts.userId, workspaceId, ECOM_SEED_VIDEO_TOOL_KEY);
  const { taskId, logId } = await ecomGwCreateBailianR2vJob(opts.userId, {
    model: opts.modelKey,
    prompt: opts.prompt,
    referenceImageUrls: opts.referenceImageUrls,
    resolution: bailianResolutionFromEcom(opts.resolution),
    ratio: opts.ratio,
    duration: opts.durationSec,
    clientPage,
  });
  await opts.onSubmitted?.({ taskId, logId });
  for (let i = 0; i < 120; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const polled = await ecomGwPollBailianR2v(opts.userId, { taskId, gatewayLogId: logId });
    if (polled.status === "SUCCEEDED" && polled.outputUrl) {
      const res = await fetch(polled.outputUrl);
      if (!res.ok) throw new Error(`下载视频失败 HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      const ossUrl = await uploadCanvasUserBuffer({
        userId: opts.userId,
        ext: "mp4",
        buf,
        contentType: "video/mp4",
      });
      return { ossUrl, taskId };
    }
    if (polled.status === "FAILED") {
      throw new Error(polled.failMessage ?? "视频任务失败");
    }
  }
  throw new Error("视频生成超时");
}

export async function ecomGenerateSeedVideoShot(opts: {
  userId: string;
  projectId: string;
  shotIndex: number;
  references: SeedVideoReference[];
  shots: SeedVideoShot[];
  aspectRatio?: "16:9" | "9:16";
  durationSec?: number;
  resolution?: string;
  modelKey?: string;
  ratio?: string;
  generateAudio?: boolean;
}) {
  await assertEcomToolkitGatewayAccess(opts.userId);
  const shot = opts.shots.find((s) => s.index === opts.shotIndex);
  if (!shot) throw new Error(`找不到镜头 ${opts.shotIndex}`);

  const modelKey = resolveStoryboardVideoModel(
    opts.modelKey ?? ECOM_SEED_VIDEO_DEFAULT_VIDEO_MODEL,
  );
  const provider = resolveStoryboardVideoProvider(modelKey);
  const resolution = resolveVideoResolution(opts.resolution);
  const generateAudio = resolveEcomVideoGenerateAudio(modelKey, opts.generateAudio);
  const durationCap = 15;
  const durationSec = Math.max(
    3,
    Math.min(
      durationCap,
      Math.round(opts.durationSec ?? shot.durationSec ?? 7),
    ),
  );
  const aspectRatio = opts.aspectRatio ?? "9:16";
  const ratio = opts.ratio?.trim() || aspectRatio;
  const prompt = shot.videoPrompt.trim();
  if (!prompt) throw new Error("视频提示词不能为空");

  const refRules = getStoryboardVideoInvokeRules(modelKey);
  const refUrls = resolveSeedVideoChatImageUrls(
    opts.references,
    prompt,
    refRules.maxTotalImages,
  );
  const imageUrl = refUrls[0]?.trim();
  if (!imageUrl || !/^https?:\/\//.test(imageUrl)) {
    throw new Error(
      `镜头 ${opts.shotIndex} 缺少参考图：请上传参考图，或在视频 Prompt 中用 @图片1 … 引用`,
    );
  }

  const materials = opts.references.filter(
    (r) => r.role === "seed-material" && r.ossUrl?.trim(),
  );
  const refUrlSet = new Set(refUrls.map((u) => u.trim()));
  const identityMaterials = materials.filter(
    (m) => refUrlSet.has(m.ossUrl.trim()) && m.ossUrl.trim() !== imageUrl,
  );

  const startedAt = new Date().toISOString();
  const existingVideoUrl = shot.videoUrl?.trim();
  await markEcomSeedVideoPendingShot(opts.userId, opts.projectId, shot.index, {
    modelKey,
    startedAt,
    ...(existingVideoUrl ? { supersedesVideoUrl: existingVideoUrl } : {}),
  });

  let gatewaySubmitted = false;
  async function persistGatewayTask(task: {
    taskId: string;
    logId: string;
    pollProvider: SeedVideoPanelPollProvider;
  }) {
    gatewaySubmitted = true;
    await updateEcomSeedVideoPendingShotEntry(opts.userId, opts.projectId, opts.shotIndex, {
      taskId: task.taskId,
      logId: task.logId,
      pollProvider: task.pollProvider,
    });
  }

  try {
  const panelRefPlan = resolveStoryboardPanelVideoRefPlan({
    modelKey,
    references: identityMaterials.map((r) => ({
      id: r.id,
      label: r.label,
      role: "product" as const,
      ossUrl: r.ossUrl,
    })),
    panelImageUrl: imageUrl,
  });

  const uniqueUrls = [...new Set(panelRefPlan.slots.map((s) => s.url))];
  const normalizedMap = new Map<string, string>();
  for (const raw of uniqueUrls) {
    const { url: sizedUrl } =
      provider === "bailian" || provider === "dashscope"
        ? await ensureStoryboardBailianR2vRefImage({
            userId: opts.userId,
            imageUrl: raw,
            modelKey,
          })
        : await ensureStoryboardVideoRefImage({
            userId: opts.userId,
            imageUrl: raw,
          });
    normalizedMap.set(raw, sizedUrl);
  }
  const norm = (u: string) => normalizedMap.get(u) ?? u;
  const firstFrame = norm(panelRefPlan.firstFrameUrl);
  const refUrls = panelRefPlan.referenceImageUrls.map(norm);
  const bailianUrls = panelRefPlan.bailianAllUrls.map(norm);

  let ossUrl: string;
  let taskId: string;

  if (provider === "kie") {
    const { model, input } = buildCanvasVideoKieInput({
      modelKey: resolveStoryboardKieVideoUpstreamModel(modelKey),
      prompt,
      imageUrl: firstFrame,
      referenceImageUrls: refUrls,
      options: { resolution, duration: durationSec, generateAudio },
      aspectRatio,
    });
    const created = await ecomGwCreateKieJob(opts.userId, {
      model,
      input,
      clientPage: ecomClientPage(opts.userId, opts.projectId, ECOM_SEED_VIDEO_TOOL_KEY),
    });
    taskId = created.taskId;
    await persistGatewayTask({
      taskId: created.taskId,
      logId: created.logId,
      pollProvider: "kie",
    });
    for (let i = 0; i < 120; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      const polled = await ecomGwPollKie(opts.userId, {
        taskId: created.taskId,
        gatewayLogId: created.logId,
      });
      if (polled.status === "SUCCEEDED" && polled.outputUrl) {
        const res = await fetch(polled.outputUrl);
        if (!res.ok) throw new Error(`下载视频失败 HTTP ${res.status}`);
        const buf = Buffer.from(await res.arrayBuffer());
        ossUrl = await uploadCanvasUserBuffer({
          userId: opts.userId,
          ext: "mp4",
          buf,
          contentType: "video/mp4",
        });
        break;
      }
      if (polled.status === "FAILED") throw new Error(polled.failMessage ?? "视频任务失败");
      if (i === 119) throw new Error("视频生成超时");
    }
    ossUrl = ossUrl!;
  } else if (provider === "bailian") {
    ({ ossUrl, taskId } = await pollBailianToOss({
      userId: opts.userId,
      projectId: opts.projectId,
      modelKey,
      prompt,
      referenceImageUrls: bailianUrls,
      durationSec,
      ratio,
      resolution,
      onSubmitted: (task) =>
        persistGatewayTask({ ...task, pollProvider: "bailian" }),
    }));
  } else if (provider === "dashscope" && isStoryboardKling30VideoModel(modelKey)) {
    const klingAspect: "16:9" | "9:16" | "1:1" =
      aspectRatio === "16:9" ? "16:9" : "9:16";
    const { model, videoBody } = buildEcomStoryboardKling30DashscopeVideoJob({
      prompt,
      firstFrameUrl: firstFrame,
      references: opts.references.map((r) => ({
        id: r.id,
        label: r.label,
        role: "product" as const,
        ossUrl: norm(r.ossUrl),
      })),
      aspectRatio: klingAspect,
      durationSec,
      sound: true,
    });
    const created = await ecomGwCreateDashscopeJob(opts.userId, {
      kind: "video",
      model,
      body: videoBody,
      clientPage: ecomClientPage(opts.userId, opts.projectId, ECOM_SEED_VIDEO_TOOL_KEY),
    });
    taskId = created.taskId;
    await persistGatewayTask({
      taskId: created.taskId,
      logId: created.logId,
      pollProvider: "dashscope",
    });
    for (let i = 0; i < 120; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      const polled = await ecomGwPollDashscope(opts.userId, {
        taskId: created.taskId,
        gatewayLogId: created.logId,
      });
      if (polled.status === "SUCCEEDED" && polled.outputUrl) {
        const res = await fetch(polled.outputUrl);
        if (!res.ok) throw new Error(`下载视频失败 HTTP ${res.status}`);
        const buf = Buffer.from(await res.arrayBuffer());
        ossUrl = await uploadCanvasUserBuffer({
          userId: opts.userId,
          ext: "mp4",
          buf,
          contentType: "video/mp4",
        });
        break;
      }
      if (polled.status === "FAILED") throw new Error(polled.failMessage ?? "视频任务失败");
      if (i === 119) throw new Error("视频生成超时");
    }
    ossUrl = ossUrl!;
  } else {
    ({ ossUrl, taskId } = await pollVolcengineToOss({
      userId: opts.userId,
      projectId: opts.projectId,
      modelKey,
      prompt,
      imageUrl: firstFrame,
      referenceImageUrls: refUrls,
      durationSec,
      aspectRatio,
      resolution,
      generateAudio,
      onSubmitted: (task) =>
        persistGatewayTask({ ...task, pollProvider: "volcengine" }),
    }));
  }

  const latestProject = await getEcomSeedVideoProject(opts.userId, opts.projectId, {
    resumePending: false,
  });
  const updatedShots = (latestProject?.plan?.shots?.length
    ? latestProject.plan.shots
    : opts.shots
  ).map((s) =>
    s.index === shot.index ? { ...s, videoUrl: ossUrl, videoTaskId: taskId } : s,
  );

  await updateEcomSeedVideoProject(opts.userId, opts.projectId, {
    plan: { shots: updatedShots },
    status: "production",
  });

  await prisma.ecomAsset.create({
    data: {
      userId: opts.userId,
      module: ECOM_SEED_VIDEO_MODULE,
      kind: "video",
      title: `种草视频 · 镜头${shot.index}`.slice(0, 80),
      prompt,
      ossUrl,
      meta: { projectId: opts.projectId, shotIndex: shot.index, modelKey, taskId },
    },
  });

  await clearEcomSeedVideoPendingShot(opts.userId, opts.projectId, shot.index);
  return { videoUrl: ossUrl, shotIndex: shot.index };
  } catch (e) {
    if (!gatewaySubmitted) {
      await clearEcomSeedVideoPendingShot(opts.userId, opts.projectId, shot.index);
    }
    throw e;
  }
}

export async function persistSeedVideoPlanShots(
  userId: string,
  projectId: string,
  shots: SeedVideoShot[],
): Promise<void> {
  const project = await getEcomSeedVideoProject(userId, projectId);
  if (!project) throw new Error("项目不存在");
  const merged = mergeSeedVideoShotsPreserveMedia(shots, project.plan?.shots ?? []);
  await updateEcomSeedVideoProject(userId, projectId, {
    plan: { ...(project.plan ?? {}), shots: merged },
  });
}
