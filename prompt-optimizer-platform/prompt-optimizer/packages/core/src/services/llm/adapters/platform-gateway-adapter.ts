import OpenAI from "openai";
import type { TextModel, TextModelConfig, TextProvider } from "../types";
import { OpenAICompatibleAdapter } from "./openai-compatible-adapter";
import {
  getPlatformGatewayChatPath,
  getPlatformGatewayClientPage,
  PLATFORM_GATEWAY_PROVIDER_ID,
} from "../../../utils/platform-gateway";

const PLATFORM_GATEWAY_MODELS: Array<{
  id: string;
  name: string;
  description: string;
}> = [
  {
    id: "deepseek-chat",
    name: "DeepSeek Chat (Gateway)",
    description: "经 Book Gateway 路由；模型 Key 在 Gateway 配置",
  },
];

/**
 * 平台版 LLM Provider：OpenAI SDK 形态，实际请求同域 `/api/gateway/chat` BFF。
 */
export class PlatformGatewayAdapter extends OpenAICompatibleAdapter {
  public getProvider(): TextProvider {
    return {
      id: PLATFORM_GATEWAY_PROVIDER_ID,
      name: "Book Gateway",
      description: "平台 Gateway BYOK；凭证与模型启用状态在 gateway-web 管理",
      requiresApiKey: false,
      defaultBaseURL: getPlatformGatewayChatPath(),
      supportsDynamicModels: false,
      connectionSchema: {
        required: [],
        optional: [],
        fieldTypes: {},
      },
    };
  }

  public getModels(): TextModel[] {
    return PLATFORM_GATEWAY_MODELS.map((definition) => ({
      ...this.buildDefaultModel(definition.id),
      name: definition.name,
      description: definition.description,
    }));
  }

  protected createOpenAIInstance(
    config: TextModelConfig,
    isStream: boolean = false,
  ): OpenAI {
    const gatewayPath = getPlatformGatewayChatPath();
    const clientPage = getPlatformGatewayClientPage();
    const modelId = config.modelId?.trim() || PLATFORM_GATEWAY_MODELS[0]!.id;
    const defaultTimeout = isStream ? 90000 : 60000;
    const timeout =
      config.paramOverrides?.timeout !== undefined
        ? (config.paramOverrides.timeout as number)
        : defaultTimeout;

    const runtimeFetch =
      typeof globalThis.fetch === "function"
        ? globalThis.fetch.bind(globalThis)
        : undefined;

    const gatewayFetch: typeof fetch = async (_input, init) => {
      if (!runtimeFetch) {
        throw new Error("fetch is not available in this environment");
      }

      let payload: Record<string, unknown> = {};
      if (typeof init?.body === "string" && init.body.trim()) {
        try {
          payload = JSON.parse(init.body) as Record<string, unknown>;
        } catch {
          payload = {};
        }
      }

      payload.clientPage = clientPage;
      if (!payload.model) {
        payload.model = modelId;
      }

      const origin =
        typeof window !== "undefined" ? window.location.origin : "";
      const url = origin ? `${origin}${gatewayPath}` : gatewayPath;

      return runtimeFetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(init?.headers ?? {}),
        },
        body: JSON.stringify(payload),
        credentials: "same-origin",
        signal: init?.signal,
      });
    };

    return new OpenAI({
      apiKey: "platform-gateway",
      baseURL: typeof window !== "undefined" ? window.location.origin : "http://localhost",
      fetch: gatewayFetch,
      timeout,
      maxRetries: isStream ? 2 : 3,
      dangerouslyAllowBrowser: typeof window !== "undefined",
    });
  }
}
