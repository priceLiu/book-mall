/** Canvas · Topaz Labs Gateway 模型（VIDEO v2v） */

import type { CanvasParamSchema } from "./types";
import {
  TOPAZ_LABS_VIDEO_ENHANCE_MODEL_KEY,
  TOPAZ_VIDEO_MODELS,
} from "@/lib/gateway/topaz-models";

export const TOPAZ_KNOWN_MODELS = TOPAZ_VIDEO_MODELS.map((m) => ({
  modelKey: m.modelKey,
  displayName: m.displayName,
  role: m.role,
  description: m.description,
  paramsSchema: [
    {
      key: "filter_model",
      label: "增强模型",
      type: "select",
      options: [
        { value: "proteus", label: "Proteus · 精准超分" },
        { value: "starlight-precise-2", label: "Starlight Precise 2" },
        { value: "apo-8", label: "APO-8" },
      ],
      defaultValue: "proteus",
    },
    {
      key: "upscale_factor",
      label: "放大倍数",
      type: "select",
      options: [
        { value: "1", label: "1×" },
        { value: "2", label: "2×" },
        { value: "4", label: "4×" },
      ],
      defaultValue: "2",
    },
  ] satisfies CanvasParamSchema,
  defaultParams: m.defaultParams,
}));

export { TOPAZ_LABS_VIDEO_ENHANCE_MODEL_KEY };

export function isTopazCanvasVideoModelKey(modelKey: string): boolean {
  const k = modelKey.trim().toLowerCase();
  return k === TOPAZ_LABS_VIDEO_ENHANCE_MODEL_KEY || k.startsWith("topaz-labs/");
}
