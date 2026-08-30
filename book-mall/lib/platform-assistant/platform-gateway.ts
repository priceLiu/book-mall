/**
 * 平台 AI 导览助手 · 平台代付 Gateway 出口。
 * 用 Platform Admin Key 直接调 Gateway（chat / embeddings），不依赖用户个人 sk-gw、不校验订阅。
 */
import { findPlatformAdminApiKey } from "@/lib/gateway/platform-credential-pool";
import { resolveGatewayApiKeyById } from "@/lib/gateway/api-key-service";
import { routeGatewayModel } from "@/lib/gateway/model-router";
import {
  createRequestLog,
  finalizeRequestLog,
  forwardEmbeddings,
  parseOpenAiUsage,
  pickCredentialForKind,
} from "@/lib/gateway/proxy-common";
import { buildGatewayInputSummary } from "@/lib/gateway/log-input-summary";
import {
  gatewayV1ChatCompletions,
  gatewayV1ChatCompletionsStream,
  gatewayV1Embeddings,
  gatewayV1ClientMeta,
} from "@/lib/gateway/gateway-v1-http-client";
import { resolveModelChain } from "@/lib/platform-assistant/platform-assistant-model-config-service";

export class PlatformAssistantGatewayError extends Error {
  constructor(
    message: string,
    readonly httpStatus = 502,
  ) {
    super(message);
    this.name = "PlatformAssistantGatewayError";
  }
}

async function resolvePlatformApiKeyId(): Promise<string> {
  const key = await findPlatformAdminApiKey();
  if (!key?.id) {
    throw new PlatformAssistantGatewayError(
      "平台 Gateway Key 未就绪，导览助手暂不可用",
      503,
    );
  }
  return key.id;
}

/** 平台代付：文本向量（RAG 检索 / 入库共用）。返回 float[] 数组，与 input 顺序一致。 */
export async function platformEmbedTexts(
  inputs: string[],
  opts: { model: string; dimensions?: number; clientPage?: string; timeoutMs?: number },
): Promise<number[][]> {
  if (inputs.length === 0) return [];
  const apiKeyId = await resolvePlatformApiKeyId();
  const body: Record<string, unknown> = {
    model: opts.model,
    input: inputs,
  };
  if (opts.dimensions) body.dimensions = opts.dimensions;

  // 上限超时：避免内部链路（book-mall → Gateway → DashScope）socket 挂死时无限等待
  let signal: AbortSignal | undefined;
  try {
    signal = AbortSignal.timeout(opts.timeoutMs ?? 45_000);
  } catch {
    signal = undefined;
  }

  const res = await gatewayV1Embeddings({
    apiKeyId,
    body,
    signal,
    meta: gatewayV1ClientMeta("TOOL", {
      clientPage: opts.clientPage ?? "platform-assistant/embed",
    }),
  });
  if (res.status < 200 || res.status >= 300) {
    throw new PlatformAssistantGatewayError(
      `embedding 失败 (HTTP ${res.status}): ${res.text.slice(0, 400)}`,
      502,
    );
  }
  return parseEmbeddingResponse(res.text, inputs);
}

function parseEmbeddingResponse(
  text: string,
  inputs: string[],
): number[][] {
  let parsed: { data?: { embedding?: number[]; index?: number }[] };
  try {
    parsed = JSON.parse(text) as typeof parsed;
  } catch {
    throw new PlatformAssistantGatewayError("embedding 响应非 JSON", 502);
  }
  const rows = parsed.data ?? [];
  const out: number[][] = new Array(inputs.length);
  rows.forEach((row, i) => {
    const idx = typeof row.index === "number" ? row.index : i;
    out[idx] = Array.isArray(row.embedding) ? row.embedding : [];
  });
  return out;
}

/**
 * 入库脚本专用：进程内直调 forwardEmbeddings，并写入 GatewayRequestLog（对账可聚合）。
 * 避免 dev 经 book-mall HTTP 自调用导致路由 404。
 */
