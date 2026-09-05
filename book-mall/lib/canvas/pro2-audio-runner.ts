/**
 * Pro2 / LibTV 音频节点 runner（Gateway 同步 TTS · MiniMax · KIE ElevenLabs · Suno）
 */
import type { Prisma } from "@prisma/client";

import { forwardMinimaxT2a } from "@/lib/gateway/minimax-speech-proxy";
import { isMinimaxSpeechModelKey } from "@/lib/gateway/minimax-speech-models";
import {
  assertGatewayApiKeyLinkedForUser,
  resolveGatewayAuthForBookUser,
} from "@/lib/gateway/book-gateway-link";
import {
  createRequestLog,
  finalizeRequestLog,
  pickCredentialForKind,
} from "@/lib/gateway/proxy-common";
import { prisma } from "@/lib/prisma";

import { CanvasProjectError } from "./canvas-project-service";
import {
  runKieAudioEngineNode,
  runTtsEngineNode,
  type RunEngineNodeArgs,
  type RunEngineNodeResult,
} from "./canvas-engine-runner";
import {
  buildPro2AudioTtsInputHash,
  resolveCanvasMinimaxTtsVoiceInput,
} from "./canvas-tts-run-params";
import { scheduleCanvasBufferOssBackfill } from "./canvas-oss-backfill";
import { createStoryScopedCanvasTask } from "./canvas-story-scope";
import {
  getCanvasProjectInflightMax,
  getCanvasUserInflightMax,
} from "./canvas-constants";
import {
  GENERATION_INFLIGHT_STATUSES,
  GENERATION_PIPELINE_INFLIGHT_STATUSES,
} from "@/lib/generation/traffic-control/constants";
import { isPro2GatewaySyncTtsModelKey } from "./pro2-audio-tts-models";

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

async function runCanvasMinimaxTtsNode(
  args: RunEngineNodeArgs,
  mergedPrompt: string,
  modelKey: string,
  params: Record<string, unknown>,
): Promise<RunEngineNodeResult> {
  const { userId, projectId, nodeId } = args;
  const voiceId = String(params.voice_id ?? params.voice ?? "").trim();
  if (!voiceId) {
    throw new CanvasProjectError("INVALID_INPUT", "请选择音色");
  }

  await assertGatewayApiKeyLinkedForUser(userId);
  const auth = await resolveGatewayAuthForBookUser(userId);
  if (!auth) {
    throw new CanvasProjectError(
      "MODEL_NOT_AVAILABLE",
      "请先在个人中心关联 Gateway API Key",
      503,
    );
  }
  const credentialId = pickCredentialForKind(auth.credentials, "MINIMAX");
  if (!credentialId) {
    throw new CanvasProjectError(
      "MODEL_NOT_AVAILABLE",
      "Gateway Key 未绑定 MiniMax 凭证",
      503,
    );
  }

  await ensureProjectInflightCapacity(projectId);
  await ensureUserInflightCapacity(userId);

  const inputHash = buildPro2AudioTtsInputHash({
    modelKey,
    voiceId,
    text: mergedPrompt,
    params,
  });

  const gwClientPage = args.clientPage ?? `canvas/${projectId}/sbv1`;
  const log = await createRequestLog({
    userId: auth.userId,
    apiKeyId: auth.id,
    credentialId,
    model: modelKey,
    endpoint: "/v1/t2a_v2",
    providerKind: "MINIMAX",
    requestKind: "TTS",
    clientSource: "EXTERNAL",
    clientPage: gwClientPage,
    actorBookUserId: userId,
    inputSummary: { text: mergedPrompt, voice_id: voiceId, modelKey },
  });

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
        text: mergedPrompt.slice(0, 4096),
        params: { ...params, voice_id: voiceId },
        modelKey,
        providerKind: "MINIMAX",
        ...(args.storyScope ? { storyScope: args.storyScope } : {}),
      } as Prisma.InputJsonValue,
      submittedAt: new Date(),
    },
  });

  const result = await forwardMinimaxT2a({
    credentialId,
    input: {
      modelKey,
      text: mergedPrompt,
      ...resolveCanvasMinimaxTtsVoiceInput(params, voiceId, modelKey),
    },
  });

  const ok = result.status >= 200 && result.status < 300;
  if (!ok) {
    const failMessage =
      result.buffer.toString("utf8").slice(0, 500) ||
      `MiniMax 语音合成失败（HTTP ${result.status}）`;
    await finalizeRequestLog(log.id, {
      status: "FAILED",
      durationMs: result.durationMs,
      failMessage,
      model: modelKey,
    });
    const updated = await prisma.canvasGenerationTask.update({
      where: { id: created.id },
      data: {
        status: "FAILED",
        failCode: "TTS_ENGINE_FAILED",
        failMessage: failMessage.slice(0, 500),
        completedAt: new Date(),
      },
    });
    return { reused: false, task: updated };
  }

  await finalizeRequestLog(log.id, {
    status: "SUCCEEDED",
    durationMs: result.durationMs,
    model: modelKey,
  });

  const ephemeralUrl = `data:${result.contentType ?? "audio/mpeg"};base64,${result.buffer.toString("base64")}`;
  const updated = await prisma.canvasGenerationTask.update({
    where: { id: created.id },
    data: {
      status: "SUCCEEDED",
      ephemeralUrl,
      textOutput: mergedPrompt.slice(0, 500),
      completedAt: new Date(),
    },
  });
  scheduleCanvasBufferOssBackfill({
    taskId: created.id,
    buf: result.buffer,
    contentType: result.contentType ?? "audio/mpeg",
    kind: "node-audio",
    projectId,
    userId,
    ext: result.ext ?? "mp3",
  });
  return { reused: false, task: updated };
}

export async function runPro2AudioNode(
  args: RunEngineNodeArgs,
): Promise<RunEngineNodeResult> {
  const data = args.node.data ?? {};
  const engine = (data.engine as Record<string, unknown> | undefined) ?? {};
  const providerId = String(
    engine.providerId ?? data.providerId ?? "",
  ).trim();
  const modelKey = String(engine.modelKey ?? data.modelKey ?? "").trim();
  const prompt = String(data.dockInput ?? data.prompt ?? "").trim();
  const upstreamText = (args.node.textInputs ?? []).filter((s) => s?.trim());
  const mergedPrompt = [prompt, ...upstreamText].filter(Boolean).join("\n\n");

  if (!providerId || !modelKey) {
    throw new CanvasProjectError(
      "INVALID_INPUT",
      "音频节点缺少模型配置，请在 Dock 选择 TTS / 音乐模型",
    );
  }
  if (!mergedPrompt.trim()) {
    throw new CanvasProjectError("EMPTY_PROMPT", "音频节点提示词为空");
  }

  const params =
    (engine.params as Record<string, unknown> | undefined) ??
    (data.params as Record<string, unknown> | undefined) ??
    {};

  if (isMinimaxSpeechModelKey(modelKey)) {
    return runCanvasMinimaxTtsNode(args, mergedPrompt, modelKey, params);
  }

  if (isPro2GatewaySyncTtsModelKey(modelKey)) {
    return runTtsEngineNode({
      ...args,
      node: {
        ...args.node,
        type: "tts-engine",
        data: {
          ...data,
          providerId,
          modelKey,
          text: mergedPrompt,
          params,
        },
      },
    });
  }

  return runKieAudioEngineNode({
    ...args,
    node: {
      ...args.node,
      type: "audio-engine",
      data: {
        ...data,
        providerId,
        modelKey,
        prompt: mergedPrompt,
        params,
      },
    },
  });
}
