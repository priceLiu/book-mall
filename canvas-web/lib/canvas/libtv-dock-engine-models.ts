import type {
  CanvasProviderDto,
  CanvasProviderModelDto,
} from "@/lib/canvas-providers-api";
import {
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
      if (allowedSet && !allowedSet.has(model.modelKey)) continue;
      if (!allowedSet && model.role !== opts.role) continue;
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
