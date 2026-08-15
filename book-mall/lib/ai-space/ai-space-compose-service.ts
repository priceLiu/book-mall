/**
 * 我的 AI 空间 · 数字人口播合成台
 *
 * 状态机：`pending → generating_human → composing → completed`（失败落 `failed`）
 *
 * - **口播生成**：形象图 + 音频 → Gateway（wan2.2-s2v，厂商同时处理中任务数 **1**，平台侧单飞排队）
 * - **画中画合成**：复用 `MediaRenderJob` 的 composite 渲染路径（背景循环 + overlay + 音轨 + 字幕）
 * - 厂商结果链接 24 小时过期，成功后立即转存 OSS
 */

import { createHash } from "node:crypto";

import { MediaRenderJobStatus } from "@prisma/client";

import { persistCanvasVideoResultToOss } from "@/lib/canvas/canvas-oss";
import {
  dashscopeCreateS2vTask,
  dashscopeExtractTaskVideoUrl,
  isDashscopeTaskFailed,
  isDashscopeTaskSuccess,
} from "@/lib/gateway/dashscope-client";
import { getDecryptedCredentialApiKey } from "@/lib/gateway/credential-service";
import { buildGatewayInputSummary } from "@/lib/gateway/log-input-summary";
import { buildGatewayTaskResultSummary } from "@/lib/gateway/log-result-summary";
import { pollDashscopeTaskForLog } from "@/lib/gateway/poll-service";
import {
  createRequestLog,
  finalizeRequestLog,
  pickCredentialForKind,
} from "@/lib/gateway/proxy-common";
import {
  createMediaRenderJob,
  enqueueMediaRenderJob,
} from "@/lib/media/media-render-service";
import { prisma } from "@/lib/prisma";

import { getAiSpaceAudioAsset } from "./ai-space-audio-service";
import {
  getAiSpaceComposeTask,
  toAiSpaceComposeTaskDto,
} from "./ai-space-compose-query";
import {
  AI_SPACE_COMPOSE_DEFAULT_OPTIONS,
  AI_SPACE_COMPOSE_STATUS_LABEL,
  AI_SPACE_S2V_MAX_AUDIO_SEC,
  AI_SPACE_S2V_VENDOR_CONCURRENCY,
  type AiSpaceComposeOverlayOptions,
  type AiSpaceComposeTaskDto,
} from "./ai-space-compose-types";
import { getAiSpaceDigitalHuman } from "./ai-space-digital-human-service";
import { requireAiSpaceDashscopeAuth } from "./ai-space-gateway-auth";
import {
  S2V_DETECT_FAILED_HINT,
  ensureDigitalHumanS2vChecked,
} from "./ai-space-s2v-detect-service";
import {
  createAiSpaceVideoMaterial,
  getAiSpaceVideoMaterial,
} from "./ai-space-video-material-service";

export type {
  AiSpaceComposeOverlayOptions,
  AiSpaceComposeTaskDto,
} from "./ai-space-compose-types";
export {
  getAiSpaceComposeTask,
  listAiSpaceComposeTasks,
} from "./ai-space-compose-query";

const S2V_MODEL_KEY = "wan2.2-s2v";
/**
 * 进程内最多等这么久；到点 **不判失败**，任务留在 `generating_human`，
 * 由 `pumpAiSpaceComposeQueue` → `reconcileStuckGeneratingTask` 继续向厂商核对。
 * （实测厂商排队可超过 45 分钟，早年 20 分钟硬超时会把在跑的任务误杀。）
 */
const S2V_INPROCESS_WAIT_MS = 10 * 60 * 1000;
/** 厂商侧硬上限：超过此时长仍 RUNNING 才收口为失败 */
const S2V_HARD_TIMEOUT_MS = (() => {
  const v = Number(process.env.AI_SPACE_S2V_HARD_TIMEOUT_MS);
  return Number.isFinite(v) && v > 0 ? v : 3 * 60 * 60 * 1000;
})();
const S2V_POLL_INTERVAL_MS = 10_000;
/** 合成阶段等待 MediaRenderJob 的上限 */
const RENDER_WAIT_TIMEOUT_MS = 20 * 60 * 1000;
const RENDER_POLL_INTERVAL_MS = 3_000;

export class AiSpaceComposeError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "AiSpaceComposeError";
  }
}

function s2vLockKeys(): [number, number] {
  const buf = createHash("sha256").update("ai-space-s2v-single-flight").digest();
  return [buf.readInt32BE(0), buf.readInt32BE(4)];
}

