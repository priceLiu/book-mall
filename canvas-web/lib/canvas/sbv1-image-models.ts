import type { CanvasProviderDto } from "@/lib/canvas-providers-api";
import type { CanvasEnginePick } from "./types";

/** sbv1 / Pro2 图片节点 · IMAGE 白名单（Gateway 登记模型） */
export const SBV1_IMAGE_MODEL_KEYS = [
  /** 与电商主图 / 分镜默认一致 · 多图参考（图生图） */
  "qwen-image-3.0-pro",
  "z-image-turbo",
  "qwen-image-edit",
  "qwen-image-edit-max",
  "wan2.7-image",
  "wan2.7-image-pro",
  "wan2.6-image",
  "nano-banana-pro",
  "kling-3.0-image",
  "4o-image",
  "nano-banana-2",
  "gpt-image-2",
  "google/nano-banana",
  /** 专用图生图 / 编辑 */
  "google/nano-banana-edit",
  "doubao-seedream-5-0-pro",
  "doubao-seedream-5-0-lite",
  "seedream-4.5",
  "seedream-5-lite",
] as const;

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

function isKieGptImageModelKey(modelKey: string): boolean {
  const k = modelKey.trim().toLowerCase();
  return k === "4o-image" || k.startsWith("gpt-image");
}

function isKieNanoBananaModelKey(modelKey: string): boolean {
  return modelKey.trim().toLowerCase().includes("nano-banana");
}

const KIE_NANO_BANANA_ASPECTS = new Set<Sbv1ImageAspectRatio>([
  "1:1",
  "16:9",
  "9:16",
]);

/** Nano Banana Pro 等 KIE 模型仅支持 1:1 / 16:9 / 9:16。 */
export function resolveKieNanoBananaAspectRatio(
  raw: Sbv1ImageAspectRatio | string | undefined,
): "1:1" | "16:9" | "9:16" {
  const r = String(raw ?? "1:1").trim() as Sbv1ImageAspectRatio;
  if (KIE_NANO_BANANA_ASPECTS.has(r)) return r as "1:1" | "16:9" | "9:16";
  if (
    r === "3:4" ||
    r === "2:3" ||
    r === "4:5" ||
    r === "9:21" ||
    r === "1:2"
  ) {
    return "9:16";
  }
  if (
    r === "4:3" ||
    r === "3:2" ||
    r === "5:4" ||
    r === "21:9" ||
    r === "2:1"
  ) {
    return "16:9";
  }
  return "1:1";
}

/** Dock 比例列表：GPT Image 暂不可选 4:5 / 5:4（KIE 422）。 */
export function sbv1ImageAspectOptionsForModel(modelKey: string): {
  value: Sbv1ImageAspectRatio;
  label: string;
}[] {
  const all = SBV1_IMAGE_ASPECT_RATIOS.filter((r) => r.value !== "auto");
  if (isKieGptImageModelKey(modelKey)) {
    return all.filter((r) => r.value !== "4:5" && r.value !== "5:4");
  }
  if (isKieNanoBananaModelKey(modelKey)) {
    return all.filter((r) => KIE_NANO_BANANA_ASPECTS.has(r.value));
  }
  return all;
}

/** 选 GPT / Nano Banana 时把不可用比例就近映射到厂商白名单。 */
export function coerceSbv1ImageAspectForModel(
  modelKey: string,
  aspect: Sbv1ImageAspectRatio,
): Sbv1ImageAspectRatio {
  if (isKieGptImageModelKey(modelKey)) {
    if (aspect === "4:5") return "3:4";
    if (aspect === "5:4") return "4:3";
    return aspect;
  }
  if (isKieNanoBananaModelKey(modelKey)) {
    return resolveKieNanoBananaAspectRatio(aspect);
  }
  return aspect;
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

/** Dock 发送钮 · 补齐仅有 modelKey、缺 providerId 的 engine（默认数据常见） */
export function resolveDockImageEnginePick(
  engine: CanvasEnginePick | undefined,
  providers: CanvasProviderDto[],
  fallback?: () => CanvasEnginePick | null,
): CanvasEnginePick | null {
  const modelKey = engine?.modelKey?.trim();
  const providerId = engine?.providerId?.trim();
  if (providerId && modelKey) {
    return {
      providerId,
      modelKey,
      params: engine?.params ?? {},
    };
  }
  if (modelKey) {
    for (const provider of providers.filter((p) => p.active)) {
      const model = provider.models.find(
        (m) => m.enabled && m.modelKey === modelKey,
      );
      if (model) {
        return {
          providerId: provider.id,
          modelKey: model.modelKey,
          params: engine?.params ?? {},
        };
      }
    }
  }
  return fallback?.() ?? null;
}
