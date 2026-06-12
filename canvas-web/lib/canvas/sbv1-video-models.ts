/**
 * 分镜视频 1.0 · Gateway 火山 Seedance 真人模型展示层
 *
 * - 上游一律经 Gateway VOLCENGINE（禁止直连 ARK）
 * - 真人人像须先录入「真人人像库」并通过审核，生成时引用 asset:// 或已授权素材
 * - 官方文档：真人人像库 https://www.volcengine.com/docs/82379/2333589
 */

import type { CanvasEnginePick } from "./types";
import { GATEWAY_SBV1_VOLCENGINE_PROVIDER_ID } from "./system-providers";
import type { CanvasProviderDto } from "@/lib/canvas-providers-api";

export type Sbv1VolcengineModelOption = {
  id: string;
  displayName: string;
  description: string;
  badge?: "real_person" | "endpoint";
  engine: CanvasEnginePick;
  /** B 表挂牌估算：元/秒（720P 参考，含音频加成见 params） */
  listCostYuanPerSec?: number;
};

/** 同一 Gateway modelKey 的展示变体（分辨率 / 有声） */
const SBV1_VOLCENGINE_VARIANT_PRESETS: Array<{
  id: string;
  modelKey: string;
  displayName: string;
  description: string;
  params: Record<string, unknown>;
  listCostYuanPerSec: number;
}> = [
  {
    id: "seedance-2-720p-real",
    modelKey: "doubao-seedance-2.0",
    displayName: "Seedance 2.0 · 720P",
    description:
      "火山方舟图生视频 · 支持真人人像库 asset://（须先录入并通过审核）",
    params: { resolution: "720p", generate_audio: false },
    listCostYuanPerSec: 0.99,
  },
  {
    id: "seedance-2-720p-audio-real",
    modelKey: "doubao-seedance-2.0",
    displayName: "Seedance 2.0 · 720P 有声",
    description: "含音频输出 · 真人人像须走人像库审核后引用",
    params: { resolution: "720p", generate_audio: true },
    listCostYuanPerSec: 1.1,
  },
  {
    id: "seedance-2-fast-720p-real",
    modelKey: "doubao-seedance-2.0",
    displayName: "Seedance 2.0 Fast · 720P",
    description: "Fast 档位（同模型 Key，参数优化）· 真人人像库",
    params: { resolution: "720p", generate_audio: false, tier: "fast" },
    listCostYuanPerSec: 0.8,
  },
  {
    id: "seedance-2-1080p-real",
    modelKey: "doubao-seedance-2.0",
    displayName: "Seedance 2.0 · 1080P",
    description: "1080P 输出 · 真人人像须 asset:// 已审核资产",
    params: { resolution: "1080p", generate_audio: false },
    listCostYuanPerSec: 1.2,
  },
  {
    id: "seedance-15-pro-1080p-real",
    modelKey: "doubao-seedance-1.5-pro",
    displayName: "Seedance 1.5 Pro · 1080P",
    description: "首尾帧 / 有声 · 真人人像库 asset://",
    params: { resolution: "1080p", generate_audio: true },
    listCostYuanPerSec: 0.65,
  },
];

function presetToOption(
  p: (typeof SBV1_VOLCENGINE_VARIANT_PRESETS)[number],
): Sbv1VolcengineModelOption {
  return {
    id: p.id,
    displayName: p.displayName,
    description: p.description,
    badge: "real_person",
    listCostYuanPerSec: p.listCostYuanPerSec,
    engine: {
      providerId: GATEWAY_SBV1_VOLCENGINE_PROVIDER_ID,
      modelKey: p.modelKey,
      params: { ...p.params },
    },
  };
}

export const SBV1_VOLCENGINE_MODELS: Sbv1VolcengineModelOption[] =
  SBV1_VOLCENGINE_VARIANT_PRESETS.map(presetToOption);

/** EnginePicker 白名单 · Gateway VOLCENGINE VIDEO modelKey */
export const SBV1_VOLCENGINE_GATEWAY_MODEL_KEYS = [
  ...new Set(SBV1_VOLCENGINE_VARIANT_PRESETS.map((p) => p.modelKey)),
] as string[];

export function resolveSbv1VariantIdFromEngine(
  engine: {
    providerId?: string;
    modelKey?: string;
    params?: Record<string, unknown>;
  },
  providers?: CanvasProviderDto[],
): string {
  const pool = providers
    ? buildSbv1VolcengineModelsFromGateway(providers)
    : SBV1_VOLCENGINE_MODELS;
  const key = (engine.modelKey ?? "").trim();
  if (!key) return migrateSbv1ModelVariantId(undefined);

  const resolution = String(engine.params?.resolution ?? "720p").toLowerCase();
  const audio = Boolean(engine.params?.generate_audio);
  const tier = engine.params?.tier;

  const exact = pool.find((m) => {
    if (m.engine.modelKey !== key) return false;
    const p = m.engine.params ?? {};
    if (String(p.resolution ?? "720p").toLowerCase() !== resolution) return false;
    if (Boolean(p.generate_audio) !== audio) return false;
    if (tier != null && p.tier !== tier) return false;
    if (tier == null && p.tier != null) return false;
    return true;
  });
  if (exact) return exact.id;

  const byKey = pool.find((m) => m.engine.modelKey === key);
  if (byKey) return byKey.id;
  return `gw-${key}`;
}

