import {
  ECOM_WANX_PAINTING_MODEL_KEY,
  isQwenEditModelKey,
  isWanxPaintingModelKey,
} from "@/lib/ecom/ecom-image-processing-models";

import { isWan27LocalEditModel } from "./model-capabilities";
import type { LocalEditSelection } from "./types";

/**
 * 画布重绘 / 常用工具 AI 修图 · 统一模型路由。
 * 千问把蒙版当第二张参考图，不再改打 wanx-x-painting。
 * 万相 2.7 只吃 bbox；笔刷蒙版才回退到万相局部重绘。
 */
export function resolveRetouchModelForSelection(opts: {
  model: string;
  selection?: LocalEditSelection;
}): string {
  const model = opts.model.trim();
  const selection = opts.selection;

  if (selection?.kind === "mask") {
    if (isWanxPaintingModelKey(model) || isQwenEditModelKey(model)) {
      return model;
    }
    if (isWan27LocalEditModel(model)) {
      return ECOM_WANX_PAINTING_MODEL_KEY;
    }
    return ECOM_WANX_PAINTING_MODEL_KEY;
  }

  if (
    (selection?.kind === "bbox" || selection?.kind === "multi-bbox") &&
    isWan27LocalEditModel(model)
  ) {
    return model;
  }

  return model;
}
