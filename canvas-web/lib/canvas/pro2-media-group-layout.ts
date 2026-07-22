"use client";

import {
  LIBTV_VIDEO_MEDIA_NODE_HEIGHT,
  LIBTV_VIDEO_MEDIA_NODE_MIN_HEIGHT,
  LIBTV_VIDEO_MEDIA_NODE_MIN_WIDTH,
  LIBTV_VIDEO_MEDIA_NODE_WIDTH,
} from "./libtv-node-chrome";
import {
  PRO2_CHARACTER_THREE_VIEW_HEIGHT,
  PRO2_CHARACTER_THREE_VIEW_WIDTH,
  PRO2_IMAGE_NODE_HEIGHT,
  PRO2_IMAGE_NODE_WIDTH,
  PRO2_SCRIPT_NODE_WIDTH,
} from "./story-pro2-node-chrome";
import { sortNodesForReactFlow } from "./normalize-graph-nodes";
import type { CanvasFlowNode } from "./types";

export const PRO2_MEDIA_GRID_GAP = 28;

/** 组内宫格间距 · 约为单元宽度的一半 */
export function pro2MediaGridGap(cellWidth: number): number {
  return Math.max(PRO2_MEDIA_GRID_GAP, Math.round(cellWidth / 2));
}
export const PRO2_MEDIA_GROUP_HEADER = 48;
/** 组内边距（大留白：空白区即「选中组」可点区域） */
export const PRO2_MEDIA_GROUP_PAD = 64;
/** 组右 / 下额外空白，进一步扩大可点选组区域（复刻图 2） */
export const PRO2_MEDIA_GROUP_EXTRA = 56;

/** 分镜图组 · 宫格单元（≈3:2 横版） */
export const PRO2_FRAME_CELL_WIDTH = 296;
export const PRO2_FRAME_CELL_HEIGHT = 196;
export const PRO2_FRAME_CELL_MIN_WIDTH = 220;
export const PRO2_FRAME_CELL_MIN_HEIGHT = 146;

/** 分镜视频组 · 宫格单元（alias `LIBTV_VIDEO_MEDIA_NODE_*`） */
export const PRO2_VIDEO_CELL_WIDTH = LIBTV_VIDEO_MEDIA_NODE_WIDTH;
export const PRO2_VIDEO_CELL_HEIGHT = LIBTV_VIDEO_MEDIA_NODE_HEIGHT;
export const PRO2_VIDEO_CELL_MIN_WIDTH = LIBTV_VIDEO_MEDIA_NODE_MIN_WIDTH;
export const PRO2_VIDEO_CELL_MIN_HEIGHT = LIBTV_VIDEO_MEDIA_NODE_MIN_HEIGHT;

/**
 * 宫格列数：偏横向（列 ≥ 行），行数最少以避免末行大量空格。
 * rows = floor(√count)，cols = ceil(count / rows)。
 * 1→1, 2→2, 3→3, 4→2, 5→3, 6→3, 7→4, 8→4, 9→3 …
 */
export function pro2MediaGridCols(count: number): number {
  if (count <= 1) return 1;
  const rows = Math.max(1, Math.floor(Math.sqrt(count)));
  return Math.ceil(count / rows);
}

export function pro2MediaChildSize(node: {
  type?: string;
  pro2MediaRole?: string;
}): { width: number; height: number } {
  if (
    node.type === "story-pro2-three-view" ||
    node.pro2MediaRole === "character-three-view"
  ) {
    return {
      width: PRO2_CHARACTER_THREE_VIEW_WIDTH,
      height: PRO2_CHARACTER_THREE_VIEW_HEIGHT,
    };
  }
  if (node.pro2MediaRole === "frame" || node.pro2MediaRole === "scene") {
    return { width: PRO2_FRAME_CELL_WIDTH, height: PRO2_FRAME_CELL_HEIGHT };
  }
  if (node.pro2MediaRole === "video") {
    // 分镜视频组 · 与分镜图组同宫格尺寸（图 3/4）
    return { width: PRO2_FRAME_CELL_WIDTH, height: PRO2_FRAME_CELL_HEIGHT };
  }
  return { width: PRO2_IMAGE_NODE_WIDTH, height: PRO2_IMAGE_NODE_HEIGHT };
}

