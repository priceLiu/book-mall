import type { CanvasProviderDto } from "@/lib/canvas-providers-api";
import type { CanvasEnginePick } from "./types";

/** sbv1 图片节点 · 首期固定 KIE nano-banana-pro（Lib Image） */
export const SBV1_IMAGE_MODEL_KEYS = ["nano-banana-pro"] as const;

export type Sbv1ImageQuality = "low" | "standard" | "high";

export type Sbv1ImageResolution = "1K" | "2K" | "4K";

export type Sbv1ImageAspectRatio =
  | "auto"
  | "1:1"
  | "1:2"
  | "2:1"
  | "9:16"
  | "16:9"
  | "3:4"
  | "4:3"
  | "3:2"
  | "2:3"
  | "5:4"
  | "4:5"
  | "21:9"
  | "9:21";

export const SBV1_IMAGE_QUALITIES: {
  value: Sbv1ImageQuality;
  label: string;
}[] = [
  { value: "low", label: "低画质" },
  { value: "standard", label: "标准画质" },
  { value: "high", label: "高画质" },
];

export const SBV1_IMAGE_RESOLUTIONS: {
  value: Sbv1ImageResolution;
  label: string;
}[] = [
  { value: "1K", label: "1K" },
  { value: "2K", label: "2K" },
  { value: "4K", label: "4K" },
];

export const SBV1_IMAGE_ASPECT_RATIOS: {
  value: Sbv1ImageAspectRatio;
  label: string;
}[] = [
  { value: "auto", label: "自适应" },
  { value: "1:1", label: "1:1" },
  { value: "1:2", label: "1:2" },
  { value: "2:1", label: "2:1" },
  { value: "9:16", label: "9:16" },
  { value: "16:9", label: "16:9" },
  { value: "3:4", label: "3:4" },
  { value: "4:3", label: "4:3" },
  { value: "3:2", label: "3:2" },
  { value: "2:3", label: "2:3" },
  { value: "5:4", label: "5:4" },
  { value: "4:5", label: "4:5" },
  { value: "21:9", label: "21:9" },
  { value: "9:21", label: "9:21" },
];

export const SBV1_IMAGE_OUTPUT_COUNTS = [1, 2, 3, 4] as const;

export function sbv1ImageAspectRatioLabel(ratio: Sbv1ImageAspectRatio): string {
  const hit = SBV1_IMAGE_ASPECT_RATIOS.find((x) => x.value === ratio);
  return hit?.label ?? ratio;
}

export function sbv1ImageQualityLabel(q: Sbv1ImageQuality): string {
  return SBV1_IMAGE_QUALITIES.find((x) => x.value === q)?.label ?? q;
}

/** 写入 Gateway / KIE createTask params */
export function buildSbv1ImageEngineParams(data: {
  aspectRatio?: Sbv1ImageAspectRatio;
  imageQuality?: Sbv1ImageQuality;
  resolution?: Sbv1ImageResolution;
  outputCount?: number;
}): Record<string, unknown> {
  const aspectRatio = data.aspectRatio ?? "auto";
  const resolution = data.resolution ?? "2K";
  const quality = data.imageQuality ?? "standard";
  const outputCount = Math.min(4, Math.max(1, data.outputCount ?? 1));

  const params: Record<string, unknown> = {
    resolution: resolution === "4K" ? "4K" : resolution === "1K" ? "1K" : "2K",
    output_format: "png",
  };

  if (aspectRatio !== "auto") {
    params.aspect_ratio = aspectRatio;
  }

  if (quality === "high") {
    params.quality = "high";
  } else if (quality === "low") {
    params.quality = "medium";
  }

  if (outputCount > 1) {
    params.n = outputCount;
  }

  return params;
}

export function resolveSbv1ImageAspectForApi(
  aspectRatio: Sbv1ImageAspectRatio | undefined,
  hasRefs: boolean,
): string | undefined {
  const raw = aspectRatio ?? "auto";
  if (raw === "auto") {
    return hasRefs ? undefined : "1:1";
  }
  return raw;
}

export function pickDefaultSbv1ImageEngine(
  providers: CanvasProviderDto[],
): CanvasEnginePick | null {
  for (const provider of providers.filter((p) => p.active)) {
    for (const key of SBV1_IMAGE_MODEL_KEYS) {
      const model = provider.models.find(
        (m) => m.role === "IMAGE" && m.enabled && m.modelKey === key,
      );
      if (model) {
        return {
          providerId: provider.id,
          modelKey: model.modelKey,
          params: buildSbv1ImageEngineParams({}),
        };
      }
    }
  }
  return null;
}
