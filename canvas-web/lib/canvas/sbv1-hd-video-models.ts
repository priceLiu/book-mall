/**
 * 分镜视频 1.0 · Topaz Labs 高清视频（Gateway TOPAZ · video v2v）
 */

import type { CanvasEnginePick } from "./types";
import { GATEWAY_TOPAZ_PROVIDER_ID } from "./system-providers";

export const TOPAZ_LABS_VIDEO_ENHANCE_MODEL_KEY =
  "topaz-labs/video-enhance" as const;

export const SBV1_HD_VIDEO_ENGINE_PRESET: CanvasEnginePick = {
  providerId: GATEWAY_TOPAZ_PROVIDER_ID,
  modelKey: TOPAZ_LABS_VIDEO_ENHANCE_MODEL_KEY,
  params: {
    filter_model: "proteus",
    frame_interpolation: "none",
    slowmo: 1,
  },
};

export function buildSbv1HdVideoEngineNodeData(
  overrides?: Record<string, unknown>,
): Record<string, unknown> {
  return {
    label: "高清视频",
    creationType: "hd-video",
    prompt: "",
    engine: { ...SBV1_HD_VIDEO_ENGINE_PRESET },
    aspectRatio: "16:9",
    durationSec: 15,
    resolution: "1080p",
    referenceMode: "omni",
    refSlots: [],
    ...overrides,
  };
}