export function pro2MediaGridLayout(
  index: number,
  cell: { width: number; height: number },
  cols: number,
): { x: number; y: number } {
  const c = Math.max(1, cols);
  const col = index % c;
  const row = Math.floor(index / c);
  const gap = pro2MediaGridGap(cell.width);
  return {
    x: PRO2_MEDIA_GROUP_PAD + col * (cell.width + gap),
    y:
      PRO2_MEDIA_GROUP_PAD +
      PRO2_MEDIA_GROUP_HEADER +
      row * (cell.height + gap),
  };
}

/** 读取子节点实际外框（含 auto-fit 后尺寸），布局时取 max(模板, 实测) */
export function effectivePro2MediaChildSize(node: CanvasFlowNode): {
  width: number;
  height: number;
} {
  const data = node.data as {
    pro2MediaRole?: string;
    gridSplitFrameCrop?: boolean;
    mediaFit?: boolean;
  };
  const cell = pro2MediaChildSize({
    type: node.type,
    pro2MediaRole: data.pro2MediaRole,
  });
  const style = node.style as { width?: number; height?: number } | undefined;
  const w =
    node.measured?.width ??
    (typeof node.width === "number" ? node.width : undefined) ??
    style?.width ??
    cell.width;
  const h =
    node.measured?.height ??
    (typeof node.height === "number" ? node.height : undefined) ??
    style?.height ??
    cell.height;
  if (data.gridSplitFrameCrop && data.mediaFit) {
    return {
      width: Math.max(1, Math.round(w)),
      height: Math.max(1, Math.round(h)),
    };
  }
  return {
    width: Math.max(cell.width, Math.round(w)),
    height: Math.max(cell.height, Math.round(h)),
  };
}

type MediaChildLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/** 宫格重排 · 按自定义尺寸函数计算行高/列宽 */
export function mediaGridLayoutForChildren(
  children: CanvasFlowNode[],
  cols: number,
  sizeOf: (node: CanvasFlowNode) => { width: number; height: number },
): MediaChildLayout[] {
  const count = children.length;
  if (count === 0) return [];
  const c = Math.max(1, cols);
  const rows = Math.ceil(count / c);
  const sizes = children.map((n) => sizeOf(n));

  const colWidths = Array.from({ length: c }, (_, col) => {
    let maxW = 0;
    for (let row = 0; row < rows; row++) {
      const idx = row * c + col;
      if (idx >= count) continue;
      maxW = Math.max(maxW, sizes[idx]!.width);
    }
    return maxW;
  });

  const rowHeights = Array.from({ length: rows }, (_, row) => {
    let maxH = 0;
    for (let col = 0; col < c; col++) {
      const idx = row * c + col;
      if (idx >= count) continue;
      maxH = Math.max(maxH, sizes[idx]!.height);
    }
    return maxH;
  });

  const colX: number[] = [];
  const gap = pro2MediaGridGap(Math.max(...colWidths, PRO2_IMAGE_NODE_WIDTH));
  let x = PRO2_MEDIA_GROUP_PAD;
  for (let col = 0; col < c; col++) {
    colX.push(x);
    x += colWidths[col]! + gap;
  }

  const rowY: number[] = [];
  let y = PRO2_MEDIA_GROUP_PAD + PRO2_MEDIA_GROUP_HEADER;
  for (let row = 0; row < rows; row++) {
    rowY.push(y);
    y += rowHeights[row]! + gap;
  }

  return children.map((_, index) => {
    const col = index % c;
    const row = Math.floor(index / c);
    const size = sizes[index]!;
    return {
      x: colX[col]!,
      y: rowY[row]!,
      width: size.width,
      height: size.height,
    };
  });
}

/** 宫格重排 · 按每格实测宽高计算行高/列宽（避免生图后 auto-fit 撑破组框） */
export function pro2MediaGridLayoutForChildren(
  children: CanvasFlowNode[],
  cols: number,
): MediaChildLayout[] {
  return mediaGridLayoutForChildren(children, cols, effectivePro2MediaChildSize);
}

