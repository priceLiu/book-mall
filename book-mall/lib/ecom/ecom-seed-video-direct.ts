import { randomUUID } from "node:crypto";

import { uploadCanvasUserBuffer } from "@/lib/canvas/canvas-oss";
import {
  buildDashscopeSbv1T2vVideoBody,
  isDashscopeWan30VideoModel,
} from "@/lib/canvas/dashscope-sbv1-t2v";
import { bailianR2vMaxDurationSec, bailianR2vMaxRefs } from "@/lib/canvas/bailian-r2v-body";
import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { bailianResolutionFromEcom } from "@/lib/ecom/ecom-storyboard-gen-params";
import { ensureStoryboardBailianR2vRefImage } from "@/lib/ecom/ecom-storyboard-ref-image";
import {
  isStoryboardBailianR2vVideoModel,
  resolveStoryboardVideoProvider,
} from "@/lib/ecom/ecom-storyboard-video-models";
import {
  ECOM_SEED_VIDEO_DIRECT_MAX_DURATION_SEC,
  ECOM_SEED_VIDEO_MODULE,
  ECOM_SEED_VIDEO_TOOL_KEY,
  type SeedVideoDirectGeneratedVideo,
  type SeedVideoDirectPlan,
} from "@/lib/ecom/ecom-seed-video-types";
import {
  getEcomSeedVideoProject,
  updateEcomSeedVideoProject,
} from "@/lib/ecom/ecom-seed-video-service";
import { ecomClientPage } from "@/lib/ecom/ecom-tool-keys";
import {
  ecomGwCreateBailianR2vJob,
  ecomGwCreateDashscopeJob,
  ecomGwPollBailianR2v,
  ecomGwPollDashscope,
} from "@/lib/gateway/ecom-tool-gateway-client";
import { prisma } from "@/lib/prisma";

export function resolveSeedVideoDirectDurationSec(opts: {
  modelKey: string;
  durationSec?: number;
  directVideo?: Pick<SeedVideoDirectPlan, "durationSec">;
}): number {
  const modelKey = opts.modelKey.trim();
  const raw = Math.round(
    opts.durationSec ?? opts.directVideo?.durationSec ?? ECOM_SEED_VIDEO_DIRECT_MAX_DURATION_SEC,
  );
  let cap = ECOM_SEED_VIDEO_DIRECT_MAX_DURATION_SEC;
  if (
    resolveStoryboardVideoProvider(modelKey) === "bailian" ||
    isStoryboardBailianR2vVideoModel(modelKey)
  ) {
    cap = bailianR2vMaxDurationSec(modelKey);
  } else if (!isDashscopeWan30VideoModel(modelKey)) {
    cap = 10;
  }
  return Math.min(cap, Math.max(3, raw));
}

export function buildSeedVideoDirectGenerationPrompt(plan: SeedVideoDirectPlan): string {
  const parts: string[] = [];
  const global = plan.globalPrompt.trim();
  if (global) parts.push(global);

  const durationSec = Math.max(
    3,
    Math.round(plan.durationSec || ECOM_SEED_VIDEO_DIRECT_MAX_DURATION_SEC),
  );
  parts.push(
    `目标成片时长：${durationSec} 秒（须严格按此时长完成镜头切换与口播节奏，勿超出）`,
  );

  const fullVo = plan.fullVoiceover?.trim();
  if (fullVo) {
    parts.push(`完整口播（按 ${durationSec}s 节奏朗读）：${fullVo}`);
  }

  if (plan.shotSequence?.length) {
    parts.push("镜头序列规划：");
    for (const s of plan.shotSequence) {
      const vo = s.voiceover.trim() ? `；口播：${s.voiceover.trim()}` : "";
      parts.push(
        `${s.index}. ${s.timeSlice} ${s.refImageLabel}：${s.sceneDescription.trim() || "（见参考图）"}${vo}`,
      );
    }
  }

  if (plan.materialUsage?.trim()) {
    parts.push(`素材运用：${plan.materialUsage.trim()}`);
  }
  if (plan.voiceTone?.trim()) {
    parts.push(`配音音色：${plan.voiceTone.trim()}`);
  }
  if (plan.bgmPreset?.trim()) {
    parts.push(`背景音乐：${plan.bgmPreset.trim()}`);
  }

  return parts.filter(Boolean).join("\n");
}

