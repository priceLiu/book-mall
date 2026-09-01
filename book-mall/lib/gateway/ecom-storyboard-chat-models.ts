/**
 * 电商分镜 · Gateway 模型 DTO 与默认 modelKey。
 * 模型清单已迁至 `lib/gateway/model-registry.ts` + `/api/sso/tools/gateway/models/registry`。
 */
import type { GatewayProviderKind } from "@prisma/client";

import type { RegistryModelRow } from "@/lib/gateway/model-registry";

export type EcomStoryboardGatewayModel = {
  modelKey: string;
  displayName: string;
  description: string;
  role: "LLM" | "IMAGE" | "VIDEO";
  providerKind?: GatewayProviderKind;
  credentialBound: boolean;
  canonicalModelKey?: string;
  platformOffering?: boolean;
  sourceLabel?: string;
  sortOrder?: number;
};

/** 电商工具箱 · 助手对话默认 LLM（须 Gateway 绑定 DEEPSEEK 凭证） */
export const ECOM_DEFAULT_ASSISTANT_CHAT_MODEL = "deepseek-v4-pro";

export const ECOM_STORYBOARD_DEFAULT_CHAT_MODEL = ECOM_DEFAULT_ASSISTANT_CHAT_MODEL;

/** DeepSeek 助手默认生成参数（长 JSON / A–E 分镜须足够 max_tokens） */
export const ECOM_DEEPSEEK_CHAT_DEFAULT_PARAMS = {
  max_tokens: 24_000,
  temperature: 0.7,
} as const;

/** 按 modelKey 解析电商助手 Chat 上游参数（DeepSeek 走长文超时 + 足够输出 token） */
export function resolveEcomAssistantChatParams(
  modelKey: string,
): Record<string, unknown> {
  const m = modelKey.trim().toLowerCase();
  if (
    m === "deepseek-v4-pro" ||
    m === "deepseek-v4-flash" ||
    m.startsWith("deepseek")
  ) {
    return { ...ECOM_DEEPSEEK_CHAT_DEFAULT_PARAMS };
  }
  return {};
}

export const ECOM_DEFAULT_VISION_MODEL = "qwen3.8-max";
/** 电商 · AI 识产品（百炼 VL Flash · 低成本图片理解） */
export const ECOM_RECOGNIZE_PRODUCT_MODEL = "qwen3-vl-flash";
export const ECOM_STORYBOARD_DEFAULT_IMAGE_MODEL = "wan2.7-image";
export const ECOM_STORYBOARD_DEFAULT_VIDEO_MODEL = "doubao-seedance-2.0";

export function registryRowsToEcomModels(rows: RegistryModelRow[]): EcomStoryboardGatewayModel[] {
  return rows.map((r) => ({
    modelKey: r.modelKey,
    displayName: r.displayName,
    description: r.description,
    role: r.role as "LLM" | "IMAGE" | "VIDEO",
    providerKind: r.providerKind,
    credentialBound: r.credentialBound,
    canonicalModelKey: r.canonicalModelKey,
    platformOffering: r.platformOffering,
    sourceLabel: r.sourceLabel,
    sortOrder: r.sortOrder,
  }));
}

/** @deprecated 使用 listModelsForApp(BYOK) */
export function listEcomStoryboardChatModels(
  _boundKinds: GatewayProviderKind[],
): EcomStoryboardGatewayModel[] {
  return [];
}

/** @deprecated */
export function listEcomStoryboardImageModels(
  _boundKinds: GatewayProviderKind[],
): EcomStoryboardGatewayModel[] {
  return [];
}

/** @deprecated */
export function listEcomStoryboardVideoModels(
  _boundKinds: GatewayProviderKind[],
): EcomStoryboardGatewayModel[] {
  return [];
}

export function pickEcomStoryboardChatModelKey(
  _boundKinds: GatewayProviderKind[],
  preferred = ECOM_STORYBOARD_DEFAULT_CHAT_MODEL,
): string {
  return preferred;
}
