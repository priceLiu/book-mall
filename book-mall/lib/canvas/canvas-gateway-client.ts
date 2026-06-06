/**
 * Canvas → Gateway 内部客户端（不经 HTTP，等同 sk-gw 代理语义）
 */

import type { GatewayProviderKind } from "@prisma/client";

import { CanvasProjectError } from "./canvas-project-service";
import { resolveGatewayAuthForBookUser } from "@/lib/gateway/book-gateway-link";
import {
  createRequestLog,
  finalizeRequestLog,
  forwardAudioSpeech,
  forwardChatCompletions,
  forwardChatCompletionsStream,
  parseOpenAiUsage,
  pickCredentialForKind,
  type UsageFromResponse,
} from "@/lib/gateway/proxy-common";
import { summarizeUpstreamFailMessage } from "@/lib/gateway/book-gateway-link";
import { routeGatewayModel } from "@/lib/gateway/model-router";
import { isQwenTtsModel } from "@/lib/gateway/qwen-tts-proxy";
import { buildGatewayInputSummary } from "@/lib/gateway/log-input-summary";
import {
  buildGatewayChatResultSummary,
  buildGatewayStreamChatResultSummary,
  buildGatewayTaskResultSummary,
} from "@/lib/gateway/log-result-summary";
import {
  pollBailianR2vTaskForLog,
  pollDashscopeTaskForLog,
  pollHunyuanTaskForLog,
  pollKieTaskForLog,
  submitBailianR2vJobForLog,
  submitHunyuanJobForLog,
  submitKieJobForLog,
} from "@/lib/gateway/poll-service";
import type { CanvasChatMessage } from "./providers/types";
import { extractKieResultUrl, type KieRecordResponse } from "@/lib/story/kie-client";
import type { BailianR2vTaskOutput } from "./canvas-video-bailian-r2v";
import type { CanvasGatewayPollResult } from "./providers/types";
import {
  AITRYON_PARSING_MODEL,
  dashscopeImageParsing,
  isDashscopeTaskFailed,
  isDashscopeTaskSuccess,
  type DashscopeClothesType,
  type DashscopeParsingOutput,
  type DashscopeTaskOutput,
} from "@/lib/gateway/dashscope-client";
import { getDecryptedCredentialApiKey } from "@/lib/gateway/credential-service";
import { submitVolcengineVideoJobForLog } from "@/lib/gateway/volcengine-jobs";
import {
  isVolcengineVideoTaskFailed,
  isVolcengineVideoTaskSuccess,
  volcengineGetVideoTask,
  type VolcengineVideoTaskResult,
} from "@/lib/gateway/volcengine-client";

const CLIENT_SOURCE = "CANVAS" as const;

async function requireGatewayAuth(userId: string) {
  const auth = await resolveGatewayAuthForBookUser(userId);
  if (!auth) {
    throw new CanvasProjectError(
      "GATEWAY_KEY_REQUIRED",
      "请先在 Book 个人中心关联 Gateway API Key",
      403,
    );
  }
  if (auth.credentials.length === 0) {
    throw new CanvasProjectError(
      "GATEWAY_KEY_REQUIRED",
      "Gateway API Key 未绑定厂商凭证，请先在 Gateway 控制台配置",
      403,
    );
  }
  return auth;
}

export type CanvasGwChatResult = {
  text: string;
  rawPayload: unknown;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  logId: string;
};

