/**
 * canvas-web AI 任务调度服务（KIE）。
 *
 * 状态机：
 *   PENDING ──createTask 200──▶ SUBMITTED ──callback/poll success──▶ SUCCEEDED
 *      │                                ╲──fail/timeout──▶ FAILED
 *      └──createTask 5xx, retry≤3──▶ FAILED
 *
 * mirror book-mall/lib/story/story-task-service.ts，但任务以 nodeId 维度且节点输入由前端整理后传入。
 */
import { createHash } from "node:crypto";
import type {
  CanvasGenerationKind,
  CanvasGenerationStatus,
  CanvasGenerationTask,
  GatewayProviderKind,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  promptArchiveFieldsForTask,
  syncTaskPromptArchiveById,
} from "@/lib/canvas/canvas-task-prompt-archive";
import {
  CANVAS_AI_TASK_TIMEOUT_MIN,
  CANVAS_BAILIAN_R2V_POLL_INTERVAL_MS,
  buildCanvasAiKieCallbackUrl,
  getCanvasProjectInflightMax,
  getCanvasUserInflightMax,
  getGenerationPollBatch,
  isCanvasBailianR2vVideoTaskPayload,
  isCanvasKieVideoTaskPayload,
  isCanvasVolcengineVideoTaskPayload,
  resolveCanvasSubmittedTaskTimeoutMin,
  resolveCanvasSubmittedTaskTimeoutMs,
} from "./canvas-constants";
import {
  getEffectiveGenerationPollConcurrency,
  getGenerationPollMaxPasses,
  getGenerationPollRecordPauseMs,
  getGenerationPollTimeBudgetMs,
} from "@/lib/generation/poll-config";
import { mapWithConcurrency } from "@/lib/generation/poll-parallel";
import { dispatchQueuedCanvasTasks } from "@/lib/generation/traffic-control/dispatch-canvas";
import { backfillCanvasTaskGatewayLink } from "@/lib/generation/traffic-control/canvas-orphan-gateway-log";
import { recoverCanvasTextLlmFromGateway } from "@/lib/canvas/canvas-text-llm-recover";
import {
  GENERATION_INFLIGHT_STATUSES,
  GENERATION_PIPELINE_INFLIGHT_STATUSES,
} from "@/lib/generation/traffic-control/constants";
import {
  pollShardOverFetchSize,
  selectPollShardTasks,
} from "@/lib/generation/poll-shard";
import {
  extractKieResultUrl,
  KieError,
  logKieEvent,
  type KieAspectRatio,
  type KieImageInput,
  type KieRecordResponse,
  type KieVideoInput,
  type CreateKieTaskArgs,
} from "@/lib/story/kie-client";
import { claimCanvasTaskKieSubmit } from "./canvas-kie-gateway-claim";
import {
  extractStoryScopeFromInputPayload,
  resolveCanvasTaskClientPage,
  storyScopesConflict,
  type CanvasTaskStoryScope,
} from "./canvas-story-scope";
import { enrichCanvasTaskRows } from "./canvas-task-billing";
import { resolveGenerationRecordLabels } from "./generation-record-labels";
import { resolveGenerationRecordPreview } from "./generation-record-preview";
import { extractPosterUrlFromResultPayload } from "./video-poster-ffmpeg";
import { resolveCanvasHistoryIdsForTasks } from "./generation-canvas-history";
import { findGenerationTaskRows, type GenerationTaskRecordRow } from "./canvas-generation-task-query";
import {
  buildGenerationTaskCursorWhere,
  encodeGenerationTaskCursor,
  GENERATION_RECORD_PAGE_DEFAULT,
  parseGenerationRecordLimit,
  parseGenerationTaskCursor,
} from "./generation-task-page-cursor";
import {
  buildCanvasTaskHotReadWhere,
  canvasGenerationRecordsDefaultSince,
} from "./canvas-task-hot-window";
import { persistCanvasKieResultToOss, persistCanvasVideoResultToOss } from "./canvas-oss";
import { mergeResultPayloadPoster } from "./video-poster-ffmpeg";
import {
  canvasGwCreateBailianR2vJob,
  canvasGwCreateKieJob,
  canvasGwRecordInfo,
} from "./canvas-gateway-client";
import { failGatewayLogIfStillRunning } from "@/lib/gateway/fail-gateway-log-on-timeout";
import { persistCanvasE2eForTask } from "@/lib/gateway/log-canvas-e2e-timing";
import {
  extractVolcengineVideoUrlFromGatewaySummary,
  patchCanvasProjectNodeRuntimeFromTask,
} from "@/lib/canvas/canvas-volcengine-recover";
import {
  canvasNodeShowsPersistedMedia,
  patchCanvasProjectNodeMediaFromTask,
} from "@/lib/canvas/canvas-media-patch";
import {
  recoverCanvasVideoTaskDisplay,
  runCanvasDisplayReconcileWorker,
} from "@/lib/canvas/canvas-video-display-recover";
import { recoverCanvasKieImageFromGateway } from "@/lib/canvas/canvas-kie-image-recover";
import { getGenerationPollInnerTimeoutMs } from "@/lib/generation/poll-config";
import { resolveGenerationSlowWarnMs } from "@/lib/generation/slow-warn-config";
import { maybeRunSlowWarnAutoHandler } from "@/lib/generation/slow-warn-auto-handler";
import {
  isSlowGenerationAge,
} from "@/lib/generation/slow-generation";
import {
  buildCanvasPollErrorPatch,
  buildCanvasTimeoutFailFields,
  probeCanvasSubmittedTaskAtTimeout,
} from "@/lib/canvas/canvas-poll-timeout-diagnostics";
import {
  isVolcengineVideoTaskFailed,
  isVolcengineVideoTaskSuccess,
} from "@/lib/gateway/volcengine-client";
import { isGatewayVirtualProviderId } from "./canvas-gateway-providers";
import { shouldCanvasUseGateway } from "./canvas-gateway-run";
import {
  SYSTEM_HUNYUAN_3D_PROVIDER_ID,
  isSystemProviderId,
} from "./canvas-system-provider";
import {
  type CanvasGatewayPollResult,
} from "./providers";
import { extractHunyuan3DResultUrls } from "./providers/hunyuan-3d";
import { buildKieImageCreateArgs } from "./providers/kie";
import { type BailianR2vTaskOutput, extractBailianR2vVideoUrlFromGatewaySummary } from "./canvas-video-bailian-r2v";
import {
  dashscopeExtractTaskImageUrl,
  dashscopeExtractTaskVideoUrl,
  isDashscopeTaskFailed,
  isDashscopeTaskSuccess,
  type DashscopeTaskOutput,
} from "@/lib/gateway/dashscope-client";
import { CanvasProjectError } from "./canvas-project-service";
import { recordCanvasPlatformError } from "@/lib/platform-error-log";

/** Canvas 任务进入 FAILED 时写入 PlatformErrorLog（幂等由 dedup fingerprint 承担） */
export function logCanvasGenerationTaskFailure(
  task: Pick<
    CanvasGenerationTask,
    | "id"
    | "projectId"
    | "nodeId"
    | "model"
    | "failCode"
    | "failMessage"
    | "inputPayload"
  >,
  userId?: string | null,
): void {
  const payload = task.inputPayload as { gatewayLogId?: string } | null;
  recordCanvasPlatformError({
    failCode: task.failCode,
    failMessage: task.failMessage,
    projectId: task.projectId,
    nodeId: task.nodeId,
    taskId: task.id,
    modelKey: task.model,
    userId,
    gatewayLogId:
      typeof payload?.gatewayLogId === "string"
        ? payload.gatewayLogId
        : undefined,
  });
}

import { assertAccessibleCanvasProject } from "./canvas-project-access";

// —— Types ——

/** 节点运行的轻量描述：由 canvas-web 前端整理上游解析后传入 */
export type CanvasRunNodeInput = {
  /** 例：'image-gen' / 'ai-text' / 'image' / 'text' / 'product-params' / 'output' */
  type: string;
  /** 仅 image-gen / ai-text 真正会创建任务，其它由前端短路。 */
  modelKey?: string;
  /** 节点配置 + 上游解析后的字段（已扁平化） */
  data: Record<string, unknown>;
  /** 上游图片节点解析的 OSS / blob URL 列表（按端口顺序） */
  imageInputs?: string[];
  /** 上游文本节点解析的字符串（按端口顺序，已 join） */
  textInputs?: string[];
  /** 火山私域人像库 asset:// 引用（来自上游 LibTV 图片节点入库） */
  portraitAssetRefs?: Array<{
    url: string;
    role?: "reference_image" | "first_frame" | "last_frame";
  }>;
};

export type SubmitCanvasNodeArgs = {
  userId: string;
  projectId: string;
  nodeId: string;
  node: CanvasRunNodeInput;
  clientPage?: string;
};

// —— Helpers ——

function taskInputPayload(
  task: Pick<CanvasGenerationTask, "inputPayload">,
): Record<string, unknown> | null {
  if (!task.inputPayload || typeof task.inputPayload !== "object") return null;
  return task.inputPayload as Record<string, unknown>;
}

function isGatewayCanvasTaskPayload(
  payload: Record<string, unknown> | null,
): boolean {
  if (!payload) return false;
  if (payload.gatewayLogId) return true;
  const pid = typeof payload.providerId === "string" ? payload.providerId : "";
  return isGatewayVirtualProviderId(pid) || pid.startsWith("system:");
}

async function shouldCanvasTaskUseGateway(
  userId: string,
  payload: Record<string, unknown> | null,
): Promise<boolean> {
  if (isGatewayCanvasTaskPayload(payload)) return true;
  if (!payload) return false;
  const pid = typeof payload.providerId === "string" ? payload.providerId : "";
  const modelKey =
    typeof payload.modelKey === "string" ? payload.modelKey : undefined;
  return shouldCanvasUseGateway(userId, pid, modelKey);
}

function gatewayProviderKindFromPayload(
  payload: Record<string, unknown>,
): GatewayProviderKind {
  const pk = payload.providerKind;
  if (pk === "VOLCENGINE") return "VOLCENGINE";
  if (pk === "DASHSCOPE") return "DASHSCOPE";
  if (pk === "BAILIAN_R2V" || pk === "BAILIAN") return "BAILIAN";
  if (pk === "HUNYUAN" || pk === "HUNYUAN_3D") return "HUNYUAN";
  if (pk === "TOPAZ") return "TOPAZ";
  return "KIE";
}

async function ensureUserInflightCapacity(
  userId: string,
  addingCount = 1,
): Promise<void> {
  const max = getCanvasUserInflightMax();
  const current = await prisma.canvasGenerationTask.count({
    where: {
      project: { userId, deletedAt: null },
      status: { in: [...GENERATION_INFLIGHT_STATUSES] },
    },
  });
  if (current + addingCount > max) {
    throw new CanvasProjectError(
      "TOO_MANY_INFLIGHT",
      `inflight tasks ${current + addingCount} exceeds limit ${max}`,
      429,
    );
  }
}

async function ensureProjectInflightCapacity(
  projectId: string,
): Promise<void> {
  const max = getCanvasProjectInflightMax();
  if (max <= 0) return;
  const current = await prisma.canvasGenerationTask.count({
    where: {
      projectId,
      status: { in: [...GENERATION_PIPELINE_INFLIGHT_STATUSES] },
    },
  });
  if (current >= max) {
    throw new CanvasProjectError(
      "TOO_MANY_INFLIGHT",
      `project inflight ${current} exceeds limit ${max}`,
      429,
    );
  }
}

