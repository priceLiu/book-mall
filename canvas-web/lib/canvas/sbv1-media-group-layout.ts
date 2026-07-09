"use client";

import {
  isSbv1MediaGroup as isSbv1MediaGroupByMeta,
  sbv1ImageChildren,
} from "./sbv1-media-group-meta";
import {
  SBV1_IMAGE_NODE_HEIGHT,
  SBV1_IMAGE_NODE_WIDTH,
  SBV1_VIDEO_ENGINE_HEIGHT,
  SBV1_VIDEO_ENGINE_WIDTH,
} from "./sbv1-node-chrome";
import { absoluteNodePosition, sortNodesForReactFlow } from "./normalize-graph-nodes";
import {
  PRO2_MEDIA_GRID_GAP,
  PRO2_MEDIA_GROUP_EXTRA,
  PRO2_MEDIA_GROUP_HEADER,
  PRO2_MEDIA_GROUP_LAYOUT_VERSION,
  PRO2_MEDIA_GROUP_PAD,
  applyPro2MediaGroupRelayout,
  mediaGridLayoutForChildren,
  pro2MediaGridCols,
  pro2MediaGroupDimensionsFromLayouts,
} from "./pro2-media-group-layout";
import type { CanvasFlowEdge, CanvasFlowNode } from "./types";

const SBV1_VIDEO_GAP = 48;

/** sbv1 组内参考图 · 统一宫格单元（忽略组外 auto-fit 的大尺寸，除非用户手动拉伸） */
function sbv1GroupImageCellSize(node: CanvasFlowNode): {
  width: number;
  height: number;
} {
  const isCanonicalImageNode =
    node.type === "sbv1-image" ||
    node.type === "story-pro2-image" ||
    node.type === "story-pro2-three-view";
  if (Boolean((node.data as { manualSize?: boolean }).manualSize)) {
    const style = node.style as { width?: number; height?: number } | undefined;
    const w =
      node.measured?.width ??
      (typeof node.width === "number" ? node.width : undefined) ??
      style?.width ??
      SBV1_IMAGE_NODE_WIDTH;
    const h =
      node.measured?.height ??
      (typeof node.height === "number" ? node.height : undefined) ??
      style?.height ??
      SBV1_IMAGE_NODE_HEIGHT;
    return { width: Math.max(1, Math.round(w)), height: Math.max(1, Math.round(h)) };
  }
  if (isCanonicalImageNode) {
    return { width: SBV1_IMAGE_NODE_WIDTH, height: SBV1_IMAGE_NODE_HEIGHT };
  }
  const style = node.style as { width?: number; height?: number } | undefined;
  const w =
    node.measured?.width ??
    (typeof node.width === "number" ? node.width : undefined) ??
    style?.width ??
    320;
  const h =
    node.measured?.height ??
    (typeof node.height === "number" ? node.height : undefined) ??
    style?.height ??
    220;
  return { width: Math.max(1, Math.round(w)), height: Math.max(1, Math.round(h)) };
}

function sbv1VideoEngineDimensions(n: CanvasFlowNode): {
  width: number;
  height: number;
} {
  const w =
    n.measured?.width ??
    (typeof n.width === "number" ? n.width : undefined) ??
    SBV1_VIDEO_ENGINE_WIDTH;
  const h =
    n.measured?.height ??
    (typeof n.height === "number" ? n.height : undefined) ??
    SBV1_VIDEO_ENGINE_HEIGHT;
  if (Boolean((n.data as { manualSize?: boolean }).manualSize)) {
    return { width: w, height: h };
  }
  if (Boolean((n.data as { mediaFit?: boolean }).mediaFit)) {
    return { width: w, height: h };
  }
  return {
    width: SBV1_VIDEO_ENGINE_WIDTH,
    height: SBV1_VIDEO_ENGINE_HEIGHT,
  };
}