export async function canvasGwChat(
  userId: string,
  opts: {
    modelKey: string;
    messages: CanvasChatMessage[];
    params?: Record<string, unknown>;
    clientPage?: string;
  },
): Promise<CanvasGwChatResult> {
  const auth = await requireGatewayAuth(userId);
  const model = opts.modelKey.trim();
  const route = routeGatewayModel(model);
  const credentialId = pickCredentialForKind(auth.credentials, route.providerKind);
  if (!credentialId) {
    throw new CanvasProjectError(
      "MODEL_NOT_AVAILABLE",
      `Gateway Key 未绑定 ${route.providerKind} 凭证`,
      503,
    );
  }

  const body: Record<string, unknown> = {
    model,
    messages: opts.messages,
    stream: false,
    ...(opts.params ?? {}),
  };

  const log = await createRequestLog({
    userId: auth.userId,
    apiKeyId: auth.id,
    credentialId,
    model,
    endpoint: "/v1/chat/completions",
    providerKind: route.providerKind,
    requestKind: "CHAT",
    clientSource: CLIENT_SOURCE,
    clientPage: opts.clientPage,
    inputSummary: buildGatewayInputSummary(model, body),
  });

  try {
    const result = await forwardChatCompletions({
      credentialId,
      providerKind: route.providerKind,
      body,
    });
    let parsed: unknown = null;
    try {
      parsed = result.text ? JSON.parse(result.text) : null;
    } catch {
      parsed = null;
    }
    const usage = parseOpenAiUsage(parsed);
    const ok = result.status >= 200 && result.status < 300;
    await finalizeRequestLog(log.id, {
      status: ok ? "SUCCEEDED" : "FAILED",
      durationMs: result.durationMs,
      usage,
      resultSummary: buildGatewayChatResultSummary(parsed) ?? undefined,
      failMessage: ok ? undefined : result.text.slice(0, 500),
      model,
    });
    if (!ok) {
      throw new CanvasProjectError(
        "MODEL_NOT_AVAILABLE",
        result.text.slice(0, 500) || `HTTP ${result.status}`,
        502,
      );
    }

    const choice = (parsed as { choices?: { message?: { content?: string } }[] })
      ?.choices?.[0];
    const text =
      typeof choice?.message?.content === "string"
        ? choice.message.content
        : result.text;

    return {
      text,
      rawPayload: parsed,
      usage,
      logId: log.id,
    };
  } catch (e) {
    if (e instanceof CanvasProjectError) throw e;
    await finalizeRequestLog(log.id, {
      status: "FAILED",
      durationMs: 0,
      failMessage: (e as Error).message,
      model,
    });
    throw e;
  }
}

export type CanvasGwJobResult = {
  taskId: string;
  logId: string;
  providerKind: GatewayProviderKind;
};

export async function canvasGwCreateKieJob(
  userId: string,
  opts: {
    model: string;
    input: Record<string, unknown>;
    callBackUrl?: string | null;
    clientPage?: string;
  },
): Promise<CanvasGwJobResult> {
  const auth = await requireGatewayAuth(userId);
  const route = routeGatewayModel(opts.model);
  const credentialId = pickCredentialForKind(auth.credentials, "KIE");
  if (!credentialId) {
    throw new CanvasProjectError(
      "MODEL_NOT_AVAILABLE",
      "Gateway Key 未绑定 KIE 凭证",
      503,
    );
  }

  const log = await createRequestLog({
    userId: auth.userId,
    apiKeyId: auth.id,
    credentialId,
    model: opts.model,
    endpoint: "/v1/jobs/createTask",
    providerKind: "KIE",
    requestKind: route.requestKind,
    clientSource: CLIENT_SOURCE,
    clientPage: opts.clientPage,
    inputSummary: buildGatewayInputSummary(opts.model, opts.input),
  });

  const taskId = await submitKieJobForLog({
    logId: log.id,
    credentialId,
    model: opts.model,
    input: opts.input,
    callBackUrl: opts.callBackUrl ?? null,
  });

  return { taskId, logId: log.id, providerKind: "KIE" };
}