async function ensureNoActiveTaskForScope(
  projectId: string,
  nodeId: string,
  storyScope?: CanvasTaskStoryScope,
): Promise<void> {
  const active = await prisma.canvasGenerationTask.findMany({
    where: {
      projectId,
      nodeId,
      status: { in: [...GENERATION_INFLIGHT_STATUSES] },
    },
    select: { id: true, inputPayload: true },
  });
  for (const t of active) {
    const existingScope = extractStoryScopeFromInputPayload(t.inputPayload);
    if (storyScopesConflict(storyScope, existingScope)) {
      throw new CanvasProjectError(
        "TASK_ALREADY_INFLIGHT",
        `node ${nodeId} task already in progress`,
        409,
      );
    }
  }
}

function computeInputHash(args: {
  modelKey: string;
  prompt: string;
  imageUrls: string[];
  params: Record<string, unknown>;
}): string {
  const payload = {
    modelKey: args.modelKey,
    prompt: args.prompt,
    imageUrls: [...args.imageUrls].sort(),
    params: args.params,
  };
  const json = JSON.stringify(payload);
  return createHash("sha256").update(json).digest("hex");
}

// —— Build KIE input for ImageGen node ——

type BuiltKieInput = {
  model: string;
  input: Record<string, unknown>;
  prompt: string;
  imageUrls: string[];
  params: Record<string, unknown>;
};

function clampInt(n: unknown, min: number, max: number, fallback: number): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(v)));
}

function pickAspectRatio(v: unknown): "16:9" | "9:16" | "1:1" {
  if (v === "16:9" || v === "9:16" || v === "1:1") return v;
  return "1:1";
}

function pickResolution(v: unknown): "1K" | "2K" {
  if (v === "1K" || v === "2K") return v;
  return "2K";
}

function pickOutputFormat(v: unknown): "png" | "jpeg" | "webp" {
  if (v === "png" || v === "jpeg" || v === "webp") return v;
  return "png";
}

function buildImageGenKieInput(node: CanvasRunNodeInput): BuiltKieInput {
  const modelKey = (node.modelKey ?? "").trim();
  if (!modelKey) {
    throw new CanvasProjectError(
      "INVALID_INPUT",
      "image-gen node requires modelKey",
    );
  }
  const promptParts: string[] = [];
  const directPrompt =
    typeof node.data.prompt === "string" ? node.data.prompt.trim() : "";
  if (directPrompt) promptParts.push(directPrompt);
  for (const t of node.textInputs ?? []) {
    if (t && t.trim()) promptParts.push(t.trim());
  }
  const prompt = promptParts.join("\n").slice(0, 4000);
  if (!prompt) {
    throw new CanvasProjectError(
      "EMPTY_PROMPT",
      "image-gen node prompt is empty",
    );
  }

  const imageUrls = (node.imageInputs ?? []).filter(
    (u): u is string => typeof u === "string" && /^https?:\/\//.test(u),
  ).slice(0, 8);

  const aspect_ratio = pickAspectRatio(node.data.aspectRatio);
  const resolution = pickResolution(node.data.resolution);
  const output_format = pickOutputFormat(node.data.outputFormat);
  const n = clampInt(node.data.n, 1, 4, 1);

  const mapped = buildKieImageCreateArgs({
    modelKey,
    prompt,
    imageUrls,
    params: {
      aspect_ratio,
      resolution,
      output_format,
      n: n > 1 ? n : undefined,
    },
  });
  return {
    model: mapped.model,
    input: mapped.input,
    prompt,
    imageUrls,
    params: { aspect_ratio, resolution, output_format, n },
  };
}

// —— Submit ——

async function findReusableSucceededTask(args: {
  projectId: string;
  nodeId: string;
  inputHash: string;
}): Promise<CanvasGenerationTask | null> {
  return prisma.canvasGenerationTask.findFirst({
    where: {
      projectId: args.projectId,
      nodeId: args.nodeId,
      status: "SUCCEEDED",
      inputHash: args.inputHash,
    },
    orderBy: { completedAt: "desc" },
  });
}

export type SubmitCanvasNodeResult =
  | { reused: true; task: CanvasGenerationTask }
  | { reused: false; task: CanvasGenerationTask };

export async function submitCanvasNodeTask(
  args: SubmitCanvasNodeArgs,
): Promise<SubmitCanvasNodeResult> {
  await assertAccessibleCanvasProject(args.userId, args.projectId);

  if (args.node.type !== "image-gen") {
    throw new CanvasProjectError(
      "INVALID_INPUT",
      `node type ${args.node.type} is not runnable`,
    );
  }

  const built = buildImageGenKieInput(args.node);
  const inputHash = computeInputHash({
    modelKey: built.model,
    prompt: built.prompt,
    imageUrls: built.imageUrls,
    params: built.params,
  });

  // 缓存命中 —— 直接复用
  const reusable = await findReusableSucceededTask({
    projectId: args.projectId,
    nodeId: args.nodeId,
    inputHash,
  });
  if (reusable) {
    return { reused: true, task: reusable };
  }

  await ensureNoActiveTaskForScope(args.projectId, args.nodeId);
  await ensureProjectInflightCapacity(args.projectId);
  await ensureUserInflightCapacity(args.userId);

  const created = await prisma.canvasGenerationTask.create({
    data: {
      projectId: args.projectId,
      nodeId: args.nodeId,
      kind: "IMAGE",
      model: built.model,
      providerId: null,
      inputPayload: {
        ...built.input,
        providerId: "gateway:kie",
        providerKind: "KIE",
      } as Prisma.InputJsonValue,
      inputHash,
      status: "PENDING",
      ...promptArchiveFieldsForTask({
        kind: "IMAGE",
        inputPayload: {
          ...built.input,
          providerId: "gateway:kie",
          providerKind: "KIE",
        },
      }),
    },
  });

  const callBackUrl = buildCanvasAiKieCallbackUrl("image", created.id);
  try {
    const job = await canvasGwCreateKieJob(args.userId, {
      model: built.model,
      input: built.input as Record<string, unknown>,
      callBackUrl,
      clientPage: args.clientPage ?? `canvas/${args.projectId}`,
    });
    const updated = await prisma.canvasGenerationTask.update({
      where: { id: created.id },
      data: {
        status: "SUBMITTED",
        kieTaskId: job.taskId,
        submittedAt: new Date(),
        inputPayload: {
          ...built.input,
          providerId: "gateway:kie",
          providerKind: "KIE",
          gatewayLogId: job.logId,
        } as Prisma.InputJsonValue,
      },
    });
    return { reused: false, task: updated };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const code = e instanceof KieError ? e.code : "KIE_HTTP_ERROR";
    logKieEvent("warn", `[canvas] createTask failed (will retry via poll worker)`, {
      taskId: created.id,
      code,
      msg,
    });
    await prisma.canvasGenerationTask.update({
      where: { id: created.id },
      data: { failCode: code, failMessage: msg.slice(0, 500) },
    });
    return { reused: false, task: created };
  }
}

// —— Apply result ——

/** 仅允许一个并发路径把 SUBMITTED/PENDING 任务推进到终态，避免重复 OSS 上传与多次 success 日志 */
async function claimCanvasTaskForResultApply(taskId: string): Promise<boolean> {
  const claimed = await prisma.canvasGenerationTask.updateMany({
    where: {
      id: taskId,
      status: { in: [...GENERATION_INFLIGHT_STATUSES] },
    },
    data: { lastPolledAt: new Date() },
  });
  return claimed.count > 0;
}

export async function applyCanvasBailianR2vPollResult(
  taskId: string,
  polled:
    | { ok: true; output: BailianR2vTaskOutput; raw: unknown }
    | { ok: false; error: string },
): Promise<void> {
  const task = await prisma.canvasGenerationTask.findUnique({
    where: { id: taskId },
    include: { project: true },
  });
  if (!task) return;
  if (task.status === "SUCCEEDED" || task.status === "CANCELLED") return;
  if (!(await claimCanvasTaskForResultApply(taskId))) return;

  if (!polled.ok) {
    await prisma.canvasGenerationTask.update({
      where: { id: taskId },
      data: {
        status: "FAILED",
        failCode: "BAILIAN_POLL_FAILED",
        failMessage: polled.error.slice(0, 500),
        completedAt: new Date(),
      },
    });
    return;
  }

  const status = polled.output.task_status ?? "";
  if (status === "FAILED" || polled.output.code) {
    await prisma.canvasGenerationTask.update({
      where: { id: taskId },
      data: {
        status: "FAILED",
        failCode: polled.output.code ?? "BAILIAN_R2V_FAILED",
        failMessage: (polled.output.message ?? "参考生视频失败").slice(0, 500),
        resultPayload: polled.raw as Prisma.InputJsonValue,
        completedAt: new Date(),
      },
    });
    return;
  }

  if (status !== "SUCCEEDED") return;

  const ephemeralUrl = polled.output.video_url?.trim();
  if (!ephemeralUrl) {
    await prisma.canvasGenerationTask.update({
      where: { id: taskId },
      data: {
        status: "FAILED",
        failCode: "BAILIAN_NO_VIDEO_URL",
        failMessage: "任务成功但未返回 video_url",
        resultPayload: polled.raw as Prisma.InputJsonValue,
        completedAt: new Date(),
      },
    });
    return;
  }

  let ossUrl: string | null = null;
  let posterUrl: string | undefined;
  let ossError: string | null = null;
  try {
    const persisted = await persistCanvasVideoResultToOss({
      ephemeralUrl,
      projectId: task.projectId,
    });
    ossUrl = persisted.videoUrl;
    posterUrl = persisted.posterUrl;
  } catch (e) {
    ossError = e instanceof Error ? e.message : String(e);
  }

  if (!ossUrl) {
    await prisma.canvasGenerationTask.update({
      where: { id: taskId },
      data: {
        status: "FAILED",
        failCode: "OSS_UPLOAD_FAILED",
        failMessage: ossError ?? "OSS upload failed",
        ephemeralUrl,
        resultPayload: polled.raw as Prisma.InputJsonValue,
        completedAt: new Date(),
      },
    });
    return;
  }

  await prisma.canvasGenerationTask.updateMany({
    where: {
      id: taskId,
      status: { in: [...GENERATION_INFLIGHT_STATUSES] },
    },
    data: {
      status: "SUCCEEDED",
      ossUrl,
      ephemeralUrl,
      resultPayload: mergeResultPayloadPoster(
        polled.raw,
        posterUrl,
      ) as Prisma.InputJsonValue,
      completedAt: new Date(),
    },
  });
  const bailianUpdated = await prisma.canvasGenerationTask.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      projectId: true,
      nodeId: true,
      ossUrl: true,
      ephemeralUrl: true,
      completedAt: true,
      resultPayload: true,
    },
  });
  if (bailianUpdated) await patchCanvasProjectNodeRuntimeFromTask(bailianUpdated);
}

