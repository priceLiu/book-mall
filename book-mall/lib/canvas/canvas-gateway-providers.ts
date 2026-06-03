/**
 * Canvas 虚拟 Gateway Provider 列表（按用户 Gateway 凭证种类过滤）
 */

import type { GatewayProviderKind } from "@prisma/client";

import type { CanvasProviderDto } from "./canvas-provider-service";
import { KIE_KNOWN_MODELS } from "./providers/kie";
import { DEEPSEEK_KNOWN_MODELS, DEEPSEEK_SYSTEM_BASE_URL } from "./providers/deepseek-system";
import { BAILIAN_R2V_KNOWN_MODELS } from "./providers/bailian-r2v";
import { STORY_TTS_GATEWAY_MODELS } from "./providers/story-tts";
import { getGatewayLinkStatusForUser } from "@/lib/gateway/book-gateway-link";
import { VOLCENGINE_ALL_KNOWN_MODELS } from "@/lib/gateway/volcengine-chat-models";
import { listHunyuanKnownModels } from "./providers/hunyuan-3d";

export const GATEWAY_KIE_PROVIDER_ID = "gateway:kie";
export const GATEWAY_DEEPSEEK_PROVIDER_ID = "gateway:deepseek";
export const GATEWAY_BAILIAN_PROVIDER_ID = "gateway:bailian";
export const GATEWAY_HUNYUAN_PROVIDER_ID = "gateway:hunyuan";
export const GATEWAY_VOLCENGINE_PROVIDER_ID = "gateway:volcengine";

export function isGatewayVirtualProviderId(id: string | null | undefined): boolean {
  return !!id && id.startsWith("gateway:");
}

function modelsForKind(kind: GatewayProviderKind): CanvasProviderDto["models"] {
  if (kind === "KIE") {
    return KIE_KNOWN_MODELS.map((m, idx) => ({
      id: `${GATEWAY_KIE_PROVIDER_ID}::${m.modelKey}`,
      modelKey: m.modelKey,
      displayName: m.displayName,
      role: m.role,
      description: m.description ?? null,
      paramsSchema: m.paramsSchema ?? null,
      defaultParams: (m.defaultParams as Record<string, unknown> | null) ?? null,
      enabled: true,
      sortOrder: idx,
    }));
  }
  if (kind === "DEEPSEEK") {
    return DEEPSEEK_KNOWN_MODELS.map((m, idx) => ({
      id: `${GATEWAY_DEEPSEEK_PROVIDER_ID}::${m.modelKey}`,
      modelKey: m.modelKey,
      displayName: m.displayName,
      role: m.role,
      description: m.description ?? null,
      paramsSchema: m.paramsSchema ?? null,
      defaultParams: (m.defaultParams as Record<string, unknown> | null) ?? null,
      enabled: true,
      sortOrder: idx,
    }));
  }
  if (kind === "BAILIAN") {
    const r2v = BAILIAN_R2V_KNOWN_MODELS.map((m, idx) => ({
      id: `${GATEWAY_BAILIAN_PROVIDER_ID}::${m.modelKey}`,
      modelKey: m.modelKey,
      displayName: m.displayName,
      role: m.role,
      description: m.description ?? null,
      paramsSchema: m.paramsSchema ?? null,
      defaultParams: (m.defaultParams as Record<string, unknown> | null) ?? null,
      enabled: true,
      sortOrder: idx,
    }));
    const tts = STORY_TTS_GATEWAY_MODELS.map((m, idx) => ({
      id: `${GATEWAY_BAILIAN_PROVIDER_ID}::${m.modelKey}`,
      modelKey: m.modelKey,
      displayName: m.displayName,
      role: m.role,
      description: m.description ?? null,
      paramsSchema: m.paramsSchema ?? null,
      defaultParams: (m.defaultParams as Record<string, unknown> | null) ?? null,
      enabled: true,
      sortOrder: r2v.length + idx,
    }));
    return [...r2v, ...tts];
  }
  if (kind === "VOLCENGINE") {
    return VOLCENGINE_ALL_KNOWN_MODELS.map((m, idx) => ({
      id: `${GATEWAY_VOLCENGINE_PROVIDER_ID}::${m.modelKey}`,
      modelKey: m.modelKey,
      displayName: m.displayName,
      role: m.role,
      description: m.description ?? null,
      paramsSchema: m.paramsSchema ?? null,
      defaultParams: (m.defaultParams as Record<string, unknown> | null) ?? null,
      enabled: true,
      sortOrder: idx,
    }));
  }
  return [];
}

