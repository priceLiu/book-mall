import {
  KLING_V3_OMNI_IMAGE_MODEL,
  WAN26_IMAGE_MODEL,
  WAN27_IMAGE_MODEL,
} from "@/lib/gateway/dashscope-client";

/** 阿里 DashScope 万相多图 messages 参考（经 Gateway） */
export const STORYBOARD_DASHSCOPE_IMAGE_MODELS = [
  "wan2.7-image",
  "wan2.7-image-pro",
  "wan2.6-image",
] as const;

/** 阿里 DashScope 可灵 3.0 Omni 多图参考 */
export const STORYBOARD_KLING_IMAGE_MODELS = ["kling-3.0-image"] as const;

/** KIE 多图 image_input 参考（经 Gateway） */
export const STORYBOARD_KIE_IMAGE_MODELS = ["nano-banana-pro"] as const;

export const STORYBOARD_IMAGE_MODELS = [
  ...STORYBOARD_DASHSCOPE_IMAGE_MODELS,
  ...STORYBOARD_KLING_IMAGE_MODELS,
  ...STORYBOARD_KIE_IMAGE_MODELS,
] as const;

export type StoryboardImageModel = (typeof STORYBOARD_IMAGE_MODELS)[number];

/** @deprecated 使用 STORYBOARD_DASHSCOPE_IMAGE_MODELS */
export const STORYBOARD_MULTI_REF_IMAGE_MODELS = STORYBOARD_DASHSCOPE_IMAGE_MODELS;

export function isWan26ImageModel(modelKey: string): boolean {
  const k = modelKey.trim().toLowerCase();
  return k === "wan2.6-image" || k === "wan2.6-t2i";
}

export function resolveStoryboardDashscopeModel(modelKey?: string): string {
  const k = modelKey?.trim() ?? "";
  // wan2.6-t2i 为纯文生图，不支持垫图；旧选项统一落到 wan2.6-image
  if (k === "wan2.6-t2i" || k === "wan2.6-image") return WAN26_IMAGE_MODEL;
  if ((STORYBOARD_DASHSCOPE_IMAGE_MODELS as readonly string[]).includes(k)) {
    return k;
  }
  return WAN27_IMAGE_MODEL;
}

/** @deprecated 使用 resolveStoryboardDashscopeModel */
export const resolveStoryboardMultiRefModel = resolveStoryboardDashscopeModel;

export function resolveStoryboardKlingModel(modelKey?: string): string {
  const k = modelKey?.trim().toLowerCase() ?? "";
  if (k === "kling-3.0" || k === "kling 3.0" || k === "kling3.0") {
    return KLING_V3_OMNI_IMAGE_MODEL;
  }
  if (k.startsWith("kling/kling-v3")) return modelKey!.trim();
  if ((STORYBOARD_KLING_IMAGE_MODELS as readonly string[]).includes(k as never)) {
    return KLING_V3_OMNI_IMAGE_MODEL;
  }
  return KLING_V3_OMNI_IMAGE_MODEL;
}

export function resolveStoryboardKieModel(modelKey?: string): string {
  const k = modelKey?.trim().toLowerCase() ?? "";
  if (k === "nano-banana" || k === "nanobanana") return "nano-banana-pro";
  if ((STORYBOARD_KIE_IMAGE_MODELS as readonly string[]).includes(k as never)) {
    return k;
  }
  return "nano-banana-pro";
}

export function isStoryboardKlingImageModel(modelKey: string): boolean {
  const k = modelKey.trim().toLowerCase();
  return (
    k === "kling-3.0-image" ||
    k.startsWith("kling/kling-v3") ||
    k === "kling-3.0" ||
    k === "kling 3.0"
  );
}

export function isStoryboardKieImageModel(modelKey: string): boolean {
  const k = modelKey.trim().toLowerCase();
  return k.includes("nano-banana") || k === "nanobanana";
}

export function isStoryboardDashscopeImageModel(modelKey: string): boolean {
  const k = modelKey.trim().toLowerCase();
  return (
    (k.startsWith("wan2.7-image") ||
      k === "wan2.6-image" ||
      k === "wan2.6-t2i" ||
      k.includes("wanx")) &&
    !isStoryboardKlingImageModel(modelKey)
  );
}

/** @deprecated 使用 isStoryboardDashscopeImageModel */
export const isStoryboardMultiRefImageModel = isStoryboardDashscopeImageModel;