/**
 * sbv1 组内「左侧网格」子节点：除视频引擎外的全部可视子节点（图片/标签等）。
 * 混合分组（图片 + 视频 + 标签）若只排 sbv1-image，会出现标签悬浮重叠。
 */
function isSbv1GroupImageChild(n: CanvasFlowNode): boolean {
  return n.type !== "group" && n.type !== "sbv1-video-engine";
}

function sortSbv1GroupChildren(children: CanvasFlowNode[]): CanvasFlowNode[] {
  return [...children].sort((a, b) => {
    const al = (a.data as { label?: string }).label ?? a.id;
    const bl = (b.data as { label?: string }).label ?? b.id;
    return al.localeCompare(bl, "zh");
  });
}

/** 组内参考图已全部连到的视频引擎（可尚未 parent 进组） */
export function findSbv1GroupLinkedVideoEngine(
  groupId: string,
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
): CanvasFlowNode | undefined {
  const inside = nodes.find(
    (n) => n.parentId === groupId && n.type === "sbv1-video-engine",
  );
  if (inside) return inside;

  const images = sbv1ImageChildren(groupId, nodes);
  if (!images.length) return undefined;

  const imageIds = new Set(images.map((n) => n.id));
  const targetCounts = new Map<string, number>();
  for (const e of edges) {
    if (!imageIds.has(e.source)) continue;
    if (e.targetHandle && e.targetHandle !== "in_ref") continue;
    targetCounts.set(e.target, (targetCounts.get(e.target) ?? 0) + 1);
  }

  let best: { node: CanvasFlowNode; count: number } | undefined;
  for (const [targetId, count] of targetCounts) {
    const node = nodes.find((n) => n.id === targetId);
    if (node?.type !== "sbv1-video-engine" || node.parentId === groupId) continue;
    if (!best || count > best.count) best = { node, count };
  }
  return best?.count ? best.node : undefined;
}

function reparentToGroup(
  node: CanvasFlowNode,
  group: CanvasFlowNode,
  allNodes: CanvasFlowNode[],
): CanvasFlowNode {
  const abs = absoluteNodePosition(node, allNodes);
  return {
    ...node,
    parentId: group.id,
    extent: "parent",
    position: { x: abs.x - group.position.x, y: abs.y - group.position.y },
    data: { ...node.data, pro2GroupId: group.id },
  };
}

function applySbv1GroupImageGrid(
  nodes: CanvasFlowNode[],
  groupId: string,
  images: CanvasFlowNode[],
): { nodes: CanvasFlowNode[]; gridContentWidth: number; imageBox: { width: number; height: number } } {
  if (images.length === 0) {
    return {
      nodes,
      gridContentWidth: 0,
      imageBox: { width: 320, height: 240 },
    };
  }

  const cols = pro2MediaGridCols(images.length);
  const layouts = mediaGridLayoutForChildren(images, cols, sbv1GroupImageCellSize);
  let next = nodes;

  for (let i = 0; i < images.length; i++) {
    const child = images[i]!;
    const lay = layouts[i]!;
    next = next.map((n) =>
      n.id === child.id
        ? {
            ...n,
            position: { x: lay.x, y: lay.y },
            width: lay.width,
            height: lay.height,
            style: {
              ...(typeof n.style === "object" && n.style ? n.style : {}),
              width: lay.width,
              height: lay.height,
            },
            data: { ...n.data, pro2GroupId: groupId },
          }
        : n,
    );
  }

  const imageBox = pro2MediaGroupDimensionsFromLayouts(layouts, cols);
  const gridContentWidth = Math.max(
    0,
    ...layouts.map((lay) => lay.x + lay.width - PRO2_MEDIA_GROUP_PAD),
  );

  return { nodes: next, gridContentWidth, imageBox };
}

