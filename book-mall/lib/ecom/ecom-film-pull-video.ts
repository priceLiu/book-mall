import { randomUUID } from "node:crypto";

import { uploadCanvasUserBuffer } from "@/lib/canvas/canvas-oss";
import { ensureStoryboardBailianR2vRefImage } from "@/lib/ecom/ecom-storyboard-ref-image";
import { resolveStoryboardVideoProvider } from "@/lib/ecom/ecom-storyboard-video-models";
import {
  getEcomFilmPullProject,
  patchFilmPullProductionShot,
  updateEcomFilmPullProject,
  updateFilmPullRenderPlanShot,
} from "@/lib/ecom/ecom-film-pull-service";
import {
  ECOM_FILM_PULL_DEFAULT_VIDEO_MODEL,
  ECOM_FILM_PULL_TOOL_KEY,
  type FilmPullCharacterRef,
} from "@/lib/ecom/ecom-film-pull-types";
import { clampFilmPullDurationSec } from "@/lib/ecom/ecom-film-pull-enums";
import { resolveProductionShotRefUrls } from "@/lib/ecom/ecom-film-pull-ref-match";
import {
  productionShotDurationSec,
  resolveFilmPullActivePlan,
} from "@/lib/ecom/ecom-film-pull-production-image";
import { ecomClientPage } from "@/lib/ecom/ecom-tool-keys";
import {
  ecomGwCreateBailianR2vJob,
  ecomGwPollBailianR2v,
  ecomGwCreateVolcengineVideoJob,
  ecomGwPollVolcengine,
} from "@/lib/gateway/ecom-tool-gateway-client";
import { buildCanvasVideoVolcengineInput } from "@/lib/canvas/canvas-video-volcengine";
import { bailianResolutionFromEcom } from "@/lib/ecom/ecom-storyboard-gen-params";

async function pollBailianFilmPullToOss(opts: {
  userId: string;
  projectId: string;
  modelKey: string;
  prompt: string;
  referenceImageUrls: string[];
  durationSec: number;
  ratio: string;
}): Promise<{ ossUrl: string; taskId: string }> {
  const clientPage = ecomClientPage(opts.userId, opts.projectId, ECOM_FILM_PULL_TOOL_KEY);
  const resolution = bailianResolutionFromEcom("1080p");
  const { taskId, logId } = await ecomGwCreateBailianR2vJob(opts.userId, {
    model: opts.modelKey,
    prompt: opts.prompt,
    referenceImageUrls: opts.referenceImageUrls,
    duration: opts.durationSec,
    ratio: opts.ratio,
    resolution,
    clientPage,
  });
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
    if (polled.status === "FAILED") throw new Error(polled.failMessage ?? "视频任务失败");
  }
  throw new Error("视频生成超时");
}

async function normalizeRefUrls(
  userId: string,
  urls: string[],
  modelKey: string,
): Promise<string[]> {
  const out: string[] = [];
  for (const raw of urls) {
    const { url } = await ensureStoryboardBailianR2vRefImage({
      userId,
      imageUrl: raw,
      modelKey,
    });
    out.push(url);
  }
  return out;
}

