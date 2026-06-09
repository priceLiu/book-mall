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
};

export const ECOM_STORYBOARD_DEFAULT_CHAT_MODEL = "qwen3.5-flash";
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
