import {
  ECOM_WANX_PAINTING_MODEL_KEY,
  isQwenEditModelKey,
  isWanxPaintingModelKey,
} from "@/lib/ecom/ecom-image-processing-models";

import { isWan27LocalEditModel } from "./model-capabilities";
import type { LocalEditSelection } from "./types";

/**
 * 画布重绘 / 常用工具 AI 修图 · 统一模型路由。
 * 涂抹蒙版须走万相局部重绘（mask_image_url）；千问编辑无原生蒙版字段。
 */
export function resolveRetouchModelForSelection(opts: {
  model: string;
  selection?: LocalEditSelection;
}): string {
  const model = opts.model.trim();
  const selection = opts.selection;

  if (selection?.kind === "mask") {
    if (isWanxPaintingModelKey(model)) return model;
    if (isQwenEditModelKey(model) || isWan27LocalEditModel(model)) {
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
