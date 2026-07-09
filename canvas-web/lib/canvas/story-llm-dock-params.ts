import { buildModelParams } from "@/components/canvas/dynamic-param-form";
import { STORY_PRO_LLM_PARAMS_DEFAULT } from "@/lib/canvas/story-pro-prompts";
import type { CanvasProviderModelDto } from "@/lib/canvas-providers-api";

export function isVolcengineDoubaoLlmModelKey(modelKey: string): boolean {
  return modelKey.trim().toLowerCase().startsWith("doubao-");
}

/** 火山豆包 Chat · 仅 temperature / max_tokens（无 reasoning_effort） */
export function volcengineDoubaoLlmParamsFromModel(
  model?: Pick<CanvasProviderModelDto, "defaultParams"> | null,
): Record<string, unknown> {
  const d = (model?.defaultParams as Record<string, unknown> | undefined) ?? {};
  return {
    temperature: typeof d.temperature === "number" ? d.temperature : 0.7,
    max_tokens: typeof d.max_tokens === "number" ? d.max_tokens : 8000,
  };
}

/** Dock 选 LLM 时合并参数：豆包不复用 Story 16k / 低推理默认 */
export function buildStoryLlmDockParams(
  model: Pick<CanvasProviderModelDto, "modelKey" | "defaultParams" | "paramsSchema">,
  curParams: Record<string, unknown>,
): Record<string, unknown> {
  const key = String(model.modelKey ?? "").trim();
  if (isVolcengineDoubaoLlmModelKey(key)) {
    return volcengineDoubaoLlmParamsFromModel(model);
  }
  const built = buildModelParams(model, curParams);
  delete built.model;
  return { ...STORY_PRO_LLM_PARAMS_DEFAULT, ...built };
}

/** 已选豆包但节点仍残留 Gemini/Story 参数（16k、reasoning_effort） */
export function storyLlmParamsNeedSanitize(
  modelKey: string,
  params: Record<string, unknown>,
): boolean {
  if (!isVolcengineDoubaoLlmModelKey(modelKey)) return false;
  if (params.reasoning_effort != null && String(params.reasoning_effort).trim()) {
    return true;
  }
  const max = Number(params.max_tokens);
  const expected = 8000;
  return Number.isFinite(max) && max !== expected && max >= 16000;
}

export function sanitizeStoryLlmParamsForModel(
  modelKey: string,
  params: Record<string, unknown>,
  model?: Pick<CanvasProviderModelDto, "defaultParams"> | null,
): Record<string, unknown> {
  if (!isVolcengineDoubaoLlmModelKey(modelKey)) return params;
  return volcengineDoubaoLlmParamsFromModel(model);
}
