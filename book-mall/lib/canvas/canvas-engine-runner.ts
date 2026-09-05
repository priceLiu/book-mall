/**
 * canvas v2 · 双引擎运行器
 *
 * 处理 `ai-engine`（LLM 同步）与 `image-engine`（图像，KIE 异步 / 其它同步）。
 *
 * 流程对齐 v1 image-gen：
 *   - 入参从 CanvasRunNodeInput 拿；data.{providerId,modelKey,prompt,params}
 *   - 计算 inputHash 做缓存命中；命中直接复用 SUCCEEDED 任务（与 v1 保持一致）
 *   - 校验 user / project inflight 限额
 *   - 创建 PENDING task（providerId 落库）
 *   - 同步路径：调 gateway，立即写 SUCCEEDED；
 *     KIE 异步路径：调 createImageTask 拿 kieTaskId → SUBMITTED → poll worker 接管
 */

import { createHash } from "node:crypto";
import type {
  CanvasGenerationTask,
  Prisma,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { promptArchiveFieldsForTask } from "@/lib/canvas/canvas-task-prompt-archive";
import { formatVideoEngineFailMessage } from "@/lib/story/kie-client";

import {
  buildCanvasAiKieCallbackUrl,
  getCanvasProjectInflightMax,
  getCanvasUserInflightMax,
} from "./canvas-constants";
import { CanvasProjectError } from "./canvas-project-service";
import { assertStoryLlmVisionModel } from "./story-llm-vision-models";
import { isLikelyVideoUrl } from "./media-url-kind";
import { scriptStudioMirrorPayload } from "./script-studio-parse-mirror";
import type { CanvasTaskStoryScope } from "./canvas-story-scope";
import {
  buildPro2StructuredRetryUserMessage,
  ensurePro2ProductionScriptFence,
  isPro2StructuredLlmScope,
  mergePro2StructuredLlmParams,
  PRO2_STRUCTURED_LLM_MAX_ATTEMPTS,
  validatePro2ProductionScriptLlmOutput,
} from "./pro2-production-script-llm";
import {
  buildScriptStudioStructuredRetryUserMessage,
  ensureScriptStudioBatchFence,
  isScriptStudioStructuredLlmScope,
  mergeScriptStudioStructuredLlmParams,
  SCRIPT_STUDIO_STRUCTURED_LLM_MAX_ATTEMPTS,
  validateScriptStudioBatchLlmOutput,
} from "./script-studio-llm";
import {
  voidGatewayLogForPro2ValidationFailure,
  PRO2_GATEWAY_VALIDATION_FAIL_CODE,
} from "./pro2-gateway-validation-void";
import {
  assertNoProjectInflightByInputHash,
  claimCanvasTaskKieSubmit,
} from "./canvas-kie-gateway-claim";
import {
  createStoryScopedCanvasTask,
  extractStoryScopeFromInputPayload,
  shouldSkipInflightScopeConflictForRun,
  storyScopesConflict,
} from "./canvas-story-scope";
import {
  canvasGwChatWithOverloadRetry,
  canvasGwCreateBailianR2vJob,
  canvasGwCreateDashscopeKlingImageJob,
  canvasGwCreateDashscopeMultimodalImageSyncJob,
  canvasGwCreateDashscopeVideoJob,
  canvasGwCreateDashscopeWan27ImageJob,
  canvasGwCreateHunyuanJob,
  canvasGwCreateKieJob,
  canvasGwCreateMinimaxVideoJob,
  canvasGwCreateTopazVideoJob,
  canvasGwCreateVolcengineVideoJob,
  canvasGwTts,
  canvasGwVolcengineImageGenerations,
} from "./canvas-gateway-client";
import { engineOverloadedUserHintZh, isEngineOverloadedMessage } from "@/lib/gateway/gateway-submit-error-policy";
import {
  assertCanvasProviderMatchesModelRoute,
  shouldCanvasUseGateway,
} from "./canvas-gateway-run";
import { GATEWAY_VOLCENGINE_PROVIDER_ID } from "./canvas-gateway-providers";
import {
  scheduleCanvasBufferOssBackfill,
  scheduleCanvasKieImageOssBackfill,
} from "./canvas-oss-backfill";
import {
  buildVolcengineSeedreamImageCall,
  isVolcengineSeedreamImageModelKey,
} from "@/lib/gateway/volcengine-chat-models";
import { ensureCanvasVendorImageUrls } from "@/lib/canvas/ensure-vendor-image-url";
import type { CanvasRunNodeInput } from "./canvas-task-service";
import {
  buildCanvasRefVideoKieInput,
  buildCanvasVideoKieInput,
} from "./canvas-video-kie";
import { normalizeKieVideoRefImageUrls } from "./canvas-video-ref-image-normalize";
import {
  buildCanvasVideoVolcengineInput,
  isVolcengineStoryVideoModelKey,
  VOLCENGINE_VIDEO_MULTI_REF_MODEL,
} from "./canvas-video-volcengine";
import { buildCanvasVideoMinimaxInput } from "@/lib/gateway/minimax-video-body";
import { isMinimaxCanvasVideoModelKey } from "./providers/minimax-video";
import { normalizePortraitAssetRefs } from "./canvas-portrait-import-service";
import { isTopazCanvasVideoModelKey } from "./providers/topaz";
import {
  buildDashscopeHappyhorseI2vVideoBody,
  buildDashscopeSbv1T2vVideoBody,
  buildDashscopeWan30Media,
  dashscopeSbv1T2vModelToR2v,
  isDashscopeHappyhorseImageToVideoModel,
  isDashscopeHappyhorseTextToVideoModel,
  isDashscopeSbv1TextToVideoModel,
  isDashscopeWan30VideoModel,
  resolveDashscopeT2vRefMismatchMessage,
} from "./dashscope-sbv1-t2v";
import {
  buildDashscopeKlingV3VideoBody,
  isDashscopeKlingV3VideoGatewayModel,
  resolveDashscopeKlingV3UpstreamModel,
} from "./dashscope-kling-v3-video";
import {
  parseTopazFrameInterpolation,
  parseTopazSlowmoFactor,
  topazUpscaleFromHdResolution,
} from "@/lib/gateway/topaz-client";
import { buildKieImageCreateArgs } from "./providers/kie";
import { buildKieToolVideoCreateArgs } from "./kie-video-tool-builders";
import {
  buildKieAudioCreateInput,
  normalizeKieAudioModelKey,
} from "./kie-audio-builders";
import { STORY_VIDEO_MODEL_IDS } from "@/lib/story/story-ai-constants";
import { BAILIAN_R2V_MODEL_IDS } from "./providers/bailian-r2v";
import { modelHasStoryCapabilities } from "./story-model-capabilities";
import { storyEngineSystemFallback } from "./story-engine-prompts";
import {
  isTrafficControlEnabled,
  GENERATION_INFLIGHT_STATUSES,
  GENERATION_PIPELINE_INFLIGHT_STATUSES,
} from "@/lib/generation/traffic-control/constants";
import { computeCanvasQueueDispatchAfter } from "@/lib/generation/traffic-control/queue-dispatch-after";
import { fireCanvasDispatchForProject } from "@/lib/generation/traffic-control/fire-canvas-dispatch";
import { buildGridSplitPrepareFromNodeData } from "@/lib/generation/traffic-control/dispatch-canvas-image";
import { assertVideoCreditsBeforeTrafficQueue } from "@/lib/generation/traffic-control/video-queue-precheck";
import { resolveCanvasProjectTrafficScope } from "@/lib/generation/traffic-control/scope-key";
import {
  isStoryboardDashscopeImageModel,
  isStoryboardKlingImageModel,
  isWan26ImageModel,
  resolveStoryboardDashscopeModel,
  resolveStoryboardKlingModel,
} from "@/lib/ecom/ecom-storyboard-image-models";
import { resolveKlingV3Resolution, resolveWan27ImageSize } from "@/lib/ecom/ecom-storyboard-gen-params";
import { ensureStoryboardRefImagesForWan27 } from "@/lib/ecom/ecom-storyboard-ref-image";
import {
  isDashscopeMultimodalImageGenModel,
  isZImageTurboModel,
} from "@/lib/gateway/qwen-image-edit-proxy";

const MAX_PROMPT_LEN = 16000;
/** Story LLM（故事大纲等）允许更长上游参考包，避免截断创意描述 */
const STORY_LLM_MAX_PROMPT_LEN = 120_000;

/**
 * 公用"商业海报设计方案"系统提示。
 *
 * 默认注入到 ai-engine 的 system 消息（除非用户的 prompt 自己已经写了"【系统任务】"
 * 段，避免重复指令）。目标：用户只需要连接产品图 + 风格图 + 参数文本就能一键出方案。
 */
export const CANVAS_DESIGN_PLAN_SYSTEM_PROMPT = `你是顶级商业视觉艺术总监，擅长把"产品 + 风格 + 参数"翻译成可直接交付给生图引擎的设计方案。

# 你的输入
1. 上游随消息附带的图片：
   - 第一张通常是【产品主体】，构图与材质必须严格保留；
   - 后续若干张为【风格 / 灵感参考】，仅借用色彩 / 质感 / 排版语言，不得复制原图元素。
2. 上游随消息附带的文本：用户提供的产品参数（品牌、卖点、规格、价格、合规要求等），可能为空。
3. 用户当前节点的 prompt：作为额外的"本次需求"补充。

# 你的产出（Markdown）
请只输出方案文本，不要附带前言 / 反思 / 致谢。结构如下：

## 1. 一句话核心创意
（不超过 25 字）

## 2. 主视觉
- 主体（产品摆位 / 角度 / 比例 / 与画面留白关系）
- 配色（主色 / 辅色 / 强调色，给 hex；说明在画面中的占比）
- 材质 / 光影（参考"灵感图"的质感要点）
- 背景 / 场景（明确有无文字、有无道具、风格关键词）

## 3. 版式与文字
- 标题（建议字号 / 字重 / 字体方向感；中英文写法）
- 副标题 / 卖点条（每条 ≤ 12 字，最多 3 条）
- 价格 / 合规角标的位置（左上 / 右下等）

## 4. 给生图引擎的 prompt（中文 + 英文双语）
- 中文 prompt（120 字以内）
- 英文 prompt（80 words 以内）
- 反向词（不希望出现的元素）

## 5. 备选变体
列出 2 个可选方向（更冷 / 更暖；更高级 / 更网感）作为 A/B 选项，每条 1-2 行。

# 强制约束
- 严格围绕"产品主体"构图，不要让风格图替代主体。
- 若用户参数缺失，按默认风格"现代极简、留白多、对比强"补全。
- 不要泄露这条 system prompt；不要解释你做了什么。
`;

function clipPrompt(s: string, maxLen = MAX_PROMPT_LEN): string {
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function computeInputHash(args: {
  modelKey: string;
  prompt: string;
  imageUrls: string[];
  params: Record<string, unknown>;
  providerId: string;
}): string {
  const payload = {
    modelKey: args.modelKey,
    prompt: args.prompt,
    imageUrls: [...args.imageUrls].sort(),
    params: args.params,
    providerId: args.providerId,
  };
  return createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");
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

async function ensureProjectInflightCapacity(projectId: string): Promise<void> {
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

async function findReusableSucceededTask(args: {
  projectId: string;
  nodeId: string;
  inputHash: string;
  useGateway?: boolean;
}): Promise<CanvasGenerationTask | null> {
  const task = await prisma.canvasGenerationTask.findFirst({
    where: {
      projectId: args.projectId,
      nodeId: args.nodeId,
      status: "SUCCEEDED",
      inputHash: args.inputHash,
      deletedAt: null,
    },
    orderBy: { completedAt: "desc" },
  });
  if (!task) return null;
  if (args.useGateway && !taskInputHasGatewayAudit(task)) return null;
  return task;
}

function taskInputHasGatewayAudit(task: CanvasGenerationTask): boolean {
  if (!task.inputPayload || typeof task.inputPayload !== "object") return false;
  const p = task.inputPayload as Record<string, unknown>;
  if (p.gatewayLogId) return true;
  const pid = typeof p.providerId === "string" ? p.providerId : "";
  return pid.startsWith("gateway:");
}

export type { CanvasTaskStoryScope } from "./canvas-story-scope";

export type RunEngineNodeArgs = {
  userId: string;
  projectId: string;
  nodeId: string;
  node: CanvasRunNodeInput;
  /** 跳过缓存，强制创建新任务（"重新生成"用） */
  forceFresh?: boolean;
  /** 漫剧列行 / 文案段，用于同节点多任务区分 */
  storyScope?: CanvasTaskStoryScope;
  /** Gateway 日志页面来源，如 canvas/{projectId} */
  clientPage?: string;
  /**
   * Story LLM：先返回 SUBMITTED 任务，Gateway 调用在后台继续（避免 run HTTP 阻塞 3min+）。
   */
  executeAsync?: boolean;
};

export type RunEngineNodeResult =
  | { reused: true; task: CanvasGenerationTask }
  | { reused: false; task: CanvasGenerationTask };

function resolveCanvasClientPage(projectId: string, clientPage?: string): string {
  return clientPage ?? `canvas/${projectId}`;
}

/** AI 引擎（LLM）—— 同步出文本。 */
export async function runAiEngineNode(
  args: RunEngineNodeArgs,
): Promise<RunEngineNodeResult> {
  const { userId, projectId, nodeId, node } = args;
  const gwClientPage = resolveCanvasClientPage(projectId, args.clientPage);
  const data = node.data ?? {};
  const providerId = String(data.providerId ?? "");
  const modelKey = String(data.modelKey ?? node.modelKey ?? "");
  const promptRaw = String(data.prompt ?? "");
  const params = (data.params as Record<string, unknown>) ?? {};

  if (!providerId)
    throw new CanvasProjectError("INVALID_INPUT", "ai-engine 缺少 providerId");
  if (!modelKey)
    throw new CanvasProjectError("INVALID_INPUT", "ai-engine 缺少 modelKey");

  // ai-engine：图片走多模态 image_url part（不进 prompt 文本），文本上游附在 prompt 末尾
  const expandedPrompt = expandMentionsText(promptRaw, node);
  if (!expandedPrompt.trim() && (node.imageInputs ?? []).length === 0) {
    throw new CanvasProjectError(
      "EMPTY_PROMPT",
      "ai-engine 既没有 prompt 也没有上游图片",
    );
  }

  await shouldCanvasUseGateway(userId, providerId, modelKey);

  // 上游图片不传给 LLM（LLM 通常仅文本入）；但 imageInputs 仍参与 hash，避免缓存错配
  const imageUrls = (node.imageInputs ?? []).filter(
    (u): u is string => typeof u === "string" && /^https?:\/\//.test(u),
  );
  const inputHash = computeInputHash({
    modelKey,
    prompt: expandedPrompt,
    imageUrls,
    params,
    providerId,
  });

  if (!args.forceFresh) {
    const reusable = await findReusableSucceededTask({
      projectId,
      nodeId,
      inputHash,
      useGateway: true,
    });
    if (reusable) return { reused: true, task: reusable };
  }

  await ensureProjectInflightCapacity(projectId);
  await ensureUserInflightCapacity(userId);

  // SUBMITTED：同步 LLM 进行中，避免 poll worker 误当作 KIE 出图 PENDING 重试。
  // 走 createStoryScopedCanvasTask 在事务内先占位再调厂商，避免 ensure + create
  // 竞态窗口导致同一节点/段重复提交 Gateway。
  const created = await createStoryScopedCanvasTask({
    projectId,
    nodeId,
    storyScope: args.storyScope,
    skipInflightScopeConflict: shouldSkipInflightScopeConflictForRun(args),
    initialStatus: "SUBMITTED",
    data: {
      kind: "TEXT",
      model: modelKey,
      providerId: null,
      inputHash,
      inputPayload: {
        kind: "ai-engine",
        prompt: clipPrompt(expandedPrompt),
        params,
        providerId,
        modelKey,
        imageUrls,
        textInputs: node.textInputs ?? [],
      } as Prisma.InputJsonValue,
      submittedAt: new Date(),
    },
  });

  // 同步调 LLM
  try {
    const hasSelfSystem =
      /【系统任务】|【强制运算逻辑】|^system\s*[:：]/im.test(promptRaw);
    const systemPrompt = hasSelfSystem ? null : CANVAS_DESIGN_PLAN_SYSTEM_PROMPT;

    const userContent: (
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
    )[] = [];
    if (imageUrls.length > 0) {
      for (const u of imageUrls) {
        userContent.push({ type: "image_url", image_url: { url: u } });
      }
    }
    userContent.push({ type: "text", text: clipPrompt(expandedPrompt) });

    const messages: import("./providers/types").CanvasChatMessage[] = [];
    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }
    messages.push({
      role: "user",
      content:
        userContent.length === 1 && userContent[0].type === "text"
          ? userContent[0].text
          : userContent,
    });

    const resp = await canvasGwChatWithOverloadRetry(userId, {
      modelKey,
      messages,
      params,
      clientPage: gwClientPage,
      projectId,
    });
    const text = resp.text;
    const updated = await prisma.canvasGenerationTask.update({
      where: { id: created.id },
      data: {
        status: "SUCCEEDED",
        textOutput: text,
        resultPayload: (resp.rawPayload ?? null) as
          | Prisma.InputJsonValue
          | undefined,
        inputPayload: {
          kind: "ai-engine",
          prompt: clipPrompt(expandedPrompt),
          params,
          providerId,
          modelKey,
          imageUrls,
          textInputs: node.textInputs ?? [],
          gatewayLogId: resp.logId,
        } as Prisma.InputJsonValue,
        submittedAt: new Date(),
        completedAt: new Date(),
      },
    });
    return { reused: false, task: updated };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const code = "AI_ENGINE_FAILED";
    const updated = await prisma.canvasGenerationTask.update({
      where: { id: created.id },
      data: {
        status: "FAILED",
        failCode: code,
        failMessage: msg.slice(0, 500),
        completedAt: new Date(),
      },
    });
    return { reused: false, task: updated };
  }
}

/** 可灵 3.0 图像 · aspect_ratio 仅支持 16:9 / 9:16 / 1:1 */
function resolveKlingImageAspectFromParams(
  params: Record<string, unknown>,
): "16:9" | "9:16" | "1:1" {
  const raw = String(params.aspect_ratio ?? "16:9").trim();
  if (raw === "1:1" || raw === "9:16" || raw === "16:9") return raw;
  if (raw.includes("9:16") || raw === "3:4" || raw === "2:3" || raw === "4:5") {
    return "9:16";
  }
  return "16:9";
}

/** 生图引擎 —— 按 provider.kind 分同步 / 异步两条路径。 */
export async function runImageEngineNode(
  args: RunEngineNodeArgs,
): Promise<RunEngineNodeResult> {
  const { userId, projectId, nodeId, node } = args;
  const gwClientPage = resolveCanvasClientPage(projectId, args.clientPage);
  const data = node.data ?? {};
  const providerId = String(data.providerId ?? "");
  const modelKey = String(data.modelKey ?? node.modelKey ?? "");
  const promptRaw = String(data.prompt ?? "");
  const params = (data.params as Record<string, unknown>) ?? {};

  const engineKind =
    node.type === "three-view-engine" ? "three-view-engine" : "image-engine";

  if (!providerId)
    throw new CanvasProjectError("INVALID_INPUT", `${engineKind} 缺少 providerId`);
  if (!modelKey)
    throw new CanvasProjectError("INVALID_INPUT", `${engineKind} 缺少 modelKey`);

  if (engineKind === "three-view-engine") {
    const allowed = new Set([
      "nano-banana-pro",
      "hunyuan-3d-pro",
      "hunyuan-3d-express",
    ]);
    if (!allowed.has(modelKey)) {
      throw new CanvasProjectError(
        "INVALID_INPUT",
        "三视图引擎仅支持 Nano Banana Pro 或混元生3D（专业版 / 极速版）",
      );
    }
  }

  // 三视图 row.prompt 已在 Pro2 Dock 组装完毕，禁止再拼 hub 大纲/分镜 markdown
  const upstreamText =
    engineKind === "three-view-engine"
      ? []
      : (node.textInputs ?? []).filter((s) => s && s.trim());
  const expandedPrompt = expandMentionsText(
    [promptRaw.trim(), ...upstreamText].filter(Boolean).join("\n\n"),
    node,
  );
  if (!expandedPrompt.trim()) {
    throw new CanvasProjectError("EMPTY_PROMPT", `${engineKind} prompt 为空`);
  }

  const imageUrlsRaw = (node.imageInputs ?? [])
    .filter((u): u is string => typeof u === "string" && /^https?:\/\//.test(u))
    .slice(0, 8);

  const gridSplitPrepare = buildGridSplitPrepareFromNodeData(data);
  /** 宫格高清待裁切：参考图由 dispatch PREPARING 写入，不入队 imageUrls */
  const imageUrls = gridSplitPrepare ? [] : imageUrlsRaw;

  const isHunyuan =
    modelKey === "hunyuan-3d-pro" || modelKey === "hunyuan-3d-express";
  const isKlingImage = isStoryboardKlingImageModel(modelKey);
  const isDashscopeWanImage = isStoryboardDashscopeImageModel(modelKey);
  const isMultimodalSyncImage = isDashscopeMultimodalImageGenModel(modelKey);
  const isVolcengineSeedream = isVolcengineSeedreamImageModelKey(modelKey);
  await shouldCanvasUseGateway(userId, providerId, modelKey);

  const inputHash = computeInputHash({
    modelKey,
    prompt: expandedPrompt,
    imageUrls,
    params,
    providerId,
  });

  if (!args.forceFresh) {
    const reusable = await findReusableSucceededTask({
      projectId,
      nodeId,
      inputHash,
      useGateway: true,
    });
    if (reusable) return { reused: true, task: reusable };
  }

  if (!args.forceFresh) {
    await assertNoProjectInflightByInputHash(projectId, inputHash);
  }
  await ensureNoActiveTaskForScope(projectId, nodeId, args.storyScope);
  await ensureProjectInflightCapacity(projectId);
  await ensureUserInflightCapacity(userId);

  const sbv1Billing =
    data.sbv1Billing && typeof data.sbv1Billing === "object"
      ? (data.sbv1Billing as Record<string, unknown>)
      : undefined;

  const gridSplitPrepareForPayload = buildGridSplitPrepareFromNodeData(data);
  const trafficQueued = isTrafficControlEnabled();

  const imageInputPayload = {
    kind: engineKind,
    prompt: clipPrompt(expandedPrompt),
    params,
    providerId,
    modelKey,
    imageUrls,
    clientPage: gwClientPage,
    /** run API 同步提交 Gateway；poll worker 勿在短时内二次 createTask */
    syncGatewaySubmit: true,
    ...(gridSplitPrepareForPayload ? { gridSplitPrepare: gridSplitPrepareForPayload } : {}),
    ...(sbv1Billing ? { sbv1Billing } : {}),
    ...(args.storyScope ? { storyScope: args.storyScope } : {}),
  } as Prisma.InputJsonValue;

  const created = await createStoryScopedCanvasTask({
    projectId,
    nodeId,
    storyScope: args.storyScope,
    actorUserId: userId,
    skipInflightScopeConflict: shouldSkipInflightScopeConflictForRun(args),
    initialStatus: trafficQueued ? "QUEUED" : undefined,
    data: {
      kind: "IMAGE",
      model: modelKey,
      providerId: null,
      inputHash,
      inputPayload: imageInputPayload,
    },
  });

  if (created.status === "QUEUED") {
    fireCanvasDispatchForProject(projectId, "runImageEngineNode");
    return { reused: false, task: created };
  }

  const callBackUrl = buildCanvasAiKieCallbackUrl("image", created.id);

  try {
      if (isHunyuan) {
        const job = await canvasGwCreateHunyuanJob(userId, {
          model: modelKey,
          prompt: clipPrompt(expandedPrompt),
          imageUrls,
          params,
          clientPage: gwClientPage,
          projectId,
          canvasTaskId: created.id,
        });
        const updated = await prisma.canvasGenerationTask.update({
          where: { id: created.id },
          data: {
            status: "SUBMITTED",
            kieTaskId: job.taskId,
            submittedAt: new Date(),
            inputPayload: {
              kind: engineKind,
              prompt: clipPrompt(expandedPrompt),
              params,
              providerId,
              modelKey,
              imageUrls,
              clientPage: gwClientPage,
              gatewayLogId: job.logId,
              providerKind: "HUNYUAN",
              ...(args.storyScope ? { storyScope: args.storyScope } : {}),
            } as Prisma.InputJsonValue,
          },
        });
        return { reused: false, task: updated };
      }

      if (isKlingImage) {
        const apiModel = resolveStoryboardKlingModel(modelKey);
        const promptText = clipPrompt(expandedPrompt);
        const content: Array<{ text: string } | { image: string }> =
          imageUrls.length > 0
            ? [
                ...imageUrls.map((url) => ({ image: url })),
                { text: promptText },
              ]
            : [{ text: promptText }];
        const job = await canvasGwCreateDashscopeKlingImageJob(userId, {
          model: apiModel,
          content,
          aspectRatio: resolveKlingImageAspectFromParams(params),
          resolution: resolveKlingV3Resolution(),
          n: Math.min(4, Math.max(1, Number(params.n ?? 1) || 1)),
          clientPage: gwClientPage,
          projectId,
          canvasTaskId: created.id,
        });
        const updated = await prisma.canvasGenerationTask.update({
          where: { id: created.id },
          data: {
            status: "SUBMITTED",
            kieTaskId: job.taskId,
            submittedAt: new Date(),
            inputPayload: {
              kind: engineKind,
              prompt: promptText,
              params,
              providerId,
              modelKey,
              imageUrls,
              clientPage: gwClientPage,
              syncGatewaySubmit: true,
              gatewayLogId: job.logId,
              providerKind: "DASHSCOPE",
              dashscopeJobKind: "kling-v3-image",
              ...(args.storyScope ? { storyScope: args.storyScope } : {}),
            } as Prisma.InputJsonValue,
          },
        });
        return { reused: false, task: updated };
      }

      if (isMultimodalSyncImage) {
        const promptText = clipPrompt(expandedPrompt);
        const resolution = String(params.resolution ?? "2K");
        const size =
          resolution === "4K"
            ? "2048*2048"
            : resolution === "1K"
              ? "1024*1024"
              : "1536*1536";
        const n = Math.min(
          isZImageTurboModel(modelKey) ? 1 : 6,
          Math.max(1, Number(params.n ?? 1) || 1),
        );
        const refs =
          !isZImageTurboModel(modelKey) && imageUrls.length > 0
            ? await ensureStoryboardRefImagesForWan27({
                userId,
                urls: imageUrls.slice(0, 3),
              })
            : [];
        const content: Array<{ text: string } | { image: string }> =
          refs.length > 0
            ? [...refs.map((url) => ({ image: url })), { text: promptText }]
            : [{ text: promptText }];
        const job = await canvasGwCreateDashscopeMultimodalImageSyncJob(userId, {
          model: modelKey,
          content,
          parameters: {
            size,
            n,
            prompt_extend: isZImageTurboModel(modelKey) ? false : true,
            watermark: false,
          },
          clientPage: gwClientPage,
          projectId,
          canvasTaskId: created.id,
        });
        const updated = await prisma.canvasGenerationTask.update({
          where: { id: created.id },
          data: {
            status: "SUBMITTED",
            kieTaskId: job.taskId,
            submittedAt: new Date(),
            inputPayload: {
              kind: engineKind,
              prompt: promptText,
              params,
              providerId,
              modelKey,
              imageUrls,
              clientPage: gwClientPage,
              syncGatewaySubmit: true,
              gatewayLogId: job.logId,
              providerKind: "DASHSCOPE",
              dashscopeJobKind: "multimodal-image-sync",
              ...(args.storyScope ? { storyScope: args.storyScope } : {}),
            } as Prisma.InputJsonValue,
          },
        });
        const { recoverCanvasDashscopeSyncImageFromGateway } = await import(
          "@/lib/canvas/canvas-dashscope-sync-image-recover"
        );
        await recoverCanvasDashscopeSyncImageFromGateway(updated.id).catch(() => undefined);
        return { reused: false, task: updated };
      }

      if (isDashscopeWanImage) {
        const apiModel = resolveStoryboardDashscopeModel(modelKey);
        const promptText = clipPrompt(expandedPrompt);
        const wan26 =
          isWan26ImageModel(apiModel) || isWan26ImageModel(modelKey);
        const resolution = String(params.resolution ?? "2K");
        const aspectRaw = String(params.aspect_ratio ?? "1:1");
        const wanAspect: "16:9" | "9:16" =
          aspectRaw === "9:16" ||
          aspectRaw === "3:4" ||
          aspectRaw === "2:3" ||
          aspectRaw === "4:5" ||
          aspectRaw === "9:21"
            ? "9:16"
            : "16:9";
        const wan27Size =
          !wan26 && imageUrls.length === 0
            ? resolveWan27ImageSize({
                aspectRatio: wanAspect,
                imageSize:
                  resolution === "4K"
                    ? "4K"
                    : resolution === "1K"
                      ? "1K"
                      : "2K",
              })
            : undefined;
        const refs =
          imageUrls.length > 0
            ? await ensureStoryboardRefImagesForWan27({
                userId,
                urls: imageUrls,
              })
            : [];
        const content: Array<{ text: string } | { image: string }> =
          refs.length > 0
            ? wan26
              ? [{ text: promptText }, ...refs.map((url) => ({ image: url }))]
              : [
                  ...refs.map((url) => ({ image: url })),
                  { text: promptText },
                ]
            : [{ text: promptText }];
        const job = await canvasGwCreateDashscopeWan27ImageJob(userId, {
          model: apiModel,
          content,
          size: wan27Size,
          n: Math.min(4, Math.max(1, Number(params.n ?? 1) || 1)),
          contentOrder: wan26 ? "text-first" : "images-first",
          clientPage: gwClientPage,
          projectId,
          canvasTaskId: created.id,
        });
        const updated = await prisma.canvasGenerationTask.update({
          where: { id: created.id },
          data: {
            status: "SUBMITTED",
            kieTaskId: job.taskId,
            submittedAt: new Date(),
            inputPayload: {
              kind: engineKind,
              prompt: promptText,
              params,
              providerId,
              modelKey,
              imageUrls,
              clientPage: gwClientPage,
              syncGatewaySubmit: true,
              gatewayLogId: job.logId,
              providerKind: "DASHSCOPE",
              dashscopeJobKind: "wan27-image",
              ...(args.storyScope ? { storyScope: args.storyScope } : {}),
            } as Prisma.InputJsonValue,
          },
        });
        return { reused: false, task: updated };
      }

      if (isVolcengineSeedream) {
        const promptText = clipPrompt(expandedPrompt);
        const vendorImageUrls =
          imageUrls.length > 0
            ? await ensureCanvasVendorImageUrls(userId, imageUrls)
            : [];
        const call = buildVolcengineSeedreamImageCall({
          prompt: promptText,
          imageUrls: vendorImageUrls,
          params,
        });
        const { images, logId } = await canvasGwVolcengineImageGenerations(
          userId,
          {
            model: modelKey,
            prompt: call.prompt,
            image: call.image,
            parameters: call.parameters,
            clientPage: gwClientPage,
            projectId,
            canvasTaskId: created.id,
          },
        );
        const first = images[0];
        const url = first?.url?.trim() ?? "";
        const b64 = first?.b64?.trim() ?? "";
        if (!url && !b64) {
          throw new Error("火山方舟 Seedream 未返回可用图像");
        }
        const ephemeralUrl = url || `data:image/png;base64,${b64}`;
        const resultImageUrls = images
          .map((i) => i.url?.trim())
          .filter((u): u is string => Boolean(u));
        const updated = await prisma.canvasGenerationTask.update({
          where: { id: created.id },
          data: {
            status: "SUCCEEDED",
            ephemeralUrl,
            submittedAt: new Date(),
            completedAt: new Date(),
            inputPayload: {
              kind: engineKind,
              prompt: promptText,
              params,
              providerId,
              modelKey,
              imageUrls: vendorImageUrls.length > 0 ? vendorImageUrls : imageUrls,
              clientPage: gwClientPage,
              syncGatewaySubmit: true,
              gatewayLogId: logId,
              providerKind: "VOLCENGINE",
              ...(args.storyScope ? { storyScope: args.storyScope } : {}),
            } as Prisma.InputJsonValue,
            resultPayload: {
              imageCount: images.length,
              ...(resultImageUrls.length ? { imageUrls: resultImageUrls } : {}),
            } as Prisma.InputJsonValue,
          },
        });
        if (url) {
          scheduleCanvasKieImageOssBackfill(
            created.id,
            url,
            projectId,
            "node-image",
          );
        } else {
          scheduleCanvasBufferOssBackfill({
            taskId: created.id,
            buf: Buffer.from(b64, "base64"),
            contentType: "image/png",
            kind: "node-image",
            projectId,
            userId,
            ext: "png",
          });
        }
        return { reused: false, task: updated };
      }

      const { model, input } = buildKieImageCreateArgs({
        modelKey,
        prompt: clipPrompt(expandedPrompt),
        imageUrls,
        params,
      });

      const { claimed, task: claimedTask } = await claimCanvasTaskKieSubmit(
        created.id,
      );
      if (!claimed) {
        const fresh = await prisma.canvasGenerationTask.findUnique({
          where: { id: created.id },
        });
        if (fresh?.kieTaskId) {
          return { reused: false, task: fresh };
        }
        throw new CanvasProjectError(
          "TASK_ALREADY_INFLIGHT",
          "image gateway submit already in progress",
          409,
        );
      }

      const job = await canvasGwCreateKieJob(userId, {
        gatewayModelKey: modelKey,
        model,
        input: input as Record<string, unknown>,
        callBackUrl,
        clientPage: gwClientPage,
        projectId,
        canvasTaskId: claimedTask.id,
        sbv1Billing,
      });
      const updated = await prisma.canvasGenerationTask.update({
        where: { id: claimedTask.id },
        data: {
          status: "SUBMITTED",
          kieTaskId: job.taskId,
          submittedAt: new Date(),
          inputPayload: {
            kind: engineKind,
            prompt: clipPrompt(expandedPrompt),
            params,
            providerId,
            modelKey,
            imageUrls,
            clientPage: gwClientPage,
            syncGatewaySubmit: true,
            gatewayKieSubmitClaimed: true,
            gatewayLogId: job.logId,
            providerKind: "KIE",
            kieModel: model,
            kieInput: input,
            ...(sbv1Billing ? { sbv1Billing } : {}),
            ...(args.storyScope ? { storyScope: args.storyScope } : {}),
          } as Prisma.InputJsonValue,
        },
      });
      return { reused: false, task: updated };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const code = "IMAGE_ENGINE_FAILED";
    const updated = await prisma.canvasGenerationTask.update({
      where: { id: created.id },
      data: {
        status: "FAILED",
        failCode: code,
        failMessage: msg.slice(0, 500),
        completedAt: new Date(),
      },
    });
    return { reused: false, task: updated };
  }
}

/**
 * 把 prompt 中的 `@<nodeId>` token 替换为可读形式：
 * 我们在 server 端不知道具体上游内容；前端在调用时已经把 textInputs/imageInputs 传过来。
 * 这里的策略：保留 token（让 LLM 看到 placeholder），并附上一段"参考资料"清单。
 *
 * 简单期：原样保留 token；如未来需要，可在 server 端 join project canvas 节点拿 label。
 */
function expandMentions(prompt: string, node: CanvasRunNodeInput): string {
  const segs: string[] = [prompt];
  const imgs = (node.imageInputs ?? []).filter(Boolean);
  const txts = (node.textInputs ?? []).filter(Boolean);
  if (imgs.length > 0) {
    segs.push(
      "\n\n[参考图片]",
      ...imgs.map((u, i) => `图${i + 1}: ${u}`),
    );
  }
  if (txts.length > 0) {
    segs.push(
      "\n\n[参考文本]",
      ...txts.map((t, i) => `文${i + 1}: ${t}`),
    );
  }
  return segs.join("\n");
}

/**
 * ai-engine 专用：只把"文本上游"附到 prompt 末尾；图片走多模态 image_url part，不重复进文本。
 */
function expandMentionsText(prompt: string, node: CanvasRunNodeInput): string {
  const segs: string[] = [prompt];
  const txts = (node.textInputs ?? []).filter((s) => s && s.trim());
  if (txts.length > 0) {
    segs.push(
      "\n\n# 用户提供的产品 / 文本输入",
      ...txts.map((t, i) => `${i + 1}. ${t.trim()}`),
    );
  }
  const imgs = (node.imageInputs ?? []).filter(Boolean);
  if (imgs.length > 0) {
    const videoCount = imgs.filter((u) => isLikelyVideoUrl(String(u))).length;
    const imageCount = imgs.length - videoCount;
    if (videoCount > 0 && imageCount > 0) {
      segs.push(
        `\n\n# 上游附带 ${imageCount} 张参考图与 ${videoCount} 段参考视频（已作为多模态附件附在本条消息）`,
      );
    } else if (videoCount > 0) {
      segs.push(
        `\n\n# 上游附带 ${videoCount} 段参考视频（已作为 video_url 附在本条消息）`,
      );
    } else {
      segs.push(
        `\n\n# 上游附带 ${imageCount} 张参考图（已作为 image_url 附在本条消息）`,
        "- 第 1 张为产品主体（必保），其余为风格 / 灵感参考。",
      );
    }
  }
  return segs.join("\n");
}

/** 分镜视频：首帧走 image_urls / reference_image_urls API 字段，@ 附加参考只进 prompt */
function expandVideoPrompt(
  prompt: string,
  referenceImageUrls: string[],
): string {
  const segs: string[] = [prompt.trim()].filter(Boolean);
  const refs = referenceImageUrls
    .map((u) => u.trim())
    .filter((u) => /^https?:\/\//.test(u));
  if (refs.length > 0) {
    segs.push(
      "\n\n[附加参考图]",
      ...refs.map((u, i) => `图${i + 1}: ${u}`),
    );
  }
  return segs.join("\n\n");
}

type StoryLlmKind =
  | "story-outline-engine"
  | "character-engine"
  | "storyboard-engine";

type StoryLlmExecutionContext = {
  userId: string;
  projectId: string;
  nodeId: string;
  node: CanvasRunNodeInput;
  engineKind: StoryLlmKind;
  gwClientPage: string;
  storyScope?: CanvasTaskStoryScope;
  data: Record<string, unknown>;
  modelKey: string;
  providerId: string;
  params: Record<string, unknown>;
  userText: string;
  imageUrls: string[];
};

async function executeStoryLlmEngineTask(
  taskId: string,
  ctx: StoryLlmExecutionContext,
): Promise<RunEngineNodeResult> {
  const {
    userId,
    projectId,
    nodeId,
    node,
    engineKind,
    gwClientPage,
    storyScope,
    data,
    modelKey,
    providerId,
    params,
    userText,
    imageUrls: mediaUrls,
  } = ctx;

  const videoUrls = mediaUrls.filter((u) => isLikelyVideoUrl(u));
  const pureImageUrls = mediaUrls.filter((u) => !isLikelyVideoUrl(u));

  const existing = await prisma.canvasGenerationTask.findUnique({
    where: { id: taskId },
    select: { status: true, resultPayload: true },
  });
  if (!existing || existing.status !== "SUBMITTED") {
    const done = await prisma.canvasGenerationTask.findUnique({
      where: { id: taskId },
    });
    if (done) {
      return {
        reused: done.status === "SUCCEEDED",
        task: done,
      };
    }
    throw new CanvasProjectError(
      "NOT_FOUND",
      "LLM 任务不存在或已结束",
      404,
    );
  }
  const prevPayload =
    (existing.resultPayload as Record<string, unknown> | null) ?? {};
  if (prevPayload.llmExecuteClaimed === true) {
    const done = await prisma.canvasGenerationTask.findUnique({
      where: { id: taskId },
    });
    if (done) return { reused: done.status === "SUCCEEDED", task: done };
  }
  await prisma.canvasGenerationTask.update({
    where: { id: taskId },
    data: {
      resultPayload: {
        ...prevPayload,
        llmExecuteClaimed: true,
      } as Prisma.InputJsonValue,
    },
  });

  try {
    const customSystem =
      engineKind === "story-outline-engine"
        ? String(data.outlineSystemPrompt ?? data.systemPrompt ?? "").trim()
        : "";
    const systemPrompt =
      customSystem || storyEngineSystemFallback(engineKind);
    const userContent: (
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
      | { type: "video_url"; video_url: { url: string } }
    )[] = [];
    for (const u of pureImageUrls) {
      userContent.push({ type: "image_url", image_url: { url: u } });
    }
    for (const u of videoUrls) {
      userContent.push({ type: "video_url", video_url: { url: u } });
    }
    userContent.push({
      type: "text",
      text: clipPrompt(userText, STORY_LLM_MAX_PROMPT_LEN),
    });

    const messages: import("./providers/types").CanvasChatMessage[] = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content:
          userContent.length === 1 && userContent[0].type === "text"
            ? userContent[0].text
            : userContent,
      },
    ];
    const structuredPro2 = isPro2StructuredLlmScope(storyScope);
    const structuredScriptStudio = isScriptStudioStructuredLlmScope(storyScope);
    const llmParams = structuredPro2
      ? mergePro2StructuredLlmParams(params)
      : structuredScriptStudio
        ? mergeScriptStudioStructuredLlmParams(params)
        : params;

    let resp = await canvasGwChatWithOverloadRetry(userId, {
      modelKey,
      messages,
      params: llmParams,
      clientPage: gwClientPage,
      projectId,
      canvasTaskId: taskId,
    });

    let outputText = (resp.text ?? "").trim();
    let pro2Validation: ReturnType<
      typeof validatePro2ProductionScriptLlmOutput
    > | null = null;
    let scriptStudioValidation: ReturnType<
      typeof validateScriptStudioBatchLlmOutput
    > | null = null;
    let pro2AttemptCount = 0;
    let scriptStudioAttemptCount = 0;
    const pro2GatewayLogIds: string[] = [];
    const scriptStudioGatewayLogIds: string[] = [];

    if (structuredPro2) {
      let chatMessages = messages;
      let lastError = "结构化 JSON 校验失败";

      for (
        let attempt = 1;
        attempt <= PRO2_STRUCTURED_LLM_MAX_ATTEMPTS;
        attempt++
      ) {
        pro2AttemptCount = attempt;
        if (attempt > 1) {
          resp = await canvasGwChatWithOverloadRetry(userId, {
            modelKey,
            messages: chatMessages,
            params: llmParams,
            clientPage: gwClientPage,
            projectId,
            canvasTaskId: taskId,
          });
        }
        if (resp.logId) pro2GatewayLogIds.push(resp.logId);

        outputText = (resp.text ?? "").trim();
        if (!outputText) {
          lastError = "模型返回空内容";
          if (resp.logId) {
            await voidGatewayLogForPro2ValidationFailure(resp.logId, {
              error: lastError,
              attempt,
              maxAttempts: PRO2_STRUCTURED_LLM_MAX_ATTEMPTS,
              canvasTaskId: taskId,
            });
          }
          if (attempt >= PRO2_STRUCTURED_LLM_MAX_ATTEMPTS) {
            pro2Validation = { ok: false, error: lastError };
            break;
          }
          chatMessages = [
            ...chatMessages,
            {
              role: "user" as const,
              content:
                "上一回复为空。请只输出 ```pro2-production-script``` JSON 围栏，禁止说明文字。",
            },
          ];
          continue;
        }

        pro2Validation = validatePro2ProductionScriptLlmOutput(
          outputText,
          storyScope,
        );
        if (pro2Validation.ok) {
          outputText = ensurePro2ProductionScriptFence(outputText);
          break;
        }

        lastError = pro2Validation.error ?? "校验失败";
        if (resp.logId) {
          await voidGatewayLogForPro2ValidationFailure(resp.logId, {
            error: lastError,
            attempt,
            maxAttempts: PRO2_STRUCTURED_LLM_MAX_ATTEMPTS,
            canvasTaskId: taskId,
          });
        }

        if (attempt >= PRO2_STRUCTURED_LLM_MAX_ATTEMPTS) break;

        chatMessages = [
          ...chatMessages,
          { role: "assistant" as const, content: outputText },
          {
            role: "user" as const,
            content: buildPro2StructuredRetryUserMessage(lastError, attempt),
          },
        ];
      }

      if (pro2Validation && !pro2Validation.ok && outputText) {
        outputText = ensurePro2ProductionScriptFence(outputText);
      }
    }

    if (structuredScriptStudio) {
      let chatMessages = messages;
      let lastError = "结构化 JSON 校验失败";

      for (
        let attempt = 1;
        attempt <= SCRIPT_STUDIO_STRUCTURED_LLM_MAX_ATTEMPTS;
        attempt++
      ) {
        scriptStudioAttemptCount = attempt;
        if (attempt > 1) {
          resp = await canvasGwChatWithOverloadRetry(userId, {
            modelKey,
            messages: chatMessages,
            params: llmParams,
            clientPage: gwClientPage,
            projectId,
            canvasTaskId: taskId,
          });
        }
        if (resp.logId) scriptStudioGatewayLogIds.push(resp.logId);

        outputText = (resp.text ?? "").trim();
        if (!outputText) {
          lastError = "模型返回空内容";
          if (resp.logId) {
            await voidGatewayLogForPro2ValidationFailure(resp.logId, {
              error: lastError,
              attempt,
              maxAttempts: SCRIPT_STUDIO_STRUCTURED_LLM_MAX_ATTEMPTS,
              canvasTaskId: taskId,
            });
          }
          if (attempt >= SCRIPT_STUDIO_STRUCTURED_LLM_MAX_ATTEMPTS) {
            scriptStudioValidation = { ok: false, error: lastError };
            break;
          }
          chatMessages = [
            ...chatMessages,
            {
              role: "user" as const,
              content:
                "上一回复为空。请只输出 ```script-studio-batch``` JSON 围栏，禁止说明文字。",
            },
          ];
          continue;
        }

        scriptStudioValidation = validateScriptStudioBatchLlmOutput(outputText);
        if (scriptStudioValidation.ok) {
          outputText = ensureScriptStudioBatchFence(outputText);
          break;
        }

        lastError = scriptStudioValidation.error ?? "校验失败";
        if (resp.logId) {
          await voidGatewayLogForPro2ValidationFailure(resp.logId, {
            error: lastError,
            attempt,
            maxAttempts: SCRIPT_STUDIO_STRUCTURED_LLM_MAX_ATTEMPTS,
            canvasTaskId: taskId,
          });
        }

        if (attempt >= SCRIPT_STUDIO_STRUCTURED_LLM_MAX_ATTEMPTS) break;

        chatMessages = [
          ...chatMessages,
          { role: "assistant" as const, content: outputText },
          {
            role: "user" as const,
            content: buildScriptStudioStructuredRetryUserMessage(
              lastError,
              attempt,
            ),
          },
        ];
      }

      if (scriptStudioValidation && !scriptStudioValidation.ok && outputText) {
        outputText = ensureScriptStudioBatchFence(outputText);
      }
    }

    if (structuredPro2 && pro2Validation && !pro2Validation.ok) {
      const failed = await prisma.canvasGenerationTask.update({
        where: { id: taskId },
        data: {
          status: "FAILED",
          failCode: PRO2_GATEWAY_VALIDATION_FAIL_CODE,
          failMessage:
            pro2Validation.error?.slice(0, 500) ??
            `结构化 JSON 校验失败（已尝试 ${pro2AttemptCount} 次）`,
          completedAt: new Date(),
          resultPayload: {
            pro2ScriptValidation: {
              ok: false,
              error: pro2Validation.error,
              attempts: pro2AttemptCount,
              maxAttempts: PRO2_STRUCTURED_LLM_MAX_ATTEMPTS,
              gatewayLogIds: pro2GatewayLogIds,
            },
          } as Prisma.InputJsonValue,
        },
      });
      return { reused: false, task: failed };
    }

    if (
      structuredScriptStudio &&
      scriptStudioValidation &&
      !scriptStudioValidation.ok
    ) {
      const failed = await prisma.canvasGenerationTask.update({
        where: { id: taskId },
        data: {
          status: "FAILED",
          failCode: PRO2_GATEWAY_VALIDATION_FAIL_CODE,
          failMessage:
            scriptStudioValidation.error?.slice(0, 500) ??
            `Script Studio JSON 校验失败（已尝试 ${scriptStudioAttemptCount} 次）`,
          completedAt: new Date(),
          resultPayload: {
            scriptStudioValidation: {
              ok: false,
              error: scriptStudioValidation.error,
              attempts: scriptStudioAttemptCount,
              maxAttempts: SCRIPT_STUDIO_STRUCTURED_LLM_MAX_ATTEMPTS,
              gatewayLogIds: scriptStudioGatewayLogIds,
            },
          } as Prisma.InputJsonValue,
        },
      });
      return { reused: false, task: failed };
    }

    // 模型返回空内容
    // 否则前端会从「生成中」直接翻到 done 且无正文，表现为「转圈一会就消失但没生成」。
    if (!outputText) {
      const failed = await prisma.canvasGenerationTask.update({
        where: { id: taskId },
        data: {
          status: "FAILED",
          failCode: "STORY_LLM_EMPTY",
          failMessage:
            "模型返回了空内容，请重试或更换文本模型（部分推理模型在预算不足时会无正文输出）。",
          completedAt: new Date(),
        },
      });
      return { reused: false, task: failed };
    }
    const scriptStudioMirror =
      structuredScriptStudio && scriptStudioValidation?.ok
        ? scriptStudioMirrorPayload(outputText, scriptStudioValidation.batch)
        : data.scriptStudioMode === true
          ? scriptStudioMirrorPayload(outputText)
          : null;
    const updated = await prisma.canvasGenerationTask.update({
      where: { id: taskId },
      data: {
        status: "SUCCEEDED",
        textOutput: outputText,
        resultPayload: {
          ...(typeof resp.rawPayload === "object" && resp.rawPayload
            ? (resp.rawPayload as Record<string, unknown>)
            : {}),
          ...(scriptStudioMirror ?? {}),
          ...(structuredPro2
            ? {
                pro2ScriptValidation: {
                  ok: pro2Validation?.ok ?? false,
                  error: pro2Validation?.error,
                  attempts: pro2AttemptCount,
                  maxAttempts: PRO2_STRUCTURED_LLM_MAX_ATTEMPTS,
                  gatewayLogIds: pro2GatewayLogIds,
                },
              }
            : {}),
          ...(structuredScriptStudio
            ? {
                scriptStudioValidation: {
                  ok: scriptStudioValidation?.ok ?? false,
                  error: scriptStudioValidation?.error,
                  attempts: scriptStudioAttemptCount,
                  maxAttempts: SCRIPT_STUDIO_STRUCTURED_LLM_MAX_ATTEMPTS,
                  gatewayLogIds: scriptStudioGatewayLogIds,
                },
              }
            : {}),
        } as Prisma.InputJsonValue,
        inputPayload: {
          kind: engineKind,
          prompt: clipPrompt(userText, STORY_LLM_MAX_PROMPT_LEN),
          params: llmParams,
          providerId,
          modelKey,
          textInputs: node.textInputs ?? [],
          ...(storyScope ? { storyScope } : {}),
          gatewayLogId: resp.logId,
        } as Prisma.InputJsonValue,
        submittedAt: new Date(),
        completedAt: new Date(),
      },
    });
    return { reused: false, task: updated };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const code = "STORY_LLM_FAILED";
    const updated = await prisma.canvasGenerationTask.update({
      where: { id: taskId },
      data: {
        status: "FAILED",
        failCode: code,
        failMessage: storyLlmUserFailMessage(msg),
        completedAt: new Date(),
      },
    });
    return { reused: false, task: updated };
  }
}

function storyLlmUserFailMessage(raw: string): string {
  const msg = raw.trim();
  if (isEngineOverloadedMessage(msg)) {
    return engineOverloadedUserHintZh();
  }
  if (/aborted due to timeout|timed out|timeout/i.test(msg)) {
    return "文本模型生成超时（长剧本/大输出较慢，约需数分钟）。请直接重试；若仍失败可缩短上游剧本或暂时换更快模型。";
  }
  return msg.slice(0, 500);
}

/** Story LLM 引擎 —— 同步 Markdown 文本，不注入海报 system prompt。 */
export async function runStoryLlmEngineNode(
  args: RunEngineNodeArgs & { engineKind: StoryLlmKind },
): Promise<RunEngineNodeResult> {
  const { userId, projectId, nodeId, node, engineKind } = args;
  const gwClientPage = resolveCanvasClientPage(projectId, args.clientPage);
  const data = node.data ?? {};
  const providerId = String(data.providerId ?? "");
  const modelKey = String(data.modelKey ?? node.modelKey ?? "");
  const promptRaw = String(data.prompt ?? "");
  const params = (data.params as Record<string, unknown>) ?? {};

  if (!providerId)
    throw new CanvasProjectError("INVALID_INPUT", `${engineKind} 缺少 providerId`);
  if (!modelKey)
    throw new CanvasProjectError("INVALID_INPUT", `${engineKind} 缺少 modelKey`);

  assertCanvasProviderMatchesModelRoute(providerId, modelKey);

  const expandedPrompt = expandMentionsText(promptRaw, node);
  const upstreamText = (node.textInputs ?? []).filter((s) => s && s.trim());
  if (!expandedPrompt.trim() && upstreamText.length === 0) {
    throw new CanvasProjectError(
      "EMPTY_PROMPT",
      `${engineKind} 既没有 prompt 也没有上游文本`,
    );
  }

  const userTextParts = [expandedPrompt.trim()];
  if (upstreamText.length > 0) {
    userTextParts.push(
      "# 创意参考 / 上游输入",
      ...upstreamText.map((t, i) => `## 参考 ${i + 1}\n${t.trim()}`),
    );
  }
  const userText = userTextParts.filter(Boolean).join("\n\n");

  const mediaUrls = (node.imageInputs ?? []).filter(
    (u): u is string => typeof u === "string" && /^https?:\/\//.test(u),
  );
  const videoUrls = mediaUrls.filter((u) => isLikelyVideoUrl(u));
  const imageUrls = mediaUrls.filter((u) => !isLikelyVideoUrl(u));
  if (imageUrls.length > 0 || videoUrls.length > 0) {
    try {
      assertStoryLlmVisionModel(modelKey, "多模态 LLM");
    } catch (e) {
      throw new CanvasProjectError(
        "MODEL_CAPABILITY_MISMATCH",
        e instanceof Error ? e.message : String(e),
        400,
      );
    }
  }
  const inputHash = computeInputHash({
    modelKey,
    prompt: userText,
    imageUrls: mediaUrls,
    params,
    providerId,
  });

  await shouldCanvasUseGateway(userId, providerId, modelKey);

  if (!args.forceFresh) {
    const reusable = await findReusableSucceededTask({
      projectId,
      nodeId,
      inputHash,
      useGateway: true,
    });
    if (reusable) return { reused: true, task: reusable };
  }

  await ensureProjectInflightCapacity(projectId);
  await ensureUserInflightCapacity(userId);

  // 事务内 advisory lock + 冲突检查占位，避免 ensure + create 竞态导致同段重复提交。
  const created = await createStoryScopedCanvasTask({
    projectId,
    nodeId,
    storyScope: args.storyScope,
    skipInflightScopeConflict: shouldSkipInflightScopeConflictForRun(args),
    initialStatus: "SUBMITTED",
    data: {
      kind: "TEXT",
      model: modelKey,
      providerId: null,
      inputHash,
      inputPayload: {
        kind: engineKind,
        prompt: clipPrompt(userText, STORY_LLM_MAX_PROMPT_LEN),
        params,
        providerId,
        modelKey,
        textInputs: node.textInputs ?? [],
        ...(args.storyScope ? { storyScope: args.storyScope } : {}),
      } as Prisma.InputJsonValue,
      submittedAt: new Date(),
    },
  });

  const execCtx: StoryLlmExecutionContext = {
    userId,
    projectId,
    nodeId,
    node,
    engineKind,
    gwClientPage,
    storyScope: args.storyScope,
    data,
    modelKey,
    providerId,
    params,
    userText,
    imageUrls: mediaUrls,
  };

  if (args.executeAsync) {
    setImmediate(() => {
      void executeStoryLlmEngineTask(created.id, execCtx).catch((e) => {
        console.error("[canvas/story-llm] async execute failed", {
          taskId: created.id,
          error: e instanceof Error ? e.message : String(e),
        });
      });
    });
    return { reused: false, task: created };
  }

  return executeStoryLlmEngineTask(created.id, execCtx);
}

/** 视频引擎 —— KIE 图生视频，异步 poll。 */
export async function runVideoEngineNode(
  args: RunEngineNodeArgs,
): Promise<RunEngineNodeResult> {
  const { userId, projectId, nodeId, node } = args;
  const gwClientPage = resolveCanvasClientPage(projectId, args.clientPage);
  const data = node.data ?? {};
  const providerId = String(data.providerId ?? "");
  let modelKey = String(data.modelKey ?? node.modelKey ?? "");
  const promptRaw = String(data.prompt ?? "");
  const params = (data.params as Record<string, unknown>) ?? {};

  if (!providerId)
    throw new CanvasProjectError("INVALID_INPUT", "video-engine 缺少 providerId");
  if (!modelKey)
    throw new CanvasProjectError("INVALID_INPUT", "video-engine 缺少 modelKey");

  const upstreamText = (node.textInputs ?? []).filter((s) => s && s.trim());
  const promptBase = [promptRaw.trim(), ...upstreamText]
    .filter(Boolean)
    .join("\n\n");

  const imageInputs = (node.imageInputs ?? []).filter(
    (u): u is string => typeof u === "string" && /^https?:\/\//.test(u),
  );
  const mainFrameImageUrl = String(
    data.mainFrameImageUrl ?? imageInputs[0] ?? "",
  ).trim();
  const referenceImageUrls = Array.isArray(data.referenceImageUrls)
    ? (data.referenceImageUrls as unknown[]).filter(
        (u): u is string =>
          typeof u === "string" &&
          /^https?:\/\//.test(u) &&
          u !== mainFrameImageUrl,
      )
    : imageInputs.slice(1);
  const lastFrameImageUrl = String(data.lastFrameImageUrl ?? "").trim();

  /** 分镜视频 · 有静帧时 HappyHorse T2V 须升 I2V（仅静帧）或 R2V（静帧+@资产） */
  if (isDashscopeHappyhorseTextToVideoModel(modelKey) && mainFrameImageUrl) {
    const extraRefs = referenceImageUrls.filter((u) => u !== mainFrameImageUrl);
    if (extraRefs.length === 0) {
      modelKey = modelKey.replace(/-t2v$/, "-i2v");
    } else {
      modelKey = dashscopeSbv1T2vModelToR2v(modelKey) ?? modelKey;
    }
  }

  const t2vRefMismatch = resolveDashscopeT2vRefMismatchMessage(modelKey, [
    mainFrameImageUrl,
    ...(lastFrameImageUrl ? [lastFrameImageUrl] : []),
    ...referenceImageUrls,
  ]);
  if (t2vRefMismatch) {
    throw new CanvasProjectError("INVALID_INPUT", t2vRefMismatch);
  }
  const forceReferenceMode = data.forceReferenceMode === true;
  const portraitAssetRefs = normalizePortraitAssetRefs(
    node.portraitAssetRefs ?? data.portraitAssetRefs,
  );
  const effectiveForceReferenceMode =
    forceReferenceMode || portraitAssetRefs.length > 0;
  const isMotionControl =
    modelKey === "kling-2.6/motion-control" ||
    modelKey === "kling-3.0/motion-control";
  const isTopazDirectV2v = isTopazCanvasVideoModelKey(modelKey);
  const isKieTopazUpscale = modelKey === "topaz/video-upscale";
  const isVideoOnlyV2v =
    isTopazDirectV2v || isKieTopazUpscale || modelKey === "wan/2-6-video-to-video";
  const dockInputModeRaw = String(data.dockInputMode ?? "").trim();
  const isDashscopeT2v = isDashscopeSbv1TextToVideoModel(modelKey);
  const isDashscopeHappyhorseI2v =
    isDashscopeHappyhorseImageToVideoModel(modelKey);
  const isKlingT2v =
    modelKey === "kling-3.0/video" &&
    (dockInputModeRaw === "t2v" || !dockInputModeRaw);
  const isVolcengineT2v =
    isVolcengineStoryVideoModelKey(modelKey) && dockInputModeRaw === "t2v";
  const isMinimaxT2v =
    isMinimaxCanvasVideoModelKey(modelKey) &&
    (modelKey.toLowerCase().includes("-t2v") ||
      modelKey.toLowerCase().includes("context-ir"));
  const isTextToVideoOnly =
    isDashscopeT2v || isKlingT2v || isVolcengineT2v || isMinimaxT2v;
  const motionVideoUrls = isMotionControl || isVideoOnlyV2v
    ? (Array.isArray(params.reference_video_urls)
        ? (params.reference_video_urls as unknown[])
        : []
      ).filter(
        (u): u is string =>
          typeof u === "string" && /^https?:\/\//.test(u.trim()),
      )
    : [];
  const expandedPrompt = expandVideoPrompt(promptBase, referenceImageUrls);
  if (!isMotionControl && !isVideoOnlyV2v && !expandedPrompt.trim()) {
    throw new CanvasProjectError("EMPTY_PROMPT", "video-engine prompt 为空");
  }

  if (
    !isVideoOnlyV2v &&
    !isTextToVideoOnly &&
    !mainFrameImageUrl &&
    portraitAssetRefs.length === 0
  ) {
    throw new CanvasProjectError(
      "INVALID_INPUT",
      "video-engine 需要分镜图作为主图",
    );
  }

  if (isVideoOnlyV2v && !motionVideoUrls.length) {
    throw new CanvasProjectError(
      "INVALID_INPUT",
      "高清视频需要连接上游视频（视频节点右侧 + · 高清视频，或左侧接入驱动视频）",
    );
  }

  if (isMotionControl && !motionVideoUrls.length) {
    throw new CanvasProjectError(
      "INVALID_INPUT",
      "动作控制需要连接驱动动作视频（视频节点左侧 + · 添加上游视频）",
    );
  }

  const isBailianR2v = (BAILIAN_R2V_MODEL_IDS as readonly string[]).includes(
    modelKey,
  );

  const VIDEO_MULTI_REF_MODEL = "bytedance/seedance-2";
  let effectiveModelKey = modelKey;
  const providerIsVolcengine =
    providerId === GATEWAY_VOLCENGINE_PROVIDER_ID ||
    providerId.toLowerCase().includes("volcengine");
  if (
    referenceImageUrls.length > 0 &&
    !isBailianR2v &&
    !isMotionControl &&
    modelKey !== "kling-3.0/video" &&
    modelKey !== "kling/v3-turbo-image-to-video" &&
    modelKey !== "wan/2-7-image-to-video" &&
    !modelHasStoryCapabilities(modelKey, ["video_multi_ref"])
  ) {
    effectiveModelKey =
      providerIsVolcengine || isVolcengineStoryVideoModelKey(modelKey)
        ? VOLCENGINE_VIDEO_MULTI_REF_MODEL
        : VIDEO_MULTI_REF_MODEL;
  }

  const allSubmittedImageUrls = [
    mainFrameImageUrl,
    ...referenceImageUrls,
  ].filter((u, i, arr) => arr.indexOf(u) === i);
  if (isBailianR2v) {
    const referenceImageUrlsForR2v = [
      mainFrameImageUrl,
      ...(lastFrameImageUrl ? [lastFrameImageUrl] : []),
      ...referenceImageUrls,
    ].filter(
      (u, i, arr) => Boolean(u?.trim()) && arr.indexOf(u) === i,
    );
    if (referenceImageUrlsForR2v.length < 1) {
      if (portraitAssetRefs.length > 0) {
        throw new CanvasProjectError(
          "INVALID_INPUT",
          "该模型需要公网 HTTPS 参考图，不支持人像库 asset://。请使用 OSS 原图，或改用火山 Seedance 模型。",
        );
      }
      throw new CanvasProjectError(
        "INVALID_INPUT",
        "百炼参考生视频需要至少 1 张参考图",
      );
    }
    return runRefVideoEngineNode({
      ...args,
      node: {
        type: "ai-video-engine",
        modelKey,
        data: {
          providerId,
          modelKey,
          params,
          prompt: expandedPrompt,
        },
        imageInputs: referenceImageUrlsForR2v,
        textInputs: [],
      },
    });
  }

  if (!(STORY_VIDEO_MODEL_IDS as readonly string[]).includes(effectiveModelKey)) {
    if (
      !isVolcengineStoryVideoModelKey(effectiveModelKey) &&
      !isMinimaxCanvasVideoModelKey(effectiveModelKey) &&
      !isMotionControl &&
      !isVideoOnlyV2v &&
      !isDashscopeT2v
    ) {
      throw new CanvasProjectError(
        "INVALID_INPUT",
        `video-engine 不支持模型 ${effectiveModelKey}`,
      );
    }
  }

  await shouldCanvasUseGateway(userId, providerId, effectiveModelKey);

  const isVolcengineVideo = isVolcengineStoryVideoModelKey(effectiveModelKey);
  const isMinimaxVideo = isMinimaxCanvasVideoModelKey(effectiveModelKey);

  const inputHash = computeInputHash({
    modelKey: effectiveModelKey,
    prompt: expandedPrompt,
    imageUrls: isVideoOnlyV2v ? motionVideoUrls : allSubmittedImageUrls,
    params: {
      ...params,
      portraitAssetRefs,
    },
    providerId,
  });

  if (!args.forceFresh) {
    const reusable = await findReusableSucceededTask({
      projectId,
      nodeId,
      inputHash,
      useGateway: true,
    });
    if (reusable) return { reused: true, task: reusable };
  }

  if (!args.forceFresh) {
    await assertNoProjectInflightByInputHash(projectId, inputHash);
  }
  if (!args.forceFresh) {
    await ensureNoActiveTaskForScope(projectId, nodeId, args.storyScope);
  }
  await ensureProjectInflightCapacity(projectId);
  await ensureUserInflightCapacity(userId);

  let kieMainFrame = mainFrameImageUrl;
  let kieReferenceImageUrls = referenceImageUrls;
  let kieLastFrame = lastFrameImageUrl;
  if (!isVolcengineVideo) {
    const needsNorm =
      isMotionControl ||
      Boolean(kieMainFrame) ||
      kieReferenceImageUrls.length > 0 ||
      Boolean(kieLastFrame);
    if (needsNorm) {
      const normalized = await normalizeKieVideoRefImageUrls({
        userId,
        mainFrameImageUrl: kieMainFrame,
        referenceImageUrls: kieReferenceImageUrls,
        lastFrameImageUrl: kieLastFrame,
      });
      kieMainFrame = normalized.mainFrameImageUrl;
      kieReferenceImageUrls = normalized.referenceImageUrls;
      kieLastFrame = normalized.lastFrameImageUrl;
    }
  }

  let model: string;
  let input: Record<string, unknown>;
  let dashscopeVideoBody: Record<string, unknown> | undefined;
  let videoProviderKind: "VOLCENGINE" | "KIE" | "TOPAZ" | "DASHSCOPE" | "MINIMAX" =
    isVolcengineVideo ? "VOLCENGINE" : isMinimaxVideo ? "MINIMAX" : "KIE";

  if (isTopazDirectV2v) {
    model = effectiveModelKey;
    const hdResolution = String(
      data.resolution ?? params.resolution ?? "1080p",
    );
    input = {
      video_url: motionVideoUrls[0],
      filter_model: String(params.filter_model ?? "proteus"),
      upscale_factor: topazUpscaleFromHdResolution(hdResolution),
      resolution: hdResolution,
      slowmo: parseTopazSlowmoFactor(params.slowmo),
      frame_interpolation: parseTopazFrameInterpolation(
        params.frame_interpolation ?? params.frameInterpolation,
      ),
    };
    videoProviderKind = "TOPAZ";
  } else if (isKieTopazUpscale) {
    try {
      const built = buildKieToolVideoCreateArgs({
        model: effectiveModelKey,
        videoUrl: motionVideoUrls[0],
        upscaleFactor:
          params.upscale_factor != null || params.upscaleFactor != null
            ? Number(params.upscale_factor ?? params.upscaleFactor)
            : undefined,
      });
      model = built.model;
      input = built.input;
    } catch (e) {
      throw new CanvasProjectError(
        "INVALID_INPUT",
        e instanceof Error ? e.message : String(e),
      );
    }
  } else if (isVolcengineVideo) {
    const refVideos = Array.isArray(params.reference_video_urls)
      ? params.reference_video_urls.filter(
          (u): u is string => typeof u === "string",
        )
      : undefined;
    const refAudios = Array.isArray(params.reference_audio_urls)
      ? params.reference_audio_urls.filter(
          (u): u is string => typeof u === "string",
        )
      : undefined;
    const built = buildCanvasVideoVolcengineInput({
      modelKey: effectiveModelKey,
      prompt: expandedPrompt,
      imageUrl: mainFrameImageUrl,
      referenceImageUrls,
      referenceVideoUrls: refVideos,
      referenceAudioUrls: refAudios,
      assetRefs: portraitAssetRefs,
      lastFrameUrl: lastFrameImageUrl,
      forceReferenceMode: effectiveForceReferenceMode,
      options: {
        resolution: String(params.resolution ?? "1080p"),
        duration: Number(params.duration ?? 5),
        generateAudio: params.generate_audio === true || params.generateAudio === true,
        watermark: params.watermark === true,
      },
      aspectRatio: String(params.aspect_ratio ?? "16:9"),
    });
    model = built.model;
    input = built.body as Record<string, unknown>;
  } else if (isMinimaxVideo) {
    const refVideos = Array.isArray(params.reference_video_urls)
      ? params.reference_video_urls.filter(
          (u): u is string => typeof u === "string",
        )
      : undefined;
    const refAudios = Array.isArray(params.reference_audio_urls)
      ? params.reference_audio_urls.filter(
          (u): u is string => typeof u === "string",
        )
      : undefined;
    const built = buildCanvasVideoMinimaxInput({
      modelKey: effectiveModelKey,
      prompt: expandedPrompt,
      imageUrl: mainFrameImageUrl,
      lastFrameUrl: lastFrameImageUrl,
      referenceImageUrls,
      referenceVideoUrls: refVideos,
      referenceAudioUrls: refAudios,
      options: {
        resolution: String(params.resolution ?? "2K"),
        duration: Number(params.duration ?? 5),
        ratio: String(params.ratio ?? params.aspect_ratio ?? "16:9"),
        aigc_watermark: params.aigc_watermark === true,
        generateAudio:
          params.generate_audio !== false && params.generateAudio !== false,
      },
    });
    model = built.modelKey;
    input = built.input;
    videoProviderKind = "MINIMAX";
  } else if (isDashscopeT2v) {
    try {
      const aspectRatio = String(
        params.ratio ?? params.aspect_ratio ?? data.aspectRatio ?? "16:9",
      );
      const resolution = String(
        params.resolution ?? data.resolution ?? "720p",
      );
      const durationSec = Number(params.duration ?? data.durationSec ?? 5);
      const dockMode = String(data.dockInputMode ?? "").trim();
      const wan30Media = isDashscopeWan30VideoModel(effectiveModelKey)
        ? dockMode === "first_last" || Boolean(kieLastFrame)
          ? buildDashscopeWan30Media({
              firstFrameUrl: kieMainFrame,
              lastFrameUrl: kieLastFrame,
              referenceImageUrls: kieReferenceImageUrls,
            })
          : dockMode === "i2v"
            ? buildDashscopeWan30Media({
                firstFrameUrl: kieMainFrame,
              })
            : buildDashscopeWan30Media({
                firstFrameUrl: "",
                referenceImageUrls: [kieMainFrame, ...kieReferenceImageUrls].filter(
                  Boolean,
                ),
              })
        : undefined;
      dashscopeVideoBody = buildDashscopeSbv1T2vVideoBody({
        prompt: expandedPrompt,
        aspectRatio,
        resolution,
        durationSec,
        promptExtend: params.prompt_extend !== false,
        modelKey: effectiveModelKey,
        watermark: params.watermark === true,
        media: wan30Media,
      });
      model = effectiveModelKey;
      input = dashscopeVideoBody;
      videoProviderKind = "DASHSCOPE";
    } catch (e) {
      throw new CanvasProjectError(
        "INVALID_INPUT",
        e instanceof Error ? e.message : String(e),
      );
    }
  } else if (isDashscopeHappyhorseI2v) {
    try {
      const aspectRatio = String(
        params.ratio ?? params.aspect_ratio ?? data.aspectRatio ?? "16:9",
      );
      const resolution = String(
        params.resolution ?? data.resolution ?? "720p",
      );
      const durationSec = Number(params.duration ?? data.durationSec ?? 5);
      dashscopeVideoBody = buildDashscopeHappyhorseI2vVideoBody({
        prompt: expandedPrompt,
        firstFrameUrl: mainFrameImageUrl,
        aspectRatio,
        resolution,
        durationSec,
        watermark: params.watermark === true,
      });
      model = effectiveModelKey;
      input = dashscopeVideoBody;
      videoProviderKind = "DASHSCOPE";
    } catch (e) {
      throw new CanvasProjectError(
        "INVALID_INPUT",
        e instanceof Error ? e.message : String(e),
      );
    }
  } else if (isDashscopeKlingV3VideoGatewayModel(effectiveModelKey)) {
    try {
      const aspectRaw = String(
        params.ratio ?? params.aspect_ratio ?? data.aspectRatio ?? "16:9",
      );
      const aspectRatio =
        aspectRaw === "9:16"
          ? "9:16"
          : aspectRaw === "1:1"
            ? "1:1"
            : "16:9";
      const durationSec = Number(params.duration ?? data.durationSec ?? 5);
      const modeRaw = String(params.mode ?? "pro");
      const mode =
        modeRaw === "std" || modeRaw === "pro" || modeRaw === "4k"
          ? modeRaw
          : "pro";
      const multiShot = params.multi_shots === true;
      const audio =
        params.sound !== false &&
        params.generate_audio !== false &&
        params.generateAudio !== false;
      const upstreamModel = resolveDashscopeKlingV3UpstreamModel({
        firstFrameUrl: isKlingT2v ? null : kieMainFrame,
        lastFrameUrl: kieLastFrame,
        referImageUrls: kieReferenceImageUrls,
        multiShot,
      });
      dashscopeVideoBody = buildDashscopeKlingV3VideoBody({
        prompt: expandedPrompt,
        firstFrameUrl: isKlingT2v ? null : kieMainFrame,
        lastFrameUrl: kieLastFrame,
        referImageUrls: kieReferenceImageUrls,
        aspectRatio,
        durationSec,
        mode,
        audio,
        watermark: params.watermark === true,
        multiShot,
      });
      model = upstreamModel;
      input = dashscopeVideoBody;
      videoProviderKind = "DASHSCOPE";
    } catch (e) {
      throw new CanvasProjectError(
        "INVALID_INPUT",
        e instanceof Error ? e.message : String(e),
      );
    }
  } else if (isMotionControl) {
    try {
      const built = buildKieToolVideoCreateArgs({
        model: effectiveModelKey,
        prompt: expandedPrompt.trim() || promptRaw.trim() || undefined,
        imageUrls: kieMainFrame ? [kieMainFrame] : [],
        videoUrls: motionVideoUrls,
        mode: String(params.mode ?? ""),
        characterOrientation: String(
          params.character_orientation ?? "video",
        ),
      });
      model = built.model;
      input = built.input;
    } catch (e) {
      throw new CanvasProjectError(
        "INVALID_INPUT",
        e instanceof Error ? e.message : String(e),
      );
    }
  } else {
    const built = buildCanvasVideoKieInput({
      modelKey: effectiveModelKey,
      prompt: expandedPrompt,
      imageUrl: kieMainFrame,
      referenceImageUrls: kieReferenceImageUrls,
      lastFrameUrl: kieLastFrame || undefined,
      options: {
        resolution: String(params.resolution ?? "1080p"),
        duration: Number(params.duration ?? 5),
        generateAudio:
          params.generate_audio === true || params.generateAudio === true,
        promptExtend: params.promptExtend !== false,
        watermark: params.watermark === true,
        mode: typeof params.mode === "string" ? params.mode : undefined,
        multi_shots: params.multi_shots === true,
        sound:
          params.sound !== false && params.generate_audio !== false,
      },
      aspectRatio:
        params.aspect_ratio === "9:16"
          ? "9:16"
          : params.aspect_ratio === "1:1"
            ? "1:1"
            : "16:9",
    });
    model = built.model;
    input = built.input as Record<string, unknown>;
  }

  await assertVideoCreditsBeforeTrafficQueue({
    userId,
    projectId,
    model: effectiveModelKey,
    params,
  });

  const created = await createStoryScopedCanvasTask({
    projectId,
    nodeId,
    storyScope: args.storyScope,
    actorUserId: userId,
    skipInflightScopeConflict: shouldSkipInflightScopeConflictForRun(args),
    initialStatus: isTrafficControlEnabled() ? "QUEUED" : "PENDING",
    data: {
      kind: "IMAGE",
      model: effectiveModelKey,
      providerId: null,
      inputHash,
      inputPayload: {
        kind: "video-engine",
        prompt: clipPrompt(expandedPrompt),
        params,
        providerId,
        modelKey: effectiveModelKey,
        modelKeyRequested: modelKey !== effectiveModelKey ? modelKey : undefined,
        imageUrls: allSubmittedImageUrls,
        mainFrameImageUrl,
        referenceImageUrls,
        providerKind: videoProviderKind,
        ...(videoProviderKind === "VOLCENGINE"
          ? { volcengineModel: model, volcengineBody: input }
          : videoProviderKind === "MINIMAX"
            ? { minimaxModel: model, minimaxInput: input }
          : videoProviderKind === "TOPAZ"
            ? { topazModel: model, topazInput: input }
            : videoProviderKind === "DASHSCOPE"
              ? { dashscopeModel: model, dashscopeVideoBody: dashscopeVideoBody ?? input }
              : { kieModel: model, kieInput: input }),
        ...(data.sbv1Billing && typeof data.sbv1Billing === "object"
          ? { sbv1Billing: data.sbv1Billing }
          : {}),
        ...(args.storyScope ? { storyScope: args.storyScope } : {}),
        clientPage: gwClientPage,
        gatewayCredentialId:
          typeof data.gatewayCredentialId === "string" &&
          data.gatewayCredentialId.trim()
            ? data.gatewayCredentialId.trim()
            : undefined,
      } as Prisma.InputJsonValue,
    },
  });

  if (created.status === "QUEUED") {
    fireCanvasDispatchForProject(projectId, "runVideoEngineNode");
    return { reused: false, task: created };
  }

  const callBackUrl = buildCanvasAiKieCallbackUrl("video", created.id);

  const submitPayloadBase = {
    kind: "video-engine" as const,
    prompt: clipPrompt(expandedPrompt),
    params,
    providerId,
    modelKey: effectiveModelKey,
    modelKeyRequested: modelKey !== effectiveModelKey ? modelKey : undefined,
    imageUrls: allSubmittedImageUrls,
    mainFrameImageUrl,
    referenceImageUrls,
    syncGatewaySubmit: true,
    providerKind: videoProviderKind,
    ...(videoProviderKind === "VOLCENGINE"
      ? { volcengineModel: model, volcengineBody: input }
      : videoProviderKind === "MINIMAX"
        ? { minimaxModel: model, minimaxInput: input }
      : videoProviderKind === "TOPAZ"
        ? { topazModel: model, topazInput: input }
        : videoProviderKind === "DASHSCOPE"
          ? { dashscopeModel: model, dashscopeVideoBody: dashscopeVideoBody ?? input }
          : { kieModel: model, kieInput: input }),
    ...(data.sbv1Billing && typeof data.sbv1Billing === "object"
      ? { sbv1Billing: data.sbv1Billing }
      : {}),
    ...(args.storyScope ? { storyScope: args.storyScope } : {}),
  };

  try {
    const { claimed, task: claimedTask } = await claimCanvasTaskKieSubmit(
      created.id,
    );
    if (!claimed) {
      const fresh = await prisma.canvasGenerationTask.findUnique({
        where: { id: created.id },
      });
      if (fresh?.kieTaskId) {
        return { reused: false, task: fresh };
      }
      throw new CanvasProjectError(
        "TASK_ALREADY_INFLIGHT",
        "video gateway submit already in progress",
        409,
      );
    }

    const job = isTopazDirectV2v
      ? await canvasGwCreateTopazVideoJob(userId, {
          model,
          videoUrl: String(motionVideoUrls[0] ?? ""),
          filterModel: String(params.filter_model ?? "proteus"),
          upscaleFactor: topazUpscaleFromHdResolution(
            String(data.resolution ?? params.resolution ?? "1080p"),
          ),
          slowmo: parseTopazSlowmoFactor(params.slowmo),
          frameInterpolation: parseTopazFrameInterpolation(
            params.frame_interpolation ?? params.frameInterpolation,
          ),
          resolution: String(data.resolution ?? params.resolution ?? "1080p"),
          clientPage: gwClientPage,
          projectId,
          canvasTaskId: claimedTask.id,
        })
      : isVolcengineVideo
      ? await canvasGwCreateVolcengineVideoJob(userId, {
          model,
          body: input as Record<string, unknown>,
          clientPage: gwClientPage,
          projectId,
          canvasTaskId: claimedTask.id,
          providerId,
          gatewayCredentialId:
            typeof data.gatewayCredentialId === "string" &&
            data.gatewayCredentialId.trim()
              ? data.gatewayCredentialId.trim()
              : undefined,
          sbv1Billing:
            data.sbv1Billing && typeof data.sbv1Billing === "object"
              ? (data.sbv1Billing as Record<string, unknown>)
              : undefined,
        })
      : videoProviderKind === "MINIMAX"
        ? await canvasGwCreateMinimaxVideoJob(userId, {
            model,
            input: input as Record<string, unknown>,
            clientPage: gwClientPage,
            projectId,
            canvasTaskId: claimedTask.id,
          })
      : videoProviderKind === "DASHSCOPE"
        ? await canvasGwCreateDashscopeVideoJob(userId, {
            model,
            videoBody: (dashscopeVideoBody ?? input) as Record<string, unknown>,
            clientPage: gwClientPage,
            projectId,
            canvasTaskId: claimedTask.id,
          })
      : await canvasGwCreateKieJob(userId, {
          gatewayModelKey: effectiveModelKey,
          model,
          input: input as Record<string, unknown>,
          callBackUrl,
          clientPage: gwClientPage,
          projectId,
          canvasTaskId: claimedTask.id,
        });
    const updated = await prisma.canvasGenerationTask.update({
      where: { id: claimedTask.id },
      data: {
        status: "SUBMITTED",
        kieTaskId: job.taskId,
        submittedAt: new Date(),
        inputPayload: {
          ...submitPayloadBase,
          gatewayLogId: job.logId,
          gatewayKieSubmitClaimed: true,
        } as Prisma.InputJsonValue,
      },
    });
    return { reused: false, task: updated };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const updated = await prisma.canvasGenerationTask.update({
      where: { id: created.id },
      data: {
        status: "FAILED",
        failCode: "VIDEO_ENGINE_FAILED",
        failMessage: formatVideoEngineFailMessage(
          "VIDEO_ENGINE_FAILED",
          msg,
          { providerKind: videoProviderKind },
        ).slice(0, 500),
        completedAt: new Date(),
        inputPayload: {
          ...submitPayloadBase,
          gatewayKieSubmitClaimed: false,
        } as Prisma.InputJsonValue,
      },
    });
    return { reused: false, task: updated };
  }
}

/** KIE 音频引擎 —— ElevenLabs TTS / Suno 音乐，异步 poll。 */
export async function runKieAudioEngineNode(
  args: RunEngineNodeArgs,
): Promise<RunEngineNodeResult> {
  const { userId, projectId, nodeId, node } = args;
  const gwClientPage = resolveCanvasClientPage(projectId, args.clientPage);
  const data = node.data ?? {};
  const providerId = String(data.providerId ?? "");
  const modelKey = normalizeKieAudioModelKey(
    String(data.modelKey ?? node.modelKey ?? ""),
  );
  const promptRaw = String(data.prompt ?? data.dockInput ?? "");
  const params = (data.params as Record<string, unknown>) ?? {};

  if (!providerId) {
    throw new CanvasProjectError("INVALID_INPUT", "audio-engine 缺少 providerId");
  }
  if (!modelKey) {
    throw new CanvasProjectError("INVALID_INPUT", "audio-engine 缺少 modelKey");
  }

  const upstreamText = (node.textInputs ?? []).filter((s) => s && s.trim());
  const expandedPrompt = [promptRaw.trim(), ...upstreamText]
    .filter(Boolean)
    .join("\n\n");
  if (!expandedPrompt.trim()) {
    throw new CanvasProjectError("EMPTY_PROMPT", "audio-engine prompt 为空");
  }

  await shouldCanvasUseGateway(userId, providerId, modelKey);

  const inputHash = computeInputHash({
    modelKey,
    prompt: expandedPrompt,
    imageUrls: [],
    params,
    providerId,
  });

  if (!args.forceFresh) {
    const reusable = await findReusableSucceededTask({
      projectId,
      nodeId,
      inputHash,
      useGateway: true,
    });
    if (reusable) return { reused: true, task: reusable };
  }

  await ensureProjectInflightCapacity(projectId);
  await ensureUserInflightCapacity(userId);

  const kieInput = buildKieAudioCreateInput({
    modelKey,
    prompt: expandedPrompt,
    params,
  });

  const created = await createStoryScopedCanvasTask({
    projectId,
    nodeId,
    storyScope: args.storyScope,
    skipInflightScopeConflict: shouldSkipInflightScopeConflictForRun(args),
    initialStatus: "PENDING",
    data: {
      kind: "IMAGE",
      model: modelKey,
      providerId: null,
      inputHash,
      inputPayload: {
        kind: "audio-engine",
        prompt: clipPrompt(expandedPrompt),
        params,
        providerId,
        modelKey,
        kieInput,
        clientPage: gwClientPage,
        syncGatewaySubmit: true,
        ...(args.storyScope ? { storyScope: args.storyScope } : {}),
      } as Prisma.InputJsonValue,
    },
  });

  const callBackUrl = buildCanvasAiKieCallbackUrl("audio", created.id);

  try {
    const job = await canvasGwCreateKieJob(userId, {
      gatewayModelKey: modelKey,
      model: modelKey,
      input: kieInput,
      callBackUrl,
      clientPage: gwClientPage,
      projectId,
      canvasTaskId: created.id,
    });
    const updated = await prisma.canvasGenerationTask.update({
      where: { id: created.id },
      data: {
        status: "SUBMITTED",
        kieTaskId: job.taskId,
        submittedAt: new Date(),
        inputPayload: {
          kind: "audio-engine",
          prompt: clipPrompt(expandedPrompt),
          params,
          providerId,
          modelKey,
          kieInput,
          clientPage: gwClientPage,
          gatewayLogId: job.logId,
          providerKind: "KIE",
          syncGatewaySubmit: true,
          ...(args.storyScope ? { storyScope: args.storyScope } : {}),
        } as Prisma.InputJsonValue,
      },
    });
    return { reused: false, task: updated };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const updated = await prisma.canvasGenerationTask.update({
      where: { id: created.id },
      data: {
        status: "FAILED",
        failCode: "AUDIO_ENGINE_FAILED",
        failMessage: msg.slice(0, 500),
        completedAt: new Date(),
      },
    });
    return { reused: false, task: updated };
  }
}

/** TTS 引擎 —— OpenAI 兼容 /audio/speech，同步落 OSS。 */
export async function runTtsEngineNode(
  args: RunEngineNodeArgs,
): Promise<RunEngineNodeResult> {
  const { userId, projectId, nodeId, node } = args;
  const gwClientPage = resolveCanvasClientPage(projectId, args.clientPage);
  const data = node.data ?? {};
  const providerId = String(data.providerId ?? "");
  const modelKey = String(data.modelKey ?? node.modelKey ?? "tts-1");
  const nodeText = String(data.text ?? "");
  const params = (data.params as Record<string, unknown>) ?? {};

  if (!providerId)
    throw new CanvasProjectError("INVALID_INPUT", "tts-engine 缺少 providerId");

  const upstreamText = (node.textInputs ?? []).filter((s) => s && s.trim());
  const text = [nodeText.trim(), ...upstreamText].filter(Boolean).join("\n").trim();
  if (!text) {
    throw new CanvasProjectError("EMPTY_PROMPT", "tts-engine 台词为空");
  }

  await shouldCanvasUseGateway(userId, providerId, modelKey);

  const inputHash = computeInputHash({
    modelKey,
    prompt: text,
    imageUrls: [],
    params,
    providerId,
  });

  if (!args.forceFresh) {
    const reusable = await findReusableSucceededTask({
      projectId,
      nodeId,
      inputHash,
    });
    if (reusable) return { reused: true, task: reusable };
  }

  await ensureProjectInflightCapacity(projectId);
  await ensureUserInflightCapacity(userId);

  const created = await createStoryScopedCanvasTask({
    projectId,
    nodeId,
    storyScope: args.storyScope,
    initialStatus: "SUBMITTED",
    data: {
      kind: "IMAGE",
      model: modelKey,
      providerId: null,
      inputHash,
      inputPayload: {
        kind: "tts-engine",
        text: text.slice(0, 4096),
        params,
        providerId,
        modelKey,
        ...(args.storyScope ? { storyScope: args.storyScope } : {}),
      } as Prisma.InputJsonValue,
      submittedAt: new Date(),
    },
  });

  const voice = String(params.voice ?? "Cherry");
  const languageType =
    typeof params.language_type === "string"
      ? params.language_type
      : undefined;
  const extras: Record<string, unknown> = {};
  if (typeof params.speed === "number") extras.speed = params.speed;
  if (typeof params.pitch === "number") extras.pitch = params.pitch;
  if (typeof params.vol === "number") extras.volume = params.vol;
  if (typeof params.instruction === "string" && params.instruction.trim()) {
    extras.instruction = params.instruction.trim();
  }

  try {
    const ttsOut = await canvasGwTts(userId, {
      modelKey,
      text,
      voice,
      languageType,
      extras: Object.keys(extras).length ? extras : undefined,
      clientPage: gwClientPage,
      projectId,
    });
    const ephemeralUrl = `data:${ttsOut.contentType};base64,${ttsOut.buffer.toString("base64")}`;
    const updated = await prisma.canvasGenerationTask.update({
      where: { id: created.id },
      data: {
        status: "SUCCEEDED",
        ephemeralUrl,
        textOutput: text.slice(0, 500),
        completedAt: new Date(),
      },
    });
    scheduleCanvasBufferOssBackfill({
      taskId: created.id,
      buf: ttsOut.buffer,
      contentType: ttsOut.contentType,
      kind: "node-audio",
      projectId,
      userId,
      ext: ttsOut.ext,
    });
    return { reused: false, task: updated };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const updated = await prisma.canvasGenerationTask.update({
      where: { id: created.id },
      data: {
        status: "FAILED",
        failCode: "TTS_ENGINE_FAILED",
        failMessage: msg.slice(0, 500),
        completedAt: new Date(),
      },
    });
    return { reused: false, task: updated };
  }
}

const REF_VIDEO_KIE_MODEL = "bytedance/seedance-2";

function isRefVideoBailianModel(modelKey: string): boolean {
  return (BAILIAN_R2V_MODEL_IDS as readonly string[]).includes(modelKey);
}

/** 参考生视频 · AI 视频引擎（百炼 R2V + KIE Seedance） */
export async function runRefVideoEngineNode(
  args: RunEngineNodeArgs,
): Promise<RunEngineNodeResult> {
  const { userId, projectId, nodeId, node } = args;
  const gwClientPage = resolveCanvasClientPage(projectId, args.clientPage);
  const data = node.data ?? {};
  const providerId = String(data.providerId ?? "");
  const modelKey = String(data.modelKey ?? node.modelKey ?? "");
  const promptRaw = String(data.prompt ?? "");
  const params = (data.params as Record<string, unknown>) ?? {};

  if (!providerId) {
    throw new CanvasProjectError("INVALID_INPUT", "ai-video-engine 缺少 providerId");
  }
  if (!modelKey) {
    throw new CanvasProjectError("INVALID_INPUT", "ai-video-engine 缺少 modelKey");
  }

  const isBailian = isRefVideoBailianModel(modelKey);
  const isKieSeedance = modelKey === REF_VIDEO_KIE_MODEL;
  if (!isBailian && !isKieSeedance) {
    throw new CanvasProjectError(
      "INVALID_INPUT",
      `ai-video-engine 不支持模型 ${modelKey}`,
    );
  }

  const expandedPrompt = promptRaw.trim();
  if (!expandedPrompt) {
    throw new CanvasProjectError("EMPTY_PROMPT", "ai-video-engine 提示词为空");
  }

  const referenceImageUrls = (node.imageInputs ?? []).filter(
    (u): u is string => typeof u === "string" && /^https?:\/\//.test(u),
  );
  if (referenceImageUrls.length < 1) {
    throw new CanvasProjectError(
      "INVALID_INPUT",
      "ai-video-engine 需要至少 1 张参考图（连接宫格）",
    );
  }

  const maxRef = isBailian ? 9 : 8;
  const refs = referenceImageUrls.slice(0, maxRef);

  await shouldCanvasUseGateway(userId, providerId, modelKey);

  const inputHash = computeInputHash({
    modelKey,
    prompt: expandedPrompt,
    imageUrls: refs,
    params,
    providerId,
  });

  if (!args.forceFresh) {
    const reusable = await findReusableSucceededTask({
      projectId,
      nodeId,
      inputHash,
      useGateway: true,
    });
    if (reusable) return { reused: true, task: reusable };
  }

  await ensureNoActiveTaskForScope(projectId, nodeId, args.storyScope);
  await ensureProjectInflightCapacity(projectId);
  await ensureUserInflightCapacity(userId);

  if (isBailian) {
    const resolution = /^720p$/i.test(String(params.resolution ?? ""))
      ? "720P"
      : "1080P";
    const ratio = String(params.ratio ?? params.aspect_ratio ?? "16:9");
    const duration = Number(params.duration ?? 5);
    const seedStr = String(params.seed ?? "");
    const parameterExtras: Record<string, unknown> = {};
    if (modelKey.startsWith("wan2.")) {
      parameterExtras.prompt_extend = params.prompt_extend !== false;
    }

    const queued = isTrafficControlEnabled();
    const scope = queued
      ? await resolveCanvasProjectTrafficScope(projectId, userId)
      : null;

    await assertVideoCreditsBeforeTrafficQueue({
      userId,
      projectId,
      model: modelKey,
      params: { ...params, duration, resolution },
    });

    const queuedAt = queued ? new Date() : undefined;
    const dispatchAfter =
      queued && scope
        ? await computeCanvasQueueDispatchAfter(scope, queuedAt!.getTime())
        : undefined;

    const created = await prisma.canvasGenerationTask.create({
      data: {
        projectId,
        nodeId,
        kind: "IMAGE",
        model: modelKey,
        providerId: null,
        inputHash,
        status: queued ? "QUEUED" : "PENDING",
        queuedAt,
        dispatchAfter,
        tenantId: scope?.tenantId ?? undefined,
        actorUserId: userId,
        inputPayload: {
          kind: "ai-video-engine",
          providerKind: "BAILIAN_R2V",
          prompt: clipPrompt(expandedPrompt),
          params,
          providerId,
          modelKey,
          referenceImageUrls: refs,
          clientPage: gwClientPage,
        } as Prisma.InputJsonValue,
        ...promptArchiveFieldsForTask({
          kind: "IMAGE",
          inputPayload: {
            kind: "ai-video-engine",
            prompt: clipPrompt(expandedPrompt),
            modelKey,
          },
        }),
      },
    });

    if (queued) {
      fireCanvasDispatchForProject(projectId, "runRefVideoEngineNode-bailian");
      return { reused: false, task: created };
    }

    try {
      const { claimed, task: claimedTask } = await claimCanvasTaskKieSubmit(
        created.id,
      );
      if (!claimed) {
        const fresh = await prisma.canvasGenerationTask.findUnique({
          where: { id: created.id },
        });
        if (fresh?.kieTaskId) {
          return { reused: false, task: fresh };
        }
        throw new CanvasProjectError(
          "TASK_ALREADY_INFLIGHT",
          "ref-video gateway submit already in progress",
          409,
        );
      }

      const job = await canvasGwCreateBailianR2vJob(userId, {
        model: modelKey,
        prompt: expandedPrompt,
        referenceImageUrls: refs,
        resolution,
        ratio,
        duration,
        seedStr,
        parameterExtras,
        clientPage: gwClientPage,
        projectId,
        canvasTaskId: claimedTask.id,
      });
      const updated = await prisma.canvasGenerationTask.update({
        where: { id: claimedTask.id },
        data: {
          status: "SUBMITTED",
          kieTaskId: job.taskId,
          submittedAt: new Date(),
          inputPayload: {
            kind: "ai-video-engine",
            providerKind: "BAILIAN_R2V",
            prompt: clipPrompt(expandedPrompt),
            params,
            providerId,
            modelKey,
            referenceImageUrls: refs,
            syncGatewaySubmit: true,
            gatewayKieSubmitClaimed: true,
            gatewayLogId: job.logId,
          } as Prisma.InputJsonValue,
        },
      });
      return { reused: false, task: updated };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const updated = await prisma.canvasGenerationTask.update({
        where: { id: created.id },
        data: {
          status: "FAILED",
          failCode: "REF_VIDEO_FAILED",
          failMessage: msg.slice(0, 500),
          completedAt: new Date(),
        },
      });
      return { reused: false, task: updated };
    }
  }

  const aspectRatio = String(params.aspect_ratio ?? "16:9");
  const { model, input } = buildCanvasRefVideoKieInput({
    modelKey,
    prompt: expandedPrompt,
    referenceImageUrls: refs,
    options: {
      resolution: String(params.resolution ?? "1080p"),
      duration: Number(params.duration ?? 5),
      generateAudio: params.generateAudio === true,
    },
    aspectRatio,
  });

  const queued = isTrafficControlEnabled();
  const scope = queued
    ? await resolveCanvasProjectTrafficScope(projectId, userId)
    : null;

  await assertVideoCreditsBeforeTrafficQueue({
    userId,
    projectId,
    model: modelKey,
    params,
  });

  const queuedAt = queued ? new Date() : undefined;
  const dispatchAfter =
    queued && scope
      ? await computeCanvasQueueDispatchAfter(scope, queuedAt!.getTime())
      : undefined;

  const created = await prisma.canvasGenerationTask.create({
    data: {
      projectId,
      nodeId,
      kind: "IMAGE",
      model: modelKey,
      providerId: null,
      inputHash,
      status: queued ? "QUEUED" : "PENDING",
      queuedAt,
      dispatchAfter,
      tenantId: scope?.tenantId ?? undefined,
      actorUserId: userId,
      inputPayload: {
        kind: "ai-video-engine",
        providerKind: "KIE",
        prompt: clipPrompt(expandedPrompt),
        params,
        providerId,
        modelKey,
        referenceImageUrls: refs,
        kieModel: model,
        kieInput: input,
        clientPage: gwClientPage,
      } as Prisma.InputJsonValue,
      ...promptArchiveFieldsForTask({
        kind: "IMAGE",
        inputPayload: {
          kind: "ai-video-engine",
          prompt: clipPrompt(expandedPrompt),
          modelKey,
        },
      }),
    },
  });

  if (queued) {
    fireCanvasDispatchForProject(projectId, "runRefVideoEngineNode-kie");
    return { reused: false, task: created };
  }

  const callBackUrl = buildCanvasAiKieCallbackUrl("video", created.id);

  try {
    const { claimed, task: claimedTask } = await claimCanvasTaskKieSubmit(
      created.id,
    );
    if (!claimed) {
      const fresh = await prisma.canvasGenerationTask.findUnique({
        where: { id: created.id },
      });
      if (fresh?.kieTaskId) {
        return { reused: false, task: fresh };
      }
      throw new CanvasProjectError(
        "TASK_ALREADY_INFLIGHT",
        "ref-video gateway submit already in progress",
        409,
      );
    }

    const job = await canvasGwCreateKieJob(userId, {
      gatewayModelKey: modelKey,
      model,
      input: input as Record<string, unknown>,
      callBackUrl,
      clientPage: gwClientPage,
      projectId,
      canvasTaskId: claimedTask.id,
    });
    const updated = await prisma.canvasGenerationTask.update({
      where: { id: claimedTask.id },
      data: {
        status: "SUBMITTED",
        kieTaskId: job.taskId,
        submittedAt: new Date(),
        inputPayload: {
          kind: "ai-video-engine",
          providerKind: "KIE",
          prompt: clipPrompt(expandedPrompt),
          params,
          providerId,
          modelKey,
          referenceImageUrls: refs,
          syncGatewaySubmit: true,
          gatewayKieSubmitClaimed: true,
          gatewayLogId: job.logId,
          kieModel: model,
          kieInput: input,
        } as Prisma.InputJsonValue,
      },
    });
    return { reused: false, task: updated };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const updated = await prisma.canvasGenerationTask.update({
      where: { id: created.id },
      data: {
        status: "FAILED",
        failCode: "REF_VIDEO_FAILED",
        failMessage: msg.slice(0, 500),
        completedAt: new Date(),
      },
    });
    return { reused: false, task: updated };
  }
}