function normalizeOptions(raw: unknown): AiSpaceComposeOverlayOptions {
  const o = (raw ?? {}) as Partial<AiSpaceComposeOverlayOptions>;
  const scale =
    typeof o.scale === "number" && o.scale >= 0.1 && o.scale <= 1
      ? o.scale
      : AI_SPACE_COMPOSE_DEFAULT_OPTIONS.scale;
  const marginPx =
    typeof o.marginPx === "number" && o.marginPx >= 0 && o.marginPx <= 400
      ? Math.round(o.marginPx)
      : AI_SPACE_COMPOSE_DEFAULT_OPTIONS.marginPx;
  const position =
    o.position === "bottom-left" ||
    o.position === "top-right" ||
    o.position === "top-left" ||
    o.position === "center"
      ? o.position
      : AI_SPACE_COMPOSE_DEFAULT_OPTIONS.position;
  return {
    scale,
    marginPx,
    position,
    burnSubtitle: o.burnSubtitle === true,
    resolution: o.resolution === "720P" ? "720P" : "480P",
  };
}

const toDto = toAiSpaceComposeTaskDto;

const requireDashscopeAuth = requireAiSpaceDashscopeAuth;

/**
 * 建任务：校验素材归属、音频 20 秒门禁与形象可用性，然后异步推进。
 */
export async function createAiSpaceComposeTask(args: {
  userId: string;
  tenantId?: string | null;
  digitalHumanId: string;
  audioAssetId: string;
  videoMaterialId?: string | null;
  options?: unknown;
}): Promise<AiSpaceComposeTaskDto> {
  const human = await getAiSpaceDigitalHuman(args.userId, args.digitalHumanId);
  if (!human) throw new AiSpaceComposeError("数字人形象不存在", 404);
  if (human.status === "inactive") {
    throw new AiSpaceComposeError("该形象已停用，请先启用或换一个形象", 400);
  }

  const audio = await getAiSpaceAudioAsset(args.userId, args.audioAssetId);
  if (!audio) throw new AiSpaceComposeError("音频不存在", 404);
  if (audio.durationSec <= 0) {
    throw new AiSpaceComposeError(
      "该音频时长未知（可能上传时探测失败），请重新上传后再合成",
      400,
    );
  }
  if (audio.durationSec >= AI_SPACE_S2V_MAX_AUDIO_SEC) {
    throw new AiSpaceComposeError(
      `数字人口播要求音频时长小于 ${AI_SPACE_S2V_MAX_AUDIO_SEC} 秒，当前 ${audio.durationSec.toFixed(1)} 秒`,
      400,
    );
  }

  if (args.videoMaterialId) {
    const bg = await getAiSpaceVideoMaterial(args.userId, args.videoMaterialId);
    if (!bg) throw new AiSpaceComposeError("背景视频不存在", 404);
  }

  // 凭证前置校验：缺凭证时不建任务，避免留一条注定失败的记录
  await requireDashscopeAuth(args.userId);

  // 形象图预检（0.004 元/张）：S2V 排队常达数十分钟，不合格的图要在建任务前就拦住
  const detect = await ensureDigitalHumanS2vChecked({
    userId: args.userId,
    digitalHumanId: args.digitalHumanId,
    avatarImageUrl: human.avatarImageUrl,
    meta: { detect: human.detect },
  }).catch((e) => {
    console.warn("[ai-space/compose] 形象预检失败，放行合成", e);
    return null;
  });
  if (detect && !detect.checkPass) {
    throw new AiSpaceComposeError(
      detect.humanoid === false
        ? "形象图未检测到人像，请换一张单人正面人像后重试"
        : S2V_DETECT_FAILED_HINT,
      400,
    );
  }

  const options = normalizeOptions(args.options);
  const row = await prisma.aiSpaceComposeTask.create({
    data: {
      userId: args.userId,
      tenantId: args.tenantId ?? null,
      digitalHumanId: args.digitalHumanId,
      audioAssetId: args.audioAssetId,
      videoMaterialId: args.videoMaterialId ?? null,
      status: "pending",
      options: options as never,
    },
  });

  void advanceAiSpaceComposeTask(row.id).catch((e) => {
    console.error("[ai-space/compose] advance failed", row.id, e);
  });

  return toDto(row);
}

/**
 * 尝试占用厂商单飞槽位：全站同时只允许 1 个 `generating_human`。
 * 拿不到槽位时任务留在 `pending`，由 `pumpAiSpaceComposeQueue` 稍后重试。
 */
