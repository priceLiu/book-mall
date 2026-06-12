"use client";

import { sbv1ImageChildren } from "./sbv1-media-group-meta";
import {
  SBV1_VIDEO_ENGINE_MIN_HEIGHT,
  SBV1_VIDEO_ENGINE_WIDTH,
} from "./sbv1-node-chrome";
import { sortNodesForReactFlow } from "./normalize-graph-nodes";
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
    const reparented = reparentToGroup(linkedEngine, group, next);
    next = next.map((n) => (n.id === reparented.id ? reparented : n));
  }

  let images = next.filter(
    (n) => n.parentId === groupId && n.type === "sbv1-image",
  );
  let engines = next.filter(
    (n) => n.parentId === groupId && n.type === "sbv1-video-engine",
  );

  if (images.length === 0 && engines.length === 0) {
    return sortNodesForReactFlow(next);
  }

  if (images.length === 0 && engines.length > 0) {
    for (let i = 0; i < engines.length; i++) {
      const engine = engines[i]!;
      const y =
        PRO2_MEDIA_GROUP_PAD +
        PRO2_MEDIA_GROUP_HEADER +
        i * (SBV1_VIDEO_ENGINE_MIN_HEIGHT + PRO2_MEDIA_GRID_GAP);
      next = next.map((n) =>
        n.id === engine.id
          ? {
              ...n,
              position: { x: PRO2_MEDIA_GROUP_PAD, y },
              width: SBV1_VIDEO_ENGINE_WIDTH,
              height: SBV1_VIDEO_ENGINE_MIN_HEIGHT,
              style: {
                ...(typeof n.style === "object" && n.style ? n.style : {}),
                width: SBV1_VIDEO_ENGINE_WIDTH,
                height: SBV1_VIDEO_ENGINE_MIN_HEIGHT,
              },
              data: { ...n.data, pro2GroupId: groupId },
            }
          : n,
      );
    }
    const groupWidth =
      PRO2_MEDIA_GROUP_PAD * 2 +
      SBV1_VIDEO_ENGINE_WIDTH +
      PRO2_MEDIA_GROUP_EXTRA;
    const groupHeight =
      PRO2_MEDIA_GROUP_PAD * 2 +
      PRO2_MEDIA_GROUP_HEADER +
      engines.length * SBV1_VIDEO_ENGINE_MIN_HEIGHT +
      Math.max(0, engines.length - 1) * PRO2_MEDIA_GRID_GAP +
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
    const videoX = PRO2_MEDIA_GROUP_PAD + gridContentWidth + SBV1_VIDEO_GAP;
    const videoY = PRO2_MEDIA_GROUP_PAD + PRO2_MEDIA_GROUP_HEADER;
    next = next.map((n) =>
      n.id === engine.id
        ? {
            ...n,
            position: { x: videoX, y: videoY },
            width: SBV1_VIDEO_ENGINE_WIDTH,
            height: SBV1_VIDEO_ENGINE_MIN_HEIGHT,
            style: {
              ...(typeof n.style === "object" && n.style ? n.style : {}),
              width: SBV1_VIDEO_ENGINE_WIDTH,
              height: SBV1_VIDEO_ENGINE_MIN_HEIGHT,
            },
            data: { ...n.data, pro2GroupId: groupId },
          }
        : n,
    );
    groupWidth =
      PRO2_MEDIA_GROUP_PAD +
      gridContentWidth +
      SBV1_VIDEO_GAP +
      SBV1_VIDEO_ENGINE_WIDTH +
      PRO2_MEDIA_GROUP_PAD +
      PRO2_MEDIA_GROUP_EXTRA;
    groupHeight = Math.max(
      imageBox.height,
      PRO2_MEDIA_GROUP_PAD +
        PRO2_MEDIA_GROUP_HEADER +
        SBV1_VIDEO_ENGINE_MIN_HEIGHT +
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
