/**
 * Canvas → Gateway 客户端（仅经 /api/gw/v1 + 用户关联的 Gateway API Key）
 */

import type { GatewayProviderKind } from "@prisma/client";

import { CanvasProjectError } from "./canvas-project-service";
import { resolveGatewayAuthForBookUser } from "@/lib/gateway/book-gateway-link";
import {
  finalizeRequestLog,
  parseOpenAiUsage,
  pickCredentialForKind,
  type UsageFromResponse,
} from "@/lib/gateway/proxy-common";
import { pickVolcengineCredentialForGatewayJob } from "@/lib/gateway/volcengine-credential-pick";
import { summarizeUpstreamFailMessage } from "@/lib/gateway/book-gateway-link";
import { routeGatewayModel } from "@/lib/gateway/model-router";
import {
  buildGatewayChatResultSummary,
  buildGatewayStreamChatResultSummary,
} from "@/lib/gateway/log-result-summary";
import {
  GatewayV1ChatError,
  runGatewayV1ChatCompletions,
} from "@/lib/gateway/gateway-v1-chat-service";
import {
  GatewayV1KieTaskError,
  runGatewayV1KieCreateTask,
} from "@/lib/gateway/gateway-v1-kie-task-service";
import {
  gatewayV1AudioSpeech,
  gatewayV1ChatCompletionsStream,
  gatewayV1ImageParsing,
  gatewayV1RecordInfo,
} from "@/lib/gateway/gateway-v1-http-client";
import { gatewayV1ClientMetaForBookUser } from "@/lib/gateway/gateway-log-meta-for-user";
import { resolveCanvasProjectTeamTenantId } from "@/lib/gateway/resolve-canvas-project-team-tenant";
import type { CanvasChatMessage } from "./providers/types";
import { extractKieResultUrl, type KieRecordResponse } from "@/lib/story/kie-client";
import type { BailianR2vTaskOutput } from "./canvas-video-bailian-r2v";
import type { CanvasGatewayPollResult } from "./providers/types";
import {
  AITRYON_PARSING_MODEL,
  type DashscopeClothesType,
  type DashscopeParsingOutput,
  type DashscopeTaskOutput,
} from "@/lib/gateway/dashscope-client";
import type { VolcengineVideoTaskResult } from "@/lib/gateway/volcengine-client";

const CLIENT_SOURCE = "CANVAS" as const;

async function canvasGwMeta(
  userId: string,
  extra?: {
    clientPage?: string;
    storyProjectId?: string;
    storyTaskId?: string;
    projectId?: string;
  },
) {
  const preferredTenantId = extra?.projectId
    ? await resolveCanvasProjectTeamTenantId(extra.projectId)
    : undefined;
  const { projectId: _projectId, ...rest } = extra ?? {};
  return gatewayV1ClientMetaForBookUser(CLIENT_SOURCE, userId, {
    ...rest,
    preferredTenantId,
  });
}

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
    projectId?: string;
    canvasTaskId?: string;
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

  const meta = await canvasGwMeta(userId, {
    clientPage: opts.clientPage,
    projectId: opts.projectId,
    storyTaskId: opts.canvasTaskId,
  });

  let result: { text: string; status: number; logId?: string };
  try {
    const inProcess = await runGatewayV1ChatCompletions({
      auth,
      body,
      logMeta: meta,
    });
    result = inProcess;
  } catch (e) {
    if (e instanceof GatewayV1ChatError) {
      throw new CanvasProjectError(
        "MODEL_NOT_AVAILABLE",
        e.message,
        e.status >= 400 && e.status < 600 ? e.status : 502,
      );
    }
    throw e;
  }

  let parsed: unknown = null;
  try {
    parsed = result.text ? JSON.parse(result.text) : null;
  } catch {
    parsed = null;
  }
  const usage = parseOpenAiUsage(parsed);
  const ok = result.status >= 200 && result.status < 300;
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
    logId: result.logId ?? "",
  };
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
    projectId?: string;
    canvasTaskId?: string;
    sbv1Billing?: Record<string, unknown>;
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

  const meta = await canvasGwMeta(userId, {
    clientPage: opts.clientPage,
    projectId: opts.projectId,
    storyTaskId: opts.canvasTaskId,
  });

  const body = {
    model: opts.model,
    input: {
      ...opts.input,
      ...(opts.sbv1Billing ? { sbv1Billing: opts.sbv1Billing } : {}),
    },
    callBackUrl: opts.callBackUrl ?? null,
  };

  try {
    const inProcess = await runGatewayV1KieCreateTask({
      auth,
      body,
      logMeta: meta,
    });
    return {
      taskId: inProcess.taskId,
      logId: inProcess.logId,
      providerKind: "KIE",
    };
  } catch (e) {
    if (e instanceof GatewayV1KieTaskError) {
      throw new CanvasProjectError(
        "MODEL_NOT_AVAILABLE",
        e.message,
        e.status >= 400 && e.status < 600 ? e.status : 502,
      );
    }
    throw e;
  }
}

