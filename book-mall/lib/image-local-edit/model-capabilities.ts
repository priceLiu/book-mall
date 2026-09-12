import {
  ECOM_WANX_PAINTING_MODEL_KEY,
  isQwenEditModelKey,
  isWanxPaintingModelKey,
} from "@/lib/ecom/ecom-image-processing-models";
import type { LocalEditBbox } from "./types";

export type LocalEditSelectionMode = "mask" | "bbox" | "mask-optional";

export const LOCAL_EDIT_WAN27_MODEL_KEY = "wan2.7-image-pro";

export function isWan27LocalEditModel(modelKey: string): boolean {
  return modelKey.trim().toLowerCase() === LOCAL_EDIT_WAN27_MODEL_KEY;
}

export function getLocalEditSelectionMode(modelKey: string): LocalEditSelectionMode {
  if (isWanxPaintingModelKey(modelKey)) return "mask";
  if (isWan27LocalEditModel(modelKey)) return "bbox";
  if (isQwenEditModelKey(modelKey)) return "mask-optional";
  throw new Error("不支持的局部编辑模型");
}

export function assertLocalEditSelection(
  modelKey: string,
  selection?: { kind: string },
): void {
  const mode = getLocalEditSelectionMode(modelKey);
  if (mode === "mask") {
    if (selection?.kind !== "mask") {
      throw new Error(`${ECOM_WANX_PAINTING_MODEL_KEY} 局部重绘需要涂抹蒙版`);
    }
  }
  if (mode === "bbox") {
    if (selection?.kind !== "bbox" && selection?.kind !== "multi-bbox") {
      throw new Error("万相 2.7 Pro 局部重绘需要框选区域");
    }
  }
}

/** wan2.7 每图最多 2 个框 */
export const WAN27_MAX_BBOX_PER_IMAGE = 2;

export function normalizeBbox(raw: LocalEditBbox): LocalEditBbox {
  const [x1, y1, x2, y2] = raw;
  return [
    Math.min(x1, x2),
    Math.min(y1, y2),
    Math.max(x1, x2),
    Math.max(y1, y2),
  ];
}

export function validateBbox(raw: LocalEditBbox, imageW: number, imageH: number): void {
  const [x1, y1, x2, y2] = normalizeBbox(raw);
  if (x2 - x1 < 4 || y2 - y1 < 4) {
    throw new Error("框选区域过小");
  }
  if (x1 < 0 || y1 < 0 || x2 > imageW || y2 > imageH) {
    throw new Error("框选坐标超出图片范围");
  }
}