async function tryClaimS2vSlot(taskId: string): Promise<boolean> {
  const [k1, k2] = s2vLockKeys();
  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<
      Array<{ pg_try_advisory_xact_lock: boolean }>
    >`SELECT pg_try_advisory_xact_lock(${k1}::int, ${k2}::int)`;
    if (!locked[0]?.pg_try_advisory_xact_lock) return false;

    const inFlight = await tx.aiSpaceComposeTask.count({
      where: { status: "generating_human" },
    });
    if (inFlight >= AI_SPACE_S2V_VENDOR_CONCURRENCY) return false;

    const claimed = await tx.aiSpaceComposeTask.updateMany({
      where: { id: taskId, status: "pending" },
      data: { status: "generating_human", errorMessage: null },
    });
    return claimed.count > 0;
  });
}

/**
 * 厂商 `InternalError` 排队约 1 小时后才抛出，且官方示例素材同样复现，
 * 已排除请求体与形象图问题；wan2.2-s2v 文档要求 **华北2（北京）** 地域 API Key，
 * 因此把这类失败指向凭证地域，而不是把裸英文报错丢给用户。
 */
function friendlyS2vFailure(code: string | undefined, message: string): string {
  if (code?.trim().toLowerCase() === "internalerror") {
    return `厂商侧生成失败（${message}）。wan2.2-s2v 要求使用华北2（北京）地域的阿里云 API Key，请在 Gateway 模型管理页核对该凭证的地域后重试`;
  }
  return message;
}

async function failTask(taskId: string, message: string): Promise<void> {
  await prisma.aiSpaceComposeTask
    .update({
      where: { id: taskId },
      data: { status: "failed", errorMessage: message.slice(0, 2000) },
    })
    .catch(() => undefined);
  kickNextPendingTask();
}

