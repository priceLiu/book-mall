/**
 * canvas v2 · Provider Gateway 抽象
 *
 * 所有 Provider（KIE / 阿里百炼 / 通用 OpenAI 兼容 / Gemini Native）实现统一接口，
 * 让节点引擎层不感知 Provider 差异。
 */

import type { CanvasModelRole, CanvasProviderKind } from "@prisma/client";

export type CanvasParamSchemaItem =
  | {
      key: string;
      label: string;
      type: "select";
      options: { value: string; label: string }[];
      defaultValue?: string;
      required?: boolean;
      help?: string;
    }
  | {
      key: string;
      label: string;
      type: "text" | "textarea";
      defaultValue?: string;
      placeholder?: string;
      required?: boolean;
      help?: string;
    }
  | {
      key: string;
      label: string;
      type: "number";
      min?: number;
      max?: number;
      step?: number;
      defaultValue?: number;
      help?: string;
    }
  | {
      key: string;
      label: string;
      type: "boolean";
      defaultValue?: boolean;
      help?: string;
    };

export type CanvasParamSchema = CanvasParamSchemaItem[];

export type CanvasProviderConfig = {
  id: string;
  alias: string;
  kind: CanvasProviderKind;
  apiKey: string;             // 解密后的明文，仅在 server 进程内使用
  baseUrl: string | null;
};

/** OpenAI 兼容多模态 content part（v2 加入 Gemini 3 Flash 多模态） */
export type CanvasChatContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export type CanvasChatMessage = {
  role: "system" | "user" | "assistant";
  /**
   * 兼容两种形态：
   * - string：简单文本消息（绝大多数 LLM）
   * - CanvasChatContentPart[]：多模态（OpenAI / Gemini 3 Flash 等）
   */
  content: string | CanvasChatContentPart[];
};

export type CanvasGatewayChatRequest = {
  /** 在该 provider 端的模型 id */
  modelKey: string;
  /** 完整 messages（含 system）；如外层只给 prompt，包装层自行拆 */
  messages: CanvasChatMessage[];
  /** 通用参数（按模型 paramsSchema 暴露） */
  params?: Record<string, unknown>;
};

export type CanvasGatewayChatResponse = {
  /** 输出文本（多 choices 取第一条） */
  text: string;
  /** 模型原始返回（用于落库 resultPayload，便于排查） */
  rawPayload?: unknown;
  /** token usage（如有） */
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
};

export type CanvasGatewayImageRequest = {
  modelKey: string;
  prompt: string;
  /** 参考图 OSS / public URL 列表 */
  imageUrls?: string[];
  /** 比例 / 分辨率 / 数量等通用参数（按模型 paramsSchema 暴露） */
  params?: Record<string, unknown>;
  /** 异步回调 URL（KIE 异步任务用，可选） */
  callBackUrl?: string | null;
};

export type CanvasGatewayImageTask =
  | {
      mode: "sync";
      /** 直接同步返回的 OSS / data URL（百炼 wanx / openai-compat 同步出图） */
      resultUrls: string[];
      rawPayload?: unknown;
    }
  | {
      mode: "async";
      /** 后端轮询/回调用的 task id（KIE 标准） */
      taskId: string;
      rawPayload?: unknown;
    };

export type CanvasGatewayPollResult = {
  state: "pending" | "running" | "succeeded" | "failed";
  resultUrls?: string[];
  errorCode?: string;
  errorMessage?: string;
  rawPayload?: unknown;
};

export type CanvasGatewayListedModel = {
  modelKey: string;
  displayName: string;
  role: CanvasModelRole;
  description?: string;
  paramsSchema?: CanvasParamSchema;
  defaultParams?: Record<string, unknown>;
};

export type CanvasGatewayListModelsResult = {
  models: CanvasGatewayListedModel[];
  /** 是否来自硬编码（如 KIE 没有 /models 接口） */
  fromHardcoded?: boolean;
  /** 错误信息（不致命；调用方仍可保存空模型清单） */
  warning?: string;
};

export interface CanvasProviderGateway {
  readonly kind: CanvasProviderKind;
  testConnection(): Promise<{ ok: boolean; message?: string }>;
  listModels(): Promise<CanvasGatewayListModelsResult>;
  /** LLM 文本生成；同步返回 */
  chat(req: CanvasGatewayChatRequest): Promise<CanvasGatewayChatResponse>;
  /** 出图；可能 sync 也可能 async */
  createImageTask(req: CanvasGatewayImageRequest): Promise<CanvasGatewayImageTask>;
  /** 轮询异步图像任务（async 模式才需要） */
  pollImageTask?(taskId: string): Promise<CanvasGatewayPollResult>;
}

export class CanvasGatewayError extends Error {
  constructor(
    public code:
      | "PROVIDER_NOT_CONFIGURED"
      | "PROVIDER_HTTP_ERROR"
      | "PROVIDER_AUTH_ERROR"
      | "PROVIDER_QUOTA_EXCEEDED"
      | "PROVIDER_MODEL_NOT_FOUND"
      | "PROVIDER_INVALID_RESPONSE"
      | "PROVIDER_UNSUPPORTED",
    message: string,
    public httpStatus: number = 502,
    public retryable: boolean = true,
  ) {
    super(message);
    this.name = "CanvasGatewayError";
  }
}

/** Provider kind 默认 baseUrl（OPENAI_COMPAT 必填用户传值） */
export function getDefaultProviderBaseUrl(
  kind: CanvasProviderKind,
): string | null {
  switch (kind) {
    case "KIE":
      return process.env.KIE_API_BASE?.trim() || "https://api.kie.ai";
    case "ALI_BAILIAN":
      return "https://dashscope.aliyuncs.com/compatible-mode/v1";
    case "OPENAI_COMPAT":
      return null;
    case "GEMINI_NATIVE":
      return "https://generativelanguage.googleapis.com/v1beta";
    default:
      return null;
  }
}
