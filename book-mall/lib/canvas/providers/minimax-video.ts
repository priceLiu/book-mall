/**
 * Canvas · MiniMax H3 视频模型清单
 */

import type { CanvasGatewayListModelsResult } from "./types";
import { MINIMAX_VIDEO_KNOWN_MODELS } from "@/lib/gateway/minimax-video-models";

export const MINIMAX_VIDEO_KNOWN_MODELS_CANVAS: CanvasGatewayListModelsResult["models"] =
  MINIMAX_VIDEO_KNOWN_MODELS.map((m) => ({
    modelKey: m.modelKey,
    displayName: m.displayName,
    role: "VIDEO",
    description: m.description,
    paramsSchema: m.paramsSchema,
    defaultParams: m.defaultParams,
  }));

export function isMinimaxCanvasVideoModelKey(modelKey: string): boolean {
  const k = modelKey.trim().toLowerCase();
  return MINIMAX_VIDEO_KNOWN_MODELS.some(
    (m) => m.modelKey.toLowerCase() === k,
  );
}
