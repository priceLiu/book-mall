import { randomUUID } from "crypto";
import { execFile } from "child_process";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { promisify } from "util";
import type { Prisma } from "@prisma/client";

const execFileAsync = promisify(execFile);

import { prisma } from "@/lib/prisma";
import { uploadCanvasUserBuffer } from "@/lib/canvas/canvas-oss";
import { buildCanvasVideoKieInput } from "@/lib/canvas/canvas-video-kie";
import { buildCanvasVideoVolcengineInput } from "@/lib/canvas/canvas-video-volcengine";
import {
  ecomGwCreateBailianR2vJob,
  ecomGwCreateKieJob,
  ecomGwCreateVolcengineVideoJob,
  ecomGwPollBailianR2v,
  ecomGwPollKie,
  ecomGwPollVolcengine,
} from "@/lib/gateway/ecom-tool-gateway-client";
import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { shouldMeterEcomToolkitUsage } from "@/lib/ecom/ecom-billing-mode";
import { reserveWalletHold } from "@/lib/wallet-holds";
import { recordToolUsageAndConsumeWallet } from "@/lib/wallet-record-tool-usage-consume";
import { resolveBillableSnapshot } from "@/lib/tool-billable-price";
import type { ToolUsagePricingSnapshot } from "@/lib/finance/tool-usage-billing-line";
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
  ensureStoryboardRefImageForWan27,
  ensureStoryboardVideoRefImage,
  ensureStoryboardVideoRefImages,
} from "@/lib/ecom/ecom-storyboard-ref-image";
import { normalizeImageForVolcengineVideo } from "@/lib/ecom/ecom-storyboard-video-image";
import {
  bailianResolutionFromEcom,
  resolveVideoResolution,
  videoSrFromResolution,
  type EcomStoryboardVideoResolution,
} from "@/lib/ecom/ecom-storyboard-gen-params";
import { persistStoryboardDeliverableSnapshot } from "@/lib/ecom/ecom-storyboard-snapshot";
import { updateEcomStoryboardProject } from "@/lib/ecom/ecom-storyboard-service";
import {
  requireStoryboardProductRef,
  resolveStoryboardFullVideoRefs,
  resolveStoryboardModelRefUrls,
} from "@/lib/ecom/ecom-storyboard-refs";
import { buildEcomStoryboardKling30VideoInput } from "@/lib/ecom/ecom-storyboard-video-kie";
import {
  isStoryboardBailianR2vVideoModel,
  isStoryboardKling30KieVideoModel,
  resolveStoryboardKieVideoUpstreamModel,
  resolveStoryboardVideoModel,
  resolveStoryboardVideoProvider,
} from "@/lib/ecom/ecom-storyboard-video-models";
import { isWan26BailianR2vModel } from "@/lib/canvas/bailian-r2v-body";

function snapToPricing(
  snap: NonNullable<Awaited<ReturnType<typeof resolveBillableSnapshot>>>,
): ToolUsagePricingSnapshot {
  return {
    unitCostYuan: snap.unitCostYuan,
    retailMultiplier: snap.retailMultiplier,
    ourUnitYuan: snap.ourUnitYuan,
    schemeARefModelKey: snap.schemeARefModelKey,
    billablePriceId: snap.billablePriceId,
    cloudBillingKind: snap.billingKind ?? null,
    billedQty: snap.billedVideoSec ?? null,
    billedUnit: snap.billingKind === "VIDEO_MODEL_SPEC" ? "秒" : null,
  };
}

type PendingFullVideoJob = {
  taskId: string;
  logId: string;
  modelKey: string;
  provider: "volcengine" | "kie" | "bailian";
  durationSec: number;
  startedAt: string;
  prompt: string;
  taskKey: string;
  walletHoldId?: string | null;
  metered: boolean;
  billPoints?: number;
  billedVideoSec?: number | null;
  pricingSnapshot?: ToolUsagePricingSnapshot;
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
      j.provider === "kie" || j.provider === "volcengine" || j.provider === "bailian"
        ? j.provider
        : resolveStoryboardVideoProvider(
            typeof j.modelKey === "string" ? j.modelKey : "",
          ),
    durationSec: typeof j.durationSec === "number" ? j.durationSec : 10,
    startedAt: typeof j.startedAt === "string" ? j.startedAt : new Date().toISOString(),
    prompt: typeof j.prompt === "string" ? j.prompt : "",
    taskKey: typeof j.taskKey === "string" ? j.taskKey : "",
    walletHoldId: typeof j.walletHoldId === "string" ? j.walletHoldId : null,
    metered: j.metered === true,
    billPoints: typeof j.billPoints === "number" ? j.billPoints : undefined,
    billedVideoSec:
      typeof j.billedVideoSec === "number" ? j.billedVideoSec : null,
    pricingSnapshot: j.pricingSnapshot as ToolUsagePricingSnapshot | undefined,
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
  if (
    opts.pending.metered &&
    opts.pending.billPoints &&
    opts.pending.billPoints > 0 &&
    opts.pending.pricingSnapshot
  ) {
    const outcome = await recordToolUsageAndConsumeWallet({
      userId: opts.userId,
      toolKey: ECOM_STORYBOARD_TOOL_KEY,
      action: "video",
      costPoints: opts.pending.billPoints,
      meta: {
        projectId: opts.projectId,
        videoDurationSec: opts.pending.durationSec,
        modelId: opts.pending.modelKey,
        taskKey: opts.pending.taskKey,
      } as Prisma.InputJsonValue,
      pricingSnapshot: opts.pending.pricingSnapshot,
      billedVideoSec: opts.pending.billedVideoSec,
      walletHoldId: opts.pending.walletHoldId,
    });
    chargePoints = outcome.ok ? opts.pending.billPoints : null;
  }

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

  return { asset, chargePoints };
}

