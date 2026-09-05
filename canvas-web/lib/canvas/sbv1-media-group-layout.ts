"use client";

import {
  isSbv1MediaGroup as isSbv1MediaGroupByMeta,
  sbv1ImageChildren,
} from "./sbv1-media-group-meta";
import {
  SBV1_IMAGE_NODE_WIDTH,
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
  mediaGroupArrangeCols,
  pro2MediaGridCols,
  pro2MediaGridGap,
  pro2MediaGroupDimensionsFromLayouts,
  type MediaGroupArrangeMode,
  type MediaGroupRelayoutOpts,
} from "./pro2-media-group-layout";
import {
  isSbv1GroupColumnLayoutChild,
  resolveSbv1GroupMediaCellSize,
  resolveSbv1GroupVideoColumnSize,
} from "./sbv1-media-group-sizing";
import type { CanvasFlowEdge, CanvasFlowNode, GroupNodeData } from "./types";

/** 参考图列与视频引擎列之间的横向间距（≈ 参考图单元宽度的一半） */
export function sbv1ImageVideoColumnGap(
  images: CanvasFlowNode[],
  allNodes: CanvasFlowNode[],
): number {
  if (!images.length) {
    return pro2MediaGridGap(SBV1_IMAGE_NODE_WIDTH);
  }
  const maxW = Math.max(
    ...images.map((n) => resolveSbv1GroupMediaCellSize(n, allNodes).width),
  );
  return pro2MediaGridGap(maxW);
}

/** 左图右视频 · 分栏排布（sbv1 组 / 分镜视频组 / 手打媒体组） */
export function shouldUseSbv1ImageVideoColumnLayout(
  group: CanvasFlowNode,
  nodes: CanvasFlowNode[],
): boolean {
  if (group.type !== "group") return false;
  const d = group.data as GroupNodeData;
  if (isSbv1MediaGroupByMeta(group, nodes)) return true;
  if (d.pro2Kind === "video-board") return true;
  const children = nodes.filter(
    (n) => n.parentId === group.id && n.type !== "group",
  );
  if (children.length < 2) return false;
  const hasVideo = children.some((n) => isSbv1GroupVideoChild(n));
  const hasImages = children.some((n) => isSbv1GroupImageChild(n));
  return hasVideo && hasImages;
}

/** 组内右侧视频列：生视频引擎 + 自动成片 */
function isSbv1GroupVideoChild(n: CanvasFlowNode): boolean {
  return (
    n.type === "sbv1-video-engine" || n.type === "jianying-auto-render-pro2"
  );
}

/**
 * sbv1 组内「左侧网格」子节点：除视频引擎/自动成片外的全部可视子节点。
 * 混合分组（图片 + 视频 + 标签）若只排 sbv1-image，会出现标签悬浮重叠。
 */
function isSbv1GroupImageChild(n: CanvasFlowNode): boolean {
  return n.type !== "group" && !isSbv1GroupVideoChild(n);
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
  videoColumnSize?: { width: number; height: number } | null,
): { nodes: CanvasFlowNode[]; gridContentWidth: number; imageBox: { width: number; height: number } } {
  if (images.length === 0) {
    return {
      nodes,
      gridContentWidth: 0,
      imageBox: { width: 320, height: 240 },
    };
  }

  const cols = pro2MediaGridCols(images.length);
  const layouts = mediaGridLayoutForChildren(images, cols, (n) =>
    resolveSbv1GroupMediaCellSize(n, nodes, videoColumnSize),
  );
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
  columnGap: number,
  videoColumnSize?: { width: number; height: number } | null,
): {
  nodes: CanvasFlowNode[];
  maxVideoWidth: number;
  videoColumnHeight: number;
} {
  if (engines.length === 0) {
    return { nodes, maxVideoWidth: 0, videoColumnHeight: 0 };
  }

  const columnSize =
    videoColumnSize ?? resolveSbv1GroupVideoColumnSize(engines, nodes);
  const videoX = PRO2_MEDIA_GROUP_PAD + gridContentWidth + columnGap;
  let videoY = PRO2_MEDIA_GROUP_PAD + PRO2_MEDIA_GROUP_HEADER;
  let maxVideoWidth = 0;
  let videoBottom = videoY;
  let next = nodes;

  for (const engine of engines) {
    const dims = resolveSbv1GroupMediaCellSize(engine, nodes, columnSize);
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
    videoY = videoBottom + pro2MediaGridGap(SBV1_VIDEO_ENGINE_WIDTH);
  }

  return {
    nodes: next,
    maxVideoWidth,
    videoColumnHeight: videoBottom - (PRO2_MEDIA_GROUP_PAD + PRO2_MEDIA_GROUP_HEADER),
  };
}

