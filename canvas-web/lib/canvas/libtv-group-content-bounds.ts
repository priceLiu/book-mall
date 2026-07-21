import type { CanvasFlowNode } from "./types";

export type GroupResizeFrozenAbs = Map<string, { x: number; y: number }>;

/** 与 normalize-graph-nodes.nodeMeasuredSize 一致 · 避免单测拉入 JSX 依赖链 */
function nodeMeasuredSize(n: CanvasFlowNode): { w: number; h: number } {
  const style = n.style as { width?: number; height?: number } | undefined;
  const w = n.width ?? style?.width ?? 320;
  const h = n.height ?? style?.height ?? 240;
  return { w: Number(w) || 320, h: Number(h) || 240 };
}

/** 与 pro2-media-group-layout.ts 保持一致 · 避免单测拉入 use client 模块 */
const LIBTV_GROUP_PAD = 64;
const LIBTV_GROUP_HEADER = 48;
const LIBTV_GROUP_EXTRA = 56;

export const LIBTV_GROUP_ABSOLUTE_MIN_WIDTH = 220;
export const LIBTV_GROUP_ABSOLUTE_MIN_HEIGHT = 140;

/** 组框最小尺寸：须包住全部子节点 + LibTV 组内 padding */
export function computeLibtvGroupContentMinSize(
  groupId: string,
  nodes: CanvasFlowNode[],
  opts?: {
    frozenAbs?: GroupResizeFrozenAbs;
    groupPosition?: { x: number; y: number };
  },
): { minWidth: number; minHeight: number } {
  const groupPos =
    opts?.groupPosition ??
    nodes.find((n) => n.id === groupId)?.position ?? { x: 0, y: 0 };
  const frozen = opts?.frozenAbs;
  const children = nodes.filter(
    (n) => n.parentId === groupId && n.type !== "group",
  );

  if (children.length === 0) {
    return {
      minWidth: LIBTV_GROUP_ABSOLUTE_MIN_WIDTH,
      minHeight: LIBTV_GROUP_ABSOLUTE_MIN_HEIGHT,
    };
  }

  let maxRight = LIBTV_GROUP_PAD;
  let maxBottom = LIBTV_GROUP_PAD + LIBTV_GROUP_HEADER;

  for (const child of children) {
    const { w, h } = nodeMeasuredSize(child);
    let relX = child.position.x;
    let relY = child.position.y;
    if (frozen) {
      const abs = frozen.get(child.id);
      if (abs) {
        relX = abs.x - groupPos.x;
        relY = abs.y - groupPos.y;
      }
    }
    maxRight = Math.max(maxRight, relX + w);
    maxBottom = Math.max(maxBottom, relY + h);
  }

  return {
    minWidth: Math.max(
      LIBTV_GROUP_ABSOLUTE_MIN_WIDTH,
      Math.ceil(maxRight + LIBTV_GROUP_PAD + LIBTV_GROUP_EXTRA),
    ),
    minHeight: Math.max(
      LIBTV_GROUP_ABSOLUTE_MIN_HEIGHT,
      Math.ceil(maxBottom + LIBTV_GROUP_PAD + LIBTV_GROUP_EXTRA),
    ),
  };
}

export type GroupResizeGeometry = {
  position: { x: number; y: number };
  width: number;
  height: number;
};

/** 将预览/提交尺寸 clamp 到 contentMin；过小则回退 snapshot */
export function resolveGroupResizeGeometry(
  proposed: GroupResizeGeometry,
  contentMin: { minWidth: number; minHeight: number },
  snapshot: GroupResizeGeometry | null,
): GroupResizeGeometry {
  const tooSmall =
    proposed.width < contentMin.minWidth ||
    proposed.height < contentMin.minHeight ||
    proposed.width < LIBTV_GROUP_ABSOLUTE_MIN_WIDTH ||
    proposed.height < LIBTV_GROUP_ABSOLUTE_MIN_HEIGHT;
  if (tooSmall && snapshot) return snapshot;
  return {
    position: proposed.position,
    width: Math.max(proposed.width, contentMin.minWidth),
    height: Math.max(proposed.height, contentMin.minHeight),
  };
}

export type GroupContentBounds = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

/**
 * 全子节点的绝对边界（含 LibTV 组内 padding / header）。
 * 用 frozenAbs（缩放开始那一刻的子节点绝对坐标）计算，缩放全程稳定。
 */
export function computeGroupChildrenAbsBounds(
  frozen: GroupResizeFrozenAbs,
  nodes: CanvasFlowNode[],
): GroupContentBounds | null {
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const [id, abs] of frozen) {
    const node = nodes.find((n) => n.id === id);
    if (!node || node.type === "group") continue;
    const { w, h } = nodeMeasuredSize(node);
    left = Math.min(left, abs.x);
    top = Math.min(top, abs.y);
    right = Math.max(right, abs.x + w);
    bottom = Math.max(bottom, abs.y + h);
  }
  if (!Number.isFinite(left) || !Number.isFinite(top)) return null;
  return {
    left: left - LIBTV_GROUP_PAD,
    top: top - LIBTV_GROUP_PAD - LIBTV_GROUP_HEADER,
    right: right + LIBTV_GROUP_PAD,
    bottom: bottom + LIBTV_GROUP_PAD,
  };
}

/**
 * 单边境界 clamp：四条边各自独立。
 * 引哪条边就只把那条边收到内容边界为止，反面那条边保持用户松手的位置——不拉扯。
 */
export function clampGroupBoxToBounds(
  proposed: GroupResizeGeometry,
  bounds: GroupContentBounds,
): GroupResizeGeometry {
  const left = Math.min(proposed.position.x, bounds.left);
  const top = Math.min(proposed.position.y, bounds.top);
  const right = Math.max(proposed.position.x + proposed.width, bounds.right);
  const bottom = Math.max(proposed.position.y + proposed.height, bounds.bottom);
  return {
    position: { x: left, y: top },
    width: Math.max(LIBTV_GROUP_ABSOLUTE_MIN_WIDTH, right - left),
    height: Math.max(LIBTV_GROUP_ABSOLUTE_MIN_HEIGHT, bottom - top),
  };
}

export type GroupResizeSnapshot = GroupResizeGeometry;