export function pro2MediaGroupDimensionsFromLayouts(
  layouts: MediaChildLayout[],
  cols: number,
): { width: number; height: number } {
  if (layouts.length === 0) {
    return { width: 320, height: 240 };
  }
  let maxRight = PRO2_MEDIA_GROUP_PAD;
  let maxBottom = PRO2_MEDIA_GROUP_PAD + PRO2_MEDIA_GROUP_HEADER;

  for (const lay of layouts) {
    maxRight = Math.max(maxRight, lay.x + lay.width);
    maxBottom = Math.max(maxBottom, lay.y + lay.height);
  }

  return {
    width: maxRight + PRO2_MEDIA_GROUP_PAD + PRO2_MEDIA_GROUP_EXTRA,
    height: maxBottom + PRO2_MEDIA_GROUP_PAD + PRO2_MEDIA_GROUP_EXTRA,
  };
}

export function pro2MediaGroupDimensions(
  childCount: number,
  cell: { width: number; height: number },
  cols: number,
): {
  width: number;
  height: number;
} {
  const c = Math.max(1, cols);
  const rows = Math.max(1, Math.ceil(childCount / c));
  const gap = pro2MediaGridGap(cell.width);
  const width =
    PRO2_MEDIA_GROUP_PAD * 2 +
    c * cell.width +
    (c - 1) * gap +
    PRO2_MEDIA_GROUP_EXTRA;
  const height =
    PRO2_MEDIA_GROUP_PAD * 2 +
    PRO2_MEDIA_GROUP_HEADER +
    rows * cell.height +
    (rows - 1) * gap +
    PRO2_MEDIA_GROUP_EXTRA;
  return { width, height };
}

/** 媒体组锚点：脚本节点右侧（已有同 hub 组时纵向错开，避免叠在一起） */
export function pro2MediaGroupOrigin(
  nodes: CanvasFlowNode[],
  hubNodeId: string,
): { x: number; y: number } {
  const hub = nodes.find((n) => n.id === hubNodeId);
  if (!hub) return { x: 240, y: 160 };
  const hubW = hub.width ?? PRO2_SCRIPT_NODE_WIDTH;
  const gap = 56;
  const base = {
    x: (hub.position?.x ?? 0) + hubW + gap,
    y: hub.position?.y ?? 160,
  };
  const siblings = nodes.filter(
    (n) =>
      n.type === "group" &&
      (n.data as { pro2HubNodeId?: string }).pro2HubNodeId === hubNodeId,
  );
  if (!siblings.length) return base;
  let maxBottom = base.y;
  for (const g of siblings) {
    const h =
      (typeof g.height === "number" ? g.height : undefined) ??
      (g.style as { height?: number } | undefined)?.height ??
      320;
    const bottom = (g.position?.y ?? base.y) + h + 48;
    maxBottom = Math.max(maxBottom, bottom);
  }
  return { x: base.x, y: maxBottom };
}

function sortMediaChildren(children: CanvasFlowNode[]): CanvasFlowNode[] {
  return [...children].sort((a, b) => {
    const af = (a.data as { pro2MediaRole?: string }).pro2MediaRole;
    const bf = (b.data as { pro2MediaRole?: string }).pro2MediaRole;
    const aLabel = (a.data as { label?: string }).label ?? "";
    const bLabel = (b.data as { label?: string }).label ?? "";
    if (
      (af === "frame" || af === "video") &&
      (bf === "frame" || bf === "video")
    ) {
      const ai = Number.parseInt(aLabel.replace(/\D/g, ""), 10) || 0;
      const bi = Number.parseInt(bLabel.replace(/\D/g, ""), 10) || 0;
      return ai - bi;
    }
    return aLabel.localeCompare(bLabel, "zh");
  });
}

function isPro2MediaGroupChild(n: CanvasFlowNode): boolean {
  return (
    n.type === "story-pro2-image" ||
    n.type === "story-pro2-three-view" ||
    n.type === "sbv1-image"
  );
}

function groupUsesMediaGrid(group: CanvasFlowNode): boolean {
  const d = group.data as {
    pro2Kind?: string;
    sbv1Styled?: boolean;
    pro2Styled?: boolean;
    pro2ShortcutPreset?: boolean;
  };
  if (d.pro2ShortcutPreset) return false;
  return Boolean(d.pro2Kind || d.sbv1Styled || d.pro2Styled);
}

