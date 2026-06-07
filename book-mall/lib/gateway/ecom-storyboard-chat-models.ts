/**
 * 电商工具箱 · 故事版创作助手 Gateway 模型清单
 */

import type { GatewayProviderKind } from "@prisma/client";

import { BAILIAN_CHAT_KNOWN_MODELS } from "@/lib/gateway/bailian-chat-models";
import { DEEPSEEK_KNOWN_MODELS } from "@/lib/canvas/providers/deepseek-system";
import { KIE_KNOWN_MODELS } from "@/lib/canvas/providers/kie";
import {
  BAILIAN_R2V_KNOWN_MODELS,
  BAILIAN_R2V_MODEL_IDS,
} from "@/lib/canvas/providers/bailian-r2v";
import { VOLCENGINE_VIDEO_KNOWN_MODELS } from "@/lib/gateway/volcengine-chat-models";
import { isGatewayProviderBound } from "@/lib/gateway/gateway-credential-match";
import { routeGatewayModel } from "@/lib/gateway/model-router";

export type EcomStoryboardGatewayModel = {
  modelKey: string;
  displayName: string;
  description: string;
  role: "LLM" | "IMAGE" | "VIDEO";
  providerKind: GatewayProviderKind;
  credentialBound: boolean;
};

/** 助手 Chat：百炼 Qwen 供仅绑 BAILIAN 的用户；DeepSeek / KIE Gemini 需对应厂商凭证 */
const CHAT_MODEL_KEYS = [
  "qwen3.5-flash",
  "deepseek-v4-flash",
  "gemini-2.5-flash",
] as const;
const IMAGE_MODEL_KEYS = [
  "wan2.7-image",
  "wan2.7-image-pro",
  "wan2.6-image",
  "kling-3.0-image",
  "nano-banana-pro",
] as const;
const VIDEO_MODEL_KEYS = [
  "doubao-seedance-2.0",
  "bytedance/seedance-2",
  "kling-3.0/video",
  ...BAILIAN_R2V_MODEL_IDS,
] as const;

export const ECOM_STORYBOARD_DEFAULT_CHAT_MODEL = "qwen3.5-flash";
export const ECOM_STORYBOARD_DEFAULT_IMAGE_MODEL = "wan2.7-image";
export const ECOM_STORYBOARD_DEFAULT_VIDEO_MODEL = "doubao-seedance-2.0";

const KNOWN_BY_KEY = new Map<string, { displayName: string; description: string }>();

for (const m of BAILIAN_CHAT_KNOWN_MODELS) {
  if (m.role === "LLM") {
    KNOWN_BY_KEY.set(m.modelKey, {
      displayName: m.displayName,
      description: m.description ?? "",
    });
  }
}
for (const m of DEEPSEEK_KNOWN_MODELS) {
  KNOWN_BY_KEY.set(m.modelKey, {
    displayName: m.displayName,
    description: m.description ?? "",
  });
}
for (const m of KIE_KNOWN_MODELS) {
  if (m.role === "LLM" && m.modelKey.toLowerCase().includes("gemini")) {
    KNOWN_BY_KEY.set(m.modelKey, {
      displayName: m.displayName,
      description: m.description ?? "",
    });
  }
  if (m.modelKey === "nano-banana-pro") {
    if (m.role === "IMAGE") {
      KNOWN_BY_KEY.set(m.modelKey, {
        displayName: m.displayName,
        description: "多图参考生分镜（KIE · Google Banana，风格融合）",
      });
    }
  }
  if (m.role === "VIDEO" && m.modelKey === "bytedance/seedance-2") {
    KNOWN_BY_KEY.set(m.modelKey, {
      displayName: m.displayName,
      description: "多图参考整图成片（分镜图+产品+角色+场景，KIE · Seedance 2）",
    });
  }
}
KNOWN_BY_KEY.set("kling-3.0/video", {
  displayName: "可灵 3.0 (KIE)",
  description: "多图参考整图成片（首帧分镜 + element 产品/角色/场景）",
});
for (const m of VOLCENGINE_VIDEO_KNOWN_MODELS) {
  KNOWN_BY_KEY.set(m.modelKey, {
    displayName: m.displayName,
    description: m.description ?? "",
  });
}
for (const m of BAILIAN_R2V_KNOWN_MODELS) {
  KNOWN_BY_KEY.set(m.modelKey, {
    displayName: m.displayName,
    description: `${m.description ?? ""} · 整图成片多图参考`,
  });
}
KNOWN_BY_KEY.set("wan2.7-image", {
  displayName: "通义万相 2.7",
  description: "多图参考生分镜（产品/角色/场景垫图，推荐）",
});
KNOWN_BY_KEY.set("wan2.7-image-pro", {
  displayName: "通义万相 2.7 Pro",
  description: "多图参考 · 更高画质",
});
KNOWN_BY_KEY.set("wan2.6-image", {
  displayName: "通义万相 2.6 · 生图",
  description: "多图参考生分镜（仅生图；视频请选 wan2.6-r2v / wan2.6-r2v-flash）",
});
KNOWN_BY_KEY.set("kling-3.0-image", {
  displayName: "可灵 3.0",
  description: "多图参考生分镜（百炼 · Kling v3 Omni）",
});

function mapModel(
  modelKey: string,
  role: "LLM" | "IMAGE" | "VIDEO",
  boundKinds: GatewayProviderKind[],
): EcomStoryboardGatewayModel {
  const meta = KNOWN_BY_KEY.get(modelKey);
  const routed = routeGatewayModel(modelKey);
  return {
    modelKey,
    displayName: meta?.displayName ?? modelKey,
    description: meta?.description ?? "",
    role,
    providerKind: routed.providerKind,
    credentialBound: isGatewayProviderBound(boundKinds, routed.providerKind),
  };
}

export function listEcomStoryboardChatModels(
  boundKinds: GatewayProviderKind[],
): EcomStoryboardGatewayModel[] {
  return CHAT_MODEL_KEYS.map((k) => mapModel(k, "LLM", boundKinds));
}

/** 优先已绑定厂商的助手模型 */
export function pickEcomStoryboardChatModelKey(
  boundKinds: GatewayProviderKind[],
  preferred = ECOM_STORYBOARD_DEFAULT_CHAT_MODEL,
): string {
  const models = listEcomStoryboardChatModels(boundKinds);
  const hit = models.find((m) => m.modelKey === preferred && m.credentialBound);
  if (hit) return hit.modelKey;
  return models.find((m) => m.credentialBound)?.modelKey ?? preferred;
}

export function listEcomStoryboardImageModels(
  boundKinds: GatewayProviderKind[],
): EcomStoryboardGatewayModel[] {
  return IMAGE_MODEL_KEYS.map((k) => mapModel(k, "IMAGE", boundKinds));
}

export function listEcomStoryboardVideoModels(
  boundKinds: GatewayProviderKind[],
): EcomStoryboardGatewayModel[] {
  return VIDEO_MODEL_KEYS.map((k) => mapModel(k, "VIDEO", boundKinds));
}
