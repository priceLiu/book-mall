/**
 * AI 小智 · 模型配置（DB 真源，Book 管理后台可编辑）。
 */
import type { PlatformAssistantModelConfig } from "@prisma/client";

import { BAILIAN_CHAT_KNOWN_MODELS } from "@/lib/gateway/bailian-chat-models";
import { DEEPSEEK_KNOWN_MODELS } from "@/lib/canvas/providers/deepseek-system";
import { prisma } from "@/lib/prisma";

export const PLATFORM_ASSISTANT_MODEL_CONFIG_ID = "default";

export const DEFAULT_PLATFORM_ASSISTANT_MODEL_CONFIG = {
  chatEnabled: true,
  chatModelKey: "qwen3.5-27b",
  chatFallbackModelKeys: ["qwen3.5-flash"],
  newsEnabled: true,
  newsModelKey: "qwen3.5-27b",
  newsFallbackModelKeys: ["qwen3.5-flash"],
  embedEnabled: true,
  embedModelKey: "text-embedding-v3",
  embedDim: 1024,
} as const;

export type PlatformAssistantModelConfigView = {
  chatEnabled: boolean;
  chatModelKey: string;
  chatFallbackModelKeys: string[];
  newsEnabled: boolean;
  newsModelKey: string;
  newsFallbackModelKeys: string[];
  embedEnabled: boolean;
  embedModelKey: string;
  embedDim: number;
  updatedAt: string | null;
  updatedByUserId: string | null;
};

export type AssistantModelCandidate = {
  modelKey: string;
  displayName: string;
  description: string;
  vendor: string;
};

export type AssistantEmbedCandidate = AssistantModelCandidate & {
  supportedDims: number[];
};

const CONFIG_CACHE_MS = 30_000;
let cachedConfig: PlatformAssistantModelConfig | null = null;
let cachedAt = 0;

export function resolveModelChain(primary: string, fallbacks: string[]): string[] {
  const first = primary.trim();
  const models = first ? [first] : [];
  for (const model of fallbacks) {
    const key = model.trim();
    if (key && key !== first && !models.includes(key)) {
      models.push(key);
    }
  }
  return models;
}

function toView(row: PlatformAssistantModelConfig): PlatformAssistantModelConfigView {
  return {
    chatEnabled: row.chatEnabled,
    chatModelKey: row.chatModelKey,
    chatFallbackModelKeys: [...row.chatFallbackModelKeys],
    newsEnabled: row.newsEnabled,
    newsModelKey: row.newsModelKey,
    newsFallbackModelKeys: [...row.newsFallbackModelKeys],
    embedEnabled: row.embedEnabled,
    embedModelKey: row.embedModelKey,
    embedDim: row.embedDim,
    updatedAt: row.updatedAt.toISOString(),
    updatedByUserId: row.updatedByUserId,
  };
}

export function listAssistantLlmCandidates(): AssistantModelCandidate[] {
  const seen = new Set<string>();
  const out: AssistantModelCandidate[] = [];

  for (const model of BAILIAN_CHAT_KNOWN_MODELS) {
    if (model.role !== "LLM" || seen.has(model.modelKey)) continue;
    seen.add(model.modelKey);
    out.push({
      modelKey: model.modelKey,
      displayName: model.displayName,
      description: model.description ?? "",
      vendor: "阿里云百炼",
    });
  }

  for (const model of DEEPSEEK_KNOWN_MODELS) {
    if (model.role !== "LLM" || seen.has(model.modelKey)) continue;
    seen.add(model.modelKey);
    out.push({
      modelKey: model.modelKey,
      displayName: model.displayName,
      description: model.description ?? "",
      vendor: "DeepSeek",
    });
  }

  return out;
}

export function listAssistantEmbedCandidates(): AssistantEmbedCandidate[] {
  return [
    {
      modelKey: "text-embedding-v3",
      displayName: "text-embedding-v3",
      description: "百炼 · 通用文本向量（推荐）",
      vendor: "阿里云百炼",
      supportedDims: [512, 768, 1024, 1536],
    },
    {
      modelKey: "text-embedding-v2",
      displayName: "text-embedding-v2",
      description: "百炼 · 上一代文本向量",
      vendor: "阿里云百炼",
      supportedDims: [1536],
    },
  ];
}

function assertKnownLlm(modelKey: string) {
  const known = listAssistantLlmCandidates();
  if (!known.some((m) => m.modelKey === modelKey)) {
    throw new Error(`未知对话/热闻模型：${modelKey}`);
  }
}

function assertKnownEmbed(modelKey: string, embedDim: number) {
  const known = listAssistantEmbedCandidates().find((m) => m.modelKey === modelKey);
  if (!known) {
    throw new Error(`未知向量模型：${modelKey}`);
  }
  if (!known.supportedDims.includes(embedDim)) {
    throw new Error(`${modelKey} 不支持维度 ${embedDim}，可选：${known.supportedDims.join("、")}`);
  }
}