function applySbv1GroupVideoColumn(
  nodes: CanvasFlowNode[],
  groupId: string,
  engines: CanvasFlowNode[],
  gridContentWidth: number,
): {
  nodes: CanvasFlowNode[];
  maxVideoWidth: number;
  videoColumnHeight: number;
} {
  if (engines.length === 0) {
    return { nodes, maxVideoWidth: 0, videoColumnHeight: 0 };
  }

  const videoX = PRO2_MEDIA_GROUP_PAD + gridContentWidth + SBV1_VIDEO_GAP;
  let videoY = PRO2_MEDIA_GROUP_PAD + PRO2_MEDIA_GROUP_HEADER;
  let maxVideoWidth = 0;
  let videoBottom = videoY;
  let next = nodes;

  for (const engine of engines) {
    const dims = sbv1VideoEngineDimensions(engine);
    next = next.map((n) =>
      n.id === engine.id
        ? {
            ...n,
            position: { x: videoX, y: videoY },
            width: dims.width,
            height: dims.height,
            style: {
              ...(typeof n.style === "object" && n.style ? n.style : {}),
              width: dims.width,
              height: dims.height,
            },
            data: { ...n.data, pro2GroupId: groupId },
          }
        : n,
    );
    maxVideoWidth = Math.max(maxVideoWidth, dims.width);
    videoBottom = videoY + dims.height;
    videoY = videoBottom + PRO2_MEDIA_GRID_GAP;
  }

  return {
    nodes: next,
    maxVideoWidth,
    videoColumnHeight: videoBottom - (PRO2_MEDIA_GROUP_PAD + PRO2_MEDIA_GROUP_HEADER),
  };
}

