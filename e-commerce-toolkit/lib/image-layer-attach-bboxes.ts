import type { ImageLayerStack } from "@/lib/image-layer-types";

/** 拆分请求带的框：若厂商未回 bbox，贴到物体层避免整图叠在底图上 */
export function attachPendingBboxesToStack(
  stack: ImageLayerStack,
  pendingBboxes: Array<[number, number, number, number]>,
): ImageLayerStack {
  if (pendingBboxes.length === 0) return stack;
  const layers = stack.layers.map((layer, index) => {
    if (layer.bbox?.normalized?.length === 4) return layer;
    const bbox = pendingBboxes[index] ?? pendingBboxes[pendingBboxes.length - 1];
    if (!bbox) return layer;
    return { ...layer, bbox: { normalized: bbox } };
  });
  return { ...stack, layers };
}
