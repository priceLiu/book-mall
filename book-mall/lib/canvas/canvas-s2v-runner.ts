/**
 * 画布 · wan2.2-s2v 对口型（形象图 + 人声音频 → 口播视频）
 */
import { createHash } from "node:crypto";

import type { Prisma } from "@prisma/client";

import {
  AI_SPACE_S2V_MAX_AUDIO_SEC,
  AI_SPACE_S2V_VENDOR_CONCURRENCY,
} from "@/lib/ai-space/ai-space-compose-types";
import {
  isDashscopeWorkspaceApiKey,
  requireAiSpaceDashscopeAuth,
  resolveAiSpaceS2vBaseUrl,
} from "@/lib/ai-space/ai-space-gateway-auth";
import { getDecryptedCredentialApiKey } from "@/lib/gateway/credential-service";
import { dashscopeCreateS2vTask } from "@/lib/gateway/dashscope-client";
import { buildGatewayInputSummary } from "@/lib/gateway/log-input-summary";
import {
  createRequestLog,
  finalizeRequestLog,
} from "@/lib/gateway/proxy-common";
import { prisma } from "@/lib/prisma";

import { CanvasProjectError } from "./canvas-project-service";
import { createStoryScopedCanvasTask } from "./canvas-story-scope";
import { scheduleCanvasPollWorkerForProject } from "./canvas-task-service";
import {
  getCanvasProjectInflightMax,
  getCanvasUserInflightMax,
} from "./canvas-constants";
import {
  GENERATION_INFLIGHT_STATUSES,
  GENERATION_PIPELINE_INFLIGHT_STATUSES,
} from "@/lib/generation/traffic-control/constants";
import type { RunEngineNodeArgs, RunEngineNodeResult } from "./canvas-engine-runner";

const S2V_MODEL_KEY = "wan2.2-s2v";

function s2vInputHash(imageUrl: string, audioUrl: string, resolution: string): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        modelKey: S2V_MODEL_KEY,
        imageUrl,
        audioUrl,
        resolution,
      }),
    )
    .digest("hex");
}

function s2vLockKeys(): [number, number] {
  const buf = createHash("sha256").update("ai-space-s2v-single-flight").digest();
  return [buf.readInt32BE(0), buf.readInt32BE(4)];
}

async function tryClaimCanvasS2vSlot(): Promise<boolean> {
  const [k1, k2] = s2vLockKeys();
  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<
      Array<{ pg_try_advisory_xact_lock: boolean }>
    >`SELECT pg_try_advisory_xact_lock(${k1}::int, ${k2}::int)`;
    if (!locked[0]?.pg_try_advisory_xact_lock) return false;

    const inFlight = await tx.canvasGenerationTask.count({
      where: { status: "SUBMITTED", model: S2V_MODEL_KEY },
    });
    return inFlight < AI_SPACE_S2V_VENDOR_CONCURRENCY;
  });
}