export async function platformEmbedTextsInProcess(
  inputs: string[],
  opts: { model: string; dimensions?: number; clientPage?: string },
): Promise<number[][]> {
  if (inputs.length === 0) return [];
  const key = await findPlatformAdminApiKey();
  if (!key?.id || !key.userId) {
    throw new PlatformAssistantGatewayError(
      "平台 Gateway Key 未就绪，导览助手暂不可用",
      503,
    );
  }
  const auth = await resolveGatewayApiKeyById(key.id);
  if (!auth) {
    throw new PlatformAssistantGatewayError("平台 Gateway Key 无效", 503);
  }

  const body: Record<string, unknown> = {
    model: opts.model,
    input: inputs,
  };
  if (opts.dimensions) body.dimensions = opts.dimensions;

  const route = routeGatewayModel(opts.model);
  const credentialId = pickCredentialForKind(auth.credentials, route.providerKind);
  if (!credentialId) {
    throw new PlatformAssistantGatewayError(
      `平台凭证未绑定 ${route.providerKind}`,
      503,
    );
  }

  const { model: _modelField, ...restBody } = body;
  const started = Date.now();
  let log;
  try {
    log = await createRequestLog({
      userId: key.userId,
      apiKeyId: key.id,
      credentialId,
      model: opts.model,
      endpoint: "/v1/embeddings",
      providerKind: route.providerKind,
      requestKind: "OTHER",
      clientSource: "TOOL",
      clientPage: opts.clientPage ?? "platform-assistant/index-embed",
      inputSummary: buildGatewayInputSummary(opts.model, restBody),
      actorBookUserId: key.userId,
    });
  } catch (e) {
    throw new PlatformAssistantGatewayError(
      e instanceof Error ? e.message : "创建 Gateway 日志失败",
      503,
    );
  }

  try {
    const result = await forwardEmbeddings({
      credentialId,
      providerKind: route.providerKind,
      body,
    });
    let usage;
    try {
      usage = parseOpenAiUsage(JSON.parse(result.text));
    } catch {
      usage = undefined;
    }
    await finalizeRequestLog(log.id, {
      status: result.status >= 200 && result.status < 300 ? "SUCCEEDED" : "FAILED",
      durationMs: result.durationMs || Date.now() - started,
      usage,
      model: opts.model,
      failCode: result.status >= 300 ? "UPSTREAM_ERROR" : undefined,
    });
    if (result.status < 200 || result.status >= 300) {
      throw new PlatformAssistantGatewayError(
        `embedding 失败 (HTTP ${result.status}): ${result.text.slice(0, 400)}`,
        502,
      );
    }
    return parseEmbeddingResponse(result.text, inputs);
  } catch (e) {
    if (!(e instanceof PlatformAssistantGatewayError)) {
      await finalizeRequestLog(log.id, {
        status: "FAILED",
        durationMs: Date.now() - started,
        failCode: "UPSTREAM_ERROR",
        failMessage: e instanceof Error ? e.message : String(e),
        model: opts.model,
      }).catch(() => undefined);
    }
    throw e;
  }
}

function isVendorInsufficientBalance(status: number, errText: string): boolean {
  if (status !== 402) return false;
  return /insufficient|余额|balance|quota|credit/i.test(errText);
}

/** 平台代付：流式对话，返回可直接透传的 SSE ReadableStream。 */
export async function platformChatStream(opts: {
  model: string;
  fallbackModels?: string[];
  messages: { role: string; content: string }[];
  maxTokens?: number;
  temperature?: number;
  clientPage?: string;
}): Promise<{ status: number; body: ReadableStream<Uint8Array> }> {
  const apiKeyId = await resolvePlatformApiKeyId();
  const models = resolveModelChain(opts.model, opts.fallbackModels ?? []);
  let lastErr = "";

  for (const model of models) {
    const body: Record<string, unknown> = {
      model,
      messages: opts.messages,
      stream: true,
      stream_options: { include_usage: true },
      max_tokens: opts.maxTokens ?? 1024,
      temperature: opts.temperature ?? 0.4,
    };
    const res = await gatewayV1ChatCompletionsStream({
      apiKeyId,
      body,
      meta: gatewayV1ClientMeta("TOOL", {
        clientPage: opts.clientPage ?? "platform-assistant/chat",
      }),
    });
    if (res.body && res.status < 300) {
      return { status: res.status, body: res.body };
    }
    const errText = res.body ? await new Response(res.body).text() : `HTTP ${res.status}`;
    lastErr = errText;
    if (isVendorInsufficientBalance(res.status, errText) && model !== models.at(-1)) {
      console.warn(
        `[platform-assistant] chat model ${model} insufficient balance, trying fallback`,
      );
      continue;
    }
    throw new PlatformAssistantGatewayError(
      `对话失败 (HTTP ${res.status}): ${errText.slice(0, 200)}`,
      502,
    );
  }

  throw new PlatformAssistantGatewayError(
    `对话失败：厂商余额不足，请稍后再试。${lastErr.slice(0, 120)}`,
    502,
  );
}

/** 平台代付：非流式对话，返回 assistant 文本。 */
export async function platformChatCompletion(opts: {
  model: string;
  fallbackModels?: string[];
  messages: { role: string; content: string }[];
  maxTokens?: number;
  temperature?: number;
  clientPage?: string;
}): Promise<string> {
  const apiKeyId = await resolvePlatformApiKeyId();
  const models = resolveModelChain(opts.model, opts.fallbackModels ?? []);
  let lastErr = "";

  for (const model of models) {
    const body: Record<string, unknown> = {
      model,
      messages: opts.messages,
      stream: false,
      max_tokens: opts.maxTokens ?? 1024,
      temperature: opts.temperature ?? 0.5,
    };
    const res = await gatewayV1ChatCompletions({
      apiKeyId,
      body,
      meta: gatewayV1ClientMeta("TOOL", {
        clientPage: opts.clientPage ?? "platform-assistant/completion",
      }),
    });
    if (res.status >= 200 && res.status < 300) {
      let parsed: unknown = null;
      try {
        parsed = res.text ? JSON.parse(res.text) : null;
      } catch {
        parsed = null;
      }
      const choice = (parsed as { choices?: { message?: { content?: string } }[] })
        ?.choices?.[0];
      const text =
        typeof choice?.message?.content === "string"
          ? choice.message.content
          : res.text;
      return text.trim();
    }
    lastErr = res.text;
    if (isVendorInsufficientBalance(res.status, res.text) && model !== models.at(-1)) {
      console.warn(
        `[platform-assistant] chat model ${model} insufficient balance, trying fallback`,
      );
      continue;
    }
    throw new PlatformAssistantGatewayError(
      `对话失败 (HTTP ${res.status}): ${res.text.slice(0, 200)}`,
      502,
    );
  }

  throw new PlatformAssistantGatewayError(
    `对话失败：厂商余额不足，请稍后再试。${lastErr.slice(0, 120)}`,
    502,
  );
}