export async function canvasGwCreateVolcengineVideoJob(
  userId: string,
  opts: {
    model: string;
    body: Record<string, unknown>;
    clientPage?: string;
  },
): Promise<CanvasGwJobResult> {
  const auth = await requireGatewayAuth(userId);
  const route = routeGatewayModel(opts.model);
  if (route.providerKind !== "VOLCENGINE" || route.requestKind !== "VIDEO") {
    throw new CanvasProjectError(
      "MODEL_NOT_AVAILABLE",
      `模型 ${opts.model} 非火山方舟视频`,
      400,
    );
  }
  const credentialId = pickCredentialForKind(auth.credentials, "VOLCENGINE");
  if (!credentialId) {
    throw new CanvasProjectError(
      "MODEL_NOT_AVAILABLE",
      "Gateway Key 未绑定火山方舟凭证",
      503,
    );
  }

  const log = await createRequestLog({
    userId: auth.userId,
    apiKeyId: auth.id,
    credentialId,
    model: opts.model,
    endpoint: "/v1/jobs/createTask",
    providerKind: "VOLCENGINE",
    requestKind: "VIDEO",
    clientSource: CLIENT_SOURCE,
    clientPage: opts.clientPage,
    inputSummary: buildGatewayInputSummary(opts.model, opts.body),
  });

  const taskId = await submitVolcengineVideoJobForLog({
    logId: log.id,
    credentialId,
    model: opts.model,
    body: opts.body,
  });

  return { taskId, logId: log.id, providerKind: "VOLCENGINE" };
}

export async function canvasGwCreateBailianR2vJob(
  userId: string,
  opts: {
    model: string;
    prompt: string;
    referenceImageUrls: string[];
    resolution: "720P" | "1080P";
    ratio: string;
    duration: number;
    seedStr?: string;
    parameterExtras?: Record<string, unknown>;
    clientPage?: string;
  },
): Promise<CanvasGwJobResult> {
  const auth = await requireGatewayAuth(userId);
  const credentialId = pickCredentialForKind(auth.credentials, "BAILIAN");
  if (!credentialId) {
    throw new CanvasProjectError(
      "MODEL_NOT_AVAILABLE",
      "Gateway Key 未绑定百炼凭证",
      503,
    );
  }

  const log = await createRequestLog({
    userId: auth.userId,
    apiKeyId: auth.id,
    credentialId,
    model: opts.model,
    endpoint: "/v1/jobs/createTask",
    providerKind: "BAILIAN",
    requestKind: "VIDEO",
    clientSource: CLIENT_SOURCE,
    clientPage: opts.clientPage,
    inputSummary: buildGatewayInputSummary(opts.model, {
      prompt: opts.prompt,
      referenceImageUrls: opts.referenceImageUrls,
      resolution: opts.resolution,
      ratio: opts.ratio,
      duration: opts.duration,
      ...(opts.seedStr ? { seed: opts.seedStr } : {}),
      ...(opts.parameterExtras ?? {}),
    }),
  });

  const taskId = await submitBailianR2vJobForLog({
    logId: log.id,
    credentialId,
    model: opts.model,
    prompt: opts.prompt,
    referenceImageUrls: opts.referenceImageUrls,
    resolution: opts.resolution,
    ratio: opts.ratio,
    duration: opts.duration,
    seedStr: opts.seedStr,
    parameterExtras: opts.parameterExtras,
  });

  return { taskId, logId: log.id, providerKind: "BAILIAN" };
}