function sbv1GroupChildDimensions(
  node: CanvasFlowNode,
  allNodes: CanvasFlowNode[],
  videoColumnSize: { width: number; height: number } | null,
): { width: number; height: number } {
  if (isSbv1GroupColumnLayoutChild(node) || isSbv1GroupVideoChild(node)) {
    return resolveSbv1GroupMediaCellSize(node, allNodes, videoColumnSize);
  }
  return resolveSbv1GroupMediaCellSize(node, allNodes, null);
}

export { resolveSbv1GroupVideoColumnSize } from "./sbv1-media-group-sizing";

function applySbv1GroupChildrenGrid(
  nodes: CanvasFlowNode[],
  groupId: string,
  children: CanvasFlowNode[],
  mode: MediaGroupArrangeMode,
): CanvasFlowNode[] {
  if (children.length === 0) return sortNodesForReactFlow(nodes);
  const engines = children.filter((n) => isSbv1GroupVideoChild(n));
  const videoColumnSize = resolveSbv1GroupVideoColumnSize(engines, nodes);
  const cols = mediaGroupArrangeCols(children.length, mode);
  const layouts = mediaGridLayoutForChildren(children, cols, (n) =>
    sbv1GroupChildDimensions(n, nodes, videoColumnSize),
  );
  let next = nodes;
  for (let i = 0; i < children.length; i++) {
    const child = children[i]!;
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
            manualSize: false,
          },
        }
      : n,
  );
  return sortNodesForReactFlow(next);
}

function clearSbv1GroupManualSizeFlags(
  nodes: CanvasFlowNode[],
  groupId: string,
): CanvasFlowNode[] {
  return nodes.map((n) => {
    if (n.id !== groupId && n.parentId !== groupId) return n;
    const d = n.data as { manualSize?: boolean };
    if (!d.manualSize) return n;
    return { ...n, data: { ...n.data, manualSize: false } };
  });
}

/** sbv1 媒体组：参考图宫格 + 右侧视频引擎（可多槽竖排），组框贴合 */
export function applySbv1MediaGroupRelayout(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  groupId: string,
  opts?: MediaGroupRelayoutOpts,
): CanvasFlowNode[] {
  const group = nodes.find((n) => n.id === groupId && n.type === "group");
  if (!group) return nodes;
  const force = opts?.force === true;
  const mode = opts?.mode ?? "auto";
  if (
    !force &&
    Boolean((group.data as { manualSize?: boolean }).manualSize)
  ) {
    return sortNodesForReactFlow(nodes);
  }
  if (mode === "row" || mode === "column") {
    const cleared = force ? clearSbv1GroupManualSizeFlags(nodes, groupId) : nodes;
    const children = sortSbv1GroupChildren(
      cleared.filter((n) => n.parentId === groupId && n.type !== "group"),
    );
    if (children.length < 2) return sortNodesForReactFlow(cleared);
    return applySbv1GroupChildrenGrid(cleared, groupId, children, mode);
  }
  if (
    mode === "auto" &&
    shouldUseSbv1ImageVideoColumnLayout(group, nodes)
  ) {
    return applySbv1ImageVideoColumnRelayout(nodes, edges, groupId, force);
  }
  return applyPro2MediaGroupRelayout(nodes, groupId, {
    ...opts,
    force,
    mode,
  });
}

