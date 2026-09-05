import {
  OUTFIT_V1_GENERATE_BASE_PROMPT_ZH,
  OUTFIT_V1_NEGATIVE_PROMPT_ZH,
} from "@/lib/ecom/ecom-outfit-video-generate-prompts";
import {
  OUTFIT_V1_DEFAULT_GENERATE_CONSTRAINT,
  OUTFIT_V1_DEFAULT_VIDEO_CONFIG,
  OUTFIT_V1_DEFAULT_VIDEO_MODEL,
  OUTFIT_V1_LLM_JSON_PREFIX,
  OUTFIT_V1_TEMPLATE_ID,
} from "@/lib/ecom/video-workflow/templates/outfit-v1/constants";
import {
  buildOutfitShotPrefilledGeneratePrompt,
  resolveOutfitShotGeneratePrompt,
} from "@/lib/ecom/ecom-outfit-video-generate-prompts";
import type { SceneShot, WorkflowRefs } from "@/lib/ecom/video-workflow/shot-spine";
import { resolveOutfitShotKlingCharacterImage } from "@/lib/ecom/ecom-outfit-video-scene-fusion";

export {
  OUTFIT_V1_GENERATE_BASE_PROMPT_ZH,
  OUTFIT_V1_NEGATIVE_PROMPT_ZH,
  OUTFIT_V1_DEFAULT_VIDEO_CONFIG,
  OUTFIT_V1_DEFAULT_GENERATE_CONSTRAINT,
  OUTFIT_V1_DEFAULT_VIDEO_MODEL,
  OUTFIT_V1_LLM_JSON_PREFIX,
  OUTFIT_V1_TEMPLATE_ID,
  buildOutfitShotPrefilledGeneratePrompt,
  resolveOutfitShotGeneratePrompt,
};

export type OutfitShotGenerateContext = {
  scene: SceneShot;
  refs: WorkflowRefs;
  videoModelKey: string;
  durationSec?: number;
};

/** §十：负向固定（中文） */
export function buildOutfitShotNegativePrompt(): string {
  return OUTFIT_V1_NEGATIVE_PROMPT_ZH;
}

/** 逐镜生成唯一人物参考：锁定后的 dressedImage */
export function resolveOutfitDressedImageUrl(refs: WorkflowRefs): string {
  const dressed = refs.dressedImage?.ossUrl?.trim();
  if (dressed) return dressed;
  throw new Error("请先锁定穿搭参考图");
}

export function buildOutfitShotGenerateBody(ctx: OutfitShotGenerateContext): {
  prompt: string;
  negativePrompt: string;
  modelImageUrl: string;
  clothingImageUrl: string;
  previewImageUrl?: string;
  keypointsUrl?: string;
  referenceClipUrl?: string;
  aspectRatio: string;
  durationSec: number;
  generateConstraint: typeof OUTFIT_V1_DEFAULT_GENERATE_CONSTRAINT;
  videoConfig: typeof OUTFIT_V1_DEFAULT_VIDEO_CONFIG;
} {
  const dressedUrl = resolveOutfitShotKlingCharacterImage(ctx.scene, ctx.refs);
  if (!ctx.scene.sceneFusion?.fusedImageUrl?.trim() && !ctx.refs.dressedImage?.ossUrl) {
    throw new Error("请先锁定穿搭参考并生成场景融合图");
  }
  if (!ctx.scene.sceneFusion?.fusedImageUrl?.trim()) {
    throw new Error("请先在分镜表生成场景融合图");
  }

  const durationSec =
    typeof ctx.durationSec === "number" && ctx.durationSec > 0
      ? ctx.durationSec
      : Math.max(2, Math.min(4, Math.round(ctx.scene.durationSec)));

  return {
    prompt: resolveOutfitShotGeneratePrompt(ctx.scene),
    negativePrompt: buildOutfitShotNegativePrompt(),
    modelImageUrl: dressedUrl,
    clothingImageUrl: dressedUrl,
    previewImageUrl: ctx.scene.previewImageUrl,
    keypointsUrl: ctx.scene.keypointsUrl,
    referenceClipUrl: ctx.scene.referenceClipUrl,
    aspectRatio: OUTFIT_V1_DEFAULT_VIDEO_CONFIG.aspectRatio,
    durationSec,
    generateConstraint: OUTFIT_V1_DEFAULT_GENERATE_CONSTRAINT,
    videoConfig: OUTFIT_V1_DEFAULT_VIDEO_CONFIG,
  };
}

/** 拆镜完成后为每镜写入初始 userGeneratePrompt（系统预填，用户可后续改） */
export function withOutfitShotInitialGeneratePrompt(scene: SceneShot): SceneShot {
  return {
    ...scene,
    userGeneratePrompt: buildOutfitShotPrefilledGeneratePrompt(scene),
  };
}