/** 腾出厂商槽位后立刻放行下一条排队任务，不必等前台再来轮询 */
function kickNextPendingTask(): void {
  void (async () => {
    const inFlight = await prisma.aiSpaceComposeTask.count({
      where: { status: "generating_human" },
    });
    if (inFlight >= AI_SPACE_S2V_VENDOR_CONCURRENCY) return;
    const next = await prisma.aiSpaceComposeTask.findFirst({
      where: { status: "pending" },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (next) await advanceAiSpaceComposeTask(next.id);
  })().catch((e) => console.error("[ai-space/compose] kick next failed", e));
}

/** 阶段一：Gateway 提交 S2V 并轮询到终态，成功后转存 OSS */
async function runS2vStage(taskId: string): Promise<void> {
  const task = await prisma.aiSpaceComposeTask.findUnique({ where: { id: taskId } });
  if (!task) return;

  const [human, audio] = await Promise.all([
    getAiSpaceDigitalHuman(task.userId, task.digitalHumanId),
    getAiSpaceAudioAsset(task.userId, task.audioAssetId),
  ]);
  if (!human || !audio) {
    await failTask(taskId, "形象或音频已被删除，无法继续合成");
    return;
  }

  const options = normalizeOptions(task.options);
  const { auth, credentialId } = await requireDashscopeAuth(task.userId);
  const cred = await getDecryptedCredentialApiKey(credentialId);
  if (!cred) {
    await failTask(taskId, "Gateway 凭证不可用，请在模型管理页重新绑定");
    return;
  }

  const payload = {
    model: S2V_MODEL_KEY,
    input: { image_url: human.avatarImageUrl, audio_url: audio.audioUrl },
    parameters: { resolution: options.resolution },
  };

  const log = await createRequestLog({
    userId: auth.userId,
    apiKeyId: auth.id,
    credentialId,
    model: S2V_MODEL_KEY,
    endpoint: "/api/v1/services/aigc/image2video/video-synthesis",
    providerKind: "DASHSCOPE",
    requestKind: "VIDEO",
    clientSource: "EXTERNAL",
    clientPage: "account/ai-space?tab=compose",
    actorBookUserId: task.userId,
    inputSummary: buildGatewayInputSummary(S2V_MODEL_KEY, payload),
  });

  await prisma.aiSpaceComposeTask.update({
    where: { id: taskId },
    data: { gatewayLogId: log.id },
  });

  const started = Date.now();
  const created = await dashscopeCreateS2vTask({
    apiKey: cred.apiKey,
    model: S2V_MODEL_KEY,
    imageUrl: human.avatarImageUrl,
    audioUrl: audio.audioUrl,
    resolution: options.resolution,
  });
  if (!created.ok) {
    await finalizeRequestLog(log.id, {
      status: "FAILED",
      durationMs: Date.now() - started,
      failCode: "UPSTREAM_ERROR",
      failMessage: created.error,
      model: S2V_MODEL_KEY,
    });
    await failTask(taskId, created.error);
    return;
  }

  await prisma.$transaction([
    prisma.gatewayRequestLog.update({
      where: { id: log.id },
      data: { externalTaskId: created.taskId, status: "RUNNING" },
    }),
    prisma.aiSpaceComposeTask.update({
      where: { id: taskId },
      data: { gatewayTaskId: created.taskId },
    }),
  ]);

  const deadline = Date.now() + S2V_INPROCESS_WAIT_MS;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, S2V_POLL_INTERVAL_MS));
    let polled: Awaited<ReturnType<typeof pollDashscopeTaskForLog>>;
    try {
      polled = await pollDashscopeTaskForLog({
        credentialId,
        taskId: created.taskId,
      });
    } catch (e) {
      // 单次查询失败（网络抖动）继续重试，直到超时
      console.warn("[ai-space/compose] poll failed", taskId, e);
      continue;
    }

    const status = polled.output.task_status;
    if (isDashscopeTaskSuccess(status)) {
      const videoUrl = dashscopeExtractTaskVideoUrl(
        polled.output as Record<string, unknown>,
      );
      if (!videoUrl) {
        await finalizeRequestLog(log.id, {
          status: "FAILED",
          durationMs: Date.now() - started,
          failCode: "UPSTREAM_ERROR",
          failMessage: "厂商任务成功但未返回 video_url",
          resultSummary: buildGatewayTaskResultSummary(polled.raw),
          externalTaskId: created.taskId,
          model: S2V_MODEL_KEY,
        });
        await failTask(taskId, "厂商任务成功但未返回视频地址");
        return;
      }

      // 阿里云结果链接 24h 过期，立即转存 OSS
      const persisted = await persistCanvasVideoResultToOss({
        ephemeralUrl: videoUrl,
        userId: task.userId,
      });
      await finalizeRequestLog(log.id, {
        status: "SUCCEEDED",
        durationMs: Date.now() - started,
        resultSummary: buildGatewayTaskResultSummary(polled.raw, {
          videoUrl: persisted.videoUrl,
        }),
        externalTaskId: created.taskId,
        model: S2V_MODEL_KEY,
      });
      await prisma.aiSpaceComposeTask.update({
        where: { id: taskId },
        data: { tempHumanVideoUrl: persisted.videoUrl, status: "composing" },
      });
      kickNextPendingTask();
      return;
    }

    if (isDashscopeTaskFailed(status)) {
      const msg =
        polled.output.message?.trim() ||
        `厂商任务状态 ${status ?? "UNKNOWN"}`;
      await finalizeRequestLog(log.id, {
        status: "FAILED",
        durationMs: Date.now() - started,
        failCode: polled.output.code?.trim() || "UPSTREAM_ERROR",
        failMessage: msg,
        resultSummary: buildGatewayTaskResultSummary(polled.raw),
        externalTaskId: created.taskId,
        model: S2V_MODEL_KEY,
      });
      await failTask(taskId, friendlyS2vFailure(polled.output.code, msg));
      return;
    }
  }

  // 进程内等待到点：厂商仍在跑，保持 generating_human 由队列泵接管，不误判失败
  console.info(
    `[ai-space/compose] ${taskId} 厂商任务 ${created.taskId} 仍在生成，转交队列泵继续核对`,
  );
}

