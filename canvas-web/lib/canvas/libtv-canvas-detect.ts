import { isPro2StyledGroup } from "./pro2-media-group-meta";
import { isSbv1MediaGroup } from "./sbv1-media-group-meta";
import { hasSbv1Pipeline } from "./sbv1-pipeline";
import { hasStoryPro2Pipeline } from "./story-pro2-pipeline";
import type { CanvasFlowNode } from "./types";

/** LibTV 媒体节点（Pro2 / sbv1 共用壳，非 story-pro 列节点） */
const LIBTV_MEDIA_NODE_TYPES = new Set([
  "story-pro2-image",
  "story-pro2-three-view",
  "story-pro2-style-asset",
  "story-pro2-audio",
  "sbv1-image",
  "sbv1-video-engine",
]);

/** 画布是否含 LibTV 媒体节点或 Pro2/sbv1 媒体组（用于外壳 / 交互特性，不仅限于 starter 流水线） */
export function hasLibtvMediaCanvasNodes(nodes: CanvasFlowNode[]): boolean {
  if (hasStoryPro2Pipeline(nodes) || hasSbv1Pipeline(nodes)) return true;
  for (const n of nodes) {
    if (LIBTV_MEDIA_NODE_TYPES.has(n.type ?? "")) return true;
    if (n.type === "group") {
      if (isPro2StyledGroup(n, nodes) || isSbv1MediaGroup(n, nodes)) {
        return true;
      }
    }
  }
  return false;
}

/** 仅 sbv1 轨道节点 + 组，无 Pro2 媒体组 / Pro2 节点 */
export function hasOnlySbv1LibtvCanvas(nodes: CanvasFlowNode[]): boolean {
  if (!hasSbv1Pipeline(nodes)) return false;
  if (hasStoryPro2Pipeline(nodes)) return false;
  return !nodes.some(
    (n) => n.type === "group" && isPro2StyledGroup(n, nodes),
  );
}
