/**
 * 通用 OpenAI 兼容 gateway。
 *
 * 用户填 baseUrl + apiKey；自动调 `${baseUrl}/models` 拉模型清单；
 * chat 走 `${baseUrl}/chat/completions`；
 * image 走 `${baseUrl}/images/generations`（可选，部分服务无此端点时报 unsupported）。
 *
 * 同时被 `ali-bailian.ts` 复用（仅 baseUrl + 模型清单 fallback 区分）。
 */

import {
  CanvasGatewayError,
  type CanvasGatewayChatRequest,
  type CanvasGatewayChatResponse,
  type CanvasGatewayImageRequest,
  type CanvasGatewayImageTask,
  type CanvasGatewayListModelsResult,
  type CanvasGatewayListedModel,
  type CanvasParamSchema,
  type CanvasProviderConfig,
  type CanvasProviderGateway,
} from "./types";
import type { CanvasProviderKind } from "@prisma/client";

export type OpenAiCompatOptions = {
  /** 决定 fallback 模型清单与显示 kind */
  kind: CanvasProviderKind;
  /** baseUrl 默认值（如果用户没传） */
  defaultBaseUrl?: string;
  /** 模型 fallback（拉清单失败时用） */
  fallbackModels?: CanvasGatewayListedModel[];
};

const COMMON_LLM_PARAMS: CanvasParamSchema = [
  {
    key: "temperature",
    label: "temperature",
    type: "number",
    min: 0,
    max: 2,
    step: 0.1,
    defaultValue: 0.7,
  },
  {
    key: "max_tokens",
    label: "max_tokens",
    type: "number",
    min: 256,
    max: 16000,
    step: 128,
    defaultValue: 2000,
  },
];

const COMMON_IMAGE_PARAMS: CanvasParamSchema = [
  {
    key: "size",
    label: "尺寸",
    type: "select",
    options: [
      { value: "1024x1024", label: "1024x1024" },
      { value: "1792x1024", label: "1792x1024" },
      { value: "1024x1792", label: "1024x1792" },
    ],
    defaultValue: "1024x1024",
  },
  {
    key: "n",
    label: "数量",
    type: "number",
    min: 1,
    max: 4,
    step: 1,
    defaultValue: 1,
  },
];

function isImageModelKey(key: string): boolean {
  const k = key.toLowerCase();
  return (
    k.includes("image") ||
    k.includes("dalle") ||
    k.includes("dall-e") ||
    k.includes("wanx") ||
    k.includes("flux") ||
    k.includes("sd") ||
    k.includes("stable-diffusion") ||
    k.includes("imagen") ||
    k.includes("kandinsky")
  );
}

function isVideoModelKey(key: string): boolean {
  const k = key.toLowerCase();
  return k.includes("video") || k.includes("wan-2") || k.includes("kling-video");
}

function inferRoleFromModelKey(key: string): CanvasGatewayListedModel["role"] {
  if (isVideoModelKey(key)) return "VIDEO";
  if (isImageModelKey(key)) return "IMAGE";
  return "LLM";
}

export class OpenAiCompatGateway implements CanvasProviderGateway {
  readonly kind: CanvasProviderKind;
  protected readonly apiKey: string;
  protected readonly baseUrl: string;
  protected readonly fallbackModels: CanvasGatewayListedModel[];

  constructor(config: CanvasProviderConfig, opts: OpenAiCompatOptions) {
    if (!config.apiKey) {
      throw new CanvasGatewayError(
        "PROVIDER_NOT_CONFIGURED",
        `${opts.kind} provider 缺少 apiKey`,
      );
    }
    const baseUrl = (config.baseUrl?.trim() || opts.defaultBaseUrl || "").replace(
      /\/$/,
      "",
    );
    if (!baseUrl) {
      throw new CanvasGatewayError(
        "PROVIDER_NOT_CONFIGURED",
        `${opts.kind} provider 缺少 baseUrl`,
      );
    }
    this.kind = opts.kind;
    this.apiKey = config.apiKey;
    this.baseUrl = baseUrl;
    this.fallbackModels = opts.fallbackModels ?? [];
  }

