"use client";

import { STORY_LLM_MODEL_KEYS } from "@/lib/canvas/types";
import { buildStoryLlmDockParams } from "@/lib/canvas/story-llm-dock-params";
import type { CanvasProviderDto } from "@/lib/canvas-providers-api";
import { resolveLibtvDockEngineModelDisplayName } from "@/lib/canvas/libtv-dock-engine-models";
import { LibtvDockEngineModelPicker } from "../libtv-dock-engine-model-picker";
import {
  LibtvDockGatewayParamsPicker,
  libtvLlmParamsSummaryLabel,
} from "../libtv-dock-gateway-params-picker";

export function pro2LlmModelTriggerLabel(
  providerId: string,
  modelKey: string,
  providers: CanvasProviderDto[],
): string {
  const key = modelKey.trim();
  if (!key) return "选择文本模型";
  return resolveLibtvDockEngineModelDisplayName(key, providers);
}

export function pro2LlmParamsTriggerLabel(
  params: Record<string, unknown>,
): string {
  return libtvLlmParamsSummaryLabel(params);
}

export function Pro2LlmDockModelPicker({
  providerId,
  modelKey,
  params,
  allowedModelKeys,
  externalProviders,
  disabled,
  open,
  onOpenChange,
  onConfirm,
}: {
  providerId: string;
  modelKey: string;
  params: Record<string, unknown>;
  allowedModelKeys?: readonly string[];
  externalProviders?: CanvasProviderDto[];
  disabled?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onConfirm: (next: {
    providerId: string;
    modelKey: string;
    params: Record<string, unknown>;
  }) => void;
}) {
  return (
    <LibtvDockEngineModelPicker
      role="LLM"
      providerId={providerId}
      modelKey={modelKey}
      allowedModelKeys={allowedModelKeys ?? [...STORY_LLM_MODEL_KEYS]}
      externalProviders={externalProviders}
      disabled={disabled}
      open={open}
      onOpenChange={onOpenChange}
      onSelect={({ providerId: pid, modelKey: key, model }) => {
        onConfirm({
          providerId: pid,
          modelKey: key,
          params: buildStoryLlmDockParams(model, params),
        });
      }}
    />
  );
}

export function Pro2LlmDockParamsPicker({
  providerId,
  modelKey,
  params,
  externalProviders,
  disabled,
  open,
  onOpenChange,
  onConfirm,
}: {
  providerId: string;
  modelKey: string;
  params: Record<string, unknown>;
  externalProviders?: CanvasProviderDto[];
  disabled?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onConfirm: (params: Record<string, unknown>) => void;
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
      summaryLabel={pro2LlmParamsTriggerLabel(params)}
      onChange={(next) => {
        onConfirm(next);
      }}
    />
  );
}
