import { randomUUID } from "crypto";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { uploadCanvasUserBuffer } from "@/lib/canvas/canvas-oss";
import { buildCanvasVideoKieInput } from "@/lib/canvas/canvas-video-kie";
import { buildCanvasVideoVolcengineInput } from "@/lib/canvas/canvas-video-volcengine";
import {
  buildDashscopeSbv1T2vVideoBody,
  buildDashscopeWan30Media,
} from "@/lib/canvas/dashscope-sbv1-t2v";
import {
  buildCanvasVideoMinimaxInput,
  minimaxResolutionFromEcom,
} from "@/lib/gateway/minimax-video-body";
import { resolveMinimaxVideoModel } from "@/lib/gateway/minimax-video-models";
import {
  ecomGwCreateBailianR2vJob,
  ecomGwCreateDashscopeJob,
  ecomGwCreateKieJob,
  ecomGwCreateMinimaxVideoJob,
  ecomGwCreateVolcengineVideoJob,
  ecomGwPollBailianR2v,
  ecomGwPollDashscope,
  ecomGwPollKie,
  ecomGwPollMinimax,
  ecomGwPollVolcengine,
} from "@/lib/gateway/ecom-tool-gateway-client";
import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { buildStoryboardImagePromptContext } from "@/lib/ecom/ecom-storyboard-image-prompt";
import type { PanelScenePromptContext } from "@/lib/ecom/ecom-storyboard-scene-prompt";
import { getEcomStoryboardProject } from "@/lib/ecom/ecom-storyboard-service";
import { mergeStoryboardPanelMediaByIndex } from "@/lib/ecom/ecom-storyboard-sheet-reconcile";
import {
  clearStoryboardPanelVideosPending,
  markStoryboardPanelVideosPending,
} from "@/lib/ecom/ecom-storyboard-pending-videos";
import { ecomClientPage } from "@/lib/ecom/ecom-tool-keys";
import { ECOM_STORYBOARD_DEFAULT_VIDEO_MODEL } from "@/lib/gateway/ecom-storyboard-chat-models";
import {
  ECOM_STORYBOARD_MODULE,
  ECOM_STORYBOARD_TOOL_KEY,
  type StoryboardReference,
  type StoryboardSheet,
  storyboardSheetSchema,
} from "@/lib/ecom/ecom-storyboard-types";
import {
  buildEcomStoryboardPanelVideoPrompt,
  buildEcomStoryboardVideoPrompt,
} from "@/lib/ecom/ecom-storyboard-video-prompt";
import {
  ensureStoryboardBailianR2vRefImage,
  ensureStoryboardRefImageForWan27,
  ensureStoryboardVideoRefImage,
  ensureStoryboardVideoRefImages,
} from "@/lib/ecom/ecom-storyboard-ref-image";
import { composeStoryboardPanelGridPng } from "@/lib/ecom/ecom-storyboard-panel-grid";
import { normalizeImageForVolcengineVideo } from "@/lib/ecom/ecom-storyboard-video-image";
import {
  bailianResolutionFromEcom,
  resolveEcomVideoGenerateAudio,
  resolveVideoResolution,
  videoSrFromResolution,
  type EcomStoryboardVideoResolution,
} from "@/lib/ecom/ecom-storyboard-gen-params";
import { persistStoryboardDeliverableSnapshot } from "@/lib/ecom/ecom-storyboard-snapshot";
import { ensureGatewayLogSucceededAfterVendorUrl } from "@/lib/gateway/gateway-log-reconcile";
import { updateEcomStoryboardProject } from "@/lib/ecom/ecom-storyboard-service";
import { requireStoryboardProductRef } from "@/lib/ecom/ecom-storyboard-refs";
import {
  resolveStoryboardPanelVideoRefPlan,
  resolveStoryboardVideoRefPlan,
} from "@/lib/ecom/ecom-storyboard-video-ref-rules";
import { buildEcomStoryboardKling30DashscopeVideoJob } from "@/lib/canvas/dashscope-kling-v3-video";
import {
  isStoryboardKling30VideoModel,
  isStoryboardWan30VideoModel,
  resolveStoryboardKieVideoUpstreamModel,
  resolveStoryboardVideoModel,
  resolveStoryboardVideoProvider,
} from "@/lib/ecom/ecom-storyboard-video-models";
import { isWan26BailianR2vModel } from "@/lib/canvas/bailian-r2v-body";

type PendingFullVideoJob = {
  taskId: string;
  logId: string;
  modelKey: string;
  provider: "volcengine" | "kie" | "bailian" | "minimax" | "dashscope";
  durationSec: number;
  startedAt: string;
  prompt: string;
  taskKey: string;
};