export async function applyCanvasDashscopeImagePollResult(
  taskId: string,
  output: DashscopeTaskOutput,
): Promise<void> {
  const task = await prisma.canvasGenerationTask.findUnique({
    where: { id: taskId },
    include: { project: true },
  });
  if (!task) return;
  if (task.status === "SUCCEEDED" || task.status === "CANCELLED") return;
  if (!(await claimCanvasTaskForResultApply(taskId))) return;

  const status = output.task_status ?? "";
  if (isDashscopeTaskFailed(status) || output.code) {
    await prisma.canvasGenerationTask.update({
      where: { id: taskId },
      data: {
        status: "FAILED",
        failCode: output.code ?? "DASHSCOPE_IMAGE_FAILED",
        failMessage: (output.message ?? "DashScope 图像任务失败").slice(0, 500),
        resultPayload: output as unknown as Prisma.InputJsonValue,
        completedAt: new Date(),
      },
    });
    return;
  }

  if (!isDashscopeTaskSuccess(status)) return;

  const videoUrl = dashscopeExtractTaskVideoUrl(
    output as Record<string, unknown>,
  );
  if (videoUrl) {
    await applyCanvasVolcengineVideoResult(taskId, videoUrl);
    return;
  }

  const ephemeralUrl = dashscopeExtractTaskImageUrl(
    output as Record<string, unknown>,
  );
  if (!ephemeralUrl) {
    await prisma.canvasGenerationTask.update({
      where: { id: taskId },
      data: {
        status: "FAILED",
        failCode: "DASHSCOPE_NO_IMAGE_URL",
        failMessage: "任务成功但未返回图片 URL",
        resultPayload: output as unknown as Prisma.InputJsonValue,
        completedAt: new Date(),
      },
    });
    return;
  }

  let ossUrl: string | null = null;
  let ossError: string | null = null;
  try {
    ossUrl = await persistCanvasKieResultToOss({
      ephemeralUrl,
      kind: "node-image",
      projectId: task.projectId,
    });
  } catch (e) {
    ossError = e instanceof Error ? e.message : String(e);
  }

  if (!ossUrl) {
    await prisma.canvasGenerationTask.update({
      where: { id: taskId },
      data: {
        status: "FAILED",
        failCode: "OSS_UPLOAD_FAILED",
        failMessage: ossError ?? "OSS upload failed",
        ephemeralUrl,
        resultPayload: output as unknown as Prisma.InputJsonValue,
        completedAt: new Date(),
      },
    });
    return;
  }

  await prisma.canvasGenerationTask.updateMany({
    where: {
      id: taskId,
      status: { in: [...GENERATION_INFLIGHT_STATUSES] },
    },
    data: {
      status: "SUCCEEDED",
      ossUrl,
      ephemeralUrl,
      resultPayload: output as unknown as Prisma.InputJsonValue,
      completedAt: new Date(),
    },
  });
  const updated = await prisma.canvasGenerationTask.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      projectId: true,
      nodeId: true,
      ossUrl: true,
      ephemeralUrl: true,
      completedAt: true,
      resultPayload: true,
    },
  });
  if (updated) {
    await patchCanvasProjectNodeRuntimeFromTask(updated);
    await patchCanvasProjectNodeMediaFromTask({
      id: task.id,
      projectId: task.projectId,
      nodeId: task.nodeId,
      ossUrl,
      ephemeralUrl,
      completedAt: updated.completedAt,
      resultPayload: updated.resultPayload,
    });
  }
}

export async function applyCanvasVolcengineVideoResult(
  taskId: string,
  videoUrl: string | null | undefined,
): Promise<void> {
  const task = await prisma.canvasGenerationTask.findUnique({
    where: { id: taskId },
    include: { project: true },
  });
  if (!task) return;
  if (task.status === "SUCCEEDED" || task.status === "CANCELLED") {
    if (
      task.status === "SUCCEEDED" &&
      (task.ossUrl?.trim() || task.ephemeralUrl?.trim())
    ) {
      if (
        !canvasNodeShowsPersistedMedia(
          task.project.canvas,
          task.nodeId,
          task.id,
        )
      ) {
        await patchCanvasProjectNodeMediaFromTask(task);
      }
    }
    return;
  }
  if (!(await claimCanvasTaskForResultApply(taskId))) return;

  const ephemeralUrl = videoUrl?.trim();
  if (!ephemeralUrl || !/^https?:\/\//.test(ephemeralUrl)) {
    await prisma.canvasGenerationTask.update({
      where: { id: taskId },
      data: {
        status: "FAILED",
        failCode: "VOLCENGINE_NO_RESULT_URL",
        failMessage: "火山方舟任务成功但未返回 video_url",
        completedAt: new Date(),
      },
    });
    return;
  }

  let ossUrl: string | null = null;
  let posterUrl: string | undefined;
  let ossError: string | null = null;
  try {
    const persisted = await persistCanvasVideoResultToOss({
      ephemeralUrl,
      projectId: task.projectId,
    });
    ossUrl = persisted.videoUrl;
    posterUrl = persisted.posterUrl;
  } catch (e) {
    ossError = e instanceof Error ? e.message : String(e);
  }
  if (!ossUrl) {
    await prisma.canvasGenerationTask.update({
      where: { id: taskId },
      data: {
        status: "SUCCEEDED",
        ephemeralUrl,
        failCode: null,
        failMessage: ossError
          ? `OSS skipped: ${ossError.slice(0, 200)}`
          : null,
        completedAt: new Date(),
      },
    });
    const updated = await prisma.canvasGenerationTask.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        projectId: true,
        nodeId: true,
        ossUrl: true,
        ephemeralUrl: true,
        completedAt: true,
        resultPayload: true,
      },
    });
    if (updated) await patchCanvasProjectNodeRuntimeFromTask(updated);
    await persistCanvasE2eForTask(taskId).catch(() => undefined);
    return;
  }

  await prisma.canvasGenerationTask.updateMany({
    where: {
      id: taskId,
      status: { in: [...GENERATION_INFLIGHT_STATUSES] },
    },
    data: {
      status: "SUCCEEDED",
      ossUrl,
      ephemeralUrl,
      resultPayload: mergeResultPayloadPoster(null, posterUrl) as Prisma.InputJsonValue,
      completedAt: new Date(),
    },
  });
  const updated = await prisma.canvasGenerationTask.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      projectId: true,
      nodeId: true,
      ossUrl: true,
      ephemeralUrl: true,
      completedAt: true,
      resultPayload: true,
    },
  });
  if (updated) await patchCanvasProjectNodeRuntimeFromTask(updated);
  await persistCanvasE2eForTask(taskId).catch(() => undefined);
}

export async function applyCanvasKieTaskResult(
  taskId: string,
  record: KieRecordResponse,
): Promise<void> {
  const task = await prisma.canvasGenerationTask.findUnique({
    where: { id: taskId },
    include: { project: true },
  });
  if (!task) {
    logKieEvent("warn", "[canvas] applyKieTaskResult: task not found", { taskId });
    return;
  }
  if (task.status === "SUCCEEDED" || task.status === "CANCELLED") {
    if (
      task.status === "SUCCEEDED" &&
      (task.ossUrl?.trim() || task.ephemeralUrl?.trim())
    ) {
      if (
        !canvasNodeShowsPersistedMedia(
          task.project.canvas,
          task.nodeId,
          task.id,
        )
      ) {
        await patchCanvasProjectNodeMediaFromTask(task);
      }
    }
    return;
  }
  if (!(await claimCanvasTaskForResultApply(taskId))) return;

  if (record.state === "success") {
    const ephemeralUrl = extractKieResultUrl(record);
    if (!ephemeralUrl) {
      await prisma.canvasGenerationTask.update({
        where: { id: taskId },
        data: {
          status: "FAILED",
          failCode: "KIE_NO_RESULT_URL",
          failMessage: "KIE returned success but resultUrls empty",
          resultPayload: record as unknown as Prisma.InputJsonValue,
          completedAt: new Date(),
        },
      });
      return;
    }
    let ossUrl: string | null = null;
    let posterUrl: string | undefined;
    let ossError: string | null = null;
    const payload = task.inputPayload as { kind?: string } | null;
    const engineKind = payload?.kind ?? "";
    const ossKind =
      engineKind === "video-engine" || engineKind === "ai-video-engine"
        ? "node-video"
        : engineKind === "tts-engine"
          ? "node-audio"
          : "node-image";
    const isVideoOss = ossKind === "node-video";
    try {
      if (isVideoOss) {
        const persisted = await persistCanvasVideoResultToOss({
          ephemeralUrl,
          projectId: task.projectId,
        });
        ossUrl = persisted.videoUrl;
        posterUrl = persisted.posterUrl;
      } else {
        ossUrl = await persistCanvasKieResultToOss({
          ephemeralUrl,
          kind: ossKind,
          projectId: task.projectId,
        });
      }
    } catch (e) {
      ossError = e instanceof Error ? e.message : String(e);
      logKieEvent("error", "[canvas] persistKieResultToOss failed", {
        taskId,
        ephemeralUrl,
        ossError,
      });
    }
    if (!ossUrl) {
      await prisma.canvasGenerationTask.update({
        where: { id: taskId },
        data: {
          status: "FAILED",
          failCode: "OSS_UPLOAD_FAILED",
          failMessage: ossError ?? "OSS upload failed",
          ephemeralUrl,
          resultPayload: record as unknown as Prisma.InputJsonValue,
          completedAt: new Date(),
        },
      });
      return;
    }
    const applied = await prisma.canvasGenerationTask.updateMany({
      where: {
        id: taskId,
        status: { in: [...GENERATION_INFLIGHT_STATUSES] },
      },
      data: {
        status: "SUCCEEDED",
        ossUrl,
        ephemeralUrl,
        resultPayload: (isVideoOss
          ? mergeResultPayloadPoster(record, posterUrl)
          : record) as Prisma.InputJsonValue,
        completedAt: new Date(),
      },
    });
    if (applied.count === 0) return;
    const updated = await prisma.canvasGenerationTask.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        projectId: true,
        nodeId: true,
        ossUrl: true,
        ephemeralUrl: true,
        completedAt: true,
        resultPayload: true,
      },
    });
    if (updated) {
      if (isVideoOss) {
        await patchCanvasProjectNodeRuntimeFromTask(updated);
      } else {
        await patchCanvasProjectNodeMediaFromTask(updated);
      }
    }
    logKieEvent("info", "[canvas] task succeeded", {
      taskId,
      kind: task.kind,
      ossUrl,
    });
  } else if (record.state === "fail") {
    const updated = await prisma.canvasGenerationTask.update({
      where: { id: taskId },
      data: {
        status: "FAILED",
        failCode: record.failCode || "KIE_FAILED",
        failMessage: record.failMsg ?? null,
        resultPayload: record as unknown as Prisma.InputJsonValue,
        completedAt: new Date(),
      },
    });
    logCanvasGenerationTaskFailure(updated, task.project.userId);
    logKieEvent("warn", "[canvas] task failed", {
      taskId,
      kind: task.kind,
      failCode: record.failCode,
      failMsg: record.failMsg,
    });
  }
}

