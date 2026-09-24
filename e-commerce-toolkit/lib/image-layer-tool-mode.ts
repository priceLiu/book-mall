/** 图片分层 · 画布工具模式（顶栏切换，互斥） */
export type ImageLayerCanvasToolMode =
  | "layer-view"
  | "bg-replace"
  | "retouch"
  | "erase"
  | "decompose-bbox";

/** 擦除 / 重绘 · 选区子工具 */
export type ImageLayerSelectionSubTool = "brush" | "eraser" | "bbox";

export const IMAGE_LAYER_RETOUCH_MODEL_KEYS = [
  "qwen-image-edit",
  "qwen-image-edit-max",
  "wanx-x-painting",
  "wan2.7-image-pro",
] as const;

export function isWanxPaintingRetouchModel(modelKey: string): boolean {
  return modelKey === "wanx-x-painting";
}

export function isWan27RetouchModel(modelKey: string): boolean {
  return modelKey === "wan2.7-image-pro";
}

export function isQwenRetouchModel(modelKey: string): boolean {
  return modelKey === "qwen-image-edit" || modelKey === "qwen-image-edit-max";
}

/** 重绘模型决定的画布选区模式 */
export function retouchCanvasMaskMode(
  modelKey: string,
): "mask" | "bbox" {
  return isWan27RetouchModel(modelKey) ? "bbox" : "mask";
}