async function pollFullVideoGatewayJob(
  userId: string,
  pending: Pick<PendingFullVideoJob, "taskId" | "logId" | "provider">,
): Promise<{ status: string; outputUrl?: string; failMessage?: string }> {
  if (pending.provider === "kie") {
    return ecomGwPollKie(userId, {
      taskId: pending.taskId,
      gatewayLogId: pending.logId,
    });
  }
  if (pending.provider === "bailian") {
    return ecomGwPollBailianR2v(userId, {
      taskId: pending.taskId,
      gatewayLogId: pending.logId,
    });
  }
  if (pending.provider === "minimax") {
    return ecomGwPollMinimax(userId, {
      taskId: pending.taskId,
      gatewayLogId: pending.logId,
    });
  }
  if (pending.provider === "dashscope") {
    return ecomGwPollDashscope(userId, {
      taskId: pending.taskId,
      gatewayLogId: pending.logId,
    });
  }
  return ecomGwPollVolcengine(userId, {
    taskId: pending.taskId,
    gatewayLogId: pending.logId,
  });
}

function readPendingFullVideoJob(meta: unknown): PendingFullVideoJob | null {
  const workflow = (meta as Record<string, unknown> | null)?.workflow as
    | Record<string, unknown>
    | undefined;
  const raw = workflow?.pendingFullVideoJob;
  if (!raw || typeof raw !== "object") return null;
  const j = raw as Record<string, unknown>;
  if (typeof j.taskId !== "string" || typeof j.logId !== "string") return null;
  return {
    taskId: j.taskId,
    logId: j.logId,
    modelKey: typeof j.modelKey === "string" ? j.modelKey : ECOM_STORYBOARD_DEFAULT_VIDEO_MODEL,
    provider:
      j.provider === "kie" ||
      j.provider === "volcengine" ||
      j.provider === "bailian" ||
      j.provider === "minimax" ||
      j.provider === "dashscope"
        ? j.provider
        : resolveStoryboardVideoProvider(
            typeof j.modelKey === "string" ? j.modelKey : "",
          ),
    durationSec: typeof j.durationSec === "number" ? j.durationSec : 10,
    startedAt: typeof j.startedAt === "string" ? j.startedAt : new Date().toISOString(),
    prompt: typeof j.prompt === "string" ? j.prompt : "",
    taskKey: typeof j.taskKey === "string" ? j.taskKey : "",
  };
}

async function resolveVideoSceneCtx(
  userId: string,
  projectId: string,
): Promise<PanelScenePromptContext | undefined> {
  const project = await getEcomStoryboardProject(userId, projectId);
  if (!project) return undefined;
  const ctx = buildStoryboardImagePromptContext(project);
  return {
    scenePresetKey: ctx.scenePresetKey,
    scenePresetLabel: ctx.scenePresetLabel,
    scenePresetImageHint: ctx.scenePresetImageHint,
    globalSceneAnchor: ctx.globalSceneAnchor,
  };
}

async function savePendingFullVideoJob(
  projectId: string,
  job: PendingFullVideoJob | null,
): Promise<void> {
  const existing = await prisma.ecomStoryboardProject.findFirst({
    where: { id: projectId },
    select: { meta: true },
  });
  const prevMeta = (existing?.meta as Record<string, unknown> | null) ?? {};
  const prevWorkflow = (prevMeta.workflow as Record<string, unknown> | undefined) ?? {};
  const workflow = { ...prevWorkflow };
  if (job) {
    workflow.pendingFullVideoJob = job;
    workflow.phase = "video";
  } else {
    delete workflow.pendingFullVideoJob;
  }
  await prisma.ecomStoryboardProject.update({
    where: { id: projectId },
    data: {
      meta: { ...prevMeta, workflow } as Prisma.InputJsonValue,
      ...(job ? { status: "video_running" } : { status: "image_ready" }),
    },
  });
}

