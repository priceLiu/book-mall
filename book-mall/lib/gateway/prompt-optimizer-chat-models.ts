/**
 * 提示词优化器 · Gateway Chat 模型清单（与 platform-gateway-adapter 保持一致）。
 */

import type { GatewayProviderKind } from "@prisma/client";

import { DEEPSEEK_KNOWN_MODELS } from "@/lib/canvas/providers/deepseek-system";
import { KIE_KNOWN_MODELS } from "@/lib/canvas/providers/kie";
import { BAILIAN_CHAT_KNOWN_MODELS } from "@/lib/gateway/bailian-chat-models";
import {
  VOLCENGINE_ALL_KNOWN_MODELS,
} from "@/lib/gateway/volcengine-chat-models";
import { isGatewayProviderBound } from "@/lib/gateway/gateway-credential-match";
import { listModelsForApp } from "@/lib/gateway/model-registry";
import { routeGatewayModel } from "@/lib/gateway/model-router";

export type PromptOptimizerGatewayModel = {
  modelKey: string;
  displayName: string;
  description: string;
  providerKind: GatewayProviderKind;
  /** 用户是否已在 Gateway 绑定对应厂商凭证 */
  credentialBound: boolean;
};

/** 提示词优化器优先暴露的 Chat 模型（顺序即 UI 默认排序） */
const PROMPT_OPTIMIZER_MODEL_KEYS: string[] = [
  "deepseek-v4-flash",
  "deepseek-v4-pro",
  "deepseek-chat",
  "qwen3.5-27b",
  "qwen3.5-plus",
  "qwen3.5-flash",
  "MiniMax/MiniMax-M2.7",
  "MiniMax/MiniMax-M2.5",
  "gemini-2.5-flash",
  "gemini-3-flash",
  "doubao-seed-2.0-lite",
  "doubao-seed-2.0-mini",
  "doubao-lite-32k",
  "doubao-seedance-1.5-pro",
  "doubao-seedance-2.0",
];

const KNOWN_BY_KEY = new Map<string, { displayName: string; description: string }>();

for (const m of DEEPSEEK_KNOWN_MODELS) {
  KNOWN_BY_KEY.set(m.modelKey, {
    displayName: m.displayName,
    description: m.description ?? "",
  });
}
for (const m of BAILIAN_CHAT_KNOWN_MODELS) {
  KNOWN_BY_KEY.set(m.modelKey, {
    displayName: m.displayName,
    description: m.description ?? "",
  });
}
for (const m of KIE_KNOWN_MODELS) {
  if (m.role !== "LLM" || !m.modelKey.toLowerCase().includes("gemini")) continue;
  KNOWN_BY_KEY.set(m.modelKey, {
    displayName: m.displayName,
    description: m.description ?? "",
  });
}
for (const m of VOLCENGINE_ALL_KNOWN_MODELS) {
  KNOWN_BY_KEY.set(m.modelKey, {
    displayName: m.displayName,
    description: m.description ?? "",
  });
}

export const PROMPT_OPTIMIZER_DEFAULT_MODEL_KEY = "deepseek-v4-flash";

export function listPromptOptimizerGatewayModels(
  boundKinds: GatewayProviderKind[],
): PromptOptimizerGatewayModel[] {
  return PROMPT_OPTIMIZER_MODEL_KEYS.map((modelKey) => {
    const meta = KNOWN_BY_KEY.get(modelKey);
    const routed = routeGatewayModel(modelKey);
    return {
      modelKey,
      displayName: meta?.displayName ?? modelKey,
      description: meta?.description ?? "",
      providerKind: routed.providerKind,
      credentialBound: isGatewayProviderBound(boundKinds, routed.providerKind),
    };
  });
}

/** 从 Gateway 统一注册表读取（优先）。 */
export async function listPromptOptimizerGatewayModelsFromRegistry(input: {
  boundKinds: GatewayProviderKind[];
  persona: "PLATFORM_CREDIT" | "BYOK";
}): Promise<PromptOptimizerGatewayModel[]> {
  const rows = await listModelsForApp({
    appTag: "prompt-optimizer",
    role: "LLM",
    persona: input.persona,
    boundKinds: input.boundKinds,
  });
  if (rows.length === 0) {
    return listPromptOptimizerGatewayModels(input.boundKinds);
  }
  return rows.map((r) => ({
    modelKey: r.modelKey,
    displayName: r.displayName,
    description: r.description,
    providerKind: r.providerKind,
    credentialBound: r.credentialBound,
  }));
}

/** 供 prompt-optimizer vendor 静态同步（勿与 book-mall 漂移） */
export function promptOptimizerGatewayModelDefinitions(): Array<{
  id: string;
  name: string;
  description: string;
}> {
  return listPromptOptimizerGatewayModels(["DEEPSEEK", "BAILIAN", "KIE"]).map((m) => ({
    id: m.modelKey,
    name: m.displayName,
    description: `${m.description} · ${
      m.providerKind === "DEEPSEEK"
        ? "DeepSeek"
        : m.providerKind === "KIE"
          ? "KIE"
          : m.providerKind === "VOLCENGINE"
            ? "火山方舟"
            : "百炼"
    }`,
  }));
}