/** 提交整图成片任务（立即返回，由前端轮询 status） */
export async function ecomSubmitStoryboardFullVideoJob(opts: {
  userId: string;
  projectId: string;
  sheet: StoryboardSheet;
  sheetPngUrl: string;
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
}) {
  await assertEcomToolkitGatewayAccess(opts.userId);
  requireStoryboardProductRef(opts.references);
  const sheet = storyboardSheetSchema.parse(opts.sheet);
  const sheetPngUrl = opts.sheetPngUrl.trim();
  if (!/^https?:\/\//.test(sheetPngUrl)) {
    throw new Error("请先生成故事版 PNG");
  }

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
  const durationMin = provider === "bailian" ? 3 : 4;
  const durationSec = Math.max(
    durationMin,
    Math.min(15, Math.round(opts.durationSec ?? 10)),
  );
  const resolution = resolveVideoResolution(opts.resolution);
  const videoSr = videoSrFromResolution(resolution);
  const taskKey = `ecom-sb-vid:${opts.projectId}:${workspaceId}`;
  const clientPage = ecomClientPage(opts.userId, workspaceId, ECOM_STORYBOARD_TOOL_KEY);

  const panelImageUrls = sheet.panels
    .map((p) => p.imageUrl?.trim())
    .filter((u): u is string => Boolean(u && /^https?:\/\//.test(u)));
  const { firstFrameUrl, referenceImageUrls, allUrls } = resolveStoryboardFullVideoRefs({
    references: opts.references,
    sheetPngUrl,
    panelImageUrls,
  });
  const prompt = buildEcomStoryboardVideoPrompt(sheet, opts.brief, opts.references, {
    bailianModelKey: provider === "bailian" ? modelKey : undefined,
    bailianRefCount: provider === "bailian" ? allUrls.length : undefined,
  });

  const { url: aspectFirstFrame } = await normalizeImageForVolcengineVideo({
    userId: opts.userId,
    imageUrl: firstFrameUrl,
  });
  const { url: sizedFirstFrame } = await ensureStoryboardVideoRefImage({
    userId: opts.userId,
    imageUrl: aspectFirstFrame,
  });
  const normalizedReferenceImageUrls = await ensureStoryboardVideoRefImages({
    userId: opts.userId,
    urls: referenceImageUrls,
  });
  const videoImageUrl = sizedFirstFrame;
  const normalizedAllUrls = [
    sizedFirstFrame,
    ...normalizedReferenceImageUrls.filter((u) => u !== sizedFirstFrame),
  ].slice(0, 9);
  const ratio =
    opts.ratio?.trim() || opts.aspectRatio?.trim() || "9:16";

  let holdId: string | null = null;
  const metered = await shouldMeterEcomToolkitUsage(opts.userId, ECOM_STORYBOARD_TOOL_KEY);
  const snap = await resolveBillableSnapshot(ECOM_STORYBOARD_TOOL_KEY, "video", {
    userId: opts.userId,
    schemeARefModelKey: modelKey,
    actuals: { durationSec, videoSr },
  });

  if (metered && snap && snap.points > 0) {
    const est = Math.ceil(snap.points * 1.2);
    const hold = await reserveWalletHold({
      userId: opts.userId,
      toolKey: ECOM_STORYBOARD_TOOL_KEY,
      action: "video",
      estimatedMaxPoints: est,
      taskKey,
      meta: { projectId: opts.projectId, durationSec },
    });
    if (!hold.ok) {
      throw new Error(
        hold.reason === "below_watermark" ? "余额低于水位线" : "余额不足",
      );
    }
    holdId = hold.holdId;
  }

  let taskId: string;
  let logId: string;
  const videoAspect: "16:9" | "9:16" =
    opts.aspectRatio === "16:9" ? "16:9" : "9:16";

  if (provider === "kie") {
    const aspect = opts.aspectRatio ?? "9:16";
    const klingAspect: "16:9" | "9:16" | "1:1" =
      aspect === "16:9" ? "16:9" : aspect === "1:1" ? "1:1" : "9:16";
    const { model, input } = isStoryboardKling30KieVideoModel(modelKey)
      ? await (async () => {
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
          return buildEcomStoryboardKling30VideoInput({
            prompt,
            firstFrameUrl: klingFirst,
            references: klingRefs,
            aspectRatio: klingAspect,
            durationSec,
            sound: true,
          });
        })()
      : buildCanvasVideoKieInput({
          modelKey: resolveStoryboardKieVideoUpstreamModel(modelKey),
          prompt,
          imageUrl: videoImageUrl,
          referenceImageUrls: normalizedReferenceImageUrls,
          options: { resolution, duration: durationSec, generateAudio: true },
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
      parameterExtras.prompt_extend = opts.promptExtend !== false;
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
  } else {
    const { body } = buildCanvasVideoVolcengineInput({
      modelKey,
      prompt,
      imageUrl: videoImageUrl,
      referenceImageUrls: normalizedReferenceImageUrls,
      options: { resolution, duration: durationSec, generateAudio: true },
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
    walletHoldId: holdId,
    metered: Boolean(metered && snap && snap.points > 0),
    billPoints: snap?.points,
    billedVideoSec: snap?.billedVideoSec,
    pricingSnapshot: snap ? snapToPricing(snap) : undefined,
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
  meta: Record<string, unknown>;
}): Promise<{ ossUrl: string; taskId: string; chargePoints: number | null }> {
  const resolution = opts.resolution ?? "1080p";
  const videoSr = videoSrFromResolution(resolution);
  const workspaceId = randomUUID().slice(0, 8);
  const taskKey = `ecom-sb-vid:${opts.projectId}:${workspaceId}`;
  const clientPage = ecomClientPage(opts.userId, workspaceId, ECOM_STORYBOARD_TOOL_KEY);

  const { body } = buildCanvasVideoVolcengineInput({
    modelKey: opts.modelKey,
    prompt: opts.prompt,
    imageUrl: opts.imageUrl,
    referenceImageUrls: opts.referenceImageUrls,
    options: { resolution, duration: opts.durationSec, generateAudio: true },
    aspectRatio: opts.aspectRatio,
  });

  let holdId: string | null = null;
  const metered = await shouldMeterEcomToolkitUsage(opts.userId, ECOM_STORYBOARD_TOOL_KEY);
  const snap = await resolveBillableSnapshot(ECOM_STORYBOARD_TOOL_KEY, "video", {
    userId: opts.userId,
    schemeARefModelKey: opts.modelKey,
    actuals: { durationSec: opts.durationSec, videoSr },
  });

  if (metered && snap && snap.points > 0) {
    const est = Math.ceil(snap.points * 1.2);
    const hold = await reserveWalletHold({
      userId: opts.userId,
      toolKey: ECOM_STORYBOARD_TOOL_KEY,
      action: "video",
      estimatedMaxPoints: est,
      taskKey,
      meta: opts.meta as Prisma.InputJsonValue,
    });
    if (!hold.ok) {
      throw new Error(
        hold.reason === "below_watermark" ? "余额低于水位线" : "余额不足",
      );
    }
    holdId = hold.holdId;
  }

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

  let chargePoints: number | null = null;
  if (metered && snap && snap.points > 0) {
    const outcome = await recordToolUsageAndConsumeWallet({
      userId: opts.userId,
      toolKey: ECOM_STORYBOARD_TOOL_KEY,
      action: "video",
      costPoints: snap.points,
      meta: {
        ...opts.meta,
        videoDurationSec: opts.durationSec,
        modelId: opts.modelKey,
        taskKey,
      } as Prisma.InputJsonValue,
      pricingSnapshot: snapToPricing(snap),
      billedVideoSec: snap.billedVideoSec,
      walletHoldId: holdId,
    });
    chargePoints = outcome.ok ? snap.points : null;
  }

  return { ossUrl, taskId, chargePoints };
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

  const modelKey = opts.modelKey?.trim() || ECOM_STORYBOARD_DEFAULT_VIDEO_MODEL;
  const resolution = resolveVideoResolution(opts.resolution);
  const durationSec = Math.max(
    2,
    Math.min(
      8,
      Math.round(
        typeof opts.durationSec === "number"
          ? opts.durationSec
          : (panel.durationHintSec ?? 3),
      ),
    ),
  );
  const prompt = buildEcomStoryboardPanelVideoPrompt(panel, sheet, opts.brief);
  const { allUrls: refUrls } = resolveStoryboardModelRefUrls(opts.references);

  const { ossUrl, taskId, chargePoints } = await runVolcengineVideoJob({
    userId: opts.userId,
    projectId: opts.projectId,
    modelKey,
    prompt,
    imageUrl,
    referenceImageUrls: refUrls,
    durationSec,
    aspectRatio: opts.aspectRatio ?? "9:16",
    resolution,
    meta: {
      projectId: opts.projectId,
      panelIndex: panel.index,
      kind: "panel_video",
      resolution,
      durationSec,
    },
  });

  const updatedPanels = sheet.panels.map((p) =>
    p.index === panel.index ? { ...p, videoUrl: ossUrl } : p,
  );
  await updateEcomStoryboardProject(opts.userId, opts.projectId, {
    sheet: { ...sheet, panels: updatedPanels },
    status: "image_ready",
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
      },
    },
  });

  await persistStoryboardDeliverableSnapshot({
    userId: opts.userId,
    projectId: opts.projectId,
  }).catch(() => undefined);

  return { videoUrl: ossUrl, panelIndex: panel.index, chargePoints };
}

export async function ecomMergeStoryboardPanelVideos(opts: {
  userId: string;
  projectId: string;
  sheet: StoryboardSheet;
  title?: string;
}) {
  await assertEcomToolkitGatewayAccess(opts.userId);
  const sheet = storyboardSheetSchema.parse(opts.sheet);
  const urls = sheet.panels
    .slice()
    .sort((a, b) => a.index - b.index)
    .map((p) => p.videoUrl?.trim())
    .filter((u): u is string => Boolean(u && /^https?:\/\//.test(u)));

  if (urls.length < 2) {
    throw new Error("请至少为 2 个镜头生成分镜视频后再合并");
  }

  const tmp = await mkdtemp(join(tmpdir(), "ecom-sb-merge-"));
  try {
    const partPaths: string[] = [];
    for (let i = 0; i < urls.length; i++) {
      const res = await fetch(urls[i]!);
      if (!res.ok) throw new Error(`下载镜头视频失败 HTTP ${res.status}`);
      const p = join(tmp, `part-${i}.mp4`);
      await writeFile(p, Buffer.from(await res.arrayBuffer()));
      partPaths.push(p);
    }

    const listPath = join(tmp, "concat.txt");
    const listBody = partPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n");
    await writeFile(listPath, listBody);
    const outPath = join(tmp, "merged.mp4");

    try {
      await execFileAsync("ffmpeg", [
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        listPath,
        "-c",
        "copy",
        outPath,
      ]);
    } catch {
      throw new Error("合并视频需要服务器安装 ffmpeg，请联系管理员或改用「整图成片」模式");
    }

    const mergedBuf = await readFile(outPath);
    const ossUrl = await uploadCanvasUserBuffer({
      userId: opts.userId,
      ext: "mp4",
      buf: mergedBuf,
      contentType: "video/mp4",
    });

    const asset = await prisma.ecomAsset.create({
      data: {
        userId: opts.userId,
        module: ECOM_STORYBOARD_MODULE,
        kind: "video",
        title: (opts.title ?? sheet.overview.title).slice(0, 80),
        prompt: "merged panel videos",
        ossUrl,
        meta: {
          projectId: opts.projectId,
          kind: "merged_panel_video",
          panelCount: urls.length,
        },
      },
    });

    const existing = await prisma.ecomStoryboardProject.findFirst({
      where: { id: opts.projectId },
      select: { meta: true },
    });
    const prevMeta = (existing?.meta as Record<string, unknown> | null) ?? {};

    await prisma.ecomStoryboardProject.update({
      where: { id: opts.projectId },
      data: {
        status: "done",
        videoAssetId: asset.id,
        meta: {
          ...prevMeta,
          workflow: {
            ...((prevMeta.workflow as Record<string, unknown> | undefined) ?? {}),
            phase: "done",
            videoMode: "merged_panels",
          },
        } as Prisma.InputJsonValue,
      },
    });

    await persistStoryboardDeliverableSnapshot({
      userId: opts.userId,
      projectId: opts.projectId,
      videoUrl: ossUrl,
      videoAssetId: asset.id,
      videoMode: "merged_panels",
    }).catch(() => undefined);

    return { asset, ossUrl };
  } finally {
    await rm(tmp, { recursive: true, force: true }).catch(() => undefined);
  }
}