/** 从 plan.shots 合成单次成片参数（方案②脚本表 → 一条视频） */
export function buildSeedVideoDirectPlanFromShots(
  shots: import("@/lib/ecom/ecom-seed-video-types").SeedVideoShot[],
  opts?: {
    settings?: import("@/lib/ecom/ecom-seed-video-types").SeedVideoSettings;
    stylePack?: import("@/lib/ecom/ecom-seed-video-types").SeedVideoPlan["stylePack"];
    existing?: Partial<SeedVideoDirectPlan>;
  },
): SeedVideoDirectPlan | null {
  const sorted = [...shots].sort((a, b) => a.index - b.index);
  if (sorted.length < 1) return null;

  const shotSequence = sorted.map((s) => ({
    index: s.index,
    timeSlice: s.timeSlice,
    refImageLabel: s.refImageLabel,
    sceneDescription: s.sceneDescription,
    voiceover: s.voiceover,
    durationSec: s.durationSec,
  }));

  const promptLines = sorted.map((s) => {
    const body = s.videoPrompt?.trim() || s.sceneDescription?.trim();
    if (!body) return "";
    return `镜${s.index} ${s.timeSlice} 参考${s.refImageLabel}：${body}`;
  });

  const globalPrompt =
    opts?.existing?.globalPrompt?.trim() ||
    promptLines.filter(Boolean).join("\n");
  const fullVoiceover =
    opts?.existing?.fullVoiceover?.trim() ||
    sorted
      .map((s) => s.voiceover?.trim())
      .filter(Boolean)
      .join(" ");

  if (!globalPrompt && !fullVoiceover) return null;

  const summed = sorted.reduce((sum, s) => sum + (s.durationSec || 0), 0);
  const durationSec = resolveSeedVideoDirectDurationSec({
    modelKey: "wan2.7-r2v",
    durationSec:
      opts?.existing?.durationSec ??
      opts?.settings?.targetDurationSec ??
      (summed > 0 ? summed : ECOM_SEED_VIDEO_DIRECT_MAX_DURATION_SEC),
    directVideo: opts?.existing,
  });

  return {
    globalPrompt: globalPrompt || fullVoiceover,
    fullVoiceover,
    aspectRatio:
      opts?.existing?.aspectRatio ?? opts?.settings?.aspectRatio ?? "9:16",
    durationSec,
    shotSequence,
    voiceTone: opts?.existing?.voiceTone ?? opts?.stylePack?.voicePreset,
    bgmPreset: opts?.existing?.bgmPreset ?? opts?.stylePack?.bgmPreset,
    materialUsage: opts?.existing?.materialUsage,
    generatedVideos: opts?.existing?.generatedVideos,
    videoUrl: opts?.existing?.videoUrl,
    taskId: opts?.existing?.taskId,
  };
}

function appendDirectGeneratedVideo(
  prev: SeedVideoDirectPlan | undefined,
  entry: SeedVideoDirectGeneratedVideo,
): SeedVideoDirectGeneratedVideo[] {
  const out: SeedVideoDirectGeneratedVideo[] = [...(prev?.generatedVideos ?? [])];
  const legacyUrl = prev?.videoUrl?.trim();
  if (legacyUrl && !out.some((v) => v.videoUrl === legacyUrl)) {
    out.push({
      id: prev?.taskId?.trim() || randomUUID(),
      videoUrl: legacyUrl,
      taskId: prev?.taskId,
    });
  }
  if (!out.some((v) => v.videoUrl === entry.videoUrl)) {
    out.push(entry);
  }
  return out;
}

function resolveVideoResolution(raw?: string): "720p" | "1080p" {
  const v = raw?.trim().toLowerCase() ?? "";
  if (v.includes("720")) return "720p";
  return "1080p";
}

