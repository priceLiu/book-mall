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
  buildLibtvMinimaxTtsVoiceParamsSchema,
  LIBTV_QWEN_TTS_INSTRUCTION_SCHEMA,
  libtvMinimaxTtsEmotionLabel,
  resolveLibtvMinimaxTtsEmotionOptions,
  LIBTV_TTS_SPEED_VOLUME_PITCH_SCHEMA,
} from "@/lib/canvas/libtv-tts-voice-controls-schema";
import {
  isLibtvTtsParamPreviewBillingEnabled,
  LIBTV_TTS_PARAM_PREVIEW_BILLING_KEY,
} from "@/lib/canvas/libtv-tts-preview-client";
import type { CanvasParamSchema, CanvasProviderDto } from "@/lib/canvas-providers-api";
import { useUserProviders } from "@/lib/canvas/use-user-providers";
import { DynamicParamForm } from "@/components/canvas/dynamic-param-form";
import { LibtvDockEngineModelPicker } from "./libtv-dock-engine-model-picker";
import { LibtvDockGatewayParamsPicker } from "./libtv-dock-gateway-params-picker";
import { RF_NODE_SCROLL } from "@/lib/canvas/react-flow-classes";

export function filterTtsParamsSchema(
  schema: CanvasParamSchema,
  modelKey: string,
): CanvasParamSchema {
  if (isMinimaxSpeechModelKey(modelKey)) {
    const rest = schema.filter(
      (item) => item.key !== "voice" && item.key !== "voice_id",
    );
    const keys = new Set(rest.map((item) => item.key));
    const merged = [...rest];
    for (const item of buildLibtvMinimaxTtsVoiceParamsSchema(modelKey)) {
      if (!keys.has(item.key)) merged.push(item);
    }
    return merged.map((item) => {
      if (item.key !== "emotion" || item.type !== "select") return item;
      return {
        ...item,
        options: resolveLibtvMinimaxTtsEmotionOptions(modelKey).map((o) => ({
          value: o.value,
          label: o.label,
        })),
      };
    });
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
  if (emotion) return libtvMinimaxTtsEmotionLabel(emotion);
  const speed = params.speed;
  if (speed != null && speed !== 1 && speed !== "1") return `语速 ${speed}`;
  return "参数";
}

function LibtvTtsParamPreviewBillingToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex max-w-[11rem] cursor-pointer select-none items-center gap-1">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className={`${RF_NODE_SCROLL} size-3 shrink-0 accent-white`}
      />
      <span className="text-[10px] leading-tight text-white/45">
        调参试听, 会产生积分扣减
      </span>
    </label>
  );
}

/** 统一弹层 · 语气与参数 */
export function LibtvTtsDockParamsPopoverContent({
  providerId,
  modelKey,
  params,
  externalProviders,
  onChange,
  onBillingPreviewChange,
}: {
  providerId: string;
  modelKey: string;
  params: Record<string, unknown>;
  externalProviders?: CanvasProviderDto[];
  onChange: (params: Record<string, unknown>) => void;
  /** 勾选「调参试听」后立即同步到音色列表（不必等节点 params 回写） */
  onBillingPreviewChange?: (enabled: boolean) => void;
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
  const hasEmotionField = useMemo(
    () => schema.some((item) => item.key === "emotion"),
    [schema],
  );
  const billingChecked = isLibtvTtsParamPreviewBillingEnabled(params);

  const billingToggle = (
    <LibtvTtsParamPreviewBillingToggle
      checked={billingChecked}
      onChange={(next) => {
        onBillingPreviewChange?.(next);
        onChange({ ...params, [LIBTV_TTS_PARAM_PREVIEW_BILLING_KEY]: next });
      }}
    />
  );

  if (schema.length === 0) return null;

  return (
    <div className="border-t border-white/10 px-2 pb-1.5 pt-1.5">
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="text-[10px] text-white/40">语气与参数</p>
        {!hasEmotionField ? billingToggle : null}
      </div>
      <DynamicParamForm
        variant="dock"
        schema={schema}
        value={params}
        onChange={onChange}
        dockLabelExtra={
          hasEmotionField ? { emotion: billingToggle } : undefined
        }
      />
    </div>
  );
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
  voiceId,
  previewContext,
  externalProviders,
  disabled,
  open,
  onOpenChange,
  onChange,
  onSelectVoice,
}: {
  providerId: string;
  modelKey: string;
  params: Record<string, unknown>;
  voiceId?: string;
  previewContext?: LibtvTtsPreviewContext;
  externalProviders?: CanvasProviderDto[];
  disabled?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onChange: (params: Record<string, unknown>) => void;
  /** MiniMax · 参数面板内切换音色（试听走 OSS 原样音） */
  onSelectVoice?: (voiceId: string, label: string) => void;
}) {
  return (
    <LibtvTtsDockParamsPickerInner
      providerId={providerId}
      modelKey={modelKey}
      params={params}
      voiceId={voiceId}
      previewContext={previewContext}
      externalProviders={externalProviders}
      disabled={disabled}
      open={open}
      onOpenChange={onOpenChange}
      onChange={onChange}
      onSelectVoice={onSelectVoice}
    />
  );
}

function LibtvTtsDockParamsPickerInner({
  providerId,
  modelKey,
  params,
  voiceId,
  previewContext,
  externalProviders,
  disabled,
  open,
  onOpenChange,
  onChange,
  onSelectVoice,
}: {
  providerId: string;
  modelKey: string;
  params: Record<string, unknown>;
  voiceId?: string;
  previewContext?: LibtvTtsPreviewContext;
  externalProviders?: CanvasProviderDto[];
  disabled?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onChange: (params: Record<string, unknown>) => void;
  onSelectVoice?: (voiceId: string, label: string) => void;
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