export async function canvasGwCreateHunyuanJob(
  userId: string,
  opts: {
    model: string;
    prompt: string;
    imageUrls?: string[];
    params?: Record<string, unknown>;
    clientPage?: string;
  },
): Promise<CanvasGwJobResult> {
  const auth = await requireGatewayAuth(userId);
  const credentialId = pickCredentialForKind(auth.credentials, "HUNYUAN");
  if (!credentialId) {
    throw new CanvasProjectError(
      "MODEL_NOT_AVAILABLE",
      "Gateway Key 未绑定混元 3D 凭证",
      503,
    );
  }

  const log = await createRequestLog({
    userId: auth.userId,
    apiKeyId: auth.id,
    credentialId,
    model: opts.model,
    endpoint: "/v1/jobs/createTask",
    providerKind: "HUNYUAN",
    requestKind: "IMAGE",
    clientSource: CLIENT_SOURCE,
    clientPage: opts.clientPage,
    inputSummary: buildGatewayInputSummary(opts.model, {
      prompt: opts.prompt,
      imageUrls: opts.imageUrls ?? [],
      params: opts.params ?? {},
    }),
  });

  const taskId = await submitHunyuanJobForLog({
    logId: log.id,
    credentialId,
    model: opts.model,
    input: {
      prompt: opts.prompt,
      imageUrls: opts.imageUrls,
      params: opts.params,
    },
  });

  return { taskId, logId: log.id, providerKind: "HUNYUAN" };
}

export async function canvasGwTts(
  userId: string,
  opts: {
    modelKey: string;
    text: string;
    voice?: string;
    languageType?: string;
    clientPage?: string;
  },
): Promise<{ buffer: Buffer; logId: string; contentType: string; ext: string }> {
  const auth = await requireGatewayAuth(userId);
  const model = opts.modelKey.trim();
  const route = routeGatewayModel(model);
  const credentialId = pickCredentialForKind(auth.credentials, route.providerKind);
  if (!credentialId) {
    throw new CanvasProjectError(
      "MODEL_NOT_AVAILABLE",
      `Gateway Key 未绑定 ${route.providerKind} 凭证`,
      503,
    );
  }

  const payload = {
    model,
    input: opts.text.slice(0, 4096),
    voice: opts.voice ?? "alloy",
    response_format: "mp3",
    ...(opts.languageType?.trim()
      ? { language_type: opts.languageType.trim() }
      : {}),
  };

  const log = await createRequestLog({
    userId: auth.userId,
    apiKeyId: auth.id,
    credentialId,
    model,
    endpoint: isQwenTtsModel(model)
      ? "/services/aigc/multimodal-generation/generation"
      : "/v1/audio/speech",
    providerKind: route.providerKind,
    requestKind: "TTS",
    clientSource: CLIENT_SOURCE,
    clientPage: opts.clientPage,
    inputSummary: buildGatewayInputSummary(model, payload),
  });

  const result = await forwardAudioSpeech({
    credentialId,
    providerKind: route.providerKind,
    body: payload,
  });
  const ok = result.status >= 200 && result.status < 300;
  const usage = result.vendorJson ? parseOpenAiUsage(result.vendorJson) : undefined;
  await finalizeRequestLog(log.id, {
    status: ok ? "SUCCEEDED" : "FAILED",
    durationMs: result.durationMs,
    usage,
    resultSummary: ok
      ? buildGatewayTaskResultSummary(result.vendorJson, {
          contentType: "audio/mpeg",
          byteLength: result.buffer.length,
        })
      : undefined,
    failMessage: ok
      ? undefined
      : result.buffer.toString("utf8").slice(0, 500),
    model,
  });
  if (!ok) {
    const detail = result.buffer.toString("utf8").slice(0, 200).trim();
    throw new CanvasProjectError(
      "MODEL_NOT_AVAILABLE",
      detail
        ? `TTS HTTP ${result.status}: ${detail}`
        : `TTS HTTP ${result.status}`,
      502,
    );
  }
  return {
    buffer: result.buffer,
    logId: log.id,
    contentType: result.contentType ?? "audio/mpeg",
    ext: result.ext ?? "mp3",
  };
}

export type CanvasGwPollResult =
  | { providerKind: "KIE"; record: KieRecordResponse }
  | { providerKind: "BAILIAN"; output: BailianR2vTaskOutput }
  | { providerKind: "HUNYUAN"; polled: CanvasGatewayPollResult }
  | { providerKind: "DASHSCOPE"; output: DashscopeTaskOutput }
  | { providerKind: "VOLCENGINE"; task: VolcengineVideoTaskResult };