function sanitizeFallbacks(primary: string, fallbacks: string[]): string[] {
  const out: string[] = [];
  for (const model of fallbacks) {
    const key = model.trim();
    if (!key || key === primary || out.includes(key)) continue;
    assertKnownLlm(key);
    out.push(key);
  }
  return out;
}

export async function ensurePlatformAssistantModelConfigRow(): Promise<PlatformAssistantModelConfig> {
  return prisma.platformAssistantModelConfig.upsert({
    where: { id: PLATFORM_ASSISTANT_MODEL_CONFIG_ID },
    create: {
      id: PLATFORM_ASSISTANT_MODEL_CONFIG_ID,
      ...DEFAULT_PLATFORM_ASSISTANT_MODEL_CONFIG,
      chatFallbackModelKeys: [...DEFAULT_PLATFORM_ASSISTANT_MODEL_CONFIG.chatFallbackModelKeys],
      newsFallbackModelKeys: [...DEFAULT_PLATFORM_ASSISTANT_MODEL_CONFIG.newsFallbackModelKeys],
    },
    update: {},
  });
}

export async function getPlatformAssistantModelConfig(): Promise<PlatformAssistantModelConfig> {
  const now = Date.now();
  if (cachedConfig && now - cachedAt < CONFIG_CACHE_MS) {
    return cachedConfig;
  }
  const row = await ensurePlatformAssistantModelConfigRow();
  cachedConfig = row;
  cachedAt = now;
  return row;
}

export function invalidatePlatformAssistantModelConfigCache() {
  cachedConfig = null;
  cachedAt = 0;
}

export async function getPlatformAssistantModelConfigView(): Promise<PlatformAssistantModelConfigView> {
  const row = await getPlatformAssistantModelConfig();
  return toView(row);
}

export async function getAssistantChatRuntimeConfig() {
  const row = await getPlatformAssistantModelConfig();
  return {
    enabled: row.chatEnabled,
    modelKey: row.chatModelKey,
    fallbackModelKeys: row.chatFallbackModelKeys,
    modelChain: resolveModelChain(row.chatModelKey, row.chatFallbackModelKeys),
  };
}

export async function getAssistantNewsRuntimeConfig() {
  const row = await getPlatformAssistantModelConfig();
  return {
    enabled: row.newsEnabled,
    modelKey: row.newsModelKey,
    fallbackModelKeys: row.newsFallbackModelKeys,
    modelChain: resolveModelChain(row.newsModelKey, row.newsFallbackModelKeys),
  };
}

export async function getAssistantEmbedRuntimeConfig() {
  const row = await getPlatformAssistantModelConfig();
  return {
    enabled: row.embedEnabled,
    modelKey: row.embedModelKey,
    embedDim: row.embedDim,
  };
}

export type UpdatePlatformAssistantModelConfigInput = {
  chatEnabled: boolean;
  chatModelKey: string;
  chatFallbackModelKeys: string[];
  newsEnabled: boolean;
  newsModelKey: string;
  newsFallbackModelKeys: string[];
  embedEnabled: boolean;
  embedModelKey: string;
  embedDim: number;
};

export async function updatePlatformAssistantModelConfig(
  input: UpdatePlatformAssistantModelConfigInput,
  updatedByUserId: string,
): Promise<PlatformAssistantModelConfigView> {
  assertKnownLlm(input.chatModelKey);
  assertKnownLlm(input.newsModelKey);
  assertKnownEmbed(input.embedModelKey, input.embedDim);

  const chatFallbackModelKeys = sanitizeFallbacks(
    input.chatModelKey,
    input.chatFallbackModelKeys,
  );
  const newsFallbackModelKeys = sanitizeFallbacks(
    input.newsModelKey,
    input.newsFallbackModelKeys,
  );

  const row = await prisma.platformAssistantModelConfig.upsert({
    where: { id: PLATFORM_ASSISTANT_MODEL_CONFIG_ID },
    create: {
      id: PLATFORM_ASSISTANT_MODEL_CONFIG_ID,
      chatEnabled: input.chatEnabled,
      chatModelKey: input.chatModelKey,
      chatFallbackModelKeys,
      newsEnabled: input.newsEnabled,
      newsModelKey: input.newsModelKey,
      newsFallbackModelKeys,
      embedEnabled: input.embedEnabled,
      embedModelKey: input.embedModelKey,
      embedDim: input.embedDim,
      updatedByUserId,
    },
    update: {
      chatEnabled: input.chatEnabled,
      chatModelKey: input.chatModelKey,
      chatFallbackModelKeys,
      newsEnabled: input.newsEnabled,
      newsModelKey: input.newsModelKey,
      newsFallbackModelKeys,
      embedEnabled: input.embedEnabled,
      embedModelKey: input.embedModelKey,
      embedDim: input.embedDim,
      updatedByUserId,
    },
  });

  invalidatePlatformAssistantModelConfigCache();
  return toView(row);
}

export function resetPlatformAssistantModelConfigCacheForTests() {
  invalidatePlatformAssistantModelConfigCache();
}
