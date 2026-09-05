"use client";

import { useMemo } from "react";

import { PRO2_TTS_MODEL_KEYS } from "@/lib/canvas/kie-audio-models";
import {
  resolveLibtvDockEngineModelDisplayName,
  resolveLibtvDockEngineModel,
} from "@/lib/canvas/libtv-dock-engine-models";
import { isMinimaxSpeechModelKey } from "@/lib/canvas/libtv-qr-audio-models";
import {
  isQwen3TtsModelKey,
  QWEN_TTS_LANGUAGE_SCHEMA,
} from "@/lib/canvas/qwen3-tts-voice-catalog";
import {
  LIBTV_MINIMAX_TTS_VOICE_PARAMS_SCHEMA,
  LIBTV_QWEN_TTS_INSTRUCTION_SCHEMA,
  LIBTV_TTS_SPEED_VOLUME_PITCH_SCHEMA,
} from "@/lib/canvas/libtv-tts-voice-controls-schema";
import type { CanvasParamSchema, CanvasProviderDto } from "@/lib/canvas-providers-api";
import { useUserProviders } from "@/lib/canvas/use-user-providers";
import { LibtvDockEngineModelPicker } from "./libtv-dock-engine-model-picker";
import { LibtvDockGatewayParamsPicker } from "./libtv-dock-gateway-params-picker";

function filterTtsParamsSchema(
  schema: CanvasParamSchema,
  modelKey: string,
): CanvasParamSchema {
  if (isMinimaxSpeechModelKey(modelKey)) {
    const rest = schema.filter(
      (item) => item.key !== "voice" && item.key !== "voice_id",
    );
    const keys = new Set(rest.map((item) => item.key));
    const merged = [...rest];
    for (const item of LIBTV_MINIMAX_TTS_VOICE_PARAMS_SCHEMA) {
      if (!keys.has(item.key)) merged.push(item);
    }
    return merged;
  }
  if (isQwen3TtsModelKey(modelKey)) {
    const rest = schema.filter(
      (item) => item.key !== "voice" && item.key !== "voice_id",
    );
    const keys = new Set(rest.map((item) => item.key));
    const merged = [...rest];
    if (!keys.has("language_type")) merged.unshift(QWEN_TTS_LANGUAGE_SCHEMA);
    if (!keys.has("instruction")) merged.push(LIBTV_QWEN_TTS_INSTRUCTION_SCHEMA);
    for (const item of LIBTV_TTS_SPEED_VOLUME_PITCH_SCHEMA) {
      if (!keys.has(item.key)) merged.push(item);
    }
    return merged;
  }
  return schema;
}

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
  const lang = String(params.language_type ?? "").trim();
  if (lang === "Chinese") return "中文";
  if (lang === "English") return "English";
  const emotion = String(params.emotion ?? "").trim();
  if (emotion === "happy") return "开心";
  if (emotion === "sad") return "悲伤";
  if (emotion === "calm") return "平静";
  if (emotion) return emotion;
  const speed = params.speed;
  if (speed != null && speed !== 1 && speed !== "1") return `语速 ${speed}`;
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
    <LibtvTtsDockParamsPickerInner
      providerId={providerId}
      modelKey={modelKey}
      params={params}
      externalProviders={externalProviders}
      disabled={disabled}
      open={open}
      onOpenChange={onOpenChange}
      onChange={onChange}
    />
  );
}

function LibtvTtsDockParamsPickerInner({
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
  const { providers: hookProviders } = useUserProviders();
  const providers = externalProviders ?? hookProviders;
  const resolvedModel = useMemo(
    () => resolveLibtvDockEngineModel(providers, providerId, modelKey),
    [providers, providerId, modelKey],
  );
  const schema = useMemo(
    () => filterTtsParamsSchema(resolvedModel?.paramsSchema ?? [], modelKey),
    [resolvedModel?.paramsSchema, modelKey],
  );

  if (schema.length === 0) return null;

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
      schemaOverride={schema}
      onChange={(next) => onChange(next)}
    />
  );
}
