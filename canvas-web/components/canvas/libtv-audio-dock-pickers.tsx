"use client";

import { PRO2_TTS_MODEL_KEYS } from "@/lib/canvas/kie-audio-models";
import type { CanvasProviderDto } from "@/lib/canvas-providers-api";
import { resolveLibtvDockEngineModelDisplayName } from "@/lib/canvas/libtv-dock-engine-models";
import { LibtvDockEngineModelPicker } from "./libtv-dock-engine-model-picker";
import { LibtvDockGatewayParamsPicker } from "./libtv-dock-gateway-params-picker";

export function libtvTtsModelTriggerLabel(
  modelKey: string,
  providers: CanvasProviderDto[],
): string {
  const key = modelKey.trim();
  if (!key) return "选择模型";
  return resolveLibtvDockEngineModelDisplayName(key, providers);
}

export function libtvTtsParamsTriggerLabel(
  params: Record<string, unknown>,
): string {
  const voice = String(params.voice_id ?? params.voice ?? "").trim();
  if (voice) {
    const short = voice.length > 12 ? `${voice.slice(0, 10)}…` : voice;
    return short;
  }
  const stability = params.stability;
  if (stability != null) return `稳定 ${stability}`;
  return "参数";
}

export function LibtvTtsDockModelPicker({
  providerId,
  modelKey,
  params,
  externalProviders,
  disabled,
  open,
  onOpenChange,
  onChange,
}: {
  providerId: string;
  modelKey: string;
  params: Record<string, unknown>;
  externalProviders?: CanvasProviderDto[];
  disabled?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onChange: (next: {
    providerId: string;
    modelKey: string;
    params: Record<string, unknown>;
  }) => void;
}) {
  return (
    <LibtvDockEngineModelPicker
      role="TTS"
      providerId={providerId}
      modelKey={modelKey}
      allowedModelKeys={[...PRO2_TTS_MODEL_KEYS]}
      externalProviders={externalProviders}
      disabled={disabled}
      open={open}
      onOpenChange={onOpenChange}
      onSelect={({ providerId: pid, modelKey: key }) => {
        onChange({
          providerId: pid,
          modelKey: key,
          params,
        });
      }}
    />
  );
}

export function LibtvTtsDockParamsPicker({
  providerId,
  modelKey,
  params,
  externalProviders,
  disabled,
  open,
  onOpenChange,
  onChange,
}: {
  providerId: string;
  modelKey: string;
  params: Record<string, unknown>;
  externalProviders?: CanvasProviderDto[];
  disabled?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onChange: (params: Record<string, unknown>) => void;
}) {
  return (
    <LibtvDockGatewayParamsPicker
      providerId={providerId}
      modelKey={modelKey}
      params={params}
      externalProviders={externalProviders}
      disabled={disabled}
      open={open}
      onOpenChange={onOpenChange}
      summaryLabel={libtvTtsParamsTriggerLabel(params)}
      onChange={(next) => onChange(next)}
    />
  );
}