/** 阶段二：交给 MediaRenderJob 做 composite 渲染，等到终态后入库视频创作库 */
async function runComposeStage(taskId: string): Promise<void> {
  const task = await prisma.aiSpaceComposeTask.findUnique({ where: { id: taskId } });
  if (!task || task.status !== "composing") return;
  if (!task.tempHumanVideoUrl) {
    await failTask(taskId, "缺少口播视频，无法合成");
    return;
  }

  const options = normalizeOptions(task.options);
  const [audio, background] = await Promise.all([
    getAiSpaceAudioAsset(task.userId, task.audioAssetId),
    task.videoMaterialId
      ? getAiSpaceVideoMaterial(task.userId, task.videoMaterialId)
      : Promise.resolve(null),
  ]);

  let jobId = task.mediaRenderJobId;
  if (!jobId) {
    const job = await createMediaRenderJob({
      userId: task.userId,
      sourceApp: "api",
      sourceRef: { aiSpaceComposeTaskId: task.id },
      timeline: {
        version: 1,
        clips: [
          {
            order: 0,
            videoUrl: task.tempHumanVideoUrl,
          },
        ],
        composite: {
          mode: "composite",
          backgroundUrl: background?.videoUrl,
          // 口播视频已含 S2V 音轨；勾选字幕时仍以 TTS 原音轨为准，保证音画一致
          audioUrl: undefined,
          overlay: {
            scale: options.scale,
            position: options.position,
            marginPx: options.marginPx,
          },
          subtitleText: options.burnSubtitle
            ? (audio?.textScript ?? undefined)
            : undefined,
        },
      },
      profile: {
        transition: { type: "none" },
        subtitle: { mode: "script", burnIn: options.burnSubtitle },
        // 画布按背景比例缩放，长边封顶 1280；口播分辨率由 S2V 的 resolution 决定
        video: { scaleMode: "fit720p" },
      },
    });
    jobId = job.id;
    await prisma.aiSpaceComposeTask.update({
      where: { id: taskId },
      data: { mediaRenderJobId: jobId },
    });
    enqueueMediaRenderJob(jobId);
  }

  const deadline = Date.now() + RENDER_WAIT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const job = await prisma.mediaRenderJob.findUnique({
      where: { id: jobId },
      select: { status: true, resultOssUrl: true, errorMessage: true },
    });
    if (!job) {
      await failTask(taskId, "合成任务不存在");
      return;
    }
    if (job.status === MediaRenderJobStatus.FAILED) {
      await failTask(taskId, job.errorMessage ?? "画中画合成失败");
      return;
    }
    if (job.status === MediaRenderJobStatus.SUCCEEDED && job.resultOssUrl) {
      await finishComposeTask(taskId, job.resultOssUrl);
      return;
    }
    await new Promise((r) => setTimeout(r, RENDER_POLL_INTERVAL_MS));
  }
  await failTask(taskId, "画中画合成超时，请稍后在视频创作库查看或重试");
}

/** 合成成片入库视频创作库（category=compose，sourceKind=compose_output） */
async function finishComposeTask(taskId: string, finalUrl: string): Promise<void> {
  const task = await prisma.aiSpaceComposeTask.findUnique({ where: { id: taskId } });
  if (!task || task.status === "completed") return;

  const audio = await getAiSpaceAudioAsset(task.userId, task.audioAssetId);
  const human = await getAiSpaceDigitalHuman(task.userId, task.digitalHumanId);
  const name = `${human?.name ?? "数字人"}口播 · ${audio?.name ?? "音频"}`;

  await createAiSpaceVideoMaterial({
    userId: task.userId,
    tenantId: task.tenantId,
    name,
    category: "compose",
    videoUrl: finalUrl,
    durationSec: audio?.durationSec ?? 0,
    sourceKind: "compose_output",
    composeTaskId: task.id,
  }).catch((e) => {
    console.error("[ai-space/compose] create video material failed", taskId, e);
  });

  await prisma.aiSpaceComposeTask.update({
    where: { id: taskId },
    data: { status: "completed", finalVideoUrl: finalUrl, errorMessage: null },
  });
}

/**
 * 推进单个任务：按当前状态执行对应阶段。
 * `pending` 抢不到厂商槽位时直接返回，由队列轮询重试。
 */