/** 混元生3D 等非 KIE 异步任务 poll 结果落库 */
export async function applyCanvasGatewayPollResult(
  taskId: string,
  poll: CanvasGatewayPollResult,
): Promise<void> {
  const task = await prisma.canvasGenerationTask.findUnique({
    where: { id: taskId },
    include: { project: true },
  });
  if (!task) {
    logKieEvent("warn", "[canvas] applyGatewayPollResult: task not found", {
      taskId,
    });
    return;
  }
  if (task.status === "SUCCEEDED" || task.status === "CANCELLED") return;
  if (!(await claimCanvasTaskForResultApply(taskId))) return;

  if (poll.state === "failed") {
    const updated = await prisma.canvasGenerationTask.update({
      where: { id: taskId },
      data: {
        status: "FAILED",
        failCode: poll.errorCode ?? "PROVIDER_FAILED",
        failMessage: poll.errorMessage?.slice(0, 500) ?? null,
        resultPayload: (poll.rawPayload ?? null) as Prisma.InputJsonValue,
        completedAt: new Date(),
      },
    });
    logCanvasGenerationTaskFailure(updated, task.project.userId);
    return;
  }

  if (poll.state !== "succeeded") return;

  const { previewUrl, modelUrl } = extractHunyuan3DResultUrls(poll);
  const imageEphemeral = previewUrl;
  if (!imageEphemeral) {
    if (modelUrl) {
      await prisma.canvasGenerationTask.update({
        where: { id: taskId },
        data: {
          status: "SUCCEEDED",
          ephemeralUrl: modelUrl,
          resultPayload: (poll.rawPayload ?? null) as Prisma.InputJsonValue,
          completedAt: new Date(),
        },
      });
      logKieEvent("info", "[canvas] gateway task succeeded (model only)", {
        taskId,
        modelUrl,
      });
      return;
    }
    await prisma.canvasGenerationTask.update({
      where: { id: taskId },
      data: {
        status: "FAILED",
        failCode: "PROVIDER_NO_RESULT_URL",
        failMessage: "Provider returned success but resultUrls empty",
        resultPayload: (poll.rawPayload ?? null) as Prisma.InputJsonValue,
        completedAt: new Date(),
      },
    });
    return;
  }

  let ossUrl: string | null = null;
  let ossError: string | null = null;
  try {
    ossUrl = await persistCanvasKieResultToOss({
      ephemeralUrl: imageEphemeral,
      kind: "node-image",
      projectId: task.projectId,
    });
  } catch (e) {
    ossError = e instanceof Error ? e.message : String(e);
    logKieEvent("error", "[canvas] persistGatewayResultToOss failed", {
      taskId,
      imageEphemeral,
      ossError,
    });
  }

  if (!ossUrl) {
    await prisma.canvasGenerationTask.update({
      where: { id: taskId },
      data: {
        status: "FAILED",
        failCode: "OSS_UPLOAD_FAILED",
        failMessage: ossError ?? "OSS upload failed",
        ephemeralUrl: imageEphemeral,
        resultPayload: (poll.rawPayload ?? null) as Prisma.InputJsonValue,
        completedAt: new Date(),
      },
    });
    return;
  }

  await prisma.canvasGenerationTask.update({
    where: { id: taskId },
    data: {
      status: "SUCCEEDED",
      ossUrl,
      ephemeralUrl: modelUrl ?? imageEphemeral,
      resultPayload: (poll.rawPayload ?? null) as Prisma.InputJsonValue,
      completedAt: new Date(),
    },
  });
  logKieEvent("info", "[canvas] gateway task succeeded", {
    taskId,
    kind: task.kind,
    ossUrl,
    modelUrl,
  });
}

// —— Polling worker ——

/**
 * 后台疏导轮询的「交通管制」：
 * - 全局单飞：同一进程同一时刻只跑一个 opportunistic poll，避免多项目 / 多请求
 *   并发触发 runCanvasPollWorker（内部对 DB 大量突发查询）把连接池（如 limit=4）打满，
 *   进而拖死准入校验等热路径（getByokToolAccess 取不到连接而 30s 超时）。
 * - 每项目节流：同项目最短间隔内不重复触发。
 * 正式环境仍由独立 poll-loop / cron 进程推进，此处仅为兜底，跳过无副作用。
 */
let opportunisticPollInFlight = false;
const lastOpportunisticPollByProject = new Map<string, number>();
const OPPORTUNISTIC_POLL_MIN_GAP_MS = 8000;

/** 单飞 + 每项目节流的 fire-and-forget 轮询（内部用，不做开关判断） */
function kickCanvasPollSingleFlight(projectId: string): void {
  if (process.env.CANVAS_DISABLE_OPPORTUNISTIC_POLL === "1") return;
  const now = Date.now();
  const last = lastOpportunisticPollByProject.get(projectId) ?? 0;
  if (now - last < OPPORTUNISTIC_POLL_MIN_GAP_MS) return;
  // 全局单飞：已有后台轮询在跑就直接跳过，绝不并发抢连接
  if (opportunisticPollInFlight) return;
  lastOpportunisticPollByProject.set(projectId, now);
  opportunisticPollInFlight = true;
  void runCanvasPollWorker({ projectId })
    .catch((e) => {
      console.warn("[canvas] opportunistic poll failed", {
        projectId,
        error: e instanceof Error ? e.message : String(e),
      });
    })
    .finally(() => {
      opportunisticPollInFlight = false;
    });
}

/**
 * 读路径（项目读 / 任务读）兜底轮询：**仅推进用户正在看的单个项目**。
 *
 * 注意与 `log-read-poll-guard` 里的「全量」poll worker 区分：
 * 那里跑 `runCanvasPollWorker()`（无 projectId、batch 100、扫全表），web 进程跑会占满
 * 连接池，故仍只在独立 poll-loop / `CANVAS_OPPORTUNISTIC_POLL=1` 时跑。
 *
 * 而此处是 **项目作用域** 单飞轮询（`{ projectId }`）：开销极小，且已有
 *  - 全局单飞（`opportunisticPollInFlight`，整进程同一时刻仅一条）
 *  - 每项目 8s 节流（`OPPORTUNISTIC_POLL_MIN_GAP_MS`）
 *  - 并发封顶（web 进程 = 2 路，见 getEffectiveGenerationPollConcurrency）
 *  - kill-switch `CANVAS_DISABLE_OPPORTUNISTIC_POLL=1`
 * 因此默认 **开启**：用户盯着画布、视频在厂商侧已完成时，无需干等下一轮 SCF（最长 60s+）
 * 即可被检测并回写完成，消除「厂商早就好了、画布还在转」的滞后。
 */
export function scheduleOpportunisticCanvasPoll(projectId: string): void {
  kickCanvasPollSingleFlight(projectId);
}

/**
 * 提交 KIE 任务后异步 poll 一次（写路径），避免仅依赖 cron/回调。
 * 非读路径，不受 Phase 1 读兜底开关约束，但仍走单飞管制。
 */
export function scheduleCanvasPollWorkerForProject(projectId: string): void {
  kickCanvasPollSingleFlight(projectId);
}

const POLL_INNER_TIMEOUT_MS = getGenerationPollInnerTimeoutMs();
const RETRY_PENDING_LIMIT = 3;
/** ai-engine 同步 LLM 若进程中断，PENDING 任务超过此时间则标记失败 */
const TEXT_PENDING_STALE_MS = 15 * 60 * 1000;
/** runImageEngineNode 在 API 内同步提交 Gateway；此窗口内 poll 不得二次 createTask（防 KIE 双扣） */
const SYNC_GATEWAY_SUBMIT_GRACE_MS = 2 * 60 * 1000;

/**
 * poll worker 仅对「KIE 异步出图」的 PENDING 任务重试 createTask。
 * v1 image-gen 的 inputPayload 即 KIE input；v2 image-engine 包一层 kind。
 * TEXT / ai-engine 为同步 LLM，不得走 createTask。
 */
function resolvePendingKieCreateArgs(
  task: Pick<CanvasGenerationTask, "kind" | "model" | "inputPayload">,
): CreateKieTaskArgs | null {
  if (task.kind !== "IMAGE") return null;
  const payload = task.inputPayload;
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;

  if (p.kind === "ai-engine") return null;

  if (p.kind === "image-engine" || p.kind === "three-view-engine") {
    const providerId = String(p.providerId ?? "");
    if (
      providerId === SYSTEM_HUNYUAN_3D_PROVIDER_ID ||
      task.model === "hunyuan-3d-pro" ||
      task.model === "hunyuan-3d-express"
    ) {
      return null;
    }
    const prompt = String(p.prompt ?? "").trim();
    if (!prompt) return null;
    const params = (p.params as Record<string, unknown>) ?? {};
    const imageUrls = Array.isArray(p.imageUrls)
      ? p.imageUrls.filter(
          (u): u is string => typeof u === "string" && /^https?:\/\//.test(u),
        )
      : [];
    return buildKieImageCreateArgs({
      modelKey: task.model,
      prompt,
      imageUrls,
      params,
    }) as CreateKieTaskArgs;
  }

  if (p.kind === "video-engine") {
    const kieModel = String(p.kieModel ?? task.model);
    const kieInput = p.kieInput;
    if (!kieInput || typeof kieInput !== "object") return null;
    return {
      model: kieModel,
      input: kieInput as KieVideoInput,
    };
  }

  if (p.kind === "ai-video-engine" && p.providerKind === "KIE") {
    const kieModel = String(p.kieModel ?? task.model);
    const kieInput = p.kieInput;
    if (!kieInput || typeof kieInput !== "object") return null;
    return {
      model: kieModel,
      input: kieInput as KieVideoInput,
    };
  }

  if (p.kind === "ai-video-engine" && p.providerKind === "BAILIAN_R2V") {
    return null;
  }

  if (p.kind === "tts-engine") return null;

  // v1 image-gen：inputPayload 本身就是 KIE input（gpt-image-1 需重新映射）
  if (typeof p.prompt === "string" && p.prompt.trim()) {
    if (task.model === "gpt-image-1") {
      const imageUrls = Array.isArray(p.image_input)
        ? p.image_input.filter(
            (u): u is string => typeof u === "string" && /^https?:\/\//.test(u),
          )
        : [];
      return buildKieImageCreateArgs({
        modelKey: task.model,
        prompt: p.prompt,
        imageUrls,
        params: {
          aspect_ratio: p.aspect_ratio,
          quality: p.quality,
        },
      }) as CreateKieTaskArgs;
    }
    return { model: task.model, input: p as KieImageInput };
  }

  return null;
}

function resolveKieCallbackKind(
  task: Pick<CanvasGenerationTask, "inputPayload">,
): "image" | "video" {
  const payload = task.inputPayload;
  if (payload && typeof payload === "object") {
    const kind = (payload as Record<string, unknown>).kind;
    if (kind === "video-engine" || kind === "ai-video-engine") return "video";
  }
  return "image";
}

function shouldPollNow(
  task: Pick<CanvasGenerationTask, "lastPolledAt" | "pollCount">,
): boolean {
  if (!task.lastPolledAt) return true;
  const intervalSec = Math.min(2 * 2 ** task.pollCount, 60);
  return Date.now() - task.lastPolledAt.getTime() >= intervalSec * 1000;
}

/** image-engine / three-view-engine 由 run API 同步调 Gateway；短时内勿让 poll 再 createTask */
function shouldDeferPollSyncGatewaySubmit(
  task: Pick<CanvasGenerationTask, "createdAt" | "inputPayload">,
): boolean {
  const payload = task.inputPayload;
  if (!payload || typeof payload !== "object") return false;
  const p = payload as Record<string, unknown>;
  if (p.syncGatewaySubmit !== true) return false;
  return Date.now() - task.createdAt.getTime() < SYNC_GATEWAY_SUBMIT_GRACE_MS;
}