  async testConnection(): Promise<{ ok: boolean; message?: string }> {
    try {
      const r = await fetch(`${this.baseUrl}/models`, {
        method: "GET",
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      if (r.status === 401 || r.status === 403) {
        return { ok: false, message: `auth failed (HTTP ${r.status})` };
      }
      if (r.status === 404) {
        // 部分兼容服务没有 /models；尝试 chat ping
        return await this.pingChat();
      }
      if (!r.ok) {
        const txt = await r.text();
        return { ok: false, message: `HTTP ${r.status}: ${txt.slice(0, 200)}` };
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, message: (e as Error).message };
    }
  }

  protected async pingChat(): Promise<{ ok: boolean; message?: string }> {
    try {
      const r = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.fallbackModels[0]?.modelKey ?? "gpt-3.5-turbo",
          messages: [{ role: "user", content: "ping" }],
          max_tokens: 4,
        }),
      });
      if (!r.ok) {
        const txt = await r.text();
        return { ok: false, message: `HTTP ${r.status}: ${txt.slice(0, 200)}` };
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, message: (e as Error).message };
    }
  }

  async listModels(): Promise<CanvasGatewayListModelsResult> {
    try {
      const r = await fetch(`${this.baseUrl}/models`, {
        method: "GET",
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      if (!r.ok) {
        return {
          models: this.fallbackModels,
          fromHardcoded: true,
          warning: `/models HTTP ${r.status}`,
        };
      }
      const text = await r.text();
      const json = JSON.parse(text) as { data?: { id?: string }[] };
      const arr = (json.data ?? []).map<CanvasGatewayListedModel>((m) => {
        const id = m.id ?? "";
        const role = inferRoleFromModelKey(id);
        return {
          modelKey: id,
          displayName: id,
          role,
          paramsSchema:
            role === "IMAGE" ? COMMON_IMAGE_PARAMS : COMMON_LLM_PARAMS,
        };
      });
      if (arr.length === 0) {
        return {
          models: this.fallbackModels,
          fromHardcoded: true,
          warning: "/models 返回为空",
        };
      }
      return { models: arr };
    } catch (e) {
      return {
        models: this.fallbackModels,
        fromHardcoded: true,
        warning: (e as Error).message,
      };
    }
  }

  async chat(req: CanvasGatewayChatRequest): Promise<CanvasGatewayChatResponse> {
    const body: Record<string, unknown> = {
      model: req.modelKey,
      messages: req.messages,
      stream: false,
    };
    const params = (req.params ?? {}) as Record<string, unknown>;
    if (params.temperature !== undefined) body.temperature = params.temperature;
    if (params.max_tokens) body.max_tokens = params.max_tokens;
    const r = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });
    const text = await r.text();
    if (!r.ok) {
      if (r.status === 401 || r.status === 403) {
        throw new CanvasGatewayError(
          "PROVIDER_AUTH_ERROR",
          `${this.kind} auth failed: ${text.slice(0, 200)}`,
          r.status,
          false,
        );
      }
      if (r.status === 404 || /model_not_found/i.test(text)) {
        throw new CanvasGatewayError(
          "PROVIDER_MODEL_NOT_FOUND",
          `${this.kind} model ${req.modelKey} not found`,
          404,
          false,
        );
      }
      throw new CanvasGatewayError(
        "PROVIDER_HTTP_ERROR",
        `${this.kind} chat HTTP ${r.status}: ${text.slice(0, 400)}`,
      );
    }
    const json = JSON.parse(text) as {
      choices?: { message?: { content?: string } }[];
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
      };
    };
    const out = json.choices?.[0]?.message?.content;
    if (typeof out !== "string" || !out) {
      throw new CanvasGatewayError(
        "PROVIDER_INVALID_RESPONSE",
        `${this.kind} chat empty content`,
      );
    }
    return {
      text: out,
      rawPayload: json,
      usage: {
        promptTokens: json.usage?.prompt_tokens,
        completionTokens: json.usage?.completion_tokens,
        totalTokens: json.usage?.total_tokens,
      },
    };
  }

  async createImageTask(
    req: CanvasGatewayImageRequest,
  ): Promise<CanvasGatewayImageTask> {
    const params = (req.params ?? {}) as Record<string, unknown>;
    const body: Record<string, unknown> = {
      model: req.modelKey,
      prompt: req.prompt,
      n: params.n ?? 1,
      size: params.size ?? "1024x1024",
    };
    const r = await fetch(`${this.baseUrl}/images/generations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });
    const text = await r.text();
    if (!r.ok) {
      if (r.status === 404) {
        throw new CanvasGatewayError(
          "PROVIDER_UNSUPPORTED",
          `${this.kind} 不支持 /images/generations`,
          404,
          false,
        );
      }
      throw new CanvasGatewayError(
        "PROVIDER_HTTP_ERROR",
        `${this.kind} image HTTP ${r.status}: ${text.slice(0, 400)}`,
      );
    }
    const json = JSON.parse(text) as {
      data?: { url?: string; b64_json?: string }[];
    };
    const urls: string[] = [];
    for (const item of json.data ?? []) {
      if (item.url) urls.push(item.url);
      else if (item.b64_json)
        urls.push(`data:image/png;base64,${item.b64_json}`);
    }
    if (urls.length === 0) {
      throw new CanvasGatewayError(
        "PROVIDER_INVALID_RESPONSE",
        `${this.kind} image 无结果 url`,
      );
    }
    return { mode: "sync", resultUrls: urls, rawPayload: json };
  }
}