export async function canvasGwRecordInfo(
  userId: string,
  opts: {
    taskId: string;
    providerKind: GatewayProviderKind;
    gatewayLogId?: string | null;
  },
): Promise<CanvasGwPollResult> {
  const auth = await requireGatewayAuth(userId);
  const credentialId = pickCredentialForKind(
    auth.credentials,
    opts.providerKind,
  );
  if (!credentialId) {
    throw new CanvasProjectError(
      "MODEL_NOT_AVAILABLE",
      `Gateway Key 未绑定 ${opts.providerKind} 凭证`,
      503,
    );
  }

  if (opts.providerKind === "BAILIAN") {
    const polled = await pollBailianR2vTaskForLog({
      credentialId,
      taskId: opts.taskId,
    });
    // 百炼终态由 gateway poll worker 统一 finalize（避免 canvas poll 写 durationMs=0 且与 worker 竞态）
    return { providerKind: "BAILIAN", output: polled.output };
  }

  if (opts.providerKind === "DASHSCOPE") {
    const polled = await pollDashscopeTaskForLog({
      credentialId,
      taskId: opts.taskId,
    });
    const { output, raw } = polled;
    if (opts.gatewayLogId) {
      const status = output.task_status;
      if (isDashscopeTaskSuccess(status)) {
        await finalizeRequestLog(opts.gatewayLogId, {
          status: "SUCCEEDED",
          durationMs: 0,
          resultSummary: buildGatewayTaskResultSummary(raw, output),
          externalTaskId: opts.taskId,
        });
      } else if (isDashscopeTaskFailed(status)) {
        await finalizeRequestLog(opts.gatewayLogId, {
          status: "FAILED",
          durationMs: 0,
          failMessage: output.message ?? output.code ?? "failed",
          externalTaskId: opts.taskId,
        });
      }
    }
    return { providerKind: "DASHSCOPE", output };
  }

  if (opts.providerKind === "HUNYUAN") {
    const polled = await pollHunyuanTaskForLog({
      credentialId,
      taskId: opts.taskId,
      model: undefined,
    });
    if (opts.gatewayLogId) {
      if (polled.state === "succeeded") {
        await finalizeRequestLog(opts.gatewayLogId, {
          status: "SUCCEEDED",
          durationMs: 0,
          resultSummary: polled,
          externalTaskId: opts.taskId,
        });
      } else if (polled.state === "failed") {
        await finalizeRequestLog(opts.gatewayLogId, {
          status: "FAILED",
          durationMs: 0,
          failMessage: polled.errorMessage ?? "failed",
          externalTaskId: opts.taskId,
        });
      }
    }
    return { providerKind: "HUNYUAN", polled };
  }

  if (opts.providerKind === "VOLCENGINE") {
    const cred = await getDecryptedCredentialApiKey(credentialId);
    if (!cred) {
      throw new CanvasProjectError(
        "MODEL_NOT_AVAILABLE",
        "火山方舟凭证不可用",
        503,
      );
    }
    const polled = await volcengineGetVideoTask({
      apiKey: cred.apiKey,
      baseUrl: cred.baseUrl,
      taskId: opts.taskId,
    });
    const row = polled.output;
    if (opts.gatewayLogId) {
      if (isVolcengineVideoTaskSuccess(row)) {
        await finalizeRequestLog(opts.gatewayLogId, {
          status: "SUCCEEDED",
          durationMs: 0,
          resultSummary: buildGatewayTaskResultSummary(
            polled.raw,
            row.content?.video_url
              ? { videoUrl: row.content.video_url }
              : { status: row.status },
          ),
          externalTaskId: opts.taskId,
        });
      } else if (isVolcengineVideoTaskFailed(row)) {
        await finalizeRequestLog(opts.gatewayLogId, {
          status: "FAILED",
          durationMs: 0,
          failMessage:
            typeof row.error === "string"
              ? row.error
              : (row.error?.message ?? `status=${row.status}`),
          failCode: "VOLCENGINE_TASK_FAILED",
          externalTaskId: opts.taskId,
        });
      }
    }
    return { providerKind: "VOLCENGINE", task: row };
  }

  const record = await pollKieTaskForLog({
    logId: opts.gatewayLogId ?? "",
    credentialId,
    taskId: opts.taskId,
  });
  // KIE 终态由 gateway poll worker 统一 finalize
  return { providerKind: "KIE", record };
}