export async function ecomGenerateFilmPullShot(opts: {
  userId: string;
  projectId: string;
  shotNo: number;
  modelKey?: string;
  aspectRatio?: "16:9" | "9:16";
}): Promise<{ shotNo: number; videoUrl: string; taskId?: string }> {
  const project = await getEcomFilmPullProject(opts.userId, opts.projectId);
  if (!project) throw new Error("项目不存在");

  const activePlan = resolveFilmPullActivePlan(project);
  const productionShot =
    activePlan?.kind === "production"
      ? activePlan.plan.shots.find((s) => s.shotNo === opts.shotNo)
      : undefined;

  const planShot = project.renderPlan?.shots.find((s) => s.shotNo === opts.shotNo);
  const scriptShot = project.renderScript?.structured?.shots.find(
    (s) => s.shotNo === opts.shotNo,
  );

  if (productionShot) {
    return ecomGenerateFilmPullProductionShot({
      userId: opts.userId,
      projectId: opts.projectId,
      shot: productionShot,
      project,
      modelKey: opts.modelKey,
      aspectRatio: opts.aspectRatio,
    });
  }

  if (!planShot || !scriptShot) throw new Error(`镜头 ${opts.shotNo} 不存在`);

  const prompt = planShot.videoPrompt.trim() || scriptShot.aiVisualPrompt.trim();
  if (!prompt) throw new Error(`镜头 ${opts.shotNo} 缺少 video prompt`);

  const characterRefs: FilmPullCharacterRef[] = project!.characterRefs;
  if (characterRefs.length === 0) throw new Error("请先上传角色参考图");

  const modelKey =
    opts.modelKey?.trim() ||
    project!.settings.videoModelKey?.trim() ||
    ECOM_FILM_PULL_DEFAULT_VIDEO_MODEL;
  const aspectRatio = opts.aspectRatio ?? project!.settings.aspectRatio ?? "9:16";
  const durationSec = clampFilmPullDurationSec(planShot.durationSec, 5);
  const provider = resolveStoryboardVideoProvider(modelKey);

  await updateEcomFilmPullProject(opts.userId, opts.projectId, { status: "generating_shots" });

  const refUrls = await normalizeRefUrls(
    opts.userId,
    characterRefs.map((r) => r.ossUrl),
    modelKey,
  );

  let ossUrl: string;
  let taskId: string | undefined;

  if (provider === "bailian" || provider === "dashscope") {
    ({ ossUrl, taskId } = await pollBailianFilmPullToOss({
      userId: opts.userId,
      projectId: opts.projectId,
      modelKey,
      prompt,
      referenceImageUrls: refUrls.slice(0, 5),
      durationSec,
      ratio: aspectRatio,
    }));
  } else if (provider === "volcengine") {
    const clientPage = ecomClientPage(opts.userId, opts.projectId, ECOM_FILM_PULL_TOOL_KEY);
    const first = refUrls[0]!;
    const { body } = buildCanvasVideoVolcengineInput({
      modelKey,
      prompt,
      imageUrl: first,
      referenceImageUrls: refUrls.slice(1, 5),
      options: { resolution: "1080p", duration: durationSec, generateAudio: true },
      aspectRatio,
    });
    const created = await ecomGwCreateVolcengineVideoJob(opts.userId, {
      model: modelKey,
      body,
      clientPage,
    });
    taskId = created.taskId;
    for (let i = 0; i < 120; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      const polled = await ecomGwPollVolcengine(opts.userId, {
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
    throw new Error(`模型「${modelKey}」暂不支持专业拉片出镜`);
  }

  await updateFilmPullRenderPlanShot(opts.userId, opts.projectId, opts.shotNo, {
    videoUrl: ossUrl,
    videoTaskId: taskId,
  });

  const refreshed = await getEcomFilmPullProject(opts.userId, opts.projectId);
  const allHaveVideo = refreshed?.renderPlan?.shots.every((s) => s.videoUrl?.trim());
  await updateEcomFilmPullProject(opts.userId, opts.projectId, {
    status: allHaveVideo ? "shots_ready" : "generating_shots",
  });

  return { shotNo: opts.shotNo, videoUrl: ossUrl, taskId };
}

async function ecomGenerateFilmPullProductionShot(opts: {
  userId: string;
  projectId: string;
  shot: import("@/lib/ecom/ecom-film-pull-types").FilmPullProductionShot;
  project: NonNullable<Awaited<ReturnType<typeof getEcomFilmPullProject>>>;
  modelKey?: string;
  aspectRatio?: "16:9" | "9:16";
}): Promise<{ shotNo: number; videoUrl: string; taskId?: string }> {
  const { shot, project } = opts;
  const prompt = shot.videoPrompt.trim();
  if (!prompt) throw new Error(`镜头 ${shot.shotNo} 缺少生视频 Prompt`);

  const perShotRefs = resolveProductionShotRefUrls(project.characterRefs, shot, project.refMatch);
  const characterRefs: FilmPullCharacterRef[] = project.characterRefs;
  if (perShotRefs.length === 0 && characterRefs.length === 0) {
    throw new Error("请先上传参考图");
  }

  const modelKey =
    opts.modelKey?.trim() ||
    project.settings.videoModelKey?.trim() ||
    ECOM_FILM_PULL_DEFAULT_VIDEO_MODEL;
  const aspectRatio = opts.aspectRatio ?? project.settings.aspectRatio ?? "9:16";
  const durationSec = productionShotDurationSec(shot);
  const provider = resolveStoryboardVideoProvider(modelKey);

  await updateEcomFilmPullProject(opts.userId, opts.projectId, { status: "generating_shots" });

  const imageUrl = shot.imageUrl?.trim();
  let refUrls: string[];
  if (imageUrl && /^https?:\/\//.test(imageUrl)) {
    refUrls = [imageUrl, ...perShotRefs.slice(0, 4)];
  } else {
    refUrls = perShotRefs.length > 0
      ? perShotRefs
      : characterRefs.map((r) => r.ossUrl);
  }
  refUrls = await normalizeRefUrls(opts.userId, refUrls, modelKey);

  let ossUrl: string;
  let taskId: string | undefined;

  if (provider === "bailian" || provider === "dashscope") {
    ({ ossUrl, taskId } = await pollBailianFilmPullToOss({
      userId: opts.userId,
      projectId: opts.projectId,
      modelKey,
      prompt,
      referenceImageUrls: refUrls.slice(0, 5),
      durationSec,
      ratio: aspectRatio,
    }));
  } else if (provider === "volcengine") {
    const clientPage = ecomClientPage(opts.userId, opts.projectId, ECOM_FILM_PULL_TOOL_KEY);
    const first = refUrls[0]!;
    const { body } = buildCanvasVideoVolcengineInput({
      modelKey,
      prompt,
      imageUrl: first,
      referenceImageUrls: refUrls.slice(1, 5),
      options: { resolution: "1080p", duration: durationSec, generateAudio: true },
      aspectRatio,
    });
    const created = await ecomGwCreateVolcengineVideoJob(opts.userId, {
      model: modelKey,
      body,
      clientPage,
    });
    taskId = created.taskId;
    for (let i = 0; i < 120; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      const polled = await ecomGwPollVolcengine(opts.userId, {
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
    throw new Error(`模型「${modelKey}」暂不支持专业拉片出镜`);
  }

  await patchFilmPullProductionShot(opts.userId, opts.projectId, shot.shotNo, {
    videoUrl: ossUrl,
    videoTaskId: taskId,
    status: "ready",
  });

  const refreshed = await getEcomFilmPullProject(opts.userId, opts.projectId);
  const allHaveVideo = refreshed?.productionPlan?.shots.every((s) => s.videoUrl?.trim());
  await updateEcomFilmPullProject(opts.userId, opts.projectId, {
    status: allHaveVideo ? "shots_ready" : "generating_shots",
  });

  return { shotNo: shot.shotNo, videoUrl: ossUrl, taskId };
}

export async function ecomGenerateFilmPullShotsBatch(opts: {
  userId: string;
  projectId: string;
  shotNos?: number[];
  modelKey?: string;
}): Promise<{ results: Array<{ shotNo: number; videoUrl?: string; error?: string }> }> {
  const project = await getEcomFilmPullProject(opts.userId, opts.projectId);
  const activePlan = resolveFilmPullActivePlan(project!);
  const plan =
    activePlan?.kind === "production"
      ? activePlan.plan.shots
      : (project?.renderPlan?.shots ?? []);
  const targets =
    opts.shotNos && opts.shotNos.length > 0
      ? opts.shotNos
      : plan.map((s) => s.shotNo);
  const results: Array<{ shotNo: number; videoUrl?: string; error?: string }> = [];
  for (const shotNo of targets) {
    try {
      const r = await ecomGenerateFilmPullShot({
        userId: opts.userId,
        projectId: opts.projectId,
        shotNo,
        modelKey: opts.modelKey,
      });
      results.push({ shotNo, videoUrl: r.videoUrl });
    } catch (e) {
      results.push({
        shotNo,
        error: e instanceof Error ? e.message : "生成失败",
      });
    }
  }
  return { results };
}

export async function ecomRenderFilmPullFinalVideo(opts: {
  userId: string;
  projectId: string;
}): Promise<{ jobId: string; finalVideoUrl?: string }> {
  const { MediaRenderSourceApp } = await import("@prisma/client");
  const { fromEcomFilmPullPlan, fromEcomFilmPullProductionPlan } = await import(
    "@/lib/ecom/adapters/ecom-film-pull-timeline"
  );
  const { createMediaRenderJob, enqueueMediaRenderJob, getMediaRenderJobForUser } =
    await import("@/lib/media/media-render-service");
  const { parseRenderProfile } = await import("@/lib/media/timeline-types");

  const project = await getEcomFilmPullProject(opts.userId, opts.projectId);
  const activePlan = project ? resolveFilmPullActivePlan(project) : null;
  const productionPlan = activePlan?.kind === "production" ? activePlan.plan : null;
  const legacyPlan = project?.renderPlan;

  const shots = productionPlan?.shots ?? legacyPlan?.shots ?? [];
  if (!shots.length) throw new Error("暂无渲染计划");
  const missing = shots.filter((s) => !s.videoUrl?.trim());
  if (missing.length > 0) {
    throw new Error(`请先为全部镜头生成视频（缺 ${missing.length} 镜）`);
  }

  await updateEcomFilmPullProject(opts.userId, opts.projectId, { status: "rendering" });

  const timeline = productionPlan
    ? fromEcomFilmPullProductionPlan(productionPlan)
    : fromEcomFilmPullPlan(legacyPlan!);
  if (timeline.clips.length < 1) throw new Error("没有可合成的视频片段");

  const profile = parseRenderProfile(null);
  const job = await createMediaRenderJob({
    userId: opts.userId,
    sourceApp: MediaRenderSourceApp.ecom,
    sourceRef: { kind: "film-pull", projectId: opts.projectId },
    timeline,
    profile,
  });
  await enqueueMediaRenderJob(job.id);

  for (let i = 0; i < 120; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const row = await getMediaRenderJobForUser(opts.userId, job.id);
    if (row?.status === "SUCCEEDED" && row.downloadUrl?.trim()) {
      const finalVideoUrl = row.downloadUrl.trim();
      const renderMeta = { jobId: job.id, finalVideoUrl };
      if (productionPlan) {
        await updateEcomFilmPullProject(opts.userId, opts.projectId, {
          status: "completed",
          productionPlan: { ...productionPlan, render: renderMeta },
          meta: {
            ...(project?.meta ?? {}),
            finalVideoUrl,
            mediaRenderJobId: job.id,
          },
        });
      } else {
        await updateEcomFilmPullProject(opts.userId, opts.projectId, {
          status: "completed",
          renderPlan: {
            ...legacyPlan!,
            render: renderMeta,
          },
          meta: {
            ...(project?.meta ?? {}),
            finalVideoUrl,
            mediaRenderJobId: job.id,
          },
        });
      }
      return { jobId: job.id, finalVideoUrl };
    }
    if (row?.status === "FAILED") {
      await updateEcomFilmPullProject(opts.userId, opts.projectId, { status: "failed" });
      throw new Error(row.errorMessage ?? "合成失败");
    }
  }
  throw new Error("合成超时");
}
