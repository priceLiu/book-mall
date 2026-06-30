"use client";

import { sbv1ImageChildren } from "./sbv1-media-group-meta";
import {
  SBV1_IMAGE_NODE_WIDTH,
  SBV1_VIDEO_ENGINE_HEIGHT,
  SBV1_VIDEO_ENGINE_WIDTH,
} from "./sbv1-node-chrome";
import { absoluteNodePosition, nodeMeasuredSize, sortNodesForReactFlow } from "./normalize-graph-nodes";
import {
  PRO2_MEDIA_GRID_GAP,
  PRO2_MEDIA_GROUP_EXTRA,
  PRO2_MEDIA_GROUP_HEADER,
  PRO2_MEDIA_GROUP_PAD,
  applyPro2MediaGroupRelayout,
  pro2MediaChildSize,
  pro2MediaGridCols,
  pro2MediaGridLayout,
  pro2MediaGroupDimensions,
} from "./pro2-media-group-layout";
import type { CanvasFlowEdge, CanvasFlowNode } from "./types";

const SBV1_VIDEO_GAP = 48;

function sbv1VideoEngineDimensions(n: CanvasFlowNode): {
  width: number;
  height: number;
} {
  const { w, h } = nodeMeasuredSize(n);
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

function releaseNodeFromGroup(
  node: CanvasFlowNode,
  absPosition: { x: number; y: number },
): CanvasFlowNode {
  const nextData = { ...(node.data as Record<string, unknown>) };
  delete nextData.pro2GroupId;
  return {
    ...node,
    parentId: undefined,
    extent: undefined,
    position: absPosition,
    data: nextData,
  } as CanvasFlowNode;
}

function pickPrimarySbv1GroupEngine(
  engines: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  images: CanvasFlowNode[],
): CanvasFlowNode {
  if (engines.length <= 1) return engines[0]!;
  const imageIds = new Set(images.map((i) => i.id));
  const refCount = (eng: CanvasFlowNode) =>
    edges.filter(
      (e) =>
        e.target === eng.id &&
        imageIds.has(e.source) &&
        (!e.targetHandle || e.targetHandle === "in_ref"),
    ).length;
  return [...engines].sort((a, b) => refCount(b) - refCount(a))[0]!;
}

/** 组内只保留一个视频槽；其余移到组框右侧外，避免叠在同一格 */
function ejectExtraSbv1GroupEngines(
  nodes: CanvasFlowNode[],
  groupId: string,
  keeperId: string,
  group: CanvasFlowNode,
): CanvasFlowNode[] {
  const gw =
    group.width ??
    SBV1_VIDEO_ENGINE_WIDTH + SBV1_IMAGE_NODE_WIDTH + PRO2_MEDIA_GROUP_PAD * 2;
  let outIdx = 0;
  return nodes.map((n) => {
    if (
      n.parentId !== groupId ||
      n.type !== "sbv1-video-engine" ||
      n.id === keeperId
    ) {
      return n;
    }
    const abs = absoluteNodePosition(n, nodes);
    const released = releaseNodeFromGroup(n, {
      x: group.position.x + gw + SBV1_VIDEO_GAP,
      y: abs.y + outIdx * (SBV1_VIDEO_ENGINE_HEIGHT + PRO2_MEDIA_GRID_GAP),
    });
    outIdx += 1;
    return released;
  });
}

function reparentToGroup(
  node: CanvasFlowNode,
  group: CanvasFlowNode,
  allNodes: CanvasFlowNode[],
): CanvasFlowNode {
  const absOf = (n: CanvasFlowNode): { x: number; y: number } => {
    if (!n.parentId) return n.position;
    const p = allNodes.find((x) => x.id === n.parentId);
    if (!p) return n.position;
    const pa = absOf(p);
    return { x: pa.x + n.position.x, y: pa.y + n.position.y };
  };
  const a = absOf(node);
  return {
    ...node,
    parentId: group.id,
    extent: "parent",
    position: { x: a.x - group.position.x, y: a.y - group.position.y },
    data: { ...node.data, pro2GroupId: group.id },
  };
}

/** sbv1 媒体组：参考图宫格 + 右侧视频引擎，组框贴合 */
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
    const existingInside = next.find(
      (n) =>
        n.parentId === groupId &&
        n.type === "sbv1-video-engine" &&
        n.id !== linkedEngine.id,
    );
    if (existingInside) {
      next = ejectExtraSbv1GroupEngines(
        next,
        groupId,
        linkedEngine.id,
        group,
      );
    }
    const reparented = reparentToGroup(linkedEngine, group, next);
    next = next.map((n) => (n.id === reparented.id ? reparented : n));
  }

  let images = next.filter(
    (n) => n.parentId === groupId && n.type === "sbv1-image",
  );
  let engines = next.filter(
    (n) => n.parentId === groupId && n.type === "sbv1-video-engine",
  );

  if (engines.length > 1 && images.length > 0 && group) {
    const keeper = pickPrimarySbv1GroupEngine(engines, edges, images);
    next = ejectExtraSbv1GroupEngines(next, groupId, keeper.id, group);
    engines = next.filter(
      (n) => n.parentId === groupId && n.type === "sbv1-video-engine",
    );
  }

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
      gridContentHeight += (rowHeights[r] ?? defaultCell.height) + (r > 0 ? PRO2_MEDIA_GRID_GAP : 0);
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

  const cols = pro2MediaGridCols(images.length);
  const cell = pro2MediaChildSize({ type: "sbv1-image" });

  for (let i = 0; i < images.length; i++) {
    const child = images[i]!;
    const rel = pro2MediaGridLayout(i, cell, cols);
    next = next.map((n) =>
      n.id === child.id
        ? {
            ...n,
            position: rel,
            width: cell.width,
            height: cell.height,
            style: {
              ...(typeof n.style === "object" && n.style ? n.style : {}),
              width: cell.width,
              height: cell.height,
            },
            data: { ...n.data, pro2GroupId: groupId },
          }
        : n,
    );
  }

  const imageBox = pro2MediaGroupDimensions(images.length, cell, cols);
  const gridContentWidth =
    cols * cell.width + Math.max(0, cols - 1) * PRO2_MEDIA_GRID_GAP;

  const engine =
    engines[0] ??
    next.find(
      (n) => n.parentId === groupId && n.type === "sbv1-video-engine",
    );

  let groupWidth = imageBox.width;
  let groupHeight = imageBox.height;

  if (engine) {
    const engineDims = sbv1VideoEngineDimensions(engine);
    const videoX = PRO2_MEDIA_GROUP_PAD + gridContentWidth + SBV1_VIDEO_GAP;
    const videoY = PRO2_MEDIA_GROUP_PAD + PRO2_MEDIA_GROUP_HEADER;
    next = next.map((n) =>
      n.id === engine.id
        ? {
            ...n,
            position: { x: videoX, y: videoY },
            width: engineDims.width,
            height: engineDims.height,
            style: {
              ...(typeof n.style === "object" && n.style ? n.style : {}),
              width: engineDims.width,
              height: engineDims.height,
            },
            data: { ...n.data, pro2GroupId: groupId },
          }
        : n,
    );
    groupWidth =
      PRO2_MEDIA_GROUP_PAD +
      gridContentWidth +
      SBV1_VIDEO_GAP +
      engineDims.width +
      PRO2_MEDIA_GROUP_PAD +
      PRO2_MEDIA_GROUP_EXTRA;
    groupHeight = Math.max(
      imageBox.height,
      PRO2_MEDIA_GROUP_PAD +
        PRO2_MEDIA_GROUP_HEADER +
        engineDims.height +
        PRO2_MEDIA_GROUP_PAD +
        PRO2_MEDIA_GROUP_EXTRA,
    );
  }

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
