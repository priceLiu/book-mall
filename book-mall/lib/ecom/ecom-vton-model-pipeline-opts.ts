import { ecomRatioFromPixelSize } from "@/lib/ecom/ecom-storyboard-gen-params";
import { ECOM_VTON_MODEL_GEN_MODEL } from "@/lib/ecom/ecom-vton/types";
import {
  buildVtonModelPipelineDescribeAppend,
  mergeVtonModelPipelinePrompt,
  type VtonModelBodyMetrics,
} from "@/lib/ecom/ecom-vton-model-body-preset";
import {
  buildVtonFullBodyExpandPrompt,
  buildVtonModelGeneratePrompt,
} from "@/lib/ecom/ecom-vton/prompts";

export type VtonModelPipelineRequestOpts = {
  prompt?: string;
  imageSize?: string;
  modelKey?: string;
  ratio?: "1:1" | "3:4" | "4:5" | "16:9" | "9:16";
  bodyPreset?: string;
  ageGroup?: string;
  featureDetail?: string;
  metrics?: VtonModelBodyMetrics;
};

function readRatio(raw: unknown, imageSize?: string): "1:1" | "3:4" | "4:5" | "16:9" | "9:16" {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (s === "1:1" || s === "3:4" || s === "4:5" || s === "16:9" || s === "9:16") return s;
  const fromSize = ecomRatioFromPixelSize(imageSize);
  if (fromSize === "9:16") return "9:16";
  return fromSize;
}

function readMetrics(body: Record<string, unknown>): VtonModelBodyMetrics | undefined {
  const m = body.metrics;
  if (!m || typeof m !== "object" || Array.isArray(m)) {
    return {
      heightCm: typeof body.heightCm === "string" ? body.heightCm : undefined,
      weightKg: typeof body.weightKg === "string" ? body.weightKg : undefined,
      bustCm: typeof body.bustCm === "string" ? body.bustCm : undefined,
      waistCm: typeof body.waistCm === "string" ? body.waistCm : undefined,
      hipsCm: typeof body.hipsCm === "string" ? body.hipsCm : undefined,
    };
  }
  const o = m as Record<string, unknown>;
  return {
    heightCm: typeof o.heightCm === "string" ? o.heightCm : undefined,
    weightKg: typeof o.weightKg === "string" ? o.weightKg : undefined,
    bustCm: typeof o.bustCm === "string" ? o.bustCm : undefined,
    waistCm: typeof o.waistCm === "string" ? o.waistCm : undefined,
    hipsCm: typeof o.hipsCm === "string" ? o.hipsCm : undefined,
  };
}

export function parseVtonModelPipelineRequest(body: Record<string, unknown>): VtonModelPipelineRequestOpts {
  const imageSize = typeof body.imageSize === "string" ? body.imageSize.trim() : undefined;
  return {
    prompt: typeof body.prompt === "string" ? body.prompt.trim() : undefined,
    imageSize,
    modelKey:
      typeof body.modelKey === "string" && body.modelKey.trim()
        ? body.modelKey.trim()
        : undefined,
    ratio: readRatio(body.ratio, imageSize),
    bodyPreset: typeof body.bodyPreset === "string" ? body.bodyPreset.trim() : undefined,
    ageGroup: typeof body.ageGroup === "string" ? body.ageGroup.trim() : undefined,
    featureDetail: typeof body.featureDetail === "string" ? body.featureDetail.trim() : undefined,
    metrics: readMetrics(body),
  };
}

export function resolveVtonModelGeneratePrompt(opts: VtonModelPipelineRequestOpts): string {
  const describe = buildVtonModelPipelineDescribeAppend(opts);
  const userPrompt = opts.prompt?.trim();
  const mergedUser = mergeVtonModelPipelinePrompt(userPrompt ?? "", describe);
  return buildVtonModelGeneratePrompt(mergedUser || undefined);
}

export function resolveVtonModelExpandPrompt(
  opts: VtonModelPipelineRequestOpts,
  layout?: Parameters<typeof buildVtonFullBodyExpandPrompt>[1],
): string {
  const describe = buildVtonModelPipelineDescribeAppend(opts);
  const userPrompt = opts.prompt?.trim();
  const mergedUser = mergeVtonModelPipelinePrompt(userPrompt ?? "", describe);
  return buildVtonFullBodyExpandPrompt(mergedUser || undefined, layout);
}

export function resolveVtonModelPipelineModelKey(opts: VtonModelPipelineRequestOpts): string {
  return opts.modelKey?.trim() || ECOM_VTON_MODEL_GEN_MODEL;
}

export type VtonModelPipelineSettingsLike = {
  modelImageSize?: string;
  modelGenModelKey?: string;
  modelGenRatio?: string;
  modelBodyPreset?: string;
  modelAgeGroup?: string;
  modelFeatureDetail?: string;
  modelHeightCm?: string;
  modelWeightKg?: string;
  modelBustCm?: string;
  modelWaistCm?: string;
  modelHipsCm?: string;
};

export function vtonModelPipelineFromSettings(
  settings: VtonModelPipelineSettingsLike,
): VtonModelPipelineRequestOpts {
  const imageSize = settings.modelImageSize?.trim() || undefined;
  return {
    imageSize,
    modelKey: settings.modelGenModelKey?.trim() || undefined,
    ratio: readRatio(settings.modelGenRatio, imageSize),
    bodyPreset: settings.modelBodyPreset?.trim() || undefined,
    ageGroup: settings.modelAgeGroup?.trim() || undefined,
    featureDetail: settings.modelFeatureDetail?.trim() || undefined,
    metrics: {
      heightCm: settings.modelHeightCm?.trim() || undefined,
      weightKg: settings.modelWeightKg?.trim() || undefined,
      bustCm: settings.modelBustCm?.trim() || undefined,
      waistCm: settings.modelWaistCm?.trim() || undefined,
      hipsCm: settings.modelHipsCm?.trim() || undefined,
    },
  };
}

export function mergeVtonModelPipelineRequest(
  base: VtonModelPipelineRequestOpts,
  override?: VtonModelPipelineRequestOpts,
): VtonModelPipelineRequestOpts {
  if (!override) return base;
  const imageSize = override.imageSize ?? base.imageSize;
  return {
    prompt: override.prompt ?? base.prompt,
    imageSize,
    modelKey: override.modelKey ?? base.modelKey,
    ratio: override.ratio ?? base.ratio ?? readRatio(undefined, imageSize),
    bodyPreset: override.bodyPreset ?? base.bodyPreset,
    ageGroup: override.ageGroup ?? base.ageGroup,
    featureDetail: override.featureDetail ?? base.featureDetail,
    metrics: { ...base.metrics, ...override.metrics },
  };
}