export async function canvasGwCreateVolcengineVideoJob(
  userId: string,
  opts: {
    model: string;
    body: Record<string, unknown>;
    clientPage?: string;
    projectId?: string;
    providerId?: string;
    sbv1Billing?: Record<string, unknown>;
    /** 影视专业版 2.0 等：可选指定 Gateway 绑定的 VOLCENGINE 凭证 id */
    gatewayCredentialId?: string;
    /** CanvasGenerationTask.id，写入 Gateway 日志 storyTaskId 便于对账 */
    canvasTaskId?: string;
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
  const inputForPick: Record<string, unknown> = {
    ...opts.body,
    ...(opts.providerId ? { providerId: opts.providerId } : {}),
    ...(opts.sbv1Billing ? { sbv1Billing: opts.sbv1Billing } : {}),
    ...(opts.gatewayCredentialId
      ? { gatewayCredentialId: opts.gatewayCredentialId }
      : {}),
  };
  const credentialId = pickVolcengineCredentialForGatewayJob({
    credentials: auth.credentials,
    modelKey: opts.model,
    clientPage: opts.clientPage,
    input: inputForPick,
    preferredCredentialId: opts.gatewayCredentialId,
    providerId: opts.providerId,
  });
  if (!credentialId) {
    throw new CanvasProjectError(
      "MODEL_NOT_AVAILABLE",
      "Gateway Key 未绑定火山方舟凭证",
      503,
    );
  }

  const created = await gatewayV1CreateTask({
    apiKeyId: auth.id,
    body: {
      model: opts.model,
      input: inputForPick,
    },
    meta: await canvasGwMeta(userId, {
      clientPage: opts.clientPage,
      projectId: opts.projectId,
      storyTaskId: opts.canvasTaskId,
    }),
  });

  return {
    taskId: created.taskId,
    logId: created.logId,
    providerKind: "VOLCENGINE",
  };
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
    projectId?: string;
    canvasTaskId?: string;
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

  const created = await gatewayV1CreateTask({
    apiKeyId: auth.id,
    body: {
      model: opts.model,
      bailian: {
        prompt: opts.prompt,
        referenceImageUrls: opts.referenceImageUrls,
        resolution: opts.resolution,
        ratio: opts.ratio,
        duration: opts.duration,
        seedStr: opts.seedStr,
        parameterExtras: opts.parameterExtras,
      },
    },
    meta: await canvasGwMeta(userId, {
      clientPage: opts.clientPage,
      projectId: opts.projectId,
      storyTaskId: opts.canvasTaskId,
    }),
  });

  return {
    taskId: created.taskId,
    logId: created.logId,
    providerKind: "BAILIAN",
  };
}

export async function canvasGwCreateHunyuanJob(
  userId: string,
  opts: {
    model: string;
    prompt: string;
    imageUrls?: string[];
    params?: Record<string, unknown>;
    clientPage?: string;
    projectId?: string;
    canvasTaskId?: string;
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

  const created = await gatewayV1CreateTask({
    apiKeyId: auth.id,
    body: {
      model: opts.model,
      hunyuan: {
        prompt: opts.prompt,
        imageUrls: opts.imageUrls,
        params: opts.params,
      },
    },
    meta: await canvasGwMeta(userId, {
      clientPage: opts.clientPage,
      projectId: opts.projectId,
      storyTaskId: opts.canvasTaskId,
    }),
  });

  return {
    taskId: created.taskId,
    logId: created.logId,
    providerKind: "HUNYUAN",
  };
}

export async function canvasGwTts(
  userId: string,
  opts: {
    modelKey: string;
    text: string;
    voice?: string;
    languageType?: string;
    clientPage?: string;
    projectId?: string;
    canvasTaskId?: string;
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

  const result = await gatewayV1AudioSpeech({
    apiKeyId: auth.id,
    body: {
      model,
      input: opts.text.slice(0, 4096),
      voice: opts.voice ?? "alloy",
      response_format: "mp3",
      ...(opts.languageType?.trim()
        ? { language_type: opts.languageType.trim() }
        : {}),
    },
    meta: await canvasGwMeta(userId, {
      clientPage: opts.clientPage,
      projectId: opts.projectId,
      storyTaskId: opts.canvasTaskId,
    }),
  });

  return {
    buffer: result.buffer,
    logId: result.logId,
    contentType: result.contentType,
    ext: result.ext,
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
  if (!pickCredentialForKind(auth.credentials, opts.providerKind)) {
    throw new CanvasProjectError(
      "MODEL_NOT_AVAILABLE",
      `Gateway Key 未绑定 ${opts.providerKind} 凭证`,
      503,
    );
  }

  const polled = await gatewayV1RecordInfo({
    apiKeyId: auth.id,
    taskId: opts.taskId,
    meta: await canvasGwMeta(userId),
  });

  if (polled.providerKind === "BAILIAN") {
    return {
      providerKind: "BAILIAN",
      output: polled.data as BailianR2vTaskOutput,
    };
  }
  if (polled.providerKind === "DASHSCOPE") {
    return {
      providerKind: "DASHSCOPE",
      output: polled.data as DashscopeTaskOutput,
    };
  }
  if (polled.providerKind === "HUNYUAN") {
    return {
      providerKind: "HUNYUAN",
      polled: polled.data as CanvasGatewayPollResult,
    };
  }
  if (polled.providerKind === "VOLCENGINE") {
    return {
      providerKind: "VOLCENGINE",
      task: polled.data as VolcengineVideoTaskResult,
    };
  }

  return {
    providerKind: "KIE",
    record: polled.data as KieRecordResponse,
  };
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
    projectId?: string;
    canvasTaskId?: string;
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

  const result = await gatewayV1ImageParsing({
    apiKeyId: auth.id,
    body: {
      imageUrl: opts.imageUrl,
      clothesType,
      model,
    },
    meta: await canvasGwMeta(userId, {
      clientPage: opts.clientPage,
      projectId: opts.projectId,
      storyTaskId: opts.canvasTaskId,
    }),
  });

  return {
    output: result.output as DashscopeParsingOutput,
    logId: result.logId,
  };
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
    projectId?: string;
    canvasTaskId?: string;
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

  const result = await gatewayV1ChatCompletionsStream({
    apiKeyId: auth.id,
    body,
    meta: await canvasGwMeta(userId, {
      clientPage: opts.clientPage,
      projectId: opts.projectId,
      storyTaskId: opts.canvasTaskId,
    }),
  });

  const logId = result.headers.get("x-gateway-log-id") ?? "";
  const bodyStream = result.body;

  if (!bodyStream || result.status >= 300) {
    const errText = bodyStream
      ? await new Response(bodyStream).text()
      : `HTTP ${result.status}`;
    throw new CanvasProjectError(
      "MODEL_NOT_AVAILABLE",
      summarizeUpstreamFailMessage(errText, result.status),
      502,
    );
  }

  return {
    logId,
    status: result.status,
    body: wrapCanvasChatStreamWithLogFinalize(bodyStream, {
      logId,
      model,
      startedMs: 0,
    }),
  };
}
