import type { SimpleFusionVariant } from "@/lib/simple-fusion-default-prompts";

export const SIMPLE_FUSION_DEFAULT_FUSION_MODEL = "qwen-image-edit";

export const SIMPLE_FUSION_DEFAULT_VIDEO_MODEL: Record<SimpleFusionVariant, string> = {
  camera: "doubao-seedance-2.0",
  mirror: "doubao-seedance-2.0",
  dance: "happyhorse-1.1-r2v",
};
