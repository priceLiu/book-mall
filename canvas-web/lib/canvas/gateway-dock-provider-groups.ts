/**
 * 画布 · Dock / EnginePicker 模型列表按 Gateway Provider 分组与排序
 */
import type { CanvasProviderDto } from "@/lib/canvas-providers-api";
import type { LibtvDockEngineModelEntry } from "./libtv-dock-engine-models";
import { hideKieVendorLabel, type GatewayModelRole } from "./gateway-model-role";
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
} from "./system-providers";

const PLATFORM_OFFERING_PROVIDER_ID = "platform:offering";

/** 选模列表 · Provider 分组展示顺序（上→下） */
export const CANVAS_PROVIDER_GROUP_ORDER: readonly string[] = [
  GATEWAY_VOLCENGINE_PROVIDER_ID,
  GATEWAY_SBV1_VOLCENGINE_PROVIDER_ID,
  GATEWAY_BAILIAN_PROVIDER_ID,
  PLATFORM_OFFERING_PROVIDER_ID,
  GATEWAY_HUNYUAN_PROVIDER_ID,
  GATEWAY_MINIMAX_VIDEO_PROVIDER_ID,
  GATEWAY_DEEPSEEK_PROVIDER_ID,
  GATEWAY_MOONSHOT_PROVIDER_ID,
  GATEWAY_TOPAZ_PROVIDER_ID,
  GATEWAY_KIE_PROVIDER_ID,
];

const GROUP_LABEL_BY_PROVIDER: Record<string, string> = {
  [GATEWAY_VOLCENGINE_PROVIDER_ID]: "火山方舟 · Doubao（Seedream / Seedance）",
  [GATEWAY_SBV1_VOLCENGINE_PROVIDER_ID]: "火山方舟 · 分镜视频",
  [GATEWAY_BAILIAN_PROVIDER_ID]: "阿里云百炼 · 通义万相 / 千问",
  [PLATFORM_OFFERING_PROVIDER_ID]: "平台模型",
  [GATEWAY_HUNYUAN_PROVIDER_ID]: "腾讯混元",
  [GATEWAY_MINIMAX_VIDEO_PROVIDER_ID]: "MiniMax · 海螺",
  [GATEWAY_DEEPSEEK_PROVIDER_ID]: "DeepSeek",
  [GATEWAY_MOONSHOT_PROVIDER_ID]: "Moonshot · Kimi",
  [GATEWAY_TOPAZ_PROVIDER_ID]: "Topaz · 视频增强",
  [GATEWAY_KIE_PROVIDER_ID]: "其他图像 / 视频能力",
};

const ROLE_SUBTITLE: Partial<Record<GatewayModelRole, string>> = {
  LLM: "文本模型",
  IMAGE: "图片模型",
  VIDEO: "视频模型",
  TTS: "语音模型",
  MUSIC: "音乐模型",
};

function providerRank(providerId: string): number {
  const idx = CANVAS_PROVIDER_GROUP_ORDER.indexOf(providerId);
  return idx >= 0 ? idx : 999;
}

export function resolveCanvasProviderGroupLabel(
  providerId: string,
  alias: string,
  role?: GatewayModelRole,
): string {
  const base =
    GROUP_LABEL_BY_PROVIDER[providerId] ??
    hideKieVendorLabel(alias) ??
    alias;
  const sub = role ? ROLE_SUBTITLE[role] : undefined;
  return sub && !base.includes(sub) ? `${base} · ${sub}` : base;
}

export type CanvasProviderModelGroup<T> = {
  providerId: string;
  label: string;
  items: T[];
};

export function groupLibtvDockEngineModelsByProvider(
  entries: LibtvDockEngineModelEntry[],
  role?: GatewayModelRole,
): CanvasProviderModelGroup<LibtvDockEngineModelEntry>[] {
  const byProvider = new Map<string, LibtvDockEngineModelEntry[]>();
  for (const entry of entries) {
    const list = byProvider.get(entry.providerId) ?? [];
    list.push(entry);
    byProvider.set(entry.providerId, list);
  }

  const providerIds = [...byProvider.keys()].sort(
    (a, b) => providerRank(a) - providerRank(b),
  );

  return providerIds.map((providerId) => {
    const items = byProvider.get(providerId) ?? [];
    items.sort((a, b) => a.model.sortOrder - b.model.sortOrder);
    const alias = items[0]?.provider.alias ?? providerId;
    return {
      providerId,
      label: resolveCanvasProviderGroupLabel(providerId, alias, role),
      items,
    };
  });
}

export function sortEnginePickerProviderGroups<
  T extends { provider: CanvasProviderDto },
>(groups: T[]): T[] {
  return [...groups].sort(
    (a, b) => providerRank(a.provider.id) - providerRank(b.provider.id),
  );
}