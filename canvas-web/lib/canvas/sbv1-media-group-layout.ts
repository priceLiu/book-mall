"use client";

import { sbv1ImageChildren } from "./sbv1-media-group-meta";
import {
  SBV1_VIDEO_ENGINE_HEIGHT,
  SBV1_VIDEO_ENGINE_WIDTH,
} from "./sbv1-node-chrome";
import { absoluteNodePosition, sortNodesForReactFlow } from "./normalize-graph-nodes";
import {
  PRO2_MEDIA_GRID_GAP,
  PRO2_MEDIA_GROUP_EXTRA,
  PRO2_MEDIA_GROUP_HEADER,
  PRO2_MEDIA_GROUP_PAD,
  applyPro2MediaGroupRelayout,
  pro2MediaGridCols,
  pro2MediaGridLayout,
  pro2MediaGridLayoutForChildren,
  pro2MediaGroupDimensionsFromLayouts,
} from "./pro2-media-group-layout";
import type { CanvasFlowEdge, CanvasFlowNode } from "./types";

const SBV1_VIDEO_GAP = 48;

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

function isSbv1MediaGroup(group: CanvasFlowNode | undefined): boolean {
  if (!group || group.type !== "group") return false;
  return Boolean((group.data as { sbv1Styled?: boolean }).sbv1Styled);
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

  for (const [targetId, count] of targetCounts) {
    if (count !== images.length) continue;
    const node = nodes.find((n) => n.id === targetId);
    if (node?.type === "sbv1-video-engine" && node.parentId !== groupId) {
      return node;
    }
  }
  return undefined;
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
  const layouts = pro2MediaGridLayoutForChildren(images, cols);
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
  if (!isSbv1MediaGroup(group)) {
    return applyPro2MediaGroupRelayout(nodes, groupId);
  }

  let next = [...nodes];
  const linkedEngine = findSbv1GroupLinkedVideoEngine(groupId, next, edges);
  if (linkedEngine && linkedEngine.parentId !== groupId && group) {
    const reparented = reparentToGroup(linkedEngine, group, next);
    next = next.map((n) => (n.id === reparented.id ? reparented : n));
  }

  const images = sortSbv1GroupChildren(
    next.filter((n) => n.parentId === groupId && n.type === "sbv1-image"),
  );
  const engines = sortSbv1GroupChildren(
    next.filter((n) => n.parentId === groupId && n.type === "sbv1-video-engine"),
  );

  if (images.length === 0 && engines.length === 0) {
    return sortNodesForReactFlow(next);
  }

  if (images.length === 0 && engines.length > 0) {
    const defaultCell = {
      width: SBV1_VIDEO_ENGINE_WIDTH,
      height: SBV1_VIDEO_ENGINE_HEIGHT,
    };
    const cols = pro2MediaGridCols(engines.length);
    const engineDimsList = engines.map((e) => sbv1VideoEngineDimensions(e));
    const rowHeights: number[] = [];

    for (let i = 0; i < engines.length; i++) {
      const engine = engines[i]!;
      const dims = engineDimsList[i]!;
      const row = Math.floor(i / cols);
      rowHeights[row] = Math.max(rowHeights[row] ?? 0, dims.height);
      const rel = pro2MediaGridLayout(i, defaultCell, cols);
      next = next.map((n) =>
        n.id === engine.id
          ? {
              ...n,
              position: rel,
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
    }

    const gridContentWidth =
      cols * defaultCell.width + Math.max(0, cols - 1) * PRO2_MEDIA_GRID_GAP;
    const rows = Math.ceil(engines.length / cols);
    let gridContentHeight = 0;
    for (let r = 0; r < rows; r++) {
      gridContentHeight +=
        (rowHeights[r] ?? defaultCell.height) + (r > 0 ? PRO2_MEDIA_GRID_GAP : 0);
    }

    const groupWidth =
      PRO2_MEDIA_GROUP_PAD * 2 + gridContentWidth + PRO2_MEDIA_GROUP_EXTRA;
    const groupHeight =
      PRO2_MEDIA_GROUP_PAD * 2 +
      PRO2_MEDIA_GROUP_HEADER +
      gridContentHeight +
      PRO2_MEDIA_GROUP_EXTRA;
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