export function extractCanvasGwKieResultUrl(record: KieRecordResponse): string | null {
  return extractKieResultUrl(record);
}

export function isBailianR2vSucceeded(output: BailianR2vTaskOutput): boolean {
  const s = output.task_status?.toUpperCase() ?? "";
  return s === "SUCCEEDED" || s === "SUCCESS";
}

export function isBailianR2vFailed(output: BailianR2vTaskOutput): boolean {
  const s = output.task_status?.toUpperCase() ?? "";
  return s === "FAILED" || s === "CANCELED" || s === "UNKNOWN";
}

/** Canvas · 百炼 AI 试衣图片分割（同步，经 Gateway 凭证） */
export async function canvasGwImageParsing(
  userId: string,
  opts: {
    imageUrl: string;
    clothesType?: DashscopeClothesType[];
    clientPage?: string;
  },
): Promise<{ output: DashscopeParsingOutput; logId: string }> {
  const auth = await requireGatewayAuth(userId);
  const model = AITRYON_PARSING_MODEL;
  const credentialId = pickCredentialForKind(auth.credentials, "DASHSCOPE");
  if (!credentialId) {
    throw new CanvasProjectError(
      "MODEL_NOT_AVAILABLE",
      "Gateway Key 未绑定 DashScope 凭证",
      503,
    );
  }

  const clothesType = opts.clothesType?.length
    ? opts.clothesType
    : (["upper", "lower"] as DashscopeClothesType[]);

  const log = await createRequestLog({
    userId: auth.userId,
    apiKeyId: auth.id,
    credentialId,
    model,
    endpoint: "/v1/image-process/process",
    providerKind: "DASHSCOPE",
    requestKind: "TRYON",
    clientSource: CLIENT_SOURCE,
    clientPage: opts.clientPage,
    inputSummary: buildGatewayInputSummary(model, {
      imageUrl: opts.imageUrl,
      clothesType,
    }),
  });

  const started = Date.now();
  try {
    const cred = await getDecryptedCredentialApiKey(credentialId);
    if (!cred) {
      throw new CanvasProjectError(
        "MODEL_NOT_AVAILABLE",
        "DashScope 凭证不可用",
        503,
      );
    }
    const result = await dashscopeImageParsing({
      apiKey: cred.apiKey,
      imageUrl: opts.imageUrl,
      clothesType,
      model,
    });
    if (!result.ok) {
      await finalizeRequestLog(log.id, {
        status: "FAILED",
        durationMs: Date.now() - started,
        failMessage: result.error,
        model,
      });
      throw new CanvasProjectError(
        "MODEL_NOT_AVAILABLE",
        result.error,
        502,
      );
    }
    await finalizeRequestLog(log.id, {
      status: "SUCCEEDED",
      durationMs: Date.now() - started,
      resultSummary: result.output,
      model,
    });
    return { output: result.output, logId: log.id };
  } catch (e) {
    if (e instanceof CanvasProjectError) throw e;
    await finalizeRequestLog(log.id, {
      status: "FAILED",
      durationMs: Date.now() - started,
      failMessage: (e as Error).message,
      model,
    });
    throw e;
  }
}