async function finalizeFullVideoFromVendorUrl(opts: {
  userId: string;
  projectId: string;
  sheet: StoryboardSheet;
  videoUrl: string;
  pending: PendingFullVideoJob;
}) {
  const res = await fetch(opts.videoUrl);
  if (!res.ok) throw new Error(`下载视频失败 HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const ossUrl = await uploadCanvasUserBuffer({
    userId: opts.userId,
    ext: "mp4",
    buf,
    contentType: "video/mp4",
  });

  let chargePoints: number | null = null;

  const asset = await prisma.ecomAsset.create({
    data: {
      userId: opts.userId,
      module: ECOM_STORYBOARD_MODULE,
      kind: "video",
      title: opts.sheet.overview.title.slice(0, 80),
      prompt: opts.pending.prompt,
      ossUrl,
      meta: {
        taskId: opts.pending.taskId,
        logId: opts.pending.logId,
        durationSec: opts.pending.durationSec,
        projectId: opts.projectId,
        modelKey: opts.pending.modelKey,
      },
    },
  });

  const existing = await prisma.ecomStoryboardProject.findFirst({
    where: { id: opts.projectId },
    select: { meta: true, settings: true },
  });
  const prevMeta = (existing?.meta as Record<string, unknown> | null) ?? {};
  const prevWorkflow = (prevMeta.workflow as Record<string, unknown> | undefined) ?? {};
  const { pendingFullVideoJob: _drop, ...workflowRest } = prevWorkflow;

  await prisma.ecomStoryboardProject.update({
    where: { id: opts.projectId },
    data: {
      status: "done",
      videoAssetId: asset.id,
      settings: {
        ...((existing?.settings as Record<string, unknown> | null) ?? {}),
        videoModelKey: opts.pending.modelKey,
      } as Prisma.InputJsonValue,
      meta: {
        ...prevMeta,
        workflow: {
          ...workflowRest,
          phase: "done",
          videoModelKey: opts.pending.modelKey,
          videoMode: "full_sheet",
        },
      } as Prisma.InputJsonValue,
    },
  });

  await persistStoryboardDeliverableSnapshot({
    userId: opts.userId,
    projectId: opts.projectId,
    videoUrl: ossUrl,
    videoAssetId: asset.id,
    videoMode: "full_sheet",
  }).catch(() => undefined);

  await ensureGatewayLogSucceededAfterVendorUrl({
    logId: opts.pending.logId,
    taskId: opts.pending.taskId,
    videoUrl: opts.videoUrl,
  }).catch((e) => {
    console.warn(
      "[ecom-storyboard-video] ensureGatewayLogSucceededAfterVendorUrl failed",
      opts.pending.logId,
      e instanceof Error ? e.message : String(e),
    );
  });

  return { asset, chargePoints };
}

/** 提交整图成片任务（立即返回，由前端轮询 status） */
export async function ecomSubmitStoryboardFullVideoJob(opts: {
  userId: string;
  projectId: string;
  sheet: StoryboardSheet;
  /** 已废弃：成片故事板由服务端从 panel.imageUrl 实时拼接宫格 */
  sheetPngUrl?: string;
  references: StoryboardReference[];
  durationSec?: number;
  aspectRatio?: "16:9" | "9:16" | "1:1";
  resolution?: string;
  modelKey?: string;
  brief?: { productHighlight?: string; style?: string };
  /** 百炼 R2V：画布比例（如 9:16、3:4） */
  ratio?: string;
  seedStr?: string;
  promptExtend?: boolean;
  generateAudio?: boolean;
}) {
  await assertEcomToolkitGatewayAccess(opts.userId);
  requireStoryboardProductRef(opts.references);
  const sheet = storyboardSheetSchema.parse(opts.sheet);
  const sortedPanels = sheet.panels.slice().sort((a, b) => a.index - b.index);
  const panelImages = sortedPanels.flatMap((p) => {
    const url = p.imageUrl?.trim();
    if (!url || !/^https?:\/\//.test(url)) return [];
    return [{ index: p.index, url }];
  });
  if (panelImages.length < sortedPanels.length) {
    throw new Error("请先生成全部分镜图");
  }

  const videoAspect: "16:9" | "9:16" =
    opts.aspectRatio === "16:9" ? "16:9" : "9:16";
  const panelGridUrl = await composeStoryboardPanelGridPng({
    userId: opts.userId,
    panelUrls: panelImages.map((p) => p.url),
    aspectRatio: videoAspect,
  });

  const existing = await prisma.ecomStoryboardProject.findFirst({
    where: { id: opts.projectId, userId: opts.userId },
    select: { meta: true },
  });
  const prevPending = readPendingFullVideoJob(existing?.meta);
  if (prevPending) {
    const polled = await pollFullVideoGatewayJob(opts.userId, prevPending);
    if (polled.status !== "SUCCEEDED" && polled.status !== "FAILED") {
      return {
        taskId: prevPending.taskId,
        logId: prevPending.logId,
        startedAt: prevPending.startedAt,
        reused: true as const,
      };
    }
    await savePendingFullVideoJob(opts.projectId, null);
  }

  const workspaceId = randomUUID().slice(0, 8);
  const modelKey = resolveStoryboardVideoModel(opts.modelKey);
  const provider = resolveStoryboardVideoProvider(modelKey);
  const refPlan = resolveStoryboardVideoRefPlan({
    modelKey,
    references: opts.references,
    sheetPngUrl: panelGridUrl,
    panelImages,
  });

  const durationMin =
    provider === "bailian" || provider === "dashscope"
      ? 3
      : provider === "minimax"
        ? 4
        : 4;
  const durationCap = refPlan.rules.apiMaxDurationSec ?? 15;
  if (opts.durationSec != null) {
    const requested = Math.round(opts.durationSec);
    if (requested > durationCap) {
      throw new Error(
        requested > 15
          ? `成片时长 ${requested}s 超过模型「${modelKey}」上限 ${durationCap}s，请改选万相 3.0（wan3.0-video）或缩短时长。`
          : `成片时长 ${requested}s 超过模型「${modelKey}」上限 ${durationCap}s，请缩短时长或更换模型。`,
      );
    }
  }
  const durationSec = Math.max(
    durationMin,
    Math.min(durationCap, Math.round(opts.durationSec ?? 10)),
  );
  const resolution = resolveVideoResolution(opts.resolution);
  const videoSr = videoSrFromResolution(resolution);
  const generateAudio = resolveEcomVideoGenerateAudio(modelKey, opts.generateAudio);
  const taskKey = `ecom-sb-vid:${opts.projectId}:${workspaceId}`;
  const clientPage = ecomClientPage(opts.userId, workspaceId, ECOM_STORYBOARD_TOOL_KEY);

  const uniqueUrls = [...new Set(refPlan.slots.map((s) => s.url))];
  const normalizedMap = new Map<string, string>();
  const slotByUrl = new Map(refPlan.slots.map((s) => [s.url, s]));
  for (const raw of uniqueUrls) {
    const role = slotByUrl.get(raw)?.role;
    const needsAspectNorm = role === "full_sheet";
    let aspectUrl = raw;
    if (needsAspectNorm) {
      ({ url: aspectUrl } = await normalizeImageForVolcengineVideo({
        userId: opts.userId,
        imageUrl: raw,
      }));
    }
    const { url: sizedUrl } =
      provider === "bailian" || provider === "dashscope"
        ? await ensureStoryboardBailianR2vRefImage({
            userId: opts.userId,
            imageUrl: aspectUrl,
            modelKey,
          })
        : await ensureStoryboardVideoRefImage({
            userId: opts.userId,
            imageUrl: aspectUrl,
          });
    normalizedMap.set(raw, sizedUrl);
  }
  const norm = (u: string) => normalizedMap.get(u) ?? u;

  const firstFrameUrl = norm(refPlan.firstFrameUrl);
  const normalizedReferenceImageUrls = refPlan.referenceImageUrls.map(norm);
  const normalizedAllUrls = refPlan.bailianAllUrls
    .map(norm)
    .slice(0, refPlan.rules.maxTotalImages);
  const videoImageUrl = firstFrameUrl;

  const sceneCtx = await resolveVideoSceneCtx(opts.userId, opts.projectId);
  const prompt = buildEcomStoryboardVideoPrompt(sheet, opts.brief, opts.references, {
    refSlots: refPlan.slots,
    refRules: refPlan.rules,
    sceneCtx,
  });
  const ratio =
    opts.ratio?.trim() || opts.aspectRatio?.trim() || "9:16";


  let taskId: string;
  let logId: string;

  if (provider === "kie") {
    const { model, input } = buildCanvasVideoKieInput({
      modelKey: resolveStoryboardKieVideoUpstreamModel(modelKey),
      prompt,
      imageUrl: videoImageUrl,
      referenceImageUrls: normalizedReferenceImageUrls,
      options: { resolution, duration: durationSec, generateAudio },
      aspectRatio: videoAspect,
    });
    const created = await ecomGwCreateKieJob(opts.userId, {
      model,
      input,
      clientPage,
    });
    taskId = created.taskId;
    logId = created.logId;
  } else if (provider === "bailian") {
    const parameterExtras: Record<string, unknown> = {};
    if (modelKey.startsWith("wan2.7")) {
      const gridStoryboard =
        refPlan.rules.strategy === "bailian_storyboard_grid";
      parameterExtras.prompt_extend = gridStoryboard
        ? opts.promptExtend === true
        : opts.promptExtend !== false;
    }
    if (isWan26BailianR2vModel(modelKey)) {
      delete parameterExtras.prompt_extend;
    }
    const created = await ecomGwCreateBailianR2vJob(opts.userId, {
      model: modelKey,
      prompt,
      referenceImageUrls: normalizedAllUrls,
      resolution: bailianResolutionFromEcom(resolution),
      ratio,
      duration: durationSec,
      seedStr: opts.seedStr,
      parameterExtras:
        Object.keys(parameterExtras).length > 0 ? parameterExtras : undefined,
      clientPage,
    });
    taskId = created.taskId;
    logId = created.logId;
  } else if (provider === "minimax") {
    const spec = resolveMinimaxVideoModel(modelKey);
    const minimaxRes = minimaxResolutionFromEcom(resolution);
    const mode = spec?.mode;
    const refUrlsForMinimax =
      mode === "r2v" || mode === "s2v" || mode === "i2v"
        ? refPlan.slots.map((s) => norm(s.url))
        : normalizedReferenceImageUrls;
    const { input } = buildCanvasVideoMinimaxInput({
      modelKey,
      prompt,
      imageUrl:
        mode === "t2v" || mode === "r2v" || mode === "s2v" || mode === "i2v"
          ? undefined
          : firstFrameUrl,
      referenceImageUrls: refUrlsForMinimax,
      options: {
        resolution: minimaxRes,
        duration: durationSec,
        ratio,
      },
    });
    const created = await ecomGwCreateMinimaxVideoJob(opts.userId, {
      model: modelKey,
      input,
      clientPage,
    });
    taskId = created.taskId;
    logId = created.logId;
  } else if (provider === "dashscope") {
    if (isStoryboardKling30VideoModel(modelKey)) {
      const aspect = opts.aspectRatio ?? "9:16";
      const klingAspect: "16:9" | "9:16" | "1:1" =
        aspect === "16:9" ? "16:9" : aspect === "1:1" ? "1:1" : "9:16";
      const klingFirst = (
        await ensureStoryboardRefImageForWan27({
          userId: opts.userId,
          imageUrl: firstFrameUrl,
        })
      ).url;
      const klingRefs = await Promise.all(
        opts.references.map(async (ref) => ({
          ...ref,
          ossUrl: (
            await ensureStoryboardRefImageForWan27({
              userId: opts.userId,
              imageUrl: ref.ossUrl,
            })
          ).url,
        })),
      );
      const { model, videoBody } = buildEcomStoryboardKling30DashscopeVideoJob({
        prompt,
        firstFrameUrl: klingFirst,
        references: klingRefs,
        aspectRatio: klingAspect,
        durationSec,
        sound: true,
      });
      const created = await ecomGwCreateDashscopeJob(opts.userId, {
        kind: "video",
        model,
        body: videoBody,
        clientPage,
      });
      taskId = created.taskId;
      logId = created.logId;
    } else {
      const media = buildDashscopeWan30Media({
        firstFrameUrl,
        referenceImageUrls: normalizedReferenceImageUrls,
      });
      const { input, parameters } = buildDashscopeSbv1T2vVideoBody({
        prompt,
        aspectRatio: videoAspect,
        resolution,
        durationSec,
        modelKey,
        media,
      });
      const created = await ecomGwCreateDashscopeJob(opts.userId, {
        kind: "video",
        model: modelKey,
        body: { input, parameters },
        clientPage,
      });
      taskId = created.taskId;
      logId = created.logId;
    }
  } else {
    const { body } = buildCanvasVideoVolcengineInput({
      modelKey,
      prompt,
      imageUrl: videoImageUrl,
      referenceImageUrls: normalizedReferenceImageUrls,
      options: { resolution, duration: durationSec, generateAudio },
      aspectRatio: videoAspect,
    });
    const created = await ecomGwCreateVolcengineVideoJob(opts.userId, {
      model: modelKey,
      body,
      clientPage,
    });
    taskId = created.taskId;
    logId = created.logId;
  }

  const startedAt = new Date().toISOString();
  const pending: PendingFullVideoJob = {
    taskId,
    logId,
    modelKey,
    provider,
    durationSec,
    startedAt,
    prompt,
    taskKey,
  };
  await savePendingFullVideoJob(opts.projectId, pending);

  return { taskId, logId, startedAt, reused: false as const };
}

/** 轮询一次整图成片任务；完成时落库并清除 pending */
export async function ecomPollStoryboardFullVideoJob(opts: {
  userId: string;
  projectId: string;
  sheet: StoryboardSheet;
}) {
  const existing = await prisma.ecomStoryboardProject.findFirst({
    where: { id: opts.projectId, userId: opts.userId },
    select: { meta: true },
  });
  const pending = readPendingFullVideoJob(existing?.meta);
  if (!pending) {
    return { status: "idle" as const };
  }

  const polled = await pollFullVideoGatewayJob(opts.userId, pending);

  if (polled.status === "FAILED") {
    await savePendingFullVideoJob(opts.projectId, null);
    throw new Error(polled.failMessage ?? "视频任务失败");
  }

  if (polled.status !== "SUCCEEDED" || !polled.outputUrl) {
    return {
      status: "running" as const,
      taskId: pending.taskId,
      startedAt: pending.startedAt,
      modelKey: pending.modelKey,
    };
  }

  const result = await finalizeFullVideoFromVendorUrl({
    userId: opts.userId,
    projectId: opts.projectId,
    sheet: opts.sheet,
    videoUrl: polled.outputUrl,
    pending,
  });

  return {
    status: "succeeded" as const,
    asset: {
      id: result.asset.id,
      ossUrl: result.asset.ossUrl,
    },
    videoOssUrl: result.asset.ossUrl,
    chargePoints: result.chargePoints,
    taskId: pending.taskId,
  };
}

/** @deprecated 同步阻塞版；新接口请用 submit + poll */
export async function ecomGenerateStoryboardVideo(opts: {
  userId: string;
  projectId: string;
  sheet: StoryboardSheet;
  sheetPngUrl: string;
  references: StoryboardReference[];
  durationSec?: number;
  aspectRatio?: "16:9" | "9:16";
  resolution?: string;
  modelKey?: string;
  brief?: { productHighlight?: string; style?: string };
}) {
  const submitted = await ecomSubmitStoryboardFullVideoJob(opts);
  for (let i = 0; i < 120; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const polled = await ecomPollStoryboardFullVideoJob({
      userId: opts.userId,
      projectId: opts.projectId,
      sheet: opts.sheet,
    });
    if (polled.status === "succeeded") {
      return {
        asset: polled.asset,
        taskId: polled.taskId,
        chargePoints: polled.chargePoints,
      };
    }
    if (polled.status === "idle") break;
  }
  throw new Error("视频生成超时");
}

async function runBailianR2vVideoJob(opts: {
  userId: string;
  projectId: string;
  modelKey: string;
  prompt: string;
  referenceImageUrls: string[];
  durationSec: number;
  aspectRatio: "16:9" | "9:16";
  resolution?: EcomStoryboardVideoResolution;
}): Promise<{ ossUrl: string; taskId: string; logId: string; chargePoints: number | null }> {
  const resolution = opts.resolution ?? "1080p";
  const clientPage = ecomClientPage(opts.userId, opts.projectId, ECOM_STORYBOARD_TOOL_KEY);
  const { taskId, logId } = await ecomGwCreateBailianR2vJob(opts.userId, {
    model: opts.modelKey,
    prompt: opts.prompt,
    referenceImageUrls: opts.referenceImageUrls,
    resolution: bailianResolutionFromEcom(resolution),
    ratio: opts.aspectRatio,
    duration: opts.durationSec,
    clientPage,
  });

  let videoUrl: string | null = null;
  for (let i = 0; i < 120; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const polled = await ecomGwPollBailianR2v(opts.userId, {
      taskId,
      gatewayLogId: logId,
    });
    if (polled.status === "SUCCEEDED" && polled.outputUrl) {
      videoUrl = polled.outputUrl;
      break;
    }
    if (polled.status === "FAILED") {
      throw new Error(polled.failMessage ?? "视频任务失败");
    }
  }
  if (!videoUrl) throw new Error("视频生成超时");

  const res = await fetch(videoUrl);
  if (!res.ok) throw new Error(`下载视频失败 HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const ossUrl = await uploadCanvasUserBuffer({
    userId: opts.userId,
    ext: "mp4",
    buf,
    contentType: "video/mp4",
  });

  return { ossUrl, taskId, logId, chargePoints: null };
}

async function runVolcengineVideoJob(opts: {
  userId: string;
  projectId: string;
  modelKey: string;
  prompt: string;
  imageUrl: string;
  referenceImageUrls: string[];
  durationSec: number;
  aspectRatio: "16:9" | "9:16";
  resolution?: EcomStoryboardVideoResolution;
  generateAudio?: boolean;
  meta: Record<string, unknown>;
}): Promise<{ ossUrl: string; taskId: string; logId: string; chargePoints: number | null }> {
  const resolution = opts.resolution ?? "1080p";
  const videoSr = videoSrFromResolution(resolution);
  const taskKey = `ecom-sb-vid:${opts.projectId}:${randomUUID().slice(0, 8)}`;
  const clientPage = ecomClientPage(opts.userId, opts.projectId, ECOM_STORYBOARD_TOOL_KEY);
  const generateAudio = resolveEcomVideoGenerateAudio(opts.modelKey, opts.generateAudio);

  const { body } = buildCanvasVideoVolcengineInput({
    modelKey: opts.modelKey,
    prompt: opts.prompt,
    imageUrl: opts.imageUrl,
    referenceImageUrls: opts.referenceImageUrls,
    options: { resolution, duration: opts.durationSec, generateAudio },
    aspectRatio: opts.aspectRatio,
  });


  const { taskId, logId } = await ecomGwCreateVolcengineVideoJob(opts.userId, {
    model: opts.modelKey,
    body,
    clientPage,
  });

  let videoUrl: string | null = null;
  for (let i = 0; i < 120; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const polled = await ecomGwPollVolcengine(opts.userId, {
      taskId,
      gatewayLogId: logId,
    });
    if (polled.status === "SUCCEEDED" && polled.outputUrl) {
      videoUrl = polled.outputUrl;
      break;
    }
    if (polled.status === "FAILED") {
      throw new Error(polled.failMessage ?? "视频任务失败");
    }
  }
  if (!videoUrl) throw new Error("视频生成超时");

  const res = await fetch(videoUrl);
  if (!res.ok) throw new Error(`下载视频失败 HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const ossUrl = await uploadCanvasUserBuffer({
    userId: opts.userId,
    ext: "mp4",
    buf,
    contentType: "video/mp4",
  });


  return { ossUrl, taskId, logId, chargePoints: null };
}

async function runDashscopeWan30VideoJob(opts: {
  userId: string;
  projectId: string;
  modelKey: string;
  prompt: string;
  firstFrameUrl: string;
  referenceImageUrls: string[];
  durationSec: number;
  aspectRatio: "16:9" | "9:16";
  resolution?: EcomStoryboardVideoResolution;
}): Promise<{ ossUrl: string; taskId: string; logId: string; chargePoints: number | null }> {
  const resolution = opts.resolution ?? "720p";
  const clientPage = ecomClientPage(opts.userId, opts.projectId, ECOM_STORYBOARD_TOOL_KEY);
  const media = buildDashscopeWan30Media({
    firstFrameUrl: opts.firstFrameUrl,
    referenceImageUrls: opts.referenceImageUrls,
  });
  const { input, parameters } = buildDashscopeSbv1T2vVideoBody({
    prompt: opts.prompt,
    aspectRatio: opts.aspectRatio,
    resolution,
    durationSec: opts.durationSec,
    modelKey: opts.modelKey,
    media,
  });
  const { taskId, logId } = await ecomGwCreateDashscopeJob(opts.userId, {
    kind: "video",
    model: opts.modelKey,
    body: { input, parameters },
    clientPage,
  });

  let videoUrl: string | null = null;
  for (let i = 0; i < 120; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const polled = await ecomGwPollDashscope(opts.userId, {
      taskId,
      gatewayLogId: logId,
    });
    if (polled.status === "SUCCEEDED" && polled.outputUrl) {
      videoUrl = polled.outputUrl;
      break;
    }
    if (polled.status === "FAILED") {
      throw new Error(polled.failMessage ?? "视频任务失败");
    }
  }
  if (!videoUrl) throw new Error("视频生成超时");

  const res = await fetch(videoUrl);
  if (!res.ok) throw new Error(`下载视频失败 HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const ossUrl = await uploadCanvasUserBuffer({
    userId: opts.userId,
    ext: "mp4",
    buf,
    contentType: "video/mp4",
  });
  return { ossUrl, taskId, logId, chargePoints: null };
}

export async function ecomGenerateStoryboardPanelVideo(opts: {
  userId: string;
  projectId: string;
  sheet: StoryboardSheet;
  panelIndex: number;
  references: StoryboardReference[];
  aspectRatio?: "16:9" | "9:16";
  durationSec?: number;
  resolution?: string;
  modelKey?: string;
  brief?: { productHighlight?: string; style?: string };
  generateAudio?: boolean;
}) {
  await assertEcomToolkitGatewayAccess(opts.userId);
  requireStoryboardProductRef(opts.references);
  const sheet = storyboardSheetSchema.parse(opts.sheet);
  const panel = sheet.panels.find((p) => p.index === opts.panelIndex);
  if (!panel) throw new Error(`找不到镜头 ${opts.panelIndex}`);
  const imageUrl = panel.imageUrl?.trim();
  if (!imageUrl || !/^https?:\/\//.test(imageUrl)) {
    throw new Error("请先生成该镜头分镜图");
  }

  const modelKey = resolveStoryboardVideoModel(
    opts.modelKey?.trim() || ECOM_STORYBOARD_DEFAULT_VIDEO_MODEL,
  );
  const provider = resolveStoryboardVideoProvider(modelKey);
  const resolution = resolveVideoResolution(opts.resolution);
  const generateAudio = resolveEcomVideoGenerateAudio(modelKey, opts.generateAudio);
  const panelDurationCap = isStoryboardWan30VideoModel(modelKey)
    ? 30
    : 8;
  const requestedPanelSec = Math.round(
    typeof opts.durationSec === "number"
      ? opts.durationSec
      : (panel.durationHintSec ?? 3),
  );
  if (opts.durationSec != null && requestedPanelSec > panelDurationCap) {
    throw new Error(
      requestedPanelSec > 15
        ? `单镜时长 ${requestedPanelSec}s 超过模型「${modelKey}」上限 ${panelDurationCap}s，请改选万相 3.0（wan3.0-video）。`
        : `单镜时长 ${requestedPanelSec}s 超过模型「${modelKey}」上限 ${panelDurationCap}s，请缩短时长或更换模型。`,
    );
  }
  const durationSec = Math.max(
    2,
    Math.min(panelDurationCap, requestedPanelSec),
  );

  await markStoryboardPanelVideosPending(opts.projectId, [panel.index], modelKey);

  try {
  const panelRefPlan = resolveStoryboardPanelVideoRefPlan({
    modelKey,
    references: opts.references,
    panelImageUrl: imageUrl,
  });
  const uniqueUrls = [...new Set(panelRefPlan.slots.map((s) => s.url))];
  const normalizedMap = new Map<string, string>();
  for (const raw of uniqueUrls) {
    const { url: sizedUrl } = await ensureStoryboardVideoRefImage({
      userId: opts.userId,
      imageUrl: raw,
    });
    normalizedMap.set(raw, sizedUrl);
  }
  const norm = (u: string) => normalizedMap.get(u) ?? u;
  const sceneCtx = await resolveVideoSceneCtx(opts.userId, opts.projectId);
  const prompt = buildEcomStoryboardPanelVideoPrompt(panel, sheet, opts.brief, {
    refSlots: panelRefPlan.slots,
    refRules: panelRefPlan.rules,
    references: opts.references,
    sceneCtx,
  });
  const refUrls = panelRefPlan.referenceImageUrls.map(norm);
  const panelFirstFrame = norm(panelRefPlan.firstFrameUrl);
  const bailianUrls = panelRefPlan.bailianAllUrls.map(norm);

  let ossUrl: string;
  let taskId: string;
  let logId: string;
  let chargePoints: number | null = null;

  if (provider === "bailian") {
    ({ ossUrl, taskId, logId, chargePoints } = await runBailianR2vVideoJob({
      userId: opts.userId,
      projectId: opts.projectId,
      modelKey,
      prompt,
      referenceImageUrls: bailianUrls,
      durationSec,
      aspectRatio: opts.aspectRatio ?? "9:16",
      resolution,
    }));
  } else if (provider === "dashscope" && isStoryboardWan30VideoModel(modelKey)) {
    ({ ossUrl, taskId, logId, chargePoints } = await runDashscopeWan30VideoJob({
      userId: opts.userId,
      projectId: opts.projectId,
      modelKey,
      prompt,
      firstFrameUrl: panelFirstFrame,
      referenceImageUrls: refUrls,
      durationSec,
      aspectRatio: opts.aspectRatio ?? "9:16",
      resolution,
    }));
  } else if (provider === "volcengine") {
    ({ ossUrl, taskId, logId, chargePoints } = await runVolcengineVideoJob({
      userId: opts.userId,
      projectId: opts.projectId,
      modelKey,
      prompt,
      imageUrl: panelFirstFrame,
      referenceImageUrls: refUrls,
      durationSec,
      aspectRatio: opts.aspectRatio ?? "9:16",
      resolution,
      generateAudio,
      meta: {
        projectId: opts.projectId,
        panelIndex: panel.index,
        kind: "panel_video",
        resolution,
        durationSec,
      },
    }));
  } else {
    throw new Error(
      `单镜头成片暂不支持模型「${modelKey}」；请选用百炼 R2V（如 happyhorse-1.1-r2v）、Wan 3.0 或 Seedance。`,
    );
  }

  const patchPanels = sheet.panels.map((p) =>
    p.index === panel.index
      ? {
          ...p,
          videoUrl: ossUrl,
          videoGen: {
            modelKey,
            durationSec,
            resolution,
            aspectRatio: opts.aspectRatio ?? "9:16",
            generatedAt: new Date().toISOString(),
          },
        }
      : p,
  );
  const latest = await getEcomStoryboardProject(opts.userId, opts.projectId);
  const baseSheet = latest?.sheet ?? sheet;
  const mergedPanels = mergeStoryboardPanelMediaByIndex(
    baseSheet.panels,
    patchPanels,
  );
  await updateEcomStoryboardProject(opts.userId, opts.projectId, {
    sheet: { ...baseSheet, panels: mergedPanels },
    status: "image_ready",
  });

  await ensureGatewayLogSucceededAfterVendorUrl({
    logId,
    taskId,
    videoUrl: ossUrl,
  }).catch((e) => {
    console.warn(
      "[ecom-storyboard-video] panel ensureGatewayLogSucceededAfterVendorUrl failed",
      logId,
      e instanceof Error ? e.message : String(e),
    );
  });

  await prisma.ecomAsset.create({
    data: {
      userId: opts.userId,
      module: ECOM_STORYBOARD_MODULE,
      kind: "video",
      title: `${sheet.overview.title} · 镜头${panel.index}`.slice(0, 80),
      prompt,
      ossUrl,
      meta: {
        projectId: opts.projectId,
        panelIndex: panel.index,
        modelKey,
        kind: "panel_video",
        taskId,
        logId,
        durationSec,
        resolution,
        aspectRatio: opts.aspectRatio ?? "9:16",
        generatedAt: new Date().toISOString(),
      },
    },
  });

  await persistStoryboardDeliverableSnapshot({
    userId: opts.userId,
    projectId: opts.projectId,
  }).catch(() => undefined);

  await clearStoryboardPanelVideosPending(opts.projectId, [panel.index]);

  return { videoUrl: ossUrl, panelIndex: panel.index, chargePoints: null };
  } catch (e) {
    await clearStoryboardPanelVideosPending(opts.projectId, [panel.index]);
    throw e;
  }
}

export async function ecomMergeStoryboardPanelVideos(opts: {
  userId: string;
  projectId: string;
  sheet: StoryboardSheet;
  title?: string;
}) {
  await assertEcomToolkitGatewayAccess(opts.userId);
  const sheet = storyboardSheetSchema.parse(opts.sheet);
  const { MediaRenderSourceApp } = await import("@prisma/client");
  const { fromEcomStoryboardSheet } = await import("@/lib/media/timeline-adapters");
  const {
    createMediaRenderJob,
    processMediaRenderJob,
    waitForMediaRenderJob,
  } = await import("@/lib/media/media-render-service");
  const { DEFAULT_RENDER_PROFILE } = await import("@/lib/media/timeline-types");

  const timeline = fromEcomStoryboardSheet(sheet);
  if (timeline.clips.length < 2) {
    throw new Error("请至少为 2 个镜头生成分镜视频后再合并");
  }

  const job = await createMediaRenderJob({
    userId: opts.userId,
    sourceApp: MediaRenderSourceApp.ecom,
    sourceRef: { projectId: opts.projectId, title: opts.title ?? sheet.overview.title },
    timeline,
    profile: DEFAULT_RENDER_PROFILE,
  });

  await processMediaRenderJob(job.id);
  const dto = await waitForMediaRenderJob(job.id);
  if (dto.status !== "SUCCEEDED" || !dto.downloadUrl) {
    throw new Error(dto.errorMessage ?? "视频合并失败");
  }

  return {
    jobId: dto.id,
    ossUrl: dto.downloadUrl,
    expiresAt: dto.expiresAt,
    asset: null as { id: string } | null,
  };
}