function isMediaGroupChildForRelayout(
  n: CanvasFlowNode,
  group: CanvasFlowNode,
): boolean {
  if (!groupUsesMediaGrid(group)) return false;
  const kind = (group.data as { pro2Kind?: string }).pro2Kind;
  if (kind === "video-board" && n.type === "sbv1-video-engine") {
    return (
      (n.data as { pro2MediaRole?: string }).pro2MediaRole === "video" ||
      n.parentId === group.id
    );
  }
  if (!isPro2MediaGroupChild(n)) return false;
  if (n.type === "sbv1-image") return true;
  return n.type === "story-pro2-image" || n.type === "story-pro2-three-view";
}

/** 布局版本：hydrate 仅对更低版本做一次网格迁移，不覆盖已保存坐标 */
export const PRO2_MEDIA_GROUP_LAYOUT_VERSION = 10;

/** 纯函数：收拢媒体子节点、宫格重排、组框贴合（与 createGroupContaining / group-node 共用） */
export function applyPro2MediaGroupRelayout(
  nodes: CanvasFlowNode[],
  groupId: string,
  opts?: { resetOrigin?: boolean },
): CanvasFlowNode[] {
  const group = nodes.find((n) => n.id === groupId && n.type === "group");
  if (!group) return nodes;
  // 用户手动拖过组框尺寸后，禁止 auto-fit / relayout 覆盖 width/height
  if (
    Boolean((group.data as { manualSize?: boolean }).manualSize) &&
    opts?.resetOrigin !== true
  ) {
    return sortNodesForReactFlow(nodes);
  }

  const controllerId = (group.data as { pro2ControllerNodeId?: string })
    .pro2ControllerNodeId;
  const hubNodeId = (group.data as { pro2HubNodeId?: string }).pro2HubNodeId;

  let next = [...nodes];

  const shouldReparent = (n: CanvasFlowNode): boolean => {
    if (!isMediaGroupChildForRelayout(n, group)) return false;
    if (n.parentId === groupId) return false;
    const d = n.data as { pro2GroupId?: string; pro2ControllerNodeId?: string };
    if (d.pro2GroupId === groupId) return true;
    return Boolean(
      controllerId && d.pro2ControllerNodeId === controllerId,
    );
  };

  for (const orphan of next.filter(shouldReparent)) {
    next = next.map((n) =>
      n.id === orphan.id
        ? {
            ...n,
            parentId: groupId,
            extent: "parent" as const,
            data: { ...n.data, pro2GroupId: groupId },
          }
        : n,
    );
  }

  let children = next.filter(
    (n) => n.parentId === groupId && isMediaGroupChildForRelayout(n, group),
  );
  children = sortMediaChildren(children);

  if (children.length === 0) return sortNodesForReactFlow(next);

  const cols = pro2MediaGridCols(children.length);
  const layouts = pro2MediaGridLayoutForChildren(children, cols);

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
              ...(n.style ?? {}),
              width: lay.width,
              height: lay.height,
            },
            data: { ...n.data, pro2GroupId: groupId },
          }
        : n,
    );
  }

  const { width, height } = pro2MediaGroupDimensionsFromLayouts(layouts, cols);
  const resetOrigin = opts?.resetOrigin === true;
  const origin =
    resetOrigin && hubNodeId
      ? pro2MediaGroupOrigin(next, hubNodeId)
      : group.position;

  next = next.map((n) =>
    n.id === groupId
      ? {
          ...n,
          position: origin,
          width,
          height,
          style: { ...(n.style ?? {}), width, height },
          data: {
            ...(n.data as Record<string, unknown>),
            pro2LayoutVersion: PRO2_MEDIA_GROUP_LAYOUT_VERSION,
          },
        }
      : n,
  );

  return sortNodesForReactFlow(next);
}

/** 收拢孤儿图片进组、网格重排、组框贴合子节点 */
export function relayoutPro2MediaGroup(
  setNodes: (fn: (nodes: CanvasFlowNode[]) => CanvasFlowNode[]) => void,
  groupId: string,
  opts?: { resetOrigin?: boolean },
): void {
  setNodes((nodes) => applyPro2MediaGroupRelayout(nodes, groupId, opts));
}