/** SUBMITTED 异步出图：固定短间隔；超 800s 预警任务每轮必 poll；百炼 R2V 用 15s */
function shouldPollSubmittedNow(
  task: Pick<
    CanvasGenerationTask,
    "lastPolledAt" | "submittedAt" | "createdAt" | "inputPayload"
  >,
): boolean {
  if (
    isSlowGenerationAge(task.submittedAt, task.createdAt)
  ) {
    return true;
  }
  if (!task.lastPolledAt) return true;
  const payload = taskInputPayload(task);
  const intervalMs = isCanvasBailianR2vVideoTaskPayload(payload)
    ? CANVAS_BAILIAN_R2V_POLL_INTERVAL_MS
    : 3_000;
  return Date.now() - task.lastPolledAt.getTime() >= intervalMs;
}

type SubmittedCanvasPollTask = CanvasGenerationTask & {
  project: { userId: string };
};

/** 对单条 SUBMITTED 任务拉一次 Gateway 状态；终态则写回任务表。 */
async function pollOneSubmittedCanvasTask(
  task: SubmittedCanvasPollTask,
): Promise<"succeeded" | "failed" | "pending"> {
  const before = task.status;
  let payload = taskInputPayload(task) ?? {};
  const useGateway = await shouldCanvasTaskUseGateway(
    task.project.userId,
    payload,
  );

  if (!useGateway) {
    await prisma.canvasGenerationTask.update({
      where: { id: task.id },
      data: {
        status: "FAILED",
        failCode: "GATEWAY_LEGACY_TASK",
        failMessage: "旧任务须经 Gateway，请重新生成",
        completedAt: new Date(),
        lastPolledAt: new Date(),
        pollCount: task.pollCount + 1,
      },
    });
    return "failed";
  }

  if (task.kind === "TEXT") {
    const textOutcome = await recoverCanvasTextLlmFromGateway(task.id);
    if (textOutcome === "succeeded") return "succeeded";
    if (textOutcome === "failed") return "failed";
    if (textOutcome === "pending") {
      await prisma.canvasGenerationTask.update({
        where: { id: task.id },
        data: { lastPolledAt: new Date(), pollCount: task.pollCount + 1 },
      });
      return "pending";
    }
  }

  const linked = await backfillCanvasTaskGatewayLink({
    taskId: task.id,
    kieTaskId: task.kieTaskId,
    payload,
  });
  if (linked) {
    payload = linked.payload;
  }
  const gatewayLogId =
    linked?.gatewayLogId ??
    (typeof payload.gatewayLogId === "string" ? payload.gatewayLogId.trim() : "");
  const kieTaskId =
    linked?.kieTaskId ?? task.kieTaskId?.trim() ?? "";

  if (!gatewayLogId || !kieTaskId) {
    await prisma.canvasGenerationTask.update({
      where: { id: task.id },
      data: {
        status: "FAILED",
        failCode: "GATEWAY_LEGACY_TASK",
        failMessage: "旧任务无 Gateway 日志，请重新生成",
        completedAt: new Date(),
        lastPolledAt: new Date(),
        pollCount: task.pollCount + 1,
      },
    });
    return "failed";
  }
  const gatewayLog = await prisma.gatewayRequestLog.findUnique({
    where: { id: gatewayLogId },
    select: {
      status: true,
      failCode: true,
      failMessage: true,
      resultSummary: true,
      providerKind: true,
    },
  });
  if (gatewayLog?.status === "SUCCEEDED") {
    const providerKind = gatewayProviderKindFromPayload(payload);
    const logProvider = gatewayLog.providerKind ?? providerKind;
    if (logProvider === "KIE") {
      const { kieRecordFromGatewaySummary } = await import(
        "@/lib/canvas/canvas-kie-image-recover"
      );
      const { isKieRecordSuccess } = await import("@/lib/story/kie-client");
      const record = kieRecordFromGatewaySummary(
        gatewayLog.resultSummary,
        task.kieTaskId ?? "",
        task.model,
      );
      if (record && isKieRecordSuccess(record.state)) {
        await applyCanvasKieTaskResult(task.id, record);
        const afterKie = await prisma.canvasGenerationTask.findUnique({
          where: { id: task.id },
          select: { status: true },
        });
        await prisma.canvasGenerationTask.update({
          where: { id: task.id },
          data: { lastPolledAt: new Date(), pollCount: task.pollCount + 1 },
        });
        if (afterKie?.status === "SUCCEEDED" && before !== "SUCCEEDED") {
          return "succeeded";
        }
        if (afterKie?.status === "FAILED" && before !== "FAILED") {
          return "failed";
        }
        return "pending";
      }
      const recovered = await recoverCanvasKieImageFromGateway(task.id);
      if (recovered === "succeeded" || recovered === "failed") {
        const afterRecover = await prisma.canvasGenerationTask.findUnique({
          where: { id: task.id },
          select: { status: true },
        });
        await prisma.canvasGenerationTask.update({
          where: { id: task.id },
          data: { lastPolledAt: new Date(), pollCount: task.pollCount + 1 },
        });
        if (afterRecover?.status === "SUCCEEDED" && before !== "SUCCEEDED") {
          return "succeeded";
        }
        if (afterRecover?.status === "FAILED" && before !== "FAILED") {
          return "failed";
        }
      }
    }
    if (
      providerKind === "VOLCENGINE" ||
      gatewayLog.providerKind === "VOLCENGINE"
    ) {
      const videoUrl = extractVolcengineVideoUrlFromGatewaySummary(
        gatewayLog.resultSummary,
      );
      if (videoUrl) {
        await applyCanvasVolcengineVideoResult(task.id, videoUrl);
        const after = await prisma.canvasGenerationTask.findUnique({
          where: { id: task.id },
          select: { status: true },
        });
        await prisma.canvasGenerationTask.update({
          where: { id: task.id },
          data: { lastPolledAt: new Date(), pollCount: task.pollCount + 1 },
        });
        if (after?.status === "SUCCEEDED" && before !== "SUCCEEDED") {
          return "succeeded";
        }
        if (after?.status === "FAILED" && before !== "FAILED") {
          return "failed";
        }
        return "pending";
      }
    }
    if (
      providerKind === "BAILIAN" ||
      gatewayLog.providerKind === "BAILIAN"
    ) {
      const videoUrl = extractBailianR2vVideoUrlFromGatewaySummary(
        gatewayLog.resultSummary,
      );
      if (videoUrl) {
        await applyCanvasBailianR2vPollResult(task.id, {
          ok: true,
          output: { task_status: "SUCCEEDED", video_url: videoUrl },
          raw: gatewayLog.resultSummary,
        });
        const after = await prisma.canvasGenerationTask.findUnique({
          where: { id: task.id },
          select: { status: true },
        });
        await prisma.canvasGenerationTask.update({
          where: { id: task.id },
          data: { lastPolledAt: new Date(), pollCount: task.pollCount + 1 },
        });
        if (after?.status === "SUCCEEDED" && before !== "SUCCEEDED") {
          return "succeeded";
        }
        if (after?.status === "FAILED" && before !== "FAILED") {
          return "failed";
        }
        return "pending";
      }
    }
  } else if (gatewayLog?.status === "FAILED") {
    const stallFail =
      gatewayLog.failCode === "VOLCENGINE_GATEWAY_POLL_STALL" ||
      (gatewayLog.failMessage?.includes("停更") ?? false);
    if (stallFail && isCanvasVolcengineVideoTaskPayload(payload)) {
      const recovered = await recoverCanvasVideoTaskDisplay(task.id);
      await prisma.canvasGenerationTask.update({
        where: { id: task.id },
        data: { lastPolledAt: new Date(), pollCount: task.pollCount + 1 },
      });
      if (recovered.ok && recovered.action !== "failed") {
        const after = await prisma.canvasGenerationTask.findUnique({
          where: { id: task.id },
          select: { status: true },
        });
        if (after?.status === "SUCCEEDED") return "succeeded";
        if (after?.status === "FAILED") return "failed";
      }
      return "pending";
    }
    await prisma.canvasGenerationTask.update({
      where: { id: task.id },
      data: {
        status: "FAILED",
        failCode: gatewayLog.failCode ?? "GATEWAY_TASK_FAILED",
        failMessage:
          gatewayLog.failMessage?.slice(0, 500) ??
          "Gateway 任务失败，请查看状态页日志",
        completedAt: new Date(),
        lastPolledAt: new Date(),
        pollCount: task.pollCount + 1,
      },
    });
    return "failed";
  }

  if (
    isSlowGenerationAge(task.submittedAt, task.createdAt) &&
    (isCanvasVolcengineVideoTaskPayload(payload) ||
      isCanvasBailianR2vVideoTaskPayload(payload) ||
      isCanvasKieVideoTaskPayload(payload))
  ) {
    const recovered = await recoverCanvasVideoTaskDisplay(task.id);
    if (recovered.ok && recovered.action !== "noop" && recovered.action !== "failed") {
      const afterRecover = await prisma.canvasGenerationTask.findUnique({
        where: { id: task.id },
        select: { status: true },
      });
      await prisma.canvasGenerationTask.update({
        where: { id: task.id },
        data: { lastPolledAt: new Date(), pollCount: task.pollCount + 1 },
      });
      if (afterRecover?.status === "SUCCEEDED") return "succeeded";
      if (afterRecover?.status === "FAILED") return "failed";
    }
  }

  const providerKind = gatewayProviderKindFromPayload(payload);
  const gw = await Promise.race([
    canvasGwRecordInfo(task.project.userId, {
      taskId: kieTaskId,
      providerKind,
      gatewayLogId,
    }),
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error("gateway recordInfo timeout")),
        POLL_INNER_TIMEOUT_MS,
      ),
    ),
  ]);

  if (gw.providerKind === "BAILIAN") {
    await applyCanvasBailianR2vPollResult(task.id, {
      ok: true,
      output: gw.output,
      raw: gw.output,
    });
  } else if (gw.providerKind === "KIE") {
    await applyCanvasKieTaskResult(task.id, gw.record);
  } else if (gw.providerKind === "VOLCENGINE") {
    const row = gw.task;
    if (isVolcengineVideoTaskSuccess(row)) {
      await applyCanvasVolcengineVideoResult(task.id, row.content?.video_url);
    } else if (isVolcengineVideoTaskFailed(row)) {
      await prisma.canvasGenerationTask.update({
        where: { id: task.id },
        data: {
          status: "FAILED",
          failCode: "VOLCENGINE_TASK_FAILED",
          failMessage:
            typeof row.error === "string"
              ? row.error
              : (row.error?.message ?? `status=${row.status}`),
          completedAt: new Date(),
        },
      });
    }
  } else if (gw.providerKind === "HUNYUAN") {
    const polled = gw.polled;
    if (polled.state === "succeeded" && polled.resultUrls?.[0]) {
      await prisma.canvasGenerationTask.update({
        where: { id: task.id },
        data: {
          status: "SUCCEEDED",
          ossUrl: polled.resultUrls[0],
          completedAt: new Date(),
        },
      });
    } else if (polled.state === "failed") {
      await prisma.canvasGenerationTask.update({
        where: { id: task.id },
        data: {
          status: "FAILED",
          failCode: polled.errorCode ?? "HUNYUAN_FAILED",
          failMessage: polled.errorMessage?.slice(0, 500),
          completedAt: new Date(),
        },
      });
    }
  } else if (gw.providerKind === "DASHSCOPE") {
    await applyCanvasDashscopeImagePollResult(task.id, gw.output);
  } else if (gw.providerKind === "TOPAZ") {
    const polled = gw.polled;
    if (polled.state === "succeeded" && polled.downloadUrl) {
      await applyCanvasVolcengineVideoResult(task.id, polled.downloadUrl);
    } else if (polled.state === "failed") {
      await prisma.canvasGenerationTask.update({
        where: { id: task.id },
        data: {
          status: "FAILED",
          failCode: "TOPAZ_VIDEO_FAILED",
          failMessage: polled.errorMessage?.slice(0, 500) ?? "Topaz video failed",
          completedAt: new Date(),
        },
      });
    }
  }

  const after = await prisma.canvasGenerationTask.findUnique({
    where: { id: task.id },
    select: { status: true },
  });
  await prisma.canvasGenerationTask.update({
    where: { id: task.id },
    data: { lastPolledAt: new Date(), pollCount: task.pollCount + 1 },
  });

  if (after?.status === "SUCCEEDED" && before !== "SUCCEEDED") return "succeeded";
  if (after?.status === "FAILED" && before !== "FAILED") return "failed";
  return "pending";
}

