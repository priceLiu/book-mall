import type { ImageLayerWorkspace } from "@/lib/image-layer-types";

export function resolvePendingBboxes(
  ws: Pick<ImageLayerWorkspace, "pendingBboxes" | "pendingBbox">,
): Array<[number, number, number, number]> {
  if (ws.pendingBboxes?.length) return ws.pendingBboxes;
  if (ws.pendingBbox) return [ws.pendingBbox];
  return [];
}