export async function listGatewayVirtualProvidersForUser(
  userId: string,
): Promise<CanvasProviderDto[]> {
  const link = await getGatewayLinkStatusForUser(userId);
  if (!link.linked) return [];

  const out: CanvasProviderDto[] = [];
  const now = new Date().toISOString();

  if (link.boundKinds.includes("KIE")) {
    out.push({
      id: GATEWAY_KIE_PROVIDER_ID,
      alias: "Gateway · KIE",
      kind: "KIE",
      baseUrl: null,
      apiKeyMasked: "gateway",
      active: true,
      lastTestedAt: null,
      lastTestStatus: "gateway",
      models: modelsForKind("KIE"),
      createdAt: now,
      updatedAt: now,
    });
  }
  if (link.boundKinds.includes("BAILIAN")) {
    out.push({
      id: GATEWAY_BAILIAN_PROVIDER_ID,
      alias: "Gateway · 百炼",
      kind: "ALI_BAILIAN",
      baseUrl: "https://dashscope.aliyuncs.com",
      apiKeyMasked: "gateway",
      active: true,
      lastTestedAt: null,
      lastTestStatus: "gateway",
      models: modelsForKind("BAILIAN"),
      createdAt: now,
      updatedAt: now,
    });
  }
  if (link.boundKinds.includes("DEEPSEEK")) {
    out.push({
      id: GATEWAY_DEEPSEEK_PROVIDER_ID,
      alias: "Gateway · DeepSeek",
      kind: "OPENAI_COMPAT",
      baseUrl: DEEPSEEK_SYSTEM_BASE_URL,
      apiKeyMasked: "gateway",
      active: true,
      lastTestedAt: null,
      lastTestStatus: "gateway",
      models: modelsForKind("DEEPSEEK"),
      createdAt: now,
      updatedAt: now,
    });
  }

  if (link.boundKinds.includes("VOLCENGINE")) {
    out.push({
      id: GATEWAY_VOLCENGINE_PROVIDER_ID,
      alias: "Gateway · 火山方舟",
      kind: "OPENAI_COMPAT",
      baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
      apiKeyMasked: "gateway",
      active: true,
      lastTestedAt: null,
      lastTestStatus: "gateway",
      models: modelsForKind("VOLCENGINE"),
      createdAt: now,
      updatedAt: now,
    });
  }

  if (link.boundKinds.includes("HUNYUAN")) {
    out.push({
      id: GATEWAY_HUNYUAN_PROVIDER_ID,
      alias: "Gateway · 混元 3D",
      kind: "HUNYUAN_3D",
      baseUrl: "https://api.ai3d.cloud.tencent.com",
      apiKeyMasked: "gateway",
      active: true,
      lastTestedAt: null,
      lastTestStatus: "gateway",
      models: listHunyuanKnownModels().map((m, idx) => ({
        id: `${GATEWAY_HUNYUAN_PROVIDER_ID}::${m.modelKey}`,
        modelKey: m.modelKey,
        displayName: m.displayName,
        role: m.role,
        description: m.description ?? null,
        paramsSchema: m.paramsSchema ?? null,
        defaultParams: (m.defaultParams as Record<string, unknown> | null) ?? null,
        enabled: true,
        sortOrder: idx,
      })),
      createdAt: now,
      updatedAt: now,
    });
  }

  return out;
}

export async function getGatewayVirtualProviderForUser(
  userId: string,
  providerId: string,
): Promise<CanvasProviderDto | null> {
  const list = await listGatewayVirtualProvidersForUser(userId);
  return list.find((p) => p.id === providerId) ?? null;
}