function wrapCanvasChatStreamWithLogFinalize(
  upstream: ReadableStream<Uint8Array>,
  ctx: { logId: string; model: string; startedMs: number },
): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  let buffer = "";
  let lastUsage: UsageFromResponse | undefined;
  let failMessage: string | undefined;

  return new ReadableStream({
    async start(controller) {
      const reader = upstream.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(value);
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n");
          buffer = parts.pop() ?? "";
          for (const line of parts) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const payload = trimmed.slice(5).trim();
            if (!payload || payload === "[DONE]") continue;
            try {
              const json = JSON.parse(payload) as Record<string, unknown>;
              const u = parseOpenAiUsage(json);
              if (
                u.totalTokens != null ||
                u.promptTokens != null ||
                u.completionTokens != null
              ) {
                lastUsage = u;
              }
              const err = json.error as { message?: string } | undefined;
              if (typeof err?.message === "string") failMessage = err.message;
            } catch {
              /* ignore */
            }
          }
        }
        await finalizeRequestLog(ctx.logId, {
          status: failMessage ? "FAILED" : "SUCCEEDED",
          durationMs: ctx.startedMs,
          usage: lastUsage,
          resultSummary: lastUsage
            ? buildGatewayStreamChatResultSummary(lastUsage)
            : undefined,
          failCode: failMessage ? "STREAM_VENDOR_ERROR" : undefined,
          failMessage,
          model: ctx.model,
        });
        controller.close();
      } catch (e) {
        await finalizeRequestLog(ctx.logId, {
          status: "FAILED",
          durationMs: ctx.startedMs,
          failCode: "STREAM_INTERRUPTED",
          failMessage: (e as Error).message || "流式连接中断",
          model: ctx.model,
        });
        controller.error(e);
      } finally {
        reader.releaseLock();
      }
    },
  });
}

/** Canvas 剧本助手等 · Gateway 流式 Chat */
export async function canvasGwChatStream(
  userId: string,
  opts: {
    modelKey: string;
    messages: CanvasChatMessage[];
    params?: Record<string, unknown>;
    clientPage?: string;
  },
): Promise<{ logId: string; status: number; body: ReadableStream<Uint8Array> }> {
  const auth = await requireGatewayAuth(userId);
  const model = opts.modelKey.trim();
  const route = routeGatewayModel(model);
  const credentialId = pickCredentialForKind(auth.credentials, route.providerKind);
  if (!credentialId) {
    throw new CanvasProjectError(
      "MODEL_NOT_AVAILABLE",
      `Gateway Key 未绑定 ${route.providerKind} 凭证`,
      503,
    );
  }

  const body: Record<string, unknown> = {
    model,
    messages: opts.messages,
    stream: true,
    stream_options: { include_usage: true },
    ...(opts.params ?? {}),
  };

  const log = await createRequestLog({
    userId: auth.userId,
    apiKeyId: auth.id,
    credentialId,
    model,
    endpoint: "/v1/chat/completions",
    providerKind: route.providerKind,
    requestKind: "CHAT",
    clientSource: CLIENT_SOURCE,
    clientPage: opts.clientPage,
    inputSummary: buildGatewayInputSummary(model, body),
  });

  const result = await forwardChatCompletionsStream({
    credentialId,
    providerKind: route.providerKind,
    body,
  });

  if (!result.body || result.status >= 300) {
    const errText = result.body
      ? await new Response(result.body).text()
      : `HTTP ${result.status}`;
    const failMessage = summarizeUpstreamFailMessage(errText, result.status);
    await finalizeRequestLog(log.id, {
      status: "FAILED",
      durationMs: result.durationMs,
      failCode: `UPSTREAM_HTTP_${result.status}`,
      failMessage,
      model,
    });
    throw new CanvasProjectError("MODEL_NOT_AVAILABLE", failMessage, 502);
  }

  return {
    logId: log.id,
    status: result.status,
    body: wrapCanvasChatStreamWithLogFinalize(result.body, {
      logId: log.id,
      model,
      startedMs: result.durationMs,
    }),
  };
}
