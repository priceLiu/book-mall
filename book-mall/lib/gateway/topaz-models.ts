/** Topaz Labs Video API · Gateway 模型登记 */

export const TOPAZ_DEFAULT_API_ROOT = "https://api.topazlabs.com";

export const TOPAZ_LABS_VIDEO_ENHANCE_MODEL_KEY =
  "topaz-labs/video-enhance" as const;

export type TopazFilterModel =
  | "proteus"
  | "starlight-precise-2"
  | "apo-8";

export const TOPAZ_VIDEO_MODELS = [
  {
    modelKey: TOPAZ_LABS_VIDEO_ENHANCE_MODEL_KEY,
    displayName: "Topaz Video Upscale",
    label: "Topaz Labs · 高清视频增强",
    description:
      "Topaz Video API · 视频超分 / 增强（Express 上传 · Proteus / Starlight 等滤镜）",
    role: "VIDEO" as const,
    defaultParams: {
      filter_model: "proteus" as TopazFilterModel,
      upscale_factor: 2,
    },
  },
] as const;

const TOPAZ_MODEL_KEYS = new Set(
  TOPAZ_VIDEO_MODELS.map((m) => m.modelKey.toLowerCase()),
);

export function isTopazLabsVideoModelKey(modelKey: string): boolean {
  return TOPAZ_MODEL_KEYS.has(modelKey.trim().toLowerCase());
}

export function resolveTopazApiRoot(baseUrl?: string | null): string {
  const raw = (baseUrl?.trim() || TOPAZ_DEFAULT_API_ROOT).replace(/\/$/, "");
  return raw || TOPAZ_DEFAULT_API_ROOT;
}

export function topazAuthHeaders(apiKey: string): Record<string, string> {
  return {
    "X-API-Key": apiKey.trim(),
    accept: "application/json",
  };
}
