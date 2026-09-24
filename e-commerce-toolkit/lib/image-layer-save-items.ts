import type { ImageLayerStack } from "@/lib/image-layer-types";

export type ImageLayerSaveItem = {
  id: string;
  label: string;
  url: string;
  filename: string;
  libraryTitle?: string;
};

export function buildSaveItems(
  sourceUrl: string | null,
  stack: ImageLayerStack | null,
  originalImageUrl?: string | null,
): ImageLayerSaveItem[] {
  const stamp = Date.now();
  const items: ImageLayerSaveItem[] = [];

  const flatUrl = sourceUrl?.trim() || stack?.sourceImageUrl?.trim() || null;
  if (flatUrl && !flatUrl.startsWith("blob:")) {
    items.push({
      id: "flat",
      label: stack ? "当前整图（改层 / 重绘结果）" : "当前结果图",
      url: flatUrl,
      filename: `image-layer-result-${stamp}.png`,
      libraryTitle: "图片处理结果",
    });
  }

  const origin = originalImageUrl?.trim() || null;
  if (origin && origin !== flatUrl && !origin.startsWith("blob:")) {
    items.push({
      id: "original",
      label: "原图",
      url: origin,
      filename: `image-layer-original-${stamp}.png`,
    });
  }

  if (stack) {
    const splitOrigin = stack.sourceImageUrl?.trim();
    if (
      splitOrigin &&
      splitOrigin !== stack.background.url &&
      splitOrigin !== origin &&
      splitOrigin !== flatUrl
    ) {
      items.push({
        id: "origin",
        label: "拆分前原图",
        url: splitOrigin,
        filename: `image-layer-source-${stamp}.png`,
      });
    }
    items.push({
      id: "bg",
      label: stack.background.name?.trim() || "底图层",
      url: stack.background.url,
      filename: `image-layer-background-${stamp}.png`,
    });
    stack.layers.forEach((layer, index) => {
      items.push({
        id: layer.id,
        label: layer.name?.trim() || `物体层 ${index + 1}`,
        url: layer.url,
        filename: `image-layer-object-${index + 1}-${stamp}.png`,
      });
    });
  }

  return items;
}
