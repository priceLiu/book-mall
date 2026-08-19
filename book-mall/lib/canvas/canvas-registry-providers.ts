/**
 * Canvas Provider 列表 · 由 Gateway 统一注册表驱动（模型运营中心）
 */
import type { CanvasModelRole, GatewayProviderKind } from "@prisma/client";

import type { CanvasProviderDto } from "./canvas-provider-service";
import { KIE_KNOWN_MODELS } from "./providers/kie";
import { DEEPSEEK_KNOWN_MODELS } from "./providers/deepseek-system";
import { MOONSHOT_KNOWN_MODELS } from "./providers/moonshot-system";
import { BAILIAN_CHAT_KNOWN_MODELS } from "@/lib/gateway/bailian-chat-models";
import { BAILIAN_IMAGE_KNOWN_MODELS } from "./providers/bailian-image";
import { BAILIAN_R2V_KNOWN_MODELS } from "./providers/bailian-r2v";
import { BAILIAN_DASHSCOPE_T2V_KNOWN_MODELS } from "./providers/bailian-dashscope-t2v";
import { STORY_TTS_GATEWAY_MODELS } from "./providers/story-tts";
import { VOLCENGINE_ALL_KNOWN_MODELS, VOLCENGINE_VIDEO_KNOWN_MODELS } from "@/lib/gateway/volcengine-chat-models";
import { listHunyuanKnownModels } from "./providers/hunyuan-3d";
import { TOPAZ_KNOWN_MODELS } from "./providers/topaz";
import { MINIMAX_VIDEO_KNOWN_MODELS_CANVAS } from "./providers/minimax-video";
import { getUserBillingPersona } from "@/lib/billing/billing-persona";
import { getGatewayLinkStatusForUser } from "@/lib/gateway/book-gateway-link";
import { listModelsForApp, type RegistryModelRow } from "@/lib/gateway/model-registry";
import {
  GATEWAY_BAILIAN_PROVIDER_ID,
  GATEWAY_DEEPSEEK_PROVIDER_ID,
  GATEWAY_HUNYUAN_PROVIDER_ID,
  GATEWAY_KIE_PROVIDER_ID,
  GATEWAY_MINIMAX_VIDEO_PROVIDER_ID,
  GATEWAY_MOONSHOT_PROVIDER_ID,
  GATEWAY_SBV1_VOLCENGINE_PROVIDER_ID,
  GATEWAY_TOPAZ_PROVIDER_ID,
  GATEWAY_VOLCENGINE_PROVIDER_ID,
} from "./canvas-gateway-providers";
import { PLATFORM_OFFERING_PROVIDER_ID } from "./platform-offering-providers";

type KnownMeta = {
  modelKey: string;
  displayName: string;
  role: CanvasModelRole;
  description?: string | null;
  paramsSchema?: CanvasProviderDto["models"][0]["paramsSchema"];
  defaultParams?: Record<string, unknown> | null;
};

const KNOWN: KnownMeta[] = [
  ...KIE_KNOWN_MODELS,
  ...DEEPSEEK_KNOWN_MODELS,
  ...MOONSHOT_KNOWN_MODELS,
  ...BAILIAN_CHAT_KNOWN_MODELS,
  ...BAILIAN_IMAGE_KNOWN_MODELS,
  ...BAILIAN_R2V_KNOWN_MODELS,
  ...BAILIAN_DASHSCOPE_T2V_KNOWN_MODELS,
  ...STORY_TTS_GATEWAY_MODELS,
  ...VOLCENGINE_ALL_KNOWN_MODELS,
  ...VOLCENGINE_VIDEO_KNOWN_MODELS,
  ...listHunyuanKnownModels(),
  ...TOPAZ_KNOWN_MODELS,
  ...MINIMAX_VIDEO_KNOWN_MODELS_CANVAS.map((m) => ({
    modelKey: m.modelKey,
    displayName: m.displayName,
    role: m.role,
    description: m.description ?? null,
    paramsSchema: m.paramsSchema ?? null,
    defaultParams: m.defaultParams ?? null,
  })),
];

const KNOWN_BY_KEY = new Map(KNOWN.map((m) => [m.modelKey, m]));

const PROVIDER_KIND_TO_ID: Partial<Record<GatewayProviderKind, string>> = {
  KIE: GATEWAY_KIE_PROVIDER_ID,
  DEEPSEEK: GATEWAY_DEEPSEEK_PROVIDER_ID,
  MOONSHOT: GATEWAY_MOONSHOT_PROVIDER_ID,
  BAILIAN: GATEWAY_BAILIAN_PROVIDER_ID,
  VOLCENGINE: GATEWAY_VOLCENGINE_PROVIDER_ID,
  HUNYUAN: GATEWAY_HUNYUAN_PROVIDER_ID,
  TOPAZ: GATEWAY_TOPAZ_PROVIDER_ID,
  MINIMAX: GATEWAY_MINIMAX_VIDEO_PROVIDER_ID,
};