/** sbv1 媒体组：参考图宫格 + 右侧视频引擎（可多槽竖排），组框贴合 */
export function applySbv1MediaGroupRelayout(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  groupId: string,
): CanvasFlowNode[] {
  const group = nodes.find((n) => n.id === groupId && n.type === "group");
  if (!group || !isSbv1MediaGroupByMeta(group, nodes)) {
    return applyPro2MediaGroupRelayout(nodes, groupId);
  }

  let next = [...nodes];
  const linkedEngine = findSbv1GroupLinkedVideoEngine(groupId, next, edges);
  if (linkedEngine && linkedEngine.parentId !== groupId && group) {
    const reparented = reparentToGroup(linkedEngine, group, next);
    next = next.map((n) => (n.id === reparented.id ? reparented : n));
  }

  const images = sortSbv1GroupChildren(
    next.filter((n) => n.parentId === groupId && isSbv1GroupImageChild(n)),
  );
  const engines = sortSbv1GroupChildren(
    next.filter((n) => n.parentId === groupId && n.type === "sbv1-video-engine"),
  );
  const allChildren = sortSbv1GroupChildren(
    next.filter((n) => n.parentId === groupId && n.type !== "group"),
  );

  if (allChildren.length === 0) {
    return sortNodesForReactFlow(next);
  }

  const hasMixedContent = allChildren.some(
    (n) => n.type !== "sbv1-image" && n.type !== "sbv1-video-engine",
  );
  if (hasMixedContent) {
    const cols = pro2MediaGridCols(allChildren.length);
    const layouts = mediaGridLayoutForChildren(allChildren, cols, (n) =>
      n.type === "sbv1-video-engine"
        ? sbv1VideoEngineDimensions(n)
        : sbv1GroupImageCellSize(n),
    );
    for (let i = 0; i < allChildren.length; i++) {
      const child = allChildren[i]!;
      const lay = layouts[i]!;
      next = next.map((n) =>
        n.id === child.id
          ? {
              ...n,
              position: { x: lay.x, y: lay.y },
              width: lay.width,
              height: lay.height,
              style: {
                ...(typeof n.style === "object" && n.style ? n.style : {}),
                width: lay.width,
                height: lay.height,
              },
              data: { ...n.data, pro2GroupId: groupId },
            }
          : n,
      );
    }
    const { width: groupWidth, height: groupHeight } =
      pro2MediaGroupDimensionsFromLayouts(layouts, cols);
    next = next.map((n) =>
      n.id === groupId
        ? {
            ...n,
            width: groupWidth,
            height: groupHeight,
            style: {
              ...(typeof n.style === "object" && n.style ? n.style : {}),
              width: groupWidth,
              height: groupHeight,
            },
            data: {
              ...(n.data as Record<string, unknown>),
              pro2LayoutVersion: PRO2_MEDIA_GROUP_LAYOUT_VERSION,
            },
          }
        : n,
    );
    return sortNodesForReactFlow(next);
  }

  if (images.length === 0 && engines.length > 0) {
    const cols = pro2MediaGridCols(engines.length);
    const layouts = mediaGridLayoutForChildren(
      engines,
      cols,
      sbv1VideoEngineDimensions,
    );
    for (let i = 0; i < engines.length; i++) {
      const engine = engines[i]!;
      const lay = layouts[i]!;
      next = next.map((n) =>
        n.id === engine.id
          ? {
              ...n,
              position: { x: lay.x, y: lay.y },
              width: lay.width,
              height: lay.height,
              style: {
                ...(typeof n.style === "object" && n.style ? n.style : {}),
                width: lay.width,
                height: lay.height,
              },
              data: { ...n.data, pro2GroupId: groupId },
            }
          : n,
      );
    }

    const { width: groupWidth, height: groupHeight } =
      pro2MediaGroupDimensionsFromLayouts(layouts, cols);
    next = next.map((n) =>
      n.id === groupId
        ? {
            ...n,
            width: groupWidth,
            height: groupHeight,
            style: {
              ...(typeof n.style === "object" && n.style ? n.style : {}),
              width: groupWidth,
              height: groupHeight,
            },
            data: {
              ...(n.data as Record<string, unknown>),
              pro2LayoutVersion: PRO2_MEDIA_GROUP_LAYOUT_VERSION,
            },
          }
        : n,
    );
    return sortNodesForReactFlow(next);
  }

  const { nodes: withImages, gridContentWidth, imageBox } = applySbv1GroupImageGrid(
    next,
    groupId,
    images,
  );
  next = withImages;

  const { nodes: withVideos, maxVideoWidth, videoColumnHeight } =
    applySbv1GroupVideoColumn(next, groupId, engines, gridContentWidth);
  next = withVideos;

  const groupWidth =
    engines.length > 0
      ? PRO2_MEDIA_GROUP_PAD +
        gridContentWidth +
        SBV1_VIDEO_GAP +
        maxVideoWidth +
        PRO2_MEDIA_GROUP_PAD +
        PRO2_MEDIA_GROUP_EXTRA
      : imageBox.width;
  const groupHeight =
    engines.length > 0
      ? Math.max(
          imageBox.height,
          PRO2_MEDIA_GROUP_PAD +
            PRO2_MEDIA_GROUP_HEADER +
            videoColumnHeight +
            PRO2_MEDIA_GROUP_PAD +
            PRO2_MEDIA_GROUP_EXTRA,
        )
      : imageBox.height;

  next = next.map((n) =>
    n.id === groupId
      ? {
          ...n,
          width: groupWidth,
          height: groupHeight,
          style: {
            ...(typeof n.style === "object" && n.style ? n.style : {}),
            width: groupWidth,
            height: groupHeight,
          },
          data: {
            ...(n.data as Record<string, unknown>),
            pro2LayoutVersion: PRO2_MEDIA_GROUP_LAYOUT_VERSION,
          },
        }
      : n,
  );

  return sortNodesForReactFlow(next);
}

export function relayoutSbv1MediaGroup(
  setNodes: (fn: (nodes: CanvasFlowNode[]) => CanvasFlowNode[]) => void,
  groupId: string,
  edges: CanvasFlowEdge[],
): void {
  setNodes((nodes) => applySbv1MediaGroupRelayout(nodes, edges, groupId));
}