/** 从 Gateway introspect 过滤：仅 VOLCENGINE VIDEO + 用户 ep-* 接入点 */
export function buildSbv1VolcengineModelsFromGateway(
  providers: CanvasProviderDto[],
): Sbv1VolcengineModelOption[] {
  const sbv1 = providers.find(
    (p) => p.id === GATEWAY_SBV1_VOLCENGINE_PROVIDER_ID,
  );
  const volc = sbv1?.models?.length
    ? sbv1
    : providers.find((p) => p.id === "gateway:volcengine");
  if (!volc?.models?.length) return SBV1_VOLCENGINE_MODELS;

  const enabledKeys = new Set(
    volc.models
      .filter((m) => m.enabled && m.role === "VIDEO")
      .map((m) => m.modelKey.toLowerCase()),
  );

  const fromPresets = SBV1_VOLCENGINE_VARIANT_PRESETS.filter((p) =>
    enabledKeys.has(p.modelKey.toLowerCase()),
  ).map(presetToOption);

  const epOptions: Sbv1VolcengineModelOption[] = [];
  for (const m of volc.models) {
    if (!m.enabled || m.role !== "VIDEO") continue;
    const key = m.modelKey.trim();
    if (!key.toLowerCase().startsWith("ep-")) continue;
    if (fromPresets.some((o) => o.engine.modelKey === key)) continue;
    epOptions.push({
      id: `ep-${key}`,
      displayName: m.displayName?.trim() || `接入点 ${key}`,
      description:
        "火山方舟控制台接入点 · 真人人像须先录入真人人像库并通过审核",
      badge: "endpoint",
      listCostYuanPerSec: 1.0,
      engine: {
        providerId: GATEWAY_SBV1_VOLCENGINE_PROVIDER_ID,
        modelKey: key,
        params: { resolution: "720p", generate_audio: false },
      },
    });
  }

  const merged = [...fromPresets, ...epOptions];
  const covered = new Set(
    merged.map((m) => m.engine.modelKey.toLowerCase()),
  );
  for (const m of volc.models) {
    if (!m.enabled || m.role !== "VIDEO") continue;
    const key = m.modelKey.trim();
    if (!key || covered.has(key.toLowerCase())) continue;
    merged.push({
      id: `gw-${key}`,
      displayName: m.displayName?.trim() || key,
      description:
        m.description?.trim() ||
        "Gateway 火山方舟 VIDEO · 真人人像须 asset:// 已审核",
      badge: key.toLowerCase().startsWith("ep-") ? "endpoint" : undefined,
      listCostYuanPerSec: 1.0,
      engine: {
        providerId: GATEWAY_SBV1_VOLCENGINE_PROVIDER_ID,
        modelKey: key,
        params: { resolution: "720p", generate_audio: false },
      },
    });
    covered.add(key.toLowerCase());
  }
  return merged.length ? merged : SBV1_VOLCENGINE_MODELS;
}

export function getSbv1VolcengineModelById(
  id: string,
  providers?: CanvasProviderDto[],
): Sbv1VolcengineModelOption {
  const pool = providers
    ? buildSbv1VolcengineModelsFromGateway(providers)
    : SBV1_VOLCENGINE_MODELS;
  return pool.find((m) => m.id === id) ?? pool[0] ?? SBV1_VOLCENGINE_MODELS[0]!;
}

/** @deprecated 旧字段 jimengModelId → 新 volcengineVariantId 映射 */
export function migrateSbv1ModelVariantId(
  legacyId: string | undefined,
): string {
  if (!legacyId) return "seedance-2-720p-audio-real";
  const map: Record<string, string> = {
    "seedance-2-fast-vip": "seedance-2-fast-720p-real",
    "seedance-2-vip": "seedance-2-1080p-real",
    "seedance-2-fast": "seedance-2-fast-720p-real",
    "seedance-2": "seedance-2-1080p-real",
    "seedance-1-5-pro": "seedance-15-pro-1080p-real",
  };
  return map[legacyId] ?? legacyId;
}

export const SBV1_ASPECT_RATIOS = [
  "21:9",
  "16:9",
  "4:3",
  "1:1",
  "3:4",
  "9:16",
] as const;

export const SBV1_REFERENCE_MODES = [
  { id: "omni" as const, label: "全能参考" },
  { id: "first_last" as const, label: "首尾帧" },
  { id: "smart_multi" as const, label: "智能多帧" },
];

export const SBV1_CREATION_TYPES = [
  { id: "video" as const, label: "视频生成", enabled: true },
  { id: "agent" as const, label: "Agent 模式", enabled: false },
  { id: "image" as const, label: "图片生成", enabled: false },
  { id: "digital_human" as const, label: "数字人", enabled: false },
  { id: "voiceover" as const, label: "配音生成", enabled: false },
  { id: "motion" as const, label: "动作模仿", enabled: false },
];

/** 火山 Seedance 2.0 官方计价参考（2026-06 文档） */
export const SBV1_VOLCENGINE_PRICING_NOTE = {
  tokenPureVideoYuanPerMillion: 46,
  tokenWithVideoInputYuanPerMillion: 28,
  reference15SecTokens: 308_880,
  approxYuanPerSec720p: 0.99,
  approxYuanPerSec1080p: 1.2,
  docBilling: "https://www.volcengine.com/docs/82379/1544106",
  docVideoApi: "https://www.volcengine.com/docs/82379/1520758",
  docRealPortrait: "https://www.volcengine.com/docs/82379/2333589",
} as const;

export function estimateSbv1ListCostYuan(args: {
  listCostYuanPerSec?: number;
  durationSec: number;
}): number | null {
  const rate = args.listCostYuanPerSec;
  if (rate == null || !Number.isFinite(rate)) return null;
  const sec = Math.max(4, Math.min(15, Math.round(args.durationSec || 5)));
  return Math.round(rate * sec * 100) / 100;
}