async function collectSeedMaterialRefUrls(opts: {
  userId: string;
  projectId: string;
  modelKey: string;
}): Promise<string[]> {
  const project = await getEcomSeedVideoProject(opts.userId, opts.projectId);
  if (!project) throw new Error("项目不存在");
  const rawUrls = project.references
    .filter((r) => r.role === "seed-material")
    .map((r) => r.ossUrl?.trim())
    .filter((u): u is string => Boolean(u && /^https?:\/\//.test(u)));
  if (rawUrls.length === 0) {
    throw new Error("请先上传种草素材后再生成视频");
  }
  const max = bailianR2vMaxRefs(opts.modelKey);
  const out: string[] = [];
  for (const url of rawUrls.slice(0, max)) {
    const { url: sized } = await ensureStoryboardBailianR2vRefImage({
      userId: opts.userId,
      imageUrl: url,
      modelKey: opts.modelKey,
    });
    out.push(sized);
  }
  return out;
}

export async function ecomSubmitSeedVideoDirectJob(opts: {
  userId: string;
  projectId: string;
  directVideo: SeedVideoDirectPlan;
  modelKey: string;
  aspectRatio?: string;
  resolution?: string;
  durationSec?: number;
  ratio?: string;
}) {
  await assertEcomToolkitGatewayAccess(opts.userId);
  const modelKey = opts.modelKey.trim();
  const prompt = buildSeedVideoDirectGenerationPrompt(opts.directVideo);
  if (!prompt) throw new Error("全局视频提示词不能为空");

  const aspectRatio = opts.aspectRatio?.trim() || opts.directVideo.aspectRatio || "9:16";
  const resolution = opts.resolution?.trim() || "720P";
  const ratio = opts.ratio?.trim() || aspectRatio;
  const provider = resolveStoryboardVideoProvider(modelKey);
  const workspaceId = randomUUID().slice(0, 8);
  const clientPage = ecomClientPage(opts.userId, workspaceId, ECOM_SEED_VIDEO_TOOL_KEY);
  const startedAt = new Date().toISOString();

  let taskId: string;
  let logId: string;
  let durationSec: number;
  let pollProvider: "bailian" | "dashscope";

  if (provider === "bailian" || isStoryboardBailianR2vVideoModel(modelKey)) {
    durationSec = resolveSeedVideoDirectDurationSec({
      modelKey,
      durationSec: opts.durationSec,
      directVideo: opts.directVideo,
    });
    const referenceImageUrls = await collectSeedMaterialRefUrls({
      userId: opts.userId,
      projectId: opts.projectId,
      modelKey,
    });
    const created = await ecomGwCreateBailianR2vJob(opts.userId, {
      model: modelKey,
      prompt,
      referenceImageUrls,
      resolution: bailianResolutionFromEcom(resolveVideoResolution(resolution)),
      ratio,
      duration: durationSec,
      clientPage,
    });
    taskId = created.taskId;
    logId = created.logId;
    pollProvider = "bailian";
  } else {
    durationSec = resolveSeedVideoDirectDurationSec({
      modelKey,
      durationSec: opts.durationSec ?? opts.directVideo.durationSec ?? ECOM_SEED_VIDEO_DIRECT_MAX_DURATION_SEC,
      directVideo: opts.directVideo,
    });
    const { parameters, input } = buildDashscopeSbv1T2vVideoBody({
      prompt,
      aspectRatio,
      resolution,
      durationSec,
      modelKey,
    });

    if (!isDashscopeWan30VideoModel(modelKey) && !modelKey.includes("wan")) {
      throw new Error(
        `方案①直接成片暂不支持模型「${modelKey}」，请选用 wan2.7-r2v 或 wan3.0-video`,
      );
    }

    const created = await ecomGwCreateDashscopeJob(opts.userId, {
      kind: "video",
      model: isDashscopeWan30VideoModel(modelKey) ? "wan3.0-video" : modelKey,
      body: { input, parameters },
      clientPage,
    });
    taskId = created.taskId;
    logId = created.logId;
    pollProvider = "dashscope";
  }

  await updateEcomSeedVideoProject(opts.userId, opts.projectId, {
    meta: {
      pendingDirectVideo: { taskId, logId, modelKey, startedAt, pollProvider },
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
    | {
        taskId: string;
        logId: string;
        modelKey: string;
        startedAt: string;
        pollProvider?: "bailian" | "dashscope";
      }
    | undefined;
  if (!pending?.taskId) return { status: "idle" as const };

  const useBailian =
    pending.pollProvider === "bailian" ||
    isStoryboardBailianR2vVideoModel(pending.modelKey);

  const polled = useBailian
    ? await ecomGwPollBailianR2v(opts.userId, {
        taskId: pending.taskId,
        gatewayLogId: pending.logId,
      })
    : await ecomGwPollDashscope(opts.userId, {
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

  const prevDirect = project.plan?.directVideo;
  const generatedVideos = appendDirectGeneratedVideo(prevDirect, {
    id: pending.taskId,
    videoUrl: ossUrl,
    taskId: pending.taskId,
    modelKey: pending.modelKey,
    createdAt: new Date().toISOString(),
  });

  await updateEcomSeedVideoProject(opts.userId, opts.projectId, {
    videoAssetId: asset.id,
    status: "done",
    meta: { pendingDirectVideo: null, workflow: { phase: "done" } },
    plan: {
      directVideo: {
        globalPrompt: prevDirect?.globalPrompt ?? "",
        fullVoiceover: prevDirect?.fullVoiceover ?? "",
        aspectRatio: prevDirect?.aspectRatio ?? "9:16",
        durationSec: prevDirect?.durationSec ?? 30,
        bgmPreset: prevDirect?.bgmPreset,
        voiceTone: prevDirect?.voiceTone,
        materialUsage: prevDirect?.materialUsage,
        shotSequence: prevDirect?.shotSequence,
        generatedVideos,
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
