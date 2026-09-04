import type { GatewayProviderKind } from "@prisma/client";

import type { EcomStoryboardGatewayModel } from "@/lib/gateway/ecom-storyboard-chat-models";
import { isGatewayProviderBound } from "@/lib/gateway/gateway-credential-match";
import {
  isQwenImage30ProModel,
  isQwenImageEditModel,
} from "@/lib/gateway/qwen-image-edit-proxy";
import { ecomStoryboardImageEditModelLabel } from "@/lib/ecom/ecom-storyboard-image-edit";

export const OUTFIT_FUSION_MODEL_KEYS = [
  "qwen-image-edit",
  "qwen-image-edit-max",
  "qwen-image-3.0-pro",
  "wan2.7-image-pro",
] as const;

export type OutfitFusionModelKey = (typeof OUTFIT_FUSION_MODEL_KEYS)[number];

export const OUTFIT_DEFAULT_FUSION_MODEL: OutfitFusionModelKey = "qwen-image-edit";

export function isOutfitFusionModel(modelKey: string): boolean {
  const k = modelKey.trim().toLowerCase();
  return (
    isQwenImageEditModel(k) ||
    isQwenImage30ProModel(k) ||
    k === "wan2.7-image-pro"
  );
}

export function resolveOutfitFusionModelKey(modelKey?: string): OutfitFusionModelKey {
  const raw = modelKey?.trim() ?? "";
  if (raw && isOutfitFusionModel(raw)) {
    return raw as OutfitFusionModelKey;
  }
  return OUTFIT_DEFAULT_FUSION_MODEL;
}

export const OUTFIT_FUSION_MODEL_META: EcomStoryboardGatewayModel[] = [
  {
    modelKey: "qwen-image-edit",
    displayName: "千问 · 图像编辑",
    description: "人物+场景融图默认；单/双参考图 + 文本 prompt",
    role: "IMAGE",
    providerKind: "DASHSCOPE",
    credentialBound: true,
  },
  {
    modelKey: "qwen-image-edit-max",
    displayName: "千问 · 图像编辑 Max",
    description: "更高质量的人物场景融合",
    role: "IMAGE",
    providerKind: "DASHSCOPE",
    credentialBound: true,
  },
  {
    modelKey: "qwen-image-3.0-pro",
    displayName: "千问 Image 3.0 Pro",
    description: "多图参考融图备选",
    role: "IMAGE",
    providerKind: "DASHSCOPE",
    credentialBound: true,
  },
  {
    modelKey: "wan2.7-image-pro",
    displayName: "万相 2.7 Pro · 编辑",
    description: "万相多图参考融图备选",
    role: "IMAGE",
    providerKind: "DASHSCOPE",
    credentialBound: true,
  },
];

export function mergeOutfitFusionGatewayModels(
  rows: EcomStoryboardGatewayModel[],
  boundKinds: GatewayProviderKind[],
): EcomStoryboardGatewayModel[] {
  const dashscopeBound = isGatewayProviderBound(boundKinds, "DASHSCOPE");
  const allowed = new Set<string>(OUTFIT_FUSION_MODEL_KEYS);
  const byKey = new Map<string, EcomStoryboardGatewayModel>();

  for (const row of rows.filter((r) => allowed.has(r.modelKey))) {
    byKey.set(row.modelKey, { ...row });
  }

  for (const meta of OUTFIT_FUSION_MODEL_META) {
    const existing = byKey.get(meta.modelKey);
    if (existing) {
      byKey.set(meta.modelKey, {
        ...existing,
        displayName: meta.displayName,
        description: meta.description,
        credentialBound:
          existing.credentialBound || existing.platformOffering || dashscopeBound,
      });
    } else {
      byKey.set(meta.modelKey, {
        ...meta,
        credentialBound: dashscopeBound,
      });
    }
  }

  return OUTFIT_FUSION_MODEL_KEYS.map(
    (k) => byKey.get(k)!,
  ).filter(Boolean);
}

export function outfitFusionModelLabel(modelKey: string): string {
  return ecomStoryboardImageEditModelLabel(modelKey);
}
