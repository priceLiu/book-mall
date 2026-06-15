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
import { ensurePlatformManagedKeyForUser } from "@/lib/gateway/platform-managed-key";
import { ensureBookUserGatewayIdentitySynced } from "@/lib/gateway/sync-user";
import { getUserBillingPersona } from "@/lib/billing/billing-persona";
import { listPlatformOfferingProvidersForUser } from "@/lib/canvas/platform-offering-providers";
import { VOLCENGINE_ALL_KNOWN_MODELS, VOLCENGINE_VIDEO_KNOWN_MODELS } from "@/lib/gateway/volcengine-chat-models";
import { listHunyuanKnownModels } from "./providers/hunyuan-3d";

export const GATEWAY_KIE_PROVIDER_ID = "gateway:kie";
export const GATEWAY_DEEPSEEK_PROVIDER_ID = "gateway:deepseek";
export const GATEWAY_BAILIAN_PROVIDER_ID = "gateway:bailian";
export const GATEWAY_HUNYUAN_PROVIDER_ID = "gateway:hunyuan";
export const GATEWAY_VOLCENGINE_PROVIDER_ID = "gateway:volcengine";
/** 分镜视频 1.0 画布专用 · 仅 VOLCENGINE VIDEO（走「火山方舟 · 分镜视频1.0」凭证） */
export const GATEWAY_SBV1_VOLCENGINE_PROVIDER_ID = "gateway:sbv1-volcengine";

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

function extraSbv1VolcengineEpModels(): typeof VOLCENGINE_VIDEO_KNOWN_MODELS {
  const raw = process.env.SBV1_VOLCENGINE_EP_MODELS?.trim();
  if (!raw) return [];
  const keys = raw
    .split(/[,;\s]+/)
    .map((k) => k.trim())
    .filter((k) => k.toLowerCase().startsWith("ep-"));
  const known = new Set(
    VOLCENGINE_VIDEO_KNOWN_MODELS.map((m) => m.modelKey.toLowerCase()),
  );
  return keys
    .filter((k) => !known.has(k.toLowerCase()))
    .map((modelKey) => ({
      modelKey,
      displayName: `接入点 ${modelKey}`,
      role: "VIDEO" as const,
      description:
        "火山方舟控制台接入点 · 真人人像须先录入真人人像库并通过审核",
      paramsSchema: VOLCENGINE_VIDEO_KNOWN_MODELS[0]?.paramsSchema,
      defaultParams: {
        resolution: "720p",
        duration: 5,
        generate_audio: false,
        watermark: false,
      },
    }));
}

function modelsForSbv1Volcengine(): CanvasProviderDto["models"] {
  const pool = [...VOLCENGINE_VIDEO_KNOWN_MODELS, ...extraSbv1VolcengineEpModels()];
  return pool.map((m, idx) => ({
    id: `${GATEWAY_SBV1_VOLCENGINE_PROVIDER_ID}::${m.modelKey}`,
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
    out.push({
      id: GATEWAY_SBV1_VOLCENGINE_PROVIDER_ID,
      alias: "分镜视频 1.0 · 火山 Seedance",
      kind: "OPENAI_COMPAT",
      baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
      apiKeyMasked: "gateway",
      active: true,
      lastTestedAt: null,
      lastTestStatus: "gateway",
      models: modelsForSbv1Volcengine(),
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

/** Canvas / Story 模型列表：平台代付 = 上架模型 + Gateway 虚拟 Provider（含 sbv1 火山 VIDEO） */
export async function listCanvasProvidersForUser(userId: string): Promise<CanvasProviderDto[]> {
  try {
    await ensureBookUserGatewayIdentitySynced(userId);
  } catch (e) {
    console.warn("[listCanvasProvidersForUser] gateway identity sync failed", e);
  }

  const persona = await getUserBillingPersona(userId);

  if (persona === "PLATFORM_CREDIT") {
    try {
      await ensurePlatformManagedKeyForUser(userId);
    } catch (e) {
      console.warn("[listCanvasProvidersForUser] platform key ensure failed", e);
    }
    const [offerings, gateway] = await Promise.all([
      listPlatformOfferingProvidersForUser(userId),
      listGatewayVirtualProvidersForUser(userId),
    ]);
    const byId = new Map<string, CanvasProviderDto>();
    for (const p of offerings) byId.set(p.id, p);
    for (const p of gateway) byId.set(p.id, p);
    return [...byId.values()];
  }

  return listGatewayVirtualProvidersForUser(userId);
}

export async function getGatewayVirtualProviderForUser(
  userId: string,
  providerId: string,
): Promise<CanvasProviderDto | null> {
  const list = await listGatewayVirtualProvidersForUser(userId);
  return list.find((p) => p.id === providerId) ?? null;
}