const PROVIDER_ALIAS: Partial<Record<string, string>> = {
  [GATEWAY_KIE_PROVIDER_ID]: "Gateway · 第三方",
  [GATEWAY_DEEPSEEK_PROVIDER_ID]: "Gateway · DeepSeek",
  [GATEWAY_MOONSHOT_PROVIDER_ID]: "Gateway · Moonshot",
  [GATEWAY_BAILIAN_PROVIDER_ID]: "Gateway · 百炼",
  [GATEWAY_VOLCENGINE_PROVIDER_ID]: "Gateway · 火山方舟",
  [GATEWAY_SBV1_VOLCENGINE_PROVIDER_ID]: "Gateway · 火山方舟 · 分镜视频1.0",
  [GATEWAY_HUNYUAN_PROVIDER_ID]: "Gateway · 混元 3D",
  [GATEWAY_TOPAZ_PROVIDER_ID]: "Gateway · Topaz",
  [GATEWAY_MINIMAX_VIDEO_PROVIDER_ID]: "Gateway · MiniMax H3 视频",
  [PLATFORM_OFFERING_PROVIDER_ID]: "平台模型",
};

function metaForRow(row: RegistryModelRow): KnownMeta {
  const hit = KNOWN_BY_KEY.get(row.modelKey);
  if (hit) return hit;
  return {
    modelKey: row.modelKey,
    displayName: row.displayName,
    role: row.role,
    description: row.description || null,
    paramsSchema: null,
    defaultParams: null,
  };
}

function rowToModelDto(
  providerId: string,
  row: RegistryModelRow,
  idx: number,
): CanvasProviderDto["models"][0] {
  const meta = metaForRow(row);
  return {
    id: `${providerId}::${row.modelKey}`,
    modelKey: row.modelKey,
    displayName: row.displayName,
    role: meta.role,
    description: meta.description ?? row.description ?? null,
    paramsSchema: meta.paramsSchema ?? null,
    defaultParams: meta.defaultParams ?? null,
    enabled: true,
    sortOrder: row.sortOrder ?? idx,
  };
}

/** sbv1 火山 Seedance · 须走 gateway:sbv1-volcengine（凭证分池） */
const SBV1_VOLCENGINE_VIDEO_MODEL_KEYS = new Set([
  "doubao-seedance-2.0",
  "doubao-seedance-1.5-pro",
]);

function providerIdForRow(row: RegistryModelRow, sceneKey?: string): string {
  const isSbv1VolcVideo =
    row.providerKind === "VOLCENGINE" &&
    row.role === "VIDEO" &&
    (sceneKey === "sbv1-video" || SBV1_VOLCENGINE_VIDEO_MODEL_KEYS.has(row.modelKey));

  if (isSbv1VolcVideo) return GATEWAY_SBV1_VOLCENGINE_PROVIDER_ID;

  const gatewayId = PROVIDER_KIND_TO_ID[row.providerKind];
  if (gatewayId) return gatewayId;

  if (row.platformOffering) return PLATFORM_OFFERING_PROVIDER_ID;
  return `gateway:${row.providerKind.toLowerCase()}`;
}

function buildProviderShell(providerId: string, now: string): Omit<CanvasProviderDto, "models"> {
  return {
    id: providerId,
    alias: PROVIDER_ALIAS[providerId] ?? providerId,
    kind: "OPENAI_COMPAT",
    baseUrl: null,
    apiKeyMasked: providerId === PLATFORM_OFFERING_PROVIDER_ID ? "platform" : "gateway",
    active: true,
    lastTestedAt: null,
    lastTestStatus: providerId === PLATFORM_OFFERING_PROVIDER_ID ? "platform" : "gateway",
    createdAt: now,
    updatedAt: now,
  };
}

export type BuildCanvasRegistryProvidersOpts = {
  sceneKey?: string | null;
  role?: CanvasModelRole;
};

/** 由统一注册表构建 Canvas 虚拟 Provider 列表。 */
export async function buildCanvasProvidersFromRegistry(
  userId: string,
  opts?: BuildCanvasRegistryProvidersOpts,
): Promise<CanvasProviderDto[]> {
  const persona = await getUserBillingPersona(userId);
  const link = await getGatewayLinkStatusForUser(userId);
  const boundKinds = link.boundKinds ?? [];

  const rows = await listModelsForApp({
    appTag: "canvas",
    role: opts?.role,
    sceneKey: opts?.sceneKey,
    persona: persona === "PLATFORM_CREDIT" ? "PLATFORM_CREDIT" : "BYOK",
    boundKinds,
  });

  const now = new Date().toISOString();
  const byProvider = new Map<string, CanvasProviderDto>();

  rows.forEach((row, idx) => {
    const providerId = providerIdForRow(row, opts?.sceneKey ?? undefined);
    let provider = byProvider.get(providerId);
    if (!provider) {
      provider = { ...buildProviderShell(providerId, now), models: [] };
      byProvider.set(providerId, provider);
    }
    provider.models.push(rowToModelDto(providerId, row, idx));
  });

  for (const p of byProvider.values()) {
    p.models.sort((a, b) => a.sortOrder - b.sortOrder);
  }

  return [...byProvider.values()];
}