async function ensureUserInflightCapacity(userId: string): Promise<void> {
  const max = getCanvasUserInflightMax();
  const current = await prisma.canvasGenerationTask.count({
    where: {
      project: { userId, deletedAt: null },
      status: { in: [...GENERATION_INFLIGHT_STATUSES] },
    },
  });
  if (current + 1 > max) {
    throw new CanvasProjectError(
      "TOO_MANY_INFLIGHT",
      `inflight tasks ${current + 1} exceeds limit ${max}`,
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

function httpsUrls(urls: string[] | undefined): string[] {
  return (urls ?? []).filter(
    (u): u is string => typeof u === "string" && /^https?:\/\//.test(u.trim()),
  );
}

export async function runCanvasS2vVideoNode(
  args: RunEngineNodeArgs,
): Promise<RunEngineNodeResult> {
  const { userId, projectId, nodeId, node } = args;
  const imageUrl = httpsUrls(node.imageInputs)[0]?.trim() ?? "";
  const audioUrl = httpsUrls(node.audioInputs)[0]?.trim() ?? "";

  if (!imageUrl) {
    throw new CanvasProjectError(
      "INVALID_INPUT",
      "对口型口播需要连接一张人物参考图",
    );
  }
  if (!audioUrl) {
    throw new CanvasProjectError(
      "INVALID_INPUT",
      "对口型口播需要连接已生成的音频（请先在音频节点合成或上传）",
    );
  }

  const data = node.data ?? {};
  const resolution =
    String(data.resolution ?? "720p").toLowerCase() === "480p"
      ? "480P"
      : "720P";

  const inputHash = s2vInputHash(imageUrl, audioUrl, resolution);

  if (!args.forceFresh) {
    const reusable = await prisma.canvasGenerationTask.findFirst({
      where: {
        projectId,
        nodeId,
        inputHash,
        status: "SUCCEEDED",
      },
      orderBy: { createdAt: "desc" },
    });
    if (reusable) return { reused: true, task: reusable };
  }

  await ensureProjectInflightCapacity(projectId);
  await ensureUserInflightCapacity(userId);

  const claimed = await tryClaimCanvasS2vSlot();
  if (!claimed) {
    throw new CanvasProjectError(
      "TOO_MANY_INFLIGHT",
      "数字人口播厂商同时只能处理 1 个任务，请稍后再试",
      429,
    );
  }

  const { auth, credentialId } = await requireAiSpaceDashscopeAuth(userId);
  if (!credentialId) {
    throw new CanvasProjectError(
      "MODEL_NOT_AVAILABLE",
      "请先在 Gateway 绑定华北2（北京）DashScope S2V 凭证（sk-ws- Key）",
      503,
    );
  }
  const cred = await getDecryptedCredentialApiKey(credentialId);
  if (!cred?.apiKey?.trim()) {
    throw new CanvasProjectError(
      "MODEL_NOT_AVAILABLE",
      "Gateway S2V 凭证不可用，请在模型管理页重新绑定",
      503,
    );
  }
  if (!isDashscopeWorkspaceApiKey(cred.apiKey)) {
    throw new CanvasProjectError(
      "MODEL_NOT_AVAILABLE",
      "对口型口播须使用华北2（北京）业务空间的 sk-ws- Key",
      503,
    );
  }
  const s2vBaseUrl = resolveAiSpaceS2vBaseUrl(cred.apiKey, cred.baseUrl);
  const gwClientPage = args.clientPage ?? `canvas/${projectId}/sbv1`;

  const payload = {
    model: S2V_MODEL_KEY,
    input: { image_url: imageUrl, audio_url: audioUrl },
    parameters: { resolution },
  };

  const log = await createRequestLog({
    userId: auth.userId,
    apiKeyId: auth.id,
    credentialId,
    model: S2V_MODEL_KEY,
    endpoint: "/api/v1/services/aigc/image2video/video-synthesis/",
    providerKind: "DASHSCOPE",
    requestKind: "VIDEO",
    clientSource: "EXTERNAL",
    clientPage: gwClientPage,
    actorBookUserId: userId,
    inputSummary: buildGatewayInputSummary(S2V_MODEL_KEY, payload),
  });

  const started = Date.now();
  const created = await dashscopeCreateS2vTask({
    apiKey: cred.apiKey,
    baseUrl: s2vBaseUrl,
    model: S2V_MODEL_KEY,
    imageUrl,
    audioUrl,
    resolution,
  });

  if (!created.ok) {
    await finalizeRequestLog(log.id, {
      status: "FAILED",
      durationMs: Date.now() - started,
      failCode: "UPSTREAM_ERROR",
      failMessage: created.error,
      model: S2V_MODEL_KEY,
    });
    throw new CanvasProjectError(
      "UPSTREAM_ERROR",
      created.error.slice(0, 500),
    );
  }

  await prisma.gatewayRequestLog.update({
    where: { id: log.id },
    data: { externalTaskId: created.taskId, status: "RUNNING" },
  });

  const task = await createStoryScopedCanvasTask({
    projectId,
    nodeId,
    storyScope: args.storyScope,
    initialStatus: "SUBMITTED",
    data: {
      kind: "IMAGE",
      model: S2V_MODEL_KEY,
      providerId: null,
      inputHash,
      kieTaskId: created.taskId,
      inputPayload: {
        kind: "canvas-s2v",
        modelKey: S2V_MODEL_KEY,
        providerId: "gateway:dashscope-s2v",
        gatewayLogId: log.id,
        imageUrl,
        audioUrl,
        resolution,
        maxAudioSec: AI_SPACE_S2V_MAX_AUDIO_SEC,
        ...(args.storyScope ? { storyScope: args.storyScope } : {}),
      } as Prisma.InputJsonValue,
      submittedAt: new Date(),
    },
  });

  scheduleCanvasPollWorkerForProject(projectId);
  return { reused: false, task };
}