type SubmittedPollDelta = {
  scanned: number;
  succeeded: number;
  failed: number;
  timedOut: number;
};

/** 推进单条 SUBMITTED 任务（供并行 poll worker 调用）。 */
async function advanceOneSubmittedCanvasTask(
  task: SubmittedCanvasPollTask,
  now: number,
): Promise<SubmittedPollDelta> {
  const delta: SubmittedPollDelta = {
    scanned: 1,
    succeeded: 0,
    failed: 0,
    timedOut: 0,
  };
  if (!task.kieTaskId) return delta;
  if (!shouldPollSubmittedNow(task)) {
    delta.scanned = 0;
    return delta;
  }

  const timeoutMs = resolveCanvasSubmittedTaskTimeoutMs(task);
  const timeoutMin = resolveCanvasSubmittedTaskTimeoutMin(task);
  const submittedTs = (task.submittedAt ?? task.createdAt).getTime();
  if (now - submittedTs >= timeoutMs) {
    let finalPollError: string | undefined;
    try {
      const outcome = await pollOneSubmittedCanvasTask(task);
      if (outcome === "succeeded") {
        delta.succeeded = 1;
        return delta;
      }
      if (outcome === "failed") {
        delta.failed = 1;
        return delta;
      }
    } catch (e) {
      finalPollError = e instanceof Error ? e.message : String(e);
      logKieEvent("warn", "[canvas] final poll before timeout error", {
        taskId: task.id,
        msg: finalPollError,
      });
    }

    const afterFinalPoll = await prisma.canvasGenerationTask.findUnique({
      where: { id: task.id },
      select: { status: true },
    });
    if (afterFinalPoll?.status === "SUCCEEDED") {
      delta.succeeded = 1;
      return delta;
    }
    if (afterFinalPoll?.status === "FAILED") {
      delta.failed = 1;
      return delta;
    }

    const diagnosis = await probeCanvasSubmittedTaskAtTimeout({
      task,
      timeoutMin,
      waitedMs: now - submittedTs,
      finalPollError,
    });

    if (
      diagnosis.cause === "vendor_already_succeeded" &&
      diagnosis.videoUrl?.trim()
    ) {
      const payload = taskInputPayload(task);
      if (isCanvasBailianR2vVideoTaskPayload(payload)) {
        await applyCanvasBailianR2vPollResult(task.id, {
          ok: true,
          output: {
            task_status: "SUCCEEDED",
            video_url: diagnosis.videoUrl.trim(),
          },
          raw: { recoveredFromTimeoutProbe: true },
        });
      } else {
        await applyCanvasVolcengineVideoResult(task.id, diagnosis.videoUrl);
      }
      const recovered = await prisma.canvasGenerationTask.findUnique({
        where: { id: task.id },
        select: { status: true },
      });
      if (recovered?.status === "SUCCEEDED") {
        logKieEvent("warn", "[canvas] timeout probe recovered vendor success", {
          taskId: task.id,
          cause: diagnosis.cause,
          vendorStatus: diagnosis.vendorStatus,
        });
        delta.succeeded = 1;
        return delta;
      }
    }

    logKieEvent("warn", "[canvas] task timeout", {
      taskId: task.id,
      nodeId: task.nodeId,
      projectId: task.projectId,
      kieTaskId: task.kieTaskId,
      cause: diagnosis.cause,
      vendorStatus: diagnosis.vendorStatus,
      gatewayLogStatus: diagnosis.gatewayLogStatus,
      timeoutMin,
      waitedMs: now - submittedTs,
      pollCount: task.pollCount,
      finalPollError,
      probeError: diagnosis.probeError,
    });

    const failFields = buildCanvasTimeoutFailFields(task, diagnosis);
    const payload = taskInputPayload(task);
    const gatewayLogId =
      typeof payload?.gatewayLogId === "string"
        ? payload.gatewayLogId.trim()
        : "";
    await prisma.canvasGenerationTask.update({
      where: { id: task.id },
      data: {
        status: "FAILED",
        failCode: failFields.failCode,
        failMessage: failFields.failMessage,
        resultPayload: failFields.resultPayload,
        lastPolledAt: new Date(),
        pollCount: task.pollCount + 1,
        completedAt: new Date(),
      },
    });
    if (gatewayLogId) {
      await failGatewayLogIfStillRunning({
        gatewayLogId,
        durationMs: now - submittedTs,
        timeoutMin,
        externalTaskId: task.kieTaskId,
      });
    }
    delta.timedOut = 1;
    return delta;
  }

  try {
    const outcome = await pollOneSubmittedCanvasTask(task);
    if (outcome === "succeeded") delta.succeeded = 1;
    else if (outcome === "failed") delta.failed = 1;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logKieEvent("warn", "[canvas] poll iteration error", {
      taskId: task.id,
      msg,
    });
    await prisma.canvasGenerationTask.update({
      where: { id: task.id },
      data: {
        lastPolledAt: new Date(),
        pollCount: task.pollCount + 1,
        ...buildCanvasPollErrorPatch(task, msg),
      },
    });
  }
  return delta;
}

/** 全局交通对账（RUNNING 超时释放 + 槽位计数纠偏）最小间隔，避免每 10s 都扫全表 */
const TRAFFIC_RECONCILE_MIN_GAP_MS = (() => {
  const raw = Number(process.env.TRAFFIC_RECONCILE_MIN_GAP_MS ?? "");
  return Number.isFinite(raw) && raw >= 10_000 ? raw : 60_000;
})();
let lastTrafficReconcileAt = 0;

