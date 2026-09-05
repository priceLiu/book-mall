import type {
  CanvasProviderDto,
  CanvasProviderModelDto,
} from "@/lib/canvas-providers-api";
import {
  isImageGenerationModelKey,
  modelHasStoryCapabilities,
  type StoryModelCapability,
} from "@/lib/canvas/story-model-capabilities";
import { hideKieVendorLabel } from "@/lib/canvas/gateway-model-role";
import type { GatewayModelRole } from "@/lib/canvas/gateway-model-role";

export type LibtvDockEngineModelEntry = {
  providerId: string;
  provider: CanvasProviderDto;
  model: CanvasProviderModelDto;
};

/** Gateway 白名单匹配（modelKey 大小写不敏感） */
export function isAllowedDockModelKey(
  modelKey: string,
  allowedSet: Set<string> | null | undefined,
): boolean {
  if (!allowedSet?.size) return true;
  const key = modelKey.trim().toLowerCase();
  for (const allowed of allowedSet) {
    if (allowed.trim().toLowerCase() === key) return true;
  }
  return false;
}

/**
 * Dock / EnginePicker 的 Gateway role 与 Provider DTO role 对齐。
 * Canvas 注册表里 qwen3-tts、ElevenLabs 等 TTS，以及 Suno 音乐模型常为 `LLM`，
 * 须结合白名单归入 TTS / MUSIC 分组。
 */
export function modelMatchesDockGatewayRole(
  model: Pick<CanvasProviderModelDto, "role" | "modelKey">,
  dockRole: GatewayModelRole,
  allowedSet: Set<string> | null | undefined,
): boolean {
  if (model.role === dockRole) return true;
  if (
    model.role === "LLM" &&
    (dockRole === "TTS" || dockRole === "MUSIC") &&
    isAllowedDockModelKey(model.modelKey, allowedSet)
  ) {
    return true;
  }
  return false;
}

export function collectLibtvDockEngineModels(
  providers: CanvasProviderDto[],
  opts: {
    role: GatewayModelRole;
    allowedModelKeys?: readonly string[];
    providerIds?: readonly string[];
    requiredCapabilities?: StoryModelCapability[];
  },
): LibtvDockEngineModelEntry[] {
  const allowedSet = opts.allowedModelKeys?.length
    ? new Set(opts.allowedModelKeys)
    : null;
  const providerIdSet = opts.providerIds?.length
    ? new Set(opts.providerIds)
    : null;
  const reqCaps = opts.requiredCapabilities;

  const out: LibtvDockEngineModelEntry[] = [];
  for (const provider of providers) {
    if (!provider.active) continue;
    if (providerIdSet && !providerIdSet.has(provider.id)) continue;
    for (const model of provider.models) {
      if (!model.enabled) continue;
      if (!modelMatchesDockGatewayRole(model, opts.role, allowedSet)) continue;
      if (!isAllowedDockModelKey(model.modelKey, allowedSet)) continue;
      if (
        opts.role === "IMAGE" &&
        !allowedSet &&
        !isImageGenerationModelKey(model.modelKey)
      ) {
        continue;
      }
      if (
        reqCaps?.length &&
        !modelHasStoryCapabilities(model.modelKey, reqCaps)
      ) {
        continue;
      }
      out.push({ providerId: provider.id, provider, model });
    }
  }
  return out;
}

export function resolveLibtvDockEngineModelDisplayName(
  modelKey: string,
  providers: CanvasProviderDto[],
): string {
  const key = modelKey.trim();
  if (!key) return "选择模型";
  for (const provider of providers) {
    const model = provider.models.find(
      (m) => m.modelKey.toLowerCase() === key.toLowerCase(),
    );
    const name = model?.displayName?.trim();
    if (name) return hideKieVendorLabel(name);
  }
  return hideKieVendorLabel(key);
}

export function resolveLibtvDockEngineModel(
  providers: CanvasProviderDto[],
  providerId: string,
  modelKey: string,
): CanvasProviderModelDto | null {
  if (!providerId.trim() || !modelKey.trim()) return null;
  for (const provider of providers) {
    if (provider.id !== providerId) continue;
    return (
      provider.models.find((m) => m.modelKey === modelKey) ?? null
    );
  }
  return null;
}
