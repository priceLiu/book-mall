"use client";

import {
  PRO2_CHARACTER_THREE_VIEW_HEIGHT,
  PRO2_CHARACTER_THREE_VIEW_WIDTH,
  PRO2_IMAGE_NODE_HEIGHT,
  PRO2_IMAGE_NODE_WIDTH,
  PRO2_SCRIPT_NODE_WIDTH,
} from "./story-pro2-node-chrome";
import {
  SBV1_IMAGE_NODE_HEIGHT,
  SBV1_IMAGE_NODE_WIDTH,
} from "./sbv1-node-chrome";
import { sortNodesForReactFlow } from "./normalize-graph-nodes";
import type { CanvasFlowNode } from "./types";

export const PRO2_MEDIA_GRID_GAP = 20;
export const PRO2_MEDIA_GROUP_HEADER = 40;
/** 组内边距（大留白：空白区即「选中组」可点区域） */
export const PRO2_MEDIA_GROUP_PAD = 52;
/** 组右 / 下额外空白，进一步扩大可点选组区域（复刻图 2） */
export const PRO2_MEDIA_GROUP_EXTRA = 44;

/** 分镜图（横向长方形）单元尺寸 */
export const PRO2_FRAME_CELL_WIDTH = 300;
export const PRO2_FRAME_CELL_HEIGHT = 196;

/**
 * 宫格列数：按子节点数量推导，偏横向（列 ≥ 行），尽量不竖排。
 * 1→1, 2→2, 3→2, 4→2, 5→3, 6→3, 9→3 …
 */
export function pro2MediaGridCols(count: number): number {
  if (count <= 1) return 1;
  return Math.ceil(Math.sqrt(count));
}

export function pro2MediaChildSize(node: {
  type?: string;
  pro2MediaRole?: string;
}): { width: number; height: number } {
  if (node.type === "sbv1-image") {
    return { width: SBV1_IMAGE_NODE_WIDTH, height: SBV1_IMAGE_NODE_HEIGHT };
  }
  if (
    node.type === "story-pro2-three-view" ||
    node.pro2MediaRole === "character-three-view"
  ) {
    return {
      width: PRO2_CHARACTER_THREE_VIEW_WIDTH,
      height: PRO2_CHARACTER_THREE_VIEW_HEIGHT,
    };
  }
  if (node.pro2MediaRole === "frame") {
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
  return {
    x: PRO2_MEDIA_GROUP_PAD + col * (cell.width + PRO2_MEDIA_GRID_GAP),
    y:
      PRO2_MEDIA_GROUP_PAD +
      PRO2_MEDIA_GROUP_HEADER +
      row * (cell.height + PRO2_MEDIA_GRID_GAP),
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
  const width =
    PRO2_MEDIA_GROUP_PAD * 2 +
    c * cell.width +
    (c - 1) * PRO2_MEDIA_GRID_GAP +
    PRO2_MEDIA_GROUP_EXTRA;
  const height =
    PRO2_MEDIA_GROUP_PAD * 2 +
    PRO2_MEDIA_GROUP_HEADER +
    rows * cell.height +
    (rows - 1) * PRO2_MEDIA_GRID_GAP +
    PRO2_MEDIA_GROUP_EXTRA;
  return { width, height };
}

/** 媒体组锚点：脚本节点右侧 */
export function pro2MediaGroupOrigin(
  nodes: CanvasFlowNode[],
  hubNodeId: string,
): { x: number; y: number } {
  const hub = nodes.find((n) => n.id === hubNodeId);
  if (!hub) return { x: 240, y: 160 };
  const hubW = hub.width ?? PRO2_SCRIPT_NODE_WIDTH;
  const gap = 56;
  return {
    x: (hub.position?.x ?? 0) + hubW + gap,
    y: hub.position?.y ?? 160,
  };
}

function sortMediaChildren(children: CanvasFlowNode[]): CanvasFlowNode[] {
  return [...children].sort((a, b) => {
    const af = (a.data as { pro2MediaRole?: string }).pro2MediaRole;
    const bf = (b.data as { pro2MediaRole?: string }).pro2MediaRole;
    const aLabel = (a.data as { label?: string }).label ?? "";
    const bLabel = (b.data as { label?: string }).label ?? "";
    if (af === "frame" && bf === "frame") {
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

function isMediaGroupChildForRelayout(
  n: CanvasFlowNode,
  group: CanvasFlowNode,
): boolean {
  if (!isPro2MediaGroupChild(n)) return false;
  if (n.type === "sbv1-image") {
    return Boolean((group.data as { sbv1Styled?: boolean }).sbv1Styled);
  }
  return n.type === "story-pro2-image" || n.type === "story-pro2-three-view";
}

/** 布局版本：hydrate 仅对更低版本做一次网格迁移，不覆盖已保存坐标 */
export const PRO2_MEDIA_GROUP_LAYOUT_VERSION = 2;

/** 纯函数：收拢媒体子节点、宫格重排、组框贴合（与 createGroupContaining / group-node 共用） */
export function applyPro2MediaGroupRelayout(
  nodes: CanvasFlowNode[],
  groupId: string,
  opts?: { resetOrigin?: boolean },
): CanvasFlowNode[] {
  const group = nodes.find((n) => n.id === groupId && n.type === "group");
  if (!group) return nodes;

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

  for (let i = 0; i < children.length; i++) {
    const child = children[i]!;
    const childCell = pro2MediaChildSize({
      type: child.type,
      pro2MediaRole: (child.data as { pro2MediaRole?: string }).pro2MediaRole,
    });
    const rel = pro2MediaGridLayout(i, childCell, cols);
    next = next.map((n) =>
      n.id === child.id
        ? {
            ...n,
            position: rel,
            width: childCell.width,
            height: childCell.height,
            style: {
              ...(n.style ?? {}),
              width: childCell.width,
              height: childCell.height,
            },
            data: { ...n.data, pro2GroupId: groupId },
          }
        : n,
    );
  }

  const layoutCell = pro2MediaChildSize({
    type: children[0]!.type,
    pro2MediaRole: (children[0]!.data as { pro2MediaRole?: string })
      .pro2MediaRole,
  });
  const { width, height } = pro2MediaGroupDimensions(
    children.length,
    layoutCell,
    cols,
  );
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
