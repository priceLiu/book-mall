import type { GatewayProviderKind } from "@prisma/client";

import type { EcomStoryboardGatewayModel } from "@/lib/gateway/ecom-storyboard-chat-models";
import { isGatewayProviderBound } from "@/lib/gateway/gateway-credential-match";
import { ecomStoryboardImageEditModelLabel } from "@/lib/ecom/ecom-storyboard-image-edit";

/** 文生试衣 · 可选图片编辑模型（Gateway 登记 + 凭证绑定） */
export const VTON_TEXT_TRYON_MODEL_KEYS = [
  "gpt-image-2",
  "wan2.7-image-pro",
  "qwen-image-3.0-pro",
  "qwen-image-edit",
  "qwen-image-edit-max",
] as const;

export type VtonTextTryonModelKey = (typeof VTON_TEXT_TRYON_MODEL_KEYS)[number];

export const VTON_DEFAULT_TEXT_TRYON_MODEL: VtonTextTryonModelKey = "wan2.7-image-pro";

export function isVtonTextTryonModel(modelKey: string): boolean {
  const k = modelKey.trim().toLowerCase();
  return (VTON_TEXT_TRYON_MODEL_KEYS as readonly string[]).includes(k);
}

export function resolveVtonTextTryonModelKey(modelKey?: string): VtonTextTryonModelKey {
  const raw = modelKey?.trim() ?? "";
  if (raw && isVtonTextTryonModel(raw)) return raw as VtonTextTryonModelKey;
  return VTON_DEFAULT_TEXT_TRYON_MODEL;
}

export const VTON_TEXT_TRYON_MODEL_META: EcomStoryboardGatewayModel[] = [
  {
    modelKey: "gpt-image-2",
    displayName: "GPT Image 2",
    description: "OpenAI 图生图 / 多图参考编辑",
    role: "IMAGE",
    providerKind: "KIE",
    credentialBound: true,
  },
  {
    modelKey: "wan2.7-image-pro",
    displayName: "万相 2.7 Pro · 编辑",
    description: "多图参考 · 试衣场景融图",
    role: "IMAGE",
    providerKind: "DASHSCOPE",
    credentialBound: true,
  },
  {
    modelKey: "qwen-image-3.0-pro",
    displayName: "千问 Image 3.0 Pro",
    description: "图生图 / 多图参考编辑",
    role: "IMAGE",
    providerKind: "DASHSCOPE",
    credentialBound: true,
  },
  {
    modelKey: "qwen-image-edit",
    displayName: "千问 · 图像编辑",
    description: "单/多参考图 + 文本 Prompt",
    role: "IMAGE",
    providerKind: "DASHSCOPE",
    credentialBound: true,
  },
  {
    modelKey: "qwen-image-edit-max",
    displayName: "千问 · 图像编辑 Max",
    description: "更高质量的图像编辑",
    role: "IMAGE",
    providerKind: "DASHSCOPE",
    credentialBound: true,
  },
];

export function mergeVtonTextTryonGatewayModels(
  rows: EcomStoryboardGatewayModel[],
  boundKinds: GatewayProviderKind[],
): EcomStoryboardGatewayModel[] {
  const dashscopeBound = isGatewayProviderBound(boundKinds, "DASHSCOPE");
  const kieBound = isGatewayProviderBound(boundKinds, "KIE");
  const allowed = new Set<string>(VTON_TEXT_TRYON_MODEL_KEYS);
  const byKey = new Map<string, EcomStoryboardGatewayModel>();

  for (const meta of VTON_TEXT_TRYON_MODEL_META) {
    const needsDash = meta.providerKind === "DASHSCOPE";
    const needsKie = meta.providerKind === "KIE";
    byKey.set(meta.modelKey, {
      ...meta,
      credentialBound:
        (needsDash ? dashscopeBound : true) && (needsKie ? kieBound : true),
    });
  }

  for (const row of rows) {
    const k = row.modelKey.trim().toLowerCase();
    if (!allowed.has(k)) continue;
    const existing = byKey.get(k);
    byKey.set(k, {
      ...existing,
      ...row,
      modelKey: k,
      displayName:
        row.displayName?.trim() ||
        existing?.displayName ||
        ecomStoryboardImageEditModelLabel(k),
      description: row.description?.trim() || existing?.description || "",
      credentialBound: row.credentialBound ?? existing?.credentialBound ?? false,
    });
  }

  return VTON_TEXT_TRYON_MODEL_KEYS.map((k) => byKey.get(k)).filter(
    (m): m is EcomStoryboardGatewayModel => Boolean(m),
  );
}