export async function advanceAiSpaceComposeTask(taskId: string): Promise<void> {
  const task = await prisma.aiSpaceComposeTask.findUnique({
    where: { id: taskId },
    select: { status: true },
  });
  if (!task) return;

  try {
    if (task.status === "pending") {
      const claimed = await tryClaimS2vSlot(taskId);
      if (!claimed) return;
      await runS2vStage(taskId);
    }
    if (task.status === "generating_human") {
      // 进程重启后遗留的 generating_human：无法续接厂商轮询，交由 reconcile 收口
      await reconcileStuckGeneratingTask(taskId);
    }
    await runComposeStage(taskId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[ai-space/compose] task failed", taskId, e);
    await failTask(taskId, msg);
  }
}

/**
 * 队列泵/重启后接管 `generating_human`：按 gatewayTaskId 向厂商核对一次。
 * 仍在跑就保持现状（下一轮再核），超过硬上限才收口失败。
 */
async function reconcileStuckGeneratingTask(taskId: string): Promise<void> {
  const task = await prisma.aiSpaceComposeTask.findUnique({ where: { id: taskId } });
  if (!task || task.status !== "generating_human" || !task.gatewayTaskId) return;

  const { credentialId } = await requireDashscopeAuth(task.userId);
  const polled = await pollDashscopeTaskForLog({
    credentialId,
    taskId: task.gatewayTaskId,
  });
  const status = polled.output.task_status;

  if (isDashscopeTaskSuccess(status)) {
    const videoUrl = dashscopeExtractTaskVideoUrl(
      polled.output as Record<string, unknown>,
    );
    if (!videoUrl) {
      await finalizeS2vLog(task, "FAILED", polled.raw, "厂商任务成功但未返回视频地址");
      await failTask(taskId, "厂商任务成功但未返回视频地址");
      return;
    }
    const persisted = await persistCanvasVideoResultToOss({
      ephemeralUrl: videoUrl,
      userId: task.userId,
    });
    await finalizeS2vLog(task, "SUCCEEDED", polled.raw, undefined, persisted.videoUrl);
    await prisma.aiSpaceComposeTask.update({
      where: { id: taskId },
      data: { tempHumanVideoUrl: persisted.videoUrl, status: "composing" },
    });
    kickNextPendingTask();
    return;
  }

  if (isDashscopeTaskFailed(status)) {
    const msg =
      polled.output.message?.trim() || `厂商任务状态 ${status ?? "UNKNOWN"}`;
    await finalizeS2vLog(task, "FAILED", polled.raw, msg);
    await failTask(taskId, friendlyS2vFailure(polled.output.code, msg));
    return;
  }

  const ageMs = Date.now() - task.createdAt.getTime();
  if (ageMs > S2V_HARD_TIMEOUT_MS) {
    const msg = `口播视频生成超过 ${Math.round(S2V_HARD_TIMEOUT_MS / 60_000)} 分钟仍未完成，已收口`;
    await finalizeS2vLog(task, "FAILED", polled.raw, msg);
    await failTask(taskId, msg);
  }
}

/** 核对出终态后补写 Gateway 日志（提交时只写 RUNNING，不能留悬挂） */
async function finalizeS2vLog(
  task: { gatewayLogId: string | null; gatewayTaskId: string | null; createdAt: Date },
  status: "SUCCEEDED" | "FAILED",
  raw: unknown,
  failMessage?: string,
  videoUrl?: string,
): Promise<void> {
  if (!task.gatewayLogId) return;
  const log = await prisma.gatewayRequestLog.findUnique({
    where: { id: task.gatewayLogId },
    select: { status: true },
  });
  if (!log || (log.status !== "RUNNING" && log.status !== "PENDING")) return;

  await finalizeRequestLog(task.gatewayLogId, {
    status,
    durationMs: Date.now() - task.createdAt.getTime(),
    resultSummary: buildGatewayTaskResultSummary(raw, videoUrl ? { videoUrl } : undefined),
    failCode: status === "FAILED" ? "UPSTREAM_ERROR" : undefined,
    failMessage,
    externalTaskId: task.gatewayTaskId ?? undefined,
    model: S2V_MODEL_KEY,
  }).catch((e) => console.warn("[ai-space/compose] finalize log failed", e));
}

/**
 * 队列泵：供轮询路由/定时任务调用。
 * 1) 推进卡在 composing 的任务（进程重启后 MediaRenderJob 可能已完成）
 * 2) 核对卡在 generating_human 的任务
 * 3) 厂商槽位空闲时放行一个 pending
 */
export async function pumpAiSpaceComposeQueue(): Promise<void> {
  const composing = await prisma.aiSpaceComposeTask.findMany({
    where: { status: "composing" },
    select: { id: true },
    take: 10,
  });
  for (const t of composing) {
    await runComposeStage(t.id).catch((e) =>
      console.error("[ai-space/compose] pump compose failed", t.id, e),
    );
  }

  const generating = await prisma.aiSpaceComposeTask.findMany({
    where: { status: "generating_human" },
    select: { id: true },
    take: 5,
  });
  for (const t of generating) {
    await reconcileStuckGeneratingTask(t.id).catch((e) =>
      console.error("[ai-space/compose] pump reconcile failed", t.id, e),
    );
  }

  const inFlight = await prisma.aiSpaceComposeTask.count({
    where: { status: "generating_human" },
  });
  if (inFlight >= AI_SPACE_S2V_VENDOR_CONCURRENCY) return;

  const next = await prisma.aiSpaceComposeTask.findFirst({
    where: { status: "pending" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (next) await advanceAiSpaceComposeTask(next.id);
}


