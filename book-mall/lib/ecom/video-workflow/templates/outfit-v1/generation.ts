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
  resolveOutfitShotNegativePrompt,
} from "@/lib/ecom/ecom-outfit-video-generate-prompts";
import { resolveDefaultLockedLookUrl } from "@/lib/ecom/ecom-vton/meta";
import type { VtonProjectMeta } from "@/lib/ecom/ecom-vton/types";
import { resolveOutfitShotKlingCharacterImage } from "@/lib/ecom/ecom-outfit-video-scene-fusion";
import type { SceneShot, WorkflowRefs } from "@/lib/ecom/video-workflow/shot-spine";

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
  meta?: VtonProjectMeta | null;
  videoModelKey: string;
  durationSec?: number;
};

/** §十：负向固定（中文）；有 scene 时优先适配结果 */
export function buildOutfitShotNegativePrompt(scene?: SceneShot): string {
  if (scene) return resolveOutfitShotNegativePrompt(scene);
  return OUTFIT_V1_NEGATIVE_PROMPT_ZH;
}

/** 逐镜生成人物参考：locked look → modelGallery 首张 → model → dressedImage */
export function resolveOutfitDressedImageUrl(
  refs: WorkflowRefs,
  meta?: VtonProjectMeta | null,
): string {
  const fromMeta = meta ? resolveDefaultLockedLookUrl(meta) : null;
  if (fromMeta) return fromMeta;
  const galleryPrimary = refs.modelGallery?.[0]?.ossUrl?.trim();
  if (galleryPrimary) return galleryPrimary;
  const model = refs.model?.ossUrl?.trim();
  if (model) return model;
  const dressed = refs.dressedImage?.ossUrl?.trim();
  if (dressed) return dressed;
  throw new Error("请先上传穿搭参考图");
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
  const dressedUrl = resolveOutfitShotKlingCharacterImage(ctx.scene, ctx.refs, ctx.meta);

  const durationSec =
    typeof ctx.durationSec === "number" && ctx.durationSec > 0
      ? ctx.durationSec
      : Math.max(2, Math.min(4, Math.round(ctx.scene.durationSec)));

  return {
    prompt: resolveOutfitShotGeneratePrompt(ctx.scene),
    negativePrompt: buildOutfitShotNegativePrompt(ctx.scene),
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