export async function runCanvasPollWorker(opts?: {
  /** 仅推进指定项目的任务（项目页 GET / 提交后按需 poll 用） */
  projectId?: string;
}): Promise<{
  scanned: number;
  retried: number;
  succeeded: number;
  failed: number;
  timedOut: number;
}> {
  const result = { scanned: 0, retried: 0, succeeded: 0, failed: 0, timedOut: 0 };
  const projectFilter = opts?.projectId ? { projectId: opts.projectId } : {};

  await dispatchQueuedCanvasTasks({ projectId: opts?.projectId }).catch(() => undefined);

  try {
    const { reconcileCanvasInflightZombies } = await import(
      "@/lib/canvas/canvas-inflight-zombie-reconcile"
    );
    const zombies = await reconcileCanvasInflightZombies({
      projectId: opts?.projectId,
      limit: 25,
    });
    if (
      zombies.failedIncomplete > 0 ||
      zombies.requeuedDispatching > 0 ||
      zombies.displayRecovered > 0
    ) {
      logKieEvent("info", "[canvas] inflight-zombie-reconcile", zombies);
    }
  } catch (e) {
    logKieEvent("warn", "[canvas] inflight-zombie-reconcile error", {
      error: e instanceof Error ? e.message : String(e),
    });
  }

  // 全局看门狗：异常检测 + 修复（释放超时 RUNNING、纠偏槽位、回收 stale DISPATCHING）。
  // 仅全局轮询触发、按 TRAFFIC_RECONCILE_MIN_GAP_MS 限频；dispatch 已在上方完成故传 false。
  if (
    !opts?.projectId &&
    Date.now() - lastTrafficReconcileAt >= TRAFFIC_RECONCILE_MIN_GAP_MS
  ) {
    lastTrafficReconcileAt = Date.now();
    try {
      const { reconcileGenerationTraffic } = await import(
        "@/lib/generation/traffic-control/reconcile"
      );
      const r = await reconcileGenerationTraffic({ dispatch: false });
      if (
        r.releasedReserve > 0 ||
        r.failedRunningLogs > 0 ||
        r.reconciledSlots > 0 ||
        r.staleDispatching > 0
      ) {
        logKieEvent("info", "[canvas] traffic-watchdog reconcile", r);
      }
    } catch (e) {
      logKieEvent("warn", "[canvas] traffic-watchdog reconcile error", {
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  if (opts?.projectId) {
    try {
      const auto = await maybeRunSlowWarnAutoHandler({ limit: 8, force: true });
      if (
        auto.gatewaySucceededSync > 0 ||
        auto.slowCanvasRecovered > 0 ||
        auto.slowGatewayRecovered > 0
      ) {
        logKieEvent("info", "[canvas] slow-warn auto", auto);
      }
    } catch {
      /* ignore */
    }
  }

  // 1) PENDING（KIE createTask 失败 / 中断）：仅 IMAGE 异步出图重试
  const pendings = await prisma.canvasGenerationTask.findMany({
    where: { status: "PENDING", pollCount: { lt: RETRY_PENDING_LIMIT }, ...projectFilter },
    orderBy: { createdAt: "asc" },
    take: getGenerationPollBatch(),
    include: { project: { select: { userId: true } } },
  });
  for (const task of pendings) {
    result.scanned++;

    // ai-engine 同步 LLM 若遗留 PENDING（进程崩溃等），超时后标记失败
    if (task.kind === "TEXT") {
      if (Date.now() - task.createdAt.getTime() >= TEXT_PENDING_STALE_MS) {
        await prisma.canvasGenerationTask.update({
          where: { id: task.id },
          data: {
            status: "FAILED",
            failCode: "SYNC_LLM_STALE",
            failMessage: "sync LLM task stuck in PENDING (server interrupted?)",
            completedAt: new Date(),
            lastPolledAt: new Date(),
          },
        });
        result.failed++;
      }
      continue;
    }

    const fresh = await prisma.canvasGenerationTask.findUnique({
      where: { id: task.id },
      select: { status: true, kieTaskId: true, submittedAt: true },
    });
    if (fresh?.kieTaskId) {
      if (fresh.status === "PENDING") {
        await prisma.canvasGenerationTask.update({
          where: { id: task.id },
          data: {
            status: "SUBMITTED",
            submittedAt: fresh.submittedAt ?? new Date(),
            lastPolledAt: new Date(),
          },
        });
      }
      continue;
    }

    const payload = taskInputPayload(task);
    const useGateway = await shouldCanvasTaskUseGateway(
      task.project.userId,
      payload,
    );

    if (
      useGateway &&
      payload?.providerKind === "BAILIAN_R2V" &&
      !fresh?.kieTaskId
    ) {
      if (!shouldPollNow(task)) continue;
      if (shouldDeferPollSyncGatewaySubmit(task)) continue;

      const existingLogId =
        typeof payload.gatewayLogId === "string"
          ? payload.gatewayLogId.trim()
          : "";
      if (existingLogId) {
        const log = await prisma.gatewayRequestLog.findUnique({
          where: { id: existingLogId },
          select: { externalTaskId: true, status: true },
        });
        if (log?.externalTaskId) {
          await prisma.canvasGenerationTask.update({
            where: { id: task.id },
            data: {
              status: "SUBMITTED",
              kieTaskId: log.externalTaskId,
              submittedAt: new Date(),
              lastPolledAt: new Date(),
            },
          });
          result.retried++;
          continue;
        }
        if (log?.status === "RUNNING") continue;
      }

      const claim = await claimCanvasTaskKieSubmit(task.id);
      if (!claim.claimed) continue;

      const refs = Array.isArray(payload.referenceImageUrls)
        ? payload.referenceImageUrls.filter(
            (u): u is string =>
              typeof u === "string" && /^https?:\/\//.test(u),
          )
        : [];
      const params = (payload.params as Record<string, unknown>) ?? {};
      const resolution = /^720p$/i.test(String(params.resolution ?? ""))
        ? "720P"
        : "1080P";
      const modelKey = String(payload.modelKey ?? task.model);
      try {
        const job = await Promise.race([
          canvasGwCreateBailianR2vJob(task.project.userId, {
            model: modelKey,
            prompt: String(payload.prompt ?? ""),
            referenceImageUrls: refs,
            resolution,
            ratio: String(params.ratio ?? params.aspect_ratio ?? "16:9"),
            duration: Number(params.duration ?? 5),
            seedStr: String(params.seed ?? ""),
            parameterExtras:
              modelKey.startsWith("wan2.")
                ? { prompt_extend: params.prompt_extend !== false }
                : undefined,
            clientPage: resolveCanvasTaskClientPage(task.projectId, payload),
          }),
          new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error("createTask retry timeout")),
              POLL_INNER_TIMEOUT_MS,
            ),
          ),
        ]);
        await prisma.canvasGenerationTask.update({
          where: { id: task.id },
          data: {
            status: "SUBMITTED",
            kieTaskId: job.taskId,
            submittedAt: new Date(),
            lastPolledAt: new Date(),
            pollCount: task.pollCount + 1,
            inputPayload: {
              ...payload,
              gatewayLogId: job.logId,
              gatewayKieSubmitClaimed: true,
              syncGatewaySubmit: true,
            } as Prisma.InputJsonValue,
          },
        });
        result.retried++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const nextCount = task.pollCount + 1;
        const failed = nextCount >= RETRY_PENDING_LIMIT;
        await prisma.canvasGenerationTask.update({
          where: { id: task.id },
          data: {
            lastPolledAt: new Date(),
            pollCount: nextCount,
            ...(failed
              ? {
                  status: "FAILED" as CanvasGenerationStatus,
                  failCode: "BAILIAN_CREATE_RETRIES_EXHAUSTED",
                  failMessage: msg.slice(0, 500),
                  completedAt: new Date(),
                }
              : { failMessage: msg.slice(0, 500) }),
          },
        });
        if (failed) result.failed++;
      }
      continue;
    }

    const createArgs = resolvePendingKieCreateArgs(task);
    if (!createArgs) continue;
    if (shouldDeferPollSyncGatewaySubmit(task)) continue;

    const claim = await claimCanvasTaskKieSubmit(task.id);
    if (!claim.claimed) {
      const freshClaim = await prisma.canvasGenerationTask.findUnique({
        where: { id: task.id },
        select: { status: true, kieTaskId: true, submittedAt: true, inputPayload: true },
      });
      if (freshClaim?.kieTaskId) {
        if (freshClaim.status === "PENDING") {
          await prisma.canvasGenerationTask.update({
            where: { id: task.id },
            data: {
              status: "SUBMITTED",
              submittedAt: freshClaim.submittedAt ?? new Date(),
              lastPolledAt: new Date(),
            },
          });
        }
        continue;
      }
      const p = freshClaim?.inputPayload;
      if (
        p &&
        typeof p === "object" &&
        !Array.isArray(p) &&
        (p as Record<string, unknown>).gatewayKieSubmitClaimed === true
      ) {
        continue;
      }
    }

    if (!shouldPollNow(task)) continue;
    const callBackUrl = buildCanvasAiKieCallbackUrl(
      resolveKieCallbackKind(task),
      task.id,
    );
    try {
      if (!useGateway) {
        const nextCount = task.pollCount + 1;
        const failed = nextCount >= RETRY_PENDING_LIMIT;
        await prisma.canvasGenerationTask.update({
          where: { id: task.id },
          data: {
            lastPolledAt: new Date(),
            pollCount: nextCount,
            ...(failed
              ? {
                  status: "FAILED" as CanvasGenerationStatus,
                  failCode: "GATEWAY_LEGACY_TASK",
                  failMessage: "旧任务须经 Gateway，请重新生成",
                  completedAt: new Date(),
                }
              : {}),
          },
        });
        if (failed) result.failed++;
        continue;
      }

      const job = await Promise.race([
        canvasGwCreateKieJob(task.project.userId, {
          model: createArgs.model,
          input: createArgs.input as Record<string, unknown>,
          callBackUrl,
          clientPage: resolveCanvasTaskClientPage(task.projectId, payload),
        }),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error("createTask retry timeout")),
            POLL_INNER_TIMEOUT_MS,
          ),
        ),
      ]);
      await prisma.canvasGenerationTask.update({
        where: { id: task.id },
        data: {
          status: "SUBMITTED",
          kieTaskId: job.taskId,
          submittedAt: new Date(),
          lastPolledAt: new Date(),
          pollCount: task.pollCount + 1,
          inputPayload: payload
            ? ({
                ...payload,
                gatewayLogId: job.logId,
                providerKind: payload.providerKind ?? "KIE",
              } as Prisma.InputJsonValue)
            : undefined,
        },
      });
      result.retried++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const nextCount = task.pollCount + 1;
      const failed = nextCount >= RETRY_PENDING_LIMIT;
      await prisma.canvasGenerationTask.update({
        where: { id: task.id },
        data: {
          lastPolledAt: new Date(),
          pollCount: nextCount,
          ...(failed
            ? {
                status: "FAILED" as CanvasGenerationStatus,
                failCode: "KIE_CREATE_RETRIES_EXHAUSTED",
                failMessage: msg.slice(0, 500),
                completedAt: new Date(),
              }
            : { failMessage: msg.slice(0, 500) }),
        },
      });
      if (failed) result.failed++;
    }
  }

  // 2) SUBMITTED：并行 poll + 多轮扫描（全站 cron）；单项目仍单轮串行
  const pollBatch = getGenerationPollBatch();
  const scaledPoll = !opts?.projectId;
  const deadline = scaledPoll
    ? Date.now() + getGenerationPollTimeBudgetMs()
    : Number.MAX_SAFE_INTEGER;
  const maxPasses = scaledPoll ? getGenerationPollMaxPasses() : 1;
  const concurrency = scaledPoll ? getEffectiveGenerationPollConcurrency() : 1;

  for (let pass = 0; pass < maxPasses && Date.now() < deadline; pass++) {
    const fetchSize = scaledPoll ? pollShardOverFetchSize(pollBatch) : pollBatch;
    const slowCutoff = new Date(Date.now() - (await resolveGenerationSlowWarnMs()));
    const candidates = await prisma.canvasGenerationTask.findMany({
      where: { status: "SUBMITTED", kieTaskId: { not: null }, ...projectFilter },
      orderBy: [
        { submittedAt: "asc" },
        { lastPolledAt: { sort: "asc", nulls: "first" } },
      ],
      take: fetchSize,
      include: { project: { select: { userId: true } } },
    });
    const submitted = scaledPoll
      ? selectPollShardTasks(
          [...candidates].sort((a, b) => {
            const aSlow =
              (a.submittedAt ?? a.createdAt) <= slowCutoff ? 0 : 1;
            const bSlow =
              (b.submittedAt ?? b.createdAt) <= slowCutoff ? 0 : 1;
            return aSlow - bSlow;
          }),
          pollBatch,
        )
      : candidates;
    if (submitted.length === 0) break;

    const tickNow = Date.now();
    await mapWithConcurrency(
      submitted,
      async (task) => {
        const d = await advanceOneSubmittedCanvasTask(task, tickNow);
        result.scanned += d.scanned;
        result.succeeded += d.succeeded;
        result.failed += d.failed;
        result.timedOut += d.timedOut;
      },
      concurrency,
    );

    const recordPauseMs = getGenerationPollRecordPauseMs();
    if (recordPauseMs > 0 && pass + 1 < maxPasses) {
      await new Promise((r) => setTimeout(r, recordPauseMs));
    }
  }

  try {
    const display = await runCanvasDisplayReconcileWorker({ limit: 25 });
    if (display.recovered > 0 || display.failed > 0) {
      logKieEvent("info", "[canvas] display-reconcile", display);
    }
  } catch (e) {
    logKieEvent("warn", "[canvas] display-reconcile error", {
      msg: e instanceof Error ? e.message : String(e),
    });
  }

  return result;
}

// —— Cleanup worker ——

const CLEANUP_BATCH = 20;
const CLEANUP_RETRY_LIMIT = 3;

export async function runCanvasCleanupWorker(): Promise<{
  scanned: number;
  done: number;
  failed: number;
}> {
  const out = { scanned: 0, done: 0, failed: 0 };
  const items = await prisma.canvasOssCleanupQueue.findMany({
    where: {
      doneAt: null,
      notBefore: { lte: new Date() },
      attempts: { lt: CLEANUP_RETRY_LIMIT },
    },
    orderBy: { notBefore: "asc" },
    take: CLEANUP_BATCH,
  });
  if (items.length === 0) return out;

  let deleteFn: ((url: string) => Promise<void>) | null = null;
  try {
    const mod = await import("@/lib/oss-delete-object");
    if (typeof mod.deleteManagedOssObjectByUrl === "function") {
      deleteFn = async (url) => {
        await mod.deleteManagedOssObjectByUrl(url);
      };
    }
  } catch {
    // 不应到这里；若失败则后面把任务标 failed
  }

  for (const item of items) {
    out.scanned++;
    if (!deleteFn) {
      await prisma.canvasOssCleanupQueue.update({
        where: { id: item.id },
        data: {
          attempts: item.attempts + 1,
          lastError: "oss-delete-object not available",
          lastTriedAt: new Date(),
        },
      });
      out.failed++;
      continue;
    }
    try {
      await deleteFn(item.ossUrl);
      await prisma.canvasOssCleanupQueue.update({
        where: { id: item.id },
        data: { doneAt: new Date(), lastTriedAt: new Date() },
      });
      out.done++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await prisma.canvasOssCleanupQueue.update({
        where: { id: item.id },
        data: {
          attempts: item.attempts + 1,
          lastError: msg.slice(0, 500),
          lastTriedAt: new Date(),
        },
      });
      out.failed++;
    }
  }
  return out;
}

