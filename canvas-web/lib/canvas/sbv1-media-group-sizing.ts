import {
  resolveLibtvMediaNodeBoxSize,
  type LibtvMediaNodeSize,
} from "./libtv-media-node-size";
import type { CanvasFlowNode } from "./types";

/** sbv1 左图右视频 · 标准子节点（含 Pro2 参考图/三视图，不含标签/文本 starter） */
export const SBV1_GROUP_COLUMN_LAYOUT_TYPES = new Set([
  "sbv1-image",
  "story-pro2-image",
  "story-pro2-three-view",
  "sbv1-video-engine",
  "jianying-auto-render-pro2",
]);

export function isSbv1GroupColumnLayoutChild(n: CanvasFlowNode): boolean {
  return SBV1_GROUP_COLUMN_LAYOUT_TYPES.has(n.type ?? "");
}

/** 组内视频列 canonical 尺寸：取各视频引擎 resolveLibtvMediaNodeBoxSize 最大者 */
export function resolveSbv1GroupVideoColumnSize(
  engines: CanvasFlowNode[],
  allNodes: CanvasFlowNode[],
): LibtvMediaNodeSize | null {
  const videos = engines.filter((n) => n.type === "sbv1-video-engine");
  if (videos.length === 0) return null;

  let best: LibtvMediaNodeSize | null = null;
  let bestArea = 0;
  for (const n of videos) {
    const dims = resolveLibtvMediaNodeBoxSize(n, allNodes);
    const area = dims.width * dims.height;
    if (area >= bestArea) {
      bestArea = area;
      best = dims;
    }
  }
  return best;
}

/**
 * 组内媒体单元 · 唯一入口（图/视频/自动成片对齐同一外框）。
 * 有 videoColumnSize 时，标准媒体子节点统一用该尺寸，不再读 node.width 旧值。
 */
export function resolveSbv1GroupMediaCellSize(
  node: CanvasFlowNode,
  allNodes: CanvasFlowNode[],
  videoColumnSize?: LibtvMediaNodeSize | null,
): LibtvMediaNodeSize {
  if (
    videoColumnSize &&
    (isSbv1GroupColumnLayoutChild(node) ||
      node.type === "jianying-auto-render-pro2")
  ) {
    return videoColumnSize;
  }
  return resolveLibtvMediaNodeBoxSize(node, allNodes);
}

/** @deprecated 使用 resolveSbv1GroupMediaCellSize */
export function sbv1GroupVideoChildDimensions(
  node: CanvasFlowNode,
  videoColumnSize: LibtvMediaNodeSize | null,
  allNodes: CanvasFlowNode[],
): LibtvMediaNodeSize {
  return resolveSbv1GroupMediaCellSize(node, allNodes, videoColumnSize);
}

/** @deprecated 使用 resolveSbv1GroupMediaCellSize */
export function sbv1GroupImageCellSize(
  node: CanvasFlowNode,
  videoColumnSize?: LibtvMediaNodeSize | null,
  allNodes?: CanvasFlowNode[],
): LibtvMediaNodeSize {
  return resolveSbv1GroupMediaCellSize(
    node,
    allNodes ?? [],
    videoColumnSize,
  );
}

/** @deprecated 使用 resolveLibtvMediaNodeBoxSize */
export function sbv1VideoEngineDimensions(
  n: CanvasFlowNode,
  allNodes?: CanvasFlowNode[],
): LibtvMediaNodeSize {
  return resolveLibtvMediaNodeBoxSize(n, allNodes);
}
