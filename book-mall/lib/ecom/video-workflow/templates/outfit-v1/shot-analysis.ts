import { z } from "zod";

import {
  normalizeOutfitSplitEnrichScene,
  outfitSplitEnrichNeedsRetry,
  type OutfitSplitEnrichNormalized,
  type OutfitSplitEnrichRawScene,
} from "@/lib/ecom/ecom-outfit-video-split-enrich-validate";
import {
  OUTFIT_V1_LLM_JSON_PREFIX,
} from "@/lib/ecom/video-workflow/templates/outfit-v1/constants";
import {
  extractOutfitSplitFenceJson,
  type OutfitSplitBatchSegment,
} from "@/lib/ecom/ecom-outfit-video-split-prompts";
import type { SceneShot } from "@/lib/ecom/video-workflow/shot-spine";
import { buildOutfitShotPrefilledGeneratePrompt } from "@/lib/ecom/ecom-outfit-video-generate-prompts";

/** 逐镜视觉分析（拆镜 enrich · §十字段） */
export const outfitShotAnalysisSchema = z.object({
  characterAction: z.string().min(2),
  cameraMove: z.string().min(2),
  lightingSetup: z.string().min(2),
  sceneBackground: z.string().min(2),
  toneContrast: z.string().optional(),
  parseIncomplete: z.boolean().optional(),
});

export type OutfitShotAnalysis = z.infer<typeof outfitShotAnalysisSchema>;

export type { OutfitSplitBatchSegment } from "@/lib/ecom/ecom-outfit-video-split-prompts";
export {
  DEFAULT_OUTFIT_SPLIT_USER_PROMPT,
  OUTFIT_SPLIT_FENCE,
  OUTFIT_SPLIT_JSON_DELIVERY_FOOTER,
  OUTFIT_SPLIT_V10_SYSTEM_PROMPT,
  appendOutfitSplitJsonDeliveryFooter,
  buildOutfitSplitBatchEnrichUserPrompt,
  buildOutfitSplitBatchEnrichUserContent,
  buildOutfitSplitRetryEnrichUserContent,
  buildOutfitSplitSystemPrompt,
} from "@/lib/ecom/ecom-outfit-video-split-prompts";

const outfitShotAnalysisWithSceneIdSchema = outfitShotAnalysisSchema.extend({
  sceneId: z.string().min(1),
});

function rawSceneToAnalysis(raw: OutfitSplitEnrichRawScene): OutfitShotAnalysis | null {
  const norm = normalizeOutfitSplitEnrichScene(raw);
  const parsed = outfitShotAnalysisSchema.safeParse({
    characterAction: norm.characterAction,
    cameraMove: norm.cameraMove,
    lightingSetup: norm.lightingSetup,
    sceneBackground: norm.sceneBackground,
    parseIncomplete: norm.parseIncomplete,
  });
  return parsed.success ? parsed.data : null;
}

function extractScenesArray(parsed: unknown): OutfitSplitEnrichRawScene[] {
  if (Array.isArray(parsed)) return parsed as OutfitSplitEnrichRawScene[];
  if (parsed && typeof parsed === "object") {
    const scenes = (parsed as { scenes?: unknown }).scenes;
    if (Array.isArray(scenes)) return scenes as OutfitSplitEnrichRawScene[];
  }
  return [];
}

/** 解析 batch enrich；单镜失败不拖垮整批 */
export function parseOutfitSplitBatchEnrichFromLlm(
  raw: string,
): Map<string, OutfitShotAnalysis> {
  const out = new Map<string, OutfitShotAnalysis>();
  const jsonText = extractOutfitSplitFenceJson(raw);
  if (!jsonText) return out;
  try {
    const parsed = JSON.parse(jsonText) as unknown;
    for (const item of extractScenesArray(parsed)) {
      const sceneId = (item.sceneId ?? "").trim();
      if (!sceneId) continue;
      const analysis = rawSceneToAnalysis(item);
      if (analysis) out.set(sceneId, analysis);
    }
  } catch {
    /* ignore */
  }
  return out;
}

/** 哪些镜 enrich 结果需要重试 */
export function listOutfitSplitEnrichRetrySceneIds(
  map: Map<string, OutfitShotAnalysis>,
  expectedSceneIds: string[],
): string[] {
  const retry: string[] = [];
  for (const sceneId of expectedSceneIds) {
    const row = map.get(sceneId);
    if (!row) {
      retry.push(sceneId);
      continue;
    }
    const norm: OutfitSplitEnrichNormalized = {
      characterAction: row.characterAction,
      cameraMove: row.cameraMove,
      lightingSetup: row.lightingSetup,
      sceneBackground: row.sceneBackground,
      parseIncomplete: row.parseIncomplete ?? false,
    };
    if (outfitSplitEnrichNeedsRetry(norm)) retry.push(sceneId);
  }
  return retry;
}

export function parseOutfitShotAnalysisFromLlm(raw: string): OutfitShotAnalysis | null {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    const parsed = JSON.parse(jsonMatch[0]) as unknown;
    if (parsed && typeof parsed === "object") {
      return rawSceneToAnalysis(parsed as OutfitSplitEnrichRawScene);
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function applyOutfitShotAnalysisToScene(
  scene: SceneShot,
  analysis: OutfitShotAnalysis,
): SceneShot {
  const next: SceneShot = {
    ...scene,
    characterAction: analysis.characterAction.trim(),
    cameraMove: analysis.cameraMove.trim(),
    lightingSetup: analysis.lightingSetup.trim(),
    sceneBackground: analysis.sceneBackground.trim(),
    toneContrast: analysis.toneContrast?.trim() || undefined,
    parseIncomplete: analysis.parseIncomplete ?? false,
  };
  return {
    ...next,
    userGeneratePrompt: buildOutfitShotPrefilledGeneratePrompt(next),
  };
}

export function outfitSceneCameraLabel(scene: SceneShot): string {
  return scene.cameraMove?.trim() || scene.cameraType?.trim() || "—";
}

export function outfitSceneActionLabel(scene: SceneShot): string {
  return scene.characterAction?.trim() || scene.motionType?.trim() || "—";
}

export function outfitSceneLightingLabel(scene: SceneShot): string {
  return scene.lightingSetup?.trim() || "—";
}

export function outfitSceneBackgroundLabel(scene: SceneShot): string {
  return scene.sceneBackground?.trim() || "—";
}

/** @deprecated §十不再把运镜/动作拼入生成 Prompt；保留导出避免旧引用 */
export function appendOutfitShotAnalysisToGeneratePrompt(
  basePrompt: string,
  _scene: SceneShot,
): string {
  return basePrompt.trim();
}

export function mergeOutfitSplitEnrichMaps(
  base: Map<string, OutfitShotAnalysis>,
  patch: Map<string, OutfitShotAnalysis>,
): Map<string, OutfitShotAnalysis> {
  const out = new Map(base);
  for (const [k, v] of patch) out.set(k, v);
  return out;
}

export function outfitShotAnalysisFromNormalized(
  norm: OutfitSplitEnrichNormalized,
): OutfitShotAnalysis {
  return {
    characterAction: norm.characterAction,
    cameraMove: norm.cameraMove,
    lightingSetup: norm.lightingSetup,
    sceneBackground: norm.sceneBackground,
    parseIncomplete: norm.parseIncomplete,
  };
}

export { OUTFIT_V1_LLM_JSON_PREFIX };