// —— Soft delete for stage 4 ——

/**
 * 软删 task 并把 ossUrl 入清理队列。
 * 调用方（前端 UI）须做两次确认（参 .cursor/rules/destructive-delete-confirmation.mdc）。
 */
export async function softDeleteCanvasTask(args: {
  userId: string;
  projectId: string;
  taskId: string;
}): Promise<{ ok: true }> {
  await assertAccessibleCanvasProject(args.userId, args.projectId);
  const task = await prisma.canvasGenerationTask.findFirst({
    where: { id: args.taskId, projectId: args.projectId },
  });
  if (!task) {
    throw new CanvasProjectError("NOT_FOUND", "task not found", 404);
  }
  await prisma.$transaction(async (tx) => {
    await tx.canvasGenerationTask.update({
      where: { id: args.taskId },
      data: { deletedAt: new Date() },
    });
    if (task.ossUrl) {
      await tx.canvasOssCleanupQueue.create({
        data: {
          source: "canvas-task-soft-delete",
          projectId: args.projectId,
          ossUrl: task.ossUrl,
          notBefore: new Date(),
        },
      });
    }
  });
  return { ok: true };
}

// —— Listing for project tasks API ——

type CanvasGenerationRecordExtras = {
  storyScope?: CanvasTaskStoryScope;
  creditsCharged: number | null;
  billingMode: "PLATFORM_CREDIT" | "BYOK" | null;
  providerLabel: string;
  modelLabel: string;
  posterUrl: string | null;
  thumbnailUrl: string | null;
  previewUrl: string | null;
  previewKind: "image" | "video" | null;
  previewMedia?: Array<{
    url: string;
    kind: "image" | "video";
    label: string;
  }>;
  canvasHistoryId: string | null;
  canRestoreCanvas: boolean;
};

type CanvasGenerationRecordListItem = Pick<
  CanvasGenerationTask,
  | "id"
  | "nodeId"
  | "kind"
  | "status"
  | "model"
  | "ossUrl"
  | "ephemeralUrl"
  | "textOutput"
  | "failCode"
  | "failMessage"
  | "submittedAt"
  | "completedAt"
  | "createdAt"
  | "updatedAt"
  | "kieTaskId"
> &
  CanvasGenerationRecordExtras;

type CanvasUserGenerationRecordListItem = CanvasGenerationRecordListItem &
  Pick<CanvasGenerationTask, "projectId"> & {
    projectName: string;
  };

function buildGenerationRecordListItem(
  source: GenerationTaskRecordRow,
  billing: {
    creditsCharged: number | null;
    billingMode: "PLATFORM_CREDIT" | "BYOK" | null;
  },
  canvasHistoryId: string | null,
): CanvasGenerationRecordListItem {
  const posterUrl = extractPosterUrlFromResultPayload(source.resultPayload);
  const preview = resolveGenerationRecordPreview({
    ossUrl: source.ossUrl,
    ephemeralUrl: source.ephemeralUrl,
    inputPayload: source.inputPayload,
  });
  return {
    id: source.id,
    nodeId: source.nodeId,
    kind: source.kind,
    status: source.status,
    model: source.model,
    ossUrl: source.ossUrl,
    ephemeralUrl: source.ephemeralUrl,
    textOutput: source.textOutput,
    failCode: source.failCode,
    failMessage: source.failMessage,
    submittedAt: source.submittedAt,
    completedAt: source.completedAt,
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
    kieTaskId: source.kieTaskId,
    ...resolveGenerationRecordLabels({
      model: source.model,
      inputPayload: source.inputPayload,
      failMessage: source.failMessage,
    }),
    posterUrl,
    thumbnailUrl: posterUrl ?? preview.thumbnailUrl,
    previewUrl: preview.previewUrl,
    previewKind: preview.previewKind,
    previewMedia: preview.previewMedia,
    creditsCharged: billing.creditsCharged,
    billingMode: billing.billingMode,
    canvasHistoryId,
    canRestoreCanvas: Boolean(canvasHistoryId),
    storyScope: extractStoryScopeFromInputPayload(source.inputPayload),
  };
}

export async function listProjectTasks(args: {
  userId: string;
  projectId: string;
  nodeIds?: string[];
  /**
   * 轻量读（高频轮询用）：跳过画布历史解析；仅对终态任务查计费快照
   * （进行中任务本就无 creditsCharged）。可恢复画布等字段由「生成记录」面板的
   * /generation-records 端点提供，不在此高频路径里付出 DB 代价。
   * Gen-HotCold-R3：轻量读仅扫在飞 + 近 6h 终态（见 canvas-task-hot-window）。
   */
  lightweight?: boolean;
}): Promise<CanvasGenerationRecordListItem[]> {
  await assertAccessibleCanvasProject(args.userId, args.projectId);
  const baseWhere: Prisma.CanvasGenerationTaskWhereInput = {
    projectId: args.projectId,
    deletedAt: null,
    ...(args.nodeIds && args.nodeIds.length > 0
      ? { nodeId: { in: args.nodeIds } }
      : {}),
  };
  const where: Prisma.CanvasGenerationTaskWhereInput = args.lightweight
    ? { AND: [baseWhere, buildCanvasTaskHotReadWhere()] }
    : baseWhere;
  const rows = await findGenerationTaskRows({
    where,
    orderBy: { updatedAt: "desc" },
    take: args.lightweight ? 100 : 200,
    projectIdForRows: args.projectId,
  });

  if (args.lightweight) {
    // 仅终态任务需要计费快照（积分 toast）；进行中任务跳过，避免每 5s 多查 gatewayRequestLog
    const terminalRows = rows.filter(
      (r) => r.status === "SUCCEEDED" || r.status === "FAILED",
    );
    const enrichedTerminal = await enrichCanvasTaskRows(terminalRows);
    const billingById = new Map(
      enrichedTerminal.map((e) => [
        e.id,
        { creditsCharged: e.creditsCharged, billingMode: e.billingMode },
      ]),
    );
    return rows.map((source) =>
      buildGenerationRecordListItem(
        source,
        billingById.get(source.id) ?? {
          creditsCharged: null,
          billingMode: null,
        },
        null,
      ),
    );
  }

  const enriched = await enrichCanvasTaskRows(rows);
  const historyByTask = await resolveCanvasHistoryIdsForTasks(
    rows.map((r) => ({
      id: r.id,
      projectId: args.projectId,
      createdAt: r.createdAt,
      canvasHistoryId: r.canvasHistoryId,
      inputPayload: r.inputPayload,
    })),
  );
  return enriched.map((row, idx) => {
    const source = rows[idx];
    if (!source) {
      throw new Error("generation record row missing");
    }
    return buildGenerationRecordListItem(
      source,
      {
        creditsCharged: row.creditsCharged,
        billingMode: row.billingMode,
      },
      historyByTask.get(row.id) ?? null,
    );
  });
}

/** 生成记录面板：本项目近 N 天任务（分页，非高频 /tasks 轮询）。 */
export async function listProjectGenerationRecords(args: {
  userId: string;
  projectId: string;
  since?: Date;
  limit?: number;
  cursor?: string | null;
}): Promise<{
  items: CanvasGenerationRecordListItem[];
  hasMore: boolean;
  nextCursor: string | null;
}> {
  await assertAccessibleCanvasProject(args.userId, args.projectId);
  const since = args.since ?? canvasGenerationRecordsDefaultSince();
  const limit = parseGenerationRecordLimit(String(args.limit ?? GENERATION_RECORD_PAGE_DEFAULT));
  const cursor = parseGenerationTaskCursor(args.cursor);
  const cursorWhere = buildGenerationTaskCursorWhere(cursor);
  const baseWhere: Prisma.CanvasGenerationTaskWhereInput = {
    projectId: args.projectId,
    deletedAt: null,
    createdAt: { gte: since },
  };
  const where: Prisma.CanvasGenerationTaskWhereInput = cursorWhere
    ? { AND: [baseWhere, cursorWhere] }
    : baseWhere;

  const rows = await findGenerationTaskRows({
    where,
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    projectIdForRows: args.projectId,
  });
  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const enriched = await enrichCanvasTaskRows(pageRows);
  const historyByTask = await resolveCanvasHistoryIdsForTasks(
    pageRows.map((r) => ({
      id: r.id,
      projectId: args.projectId,
      createdAt: r.createdAt,
      canvasHistoryId: r.canvasHistoryId,
      inputPayload: r.inputPayload,
    })),
  );
  const items = enriched.map((row, idx) => {
    const source = pageRows[idx];
    if (!source) {
      throw new Error("generation record row missing");
    }
    return buildGenerationRecordListItem(
      source,
      {
        creditsCharged: row.creditsCharged,
        billingMode: row.billingMode,
      },
      historyByTask.get(row.id) ?? null,
    );
  });
  const last = pageRows[pageRows.length - 1];
  return {
    items,
    hasMore,
    nextCursor:
      hasMore && last
        ? encodeGenerationTaskCursor({ createdAt: last.createdAt, id: last.id })
        : null,
  };
}

/** 用户级生成记录（分页；可按时间筛选，用于「生成记录」面板）。 */
export async function listUserGenerationRecords(args: {
  userId: string;
  projectId?: string;
  since?: Date;
  limit?: number;
  cursor?: string | null;
}): Promise<{
  items: CanvasUserGenerationRecordListItem[];
  hasMore: boolean;
  nextCursor: string | null;
}> {
  const limit = parseGenerationRecordLimit(String(args.limit ?? GENERATION_RECORD_PAGE_DEFAULT));
  const cursor = parseGenerationTaskCursor(args.cursor);
  const cursorWhere = buildGenerationTaskCursorWhere(cursor);
  const baseWhere: Prisma.CanvasGenerationTaskWhereInput = {
    deletedAt: null,
    project: {
      userId: args.userId,
      deletedAt: null,
      ...(args.projectId ? { id: args.projectId } : {}),
    },
    ...(args.since ? { createdAt: { gte: args.since } } : {}),
  };
  const where: Prisma.CanvasGenerationTaskWhereInput = cursorWhere
    ? { AND: [baseWhere, cursorWhere] }
    : baseWhere;

  const rows = await findGenerationTaskRows({
    where,
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    includeProjectName: true,
  });
  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const enriched = await enrichCanvasTaskRows(pageRows);
  const historyByTask = await resolveCanvasHistoryIdsForTasks(
    pageRows.map((r) => ({
      id: r.id,
      projectId: r.projectId,
      createdAt: r.createdAt,
      canvasHistoryId: r.canvasHistoryId,
      inputPayload: r.inputPayload,
    })),
  );
  const items = enriched.map((row, idx) => {
    const source = pageRows[idx];
    if (!source) {
      throw new Error("generation record row missing");
    }
    return {
      ...buildGenerationRecordListItem(
        source,
        {
          creditsCharged: row.creditsCharged,
          billingMode: row.billingMode,
        },
        historyByTask.get(row.id) ?? null,
      ),
      projectId: source.projectId,
      projectName: source.project?.name ?? "",
    };
  });
  const last = pageRows[pageRows.length - 1];
  return {
    items,
    hasMore,
    nextCursor:
      hasMore && last
        ? encodeGenerationTaskCursor({ createdAt: last.createdAt, id: last.id })
        : null,
  };
}

export type CanvasGenerationKindAlias = CanvasGenerationKind;