function applySbv1ImageVideoColumnRelayout(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  groupId: string,
  force: boolean,
): CanvasFlowNode[] {
  const group = nodes.find((n) => n.id === groupId && n.type === "group");
  if (!group) return nodes;

  let next = force ? clearSbv1GroupManualSizeFlags(nodes, groupId) : [...nodes];
  const linkedEngine = findSbv1GroupLinkedVideoEngine(groupId, next, edges);
  if (linkedEngine && linkedEngine.parentId !== groupId && group) {
    const reparented = reparentToGroup(linkedEngine, group, next);
    next = next.map((n) => (n.id === reparented.id ? reparented : n));
  }
  // 组内视频已连到画布根级的「自动成片」时，收进组，避免拖组时成片留在原地
  const orphanRenders = next.filter(
    (n) =>
      n.type === "jianying-auto-render-pro2" &&
      n.parentId !== groupId &&
      edges.some(
        (e) =>
          e.target === n.id &&
          e.targetHandle === "in_video" &&
          next.some(
            (src) =>
              src.id === e.source &&
              src.parentId === groupId &&
              src.type === "sbv1-video-engine",
          ),
      ),
  );
  for (const orphan of orphanRenders) {
    const reparented = reparentToGroup(orphan, group, next);
    next = next.map((n) => (n.id === reparented.id ? reparented : n));
  }

  const images = sortSbv1GroupChildren(
    next.filter((n) => n.parentId === groupId && isSbv1GroupImageChild(n)),
  );
  const engines = sortSbv1GroupChildren(
    next.filter((n) => n.parentId === groupId && isSbv1GroupVideoChild(n)),
  );
  const allChildren = sortSbv1GroupChildren(
    next.filter((n) => n.parentId === groupId && n.type !== "group"),
  );

  if (allChildren.length === 0) {
    return sortNodesForReactFlow(next);
  }

  const videoColumnSize = resolveSbv1GroupVideoColumnSize(engines, next);
  const hasMixedContent = allChildren.some((n) => !isSbv1GroupColumnLayoutChild(n));
  if (hasMixedContent) {
    return applySbv1GroupChildrenGrid(next, groupId, allChildren, "auto");
  }

  if (images.length === 0 && engines.length > 0) {
    const cols = pro2MediaGridCols(engines.length);
    const layouts = mediaGridLayoutForChildren(engines, cols, (n) =>
      resolveSbv1GroupMediaCellSize(n, next, videoColumnSize),
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
    videoColumnSize,
  );
  next = withImages;

  const columnGap = sbv1ImageVideoColumnGap(images, next);

  const { nodes: withVideos, maxVideoWidth, videoColumnHeight } =
    applySbv1GroupVideoColumn(
      next,
      groupId,
      engines,
      gridContentWidth,
      columnGap,
      videoColumnSize,
    );
  next = withVideos;

  const groupWidth =
    engines.length > 0
      ? PRO2_MEDIA_GROUP_PAD +
        gridContentWidth +
        columnGap +
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

function sbv1MediaRelayoutChanged(
  before: CanvasFlowNode[],
  after: CanvasFlowNode[],
  groupId: string,
): boolean {
  const ids = new Set<string>([groupId]);
  for (const n of after) {
    if (n.parentId === groupId) ids.add(n.id);
  }
  for (const id of ids) {
    const a = before.find((n) => n.id === id);
    const b = after.find((n) => n.id === id);
    if (!a || !b) return true;
    if (a.position.x !== b.position.x || a.position.y !== b.position.y) {
      return true;
    }
    const aw =
      (typeof a.width === "number" ? a.width : undefined) ??
      (a.style as { width?: number } | undefined)?.width ??
      0;
    const ah =
      (typeof a.height === "number" ? a.height : undefined) ??
      (a.style as { height?: number } | undefined)?.height ??
      0;
    const bw =
      (typeof b.width === "number" ? b.width : undefined) ??
      (b.style as { width?: number } | undefined)?.width ??
      0;
    const bh =
      (typeof b.height === "number" ? b.height : undefined) ??
      (b.style as { height?: number } | undefined)?.height ??
      0;
    if (Math.round(aw) !== Math.round(bw) || Math.round(ah) !== Math.round(bh)) {
      return true;
    }
  }
  return false;
}

export function relayoutSbv1MediaGroup(
  setNodes: (fn: (nodes: CanvasFlowNode[]) => CanvasFlowNode[]) => void,
  groupId: string,
  edges: CanvasFlowEdge[],
): void {
  setNodes((nodes) => {
    const next = applySbv1MediaGroupRelayout(nodes, edges, groupId);
    if (!sbv1MediaRelayoutChanged(nodes, next, groupId)) return nodes;
    return next;
  });
}

const sbv1GroupRelayoutTimers = new Map<string, number>();
const sbv1GroupRelayoutForcePending = new Set<string>();

/** 组内多节点并发 auto-fit 时合并为一次 relayout，避免布局互相覆盖挤在一起 */
export function scheduleRelayoutSbv1MediaGroup(
  setNodes: (fn: (nodes: CanvasFlowNode[]) => CanvasFlowNode[]) => void,
  groupId: string,
  getEdges: () => CanvasFlowEdge[],
  delayMs = 180,
  opts?: MediaGroupRelayoutOpts,
): void {
  if (opts?.force) sbv1GroupRelayoutForcePending.add(groupId);
  const prev = sbv1GroupRelayoutTimers.get(groupId);
  if (prev !== undefined) window.clearTimeout(prev);
  const timer = window.setTimeout(() => {
    sbv1GroupRelayoutTimers.delete(groupId);
    const force = sbv1GroupRelayoutForcePending.has(groupId);
    sbv1GroupRelayoutForcePending.delete(groupId);
    const edges = getEdges();
    setNodes((nodes) => {
      const next = applySbv1MediaGroupRelayout(nodes, edges, groupId, {
        ...opts,
        force: force || opts?.force,
        mode: opts?.mode ?? "auto",
      });
      if (!sbv1MediaRelayoutChanged(nodes, next, groupId)) return nodes;
      return next;
    });
  }, delayMs);
  sbv1GroupRelayoutTimers.set(groupId, timer);
}
