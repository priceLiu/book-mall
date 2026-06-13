/**
 * 节点拖动 · 对齐吸附与参考线（水平 / 垂直 / 居中）
 */
import { absoluteNodePosition, nodeMeasuredSize } from "./normalize-graph-nodes";
import type { CanvasFlowNode } from "./types";

export const CANVAS_DRAG_SNAP_THRESHOLD = 6;

export type SnapGuideLine = {
  orientation: "horizontal" | "vertical";
  /** 画布 flow 坐标 */
  position: number;
  /** 参考线起止（flow 坐标，用于截断显示） */
  from: number;
  to: number;
};

export type NodeSnapBox = {
  id: string;
  left: number;
  right: number;
  top: number;
  bottom: number;
  centerX: number;
  centerY: number;
};

export function nodeSnapBox(
  n: CanvasFlowNode,
  nodes: CanvasFlowNode[],
): NodeSnapBox {
  const { w, h } = nodeMeasuredSize(n);
  const abs = absoluteNodePosition(n, nodes);
  return {
    id: n.id,
    left: abs.x,
    top: abs.y,
    right: abs.x + w,
    bottom: abs.y + h,
    centerX: abs.x + w / 2,
    centerY: abs.y + h / 2,
  };
}

function pickSnap(
  moving: number[],
  targets: number[],
  threshold: number,
): { value: number; delta: number } | null {
  let best: { value: number; delta: number } | null = null;
  for (const m of moving) {
    for (const t of targets) {
      const delta = t - m;
      if (Math.abs(delta) > threshold) continue;
      if (!best || Math.abs(delta) < Math.abs(best.delta)) {
        best = { value: t, delta };
      }
    }
  }
  return best;
}

export type DragSnapResult = {
  dx: number;
  dy: number;
  guides: SnapGuideLine[];
};

export function snapGuideKey(guides: SnapGuideLine[]): string {
  return guides
    .map((g) => `${g.orientation}:${Math.round(g.position)}`)
    .join("|");
}

/** 仅保留拖动节点附近的候选，减少每帧计算量 */
export function filterNearbySnapCandidates(
  dragging: NodeSnapBox,
  others: NodeSnapBox[],
  margin = 480,
): NodeSnapBox[] {
  const minX = dragging.left - margin;
  const maxX = dragging.right + margin;
  const minY = dragging.top - margin;
  const maxY = dragging.bottom + margin;
  return others.filter(
    (o) =>
      o.right >= minX &&
      o.left <= maxX &&
      o.bottom >= minY &&
      o.top <= maxY,
  );
}

/** 计算吸附偏移与参考线（基于绝对坐标） */
export function computeDragSnap(
  dragging: NodeSnapBox,
  others: NodeSnapBox[],
  threshold = CANVAS_DRAG_SNAP_THRESHOLD,
): DragSnapResult {
  const xTargets: number[] = [];
  const yTargets: number[] = [];
  for (const o of others) {
    xTargets.push(o.left, o.centerX, o.right);
    yTargets.push(o.top, o.centerY, o.bottom);
  }

  const snapX = pickSnap(
    [dragging.left, dragging.centerX, dragging.right],
    xTargets,
    threshold,
  );
  const snapY = pickSnap(
    [dragging.top, dragging.centerY, dragging.bottom],
    yTargets,
    threshold,
  );

  const dx = snapX?.delta ?? 0;
  const dy = snapY?.delta ?? 0;
  const guides: SnapGuideLine[] = [];

  if (snapX) {
    const allX = [
      dragging.left + dx,
      dragging.centerX + dx,
      dragging.right + dx,
      ...others.flatMap((o) => [o.left, o.centerX, o.right]),
    ];
    const allY = [
      dragging.top + dy,
      dragging.bottom + dy,
      ...others.flatMap((o) => [o.top, o.bottom]),
    ];
    guides.push({
      orientation: "vertical",
      position: snapX.value,
      from: Math.min(...allY) - 40,
      to: Math.max(...allY) + 40,
    });
  }

  if (snapY) {
    const allY = [
      dragging.top + dy,
      dragging.centerY + dy,
      dragging.bottom + dy,
      ...others.flatMap((o) => [o.top, o.centerY, o.bottom]),
    ];
    const allX = [
      dragging.left + dx,
      dragging.right + dx,
      ...others.flatMap((o) => [o.left, o.right]),
    ];
    guides.push({
      orientation: "horizontal",
      position: snapY.value,
      from: Math.min(...allX) - 40,
      to: Math.max(...allX) + 40,
    });
  }

  return { dx, dy, guides };
}

/** 将绝对坐标吸附结果写回节点 position（含 parent 相对坐标） */
export function applyDragSnapToNode(
  node: CanvasFlowNode,
  nodes: CanvasFlowNode[],
  dx: number,
  dy: number,
): CanvasFlowNode {
  if (dx === 0 && dy === 0) return node;
  if (!node.parentId) {
    return {
      ...node,
      position: { x: node.position.x + dx, y: node.position.y + dy },
    };
  }
  const abs = absoluteNodePosition(node, nodes);
  const nextAbs = { x: abs.x + dx, y: abs.y + dy };
  const parent = nodes.find((n) => n.id === node.parentId);
  if (!parent) {
    return {
      ...node,
      position: { x: node.position.x + dx, y: node.position.y + dy },
    };
  }
  const pAbs = absoluteNodePosition(parent, nodes);
  return {
    ...node,
    position: { x: nextAbs.x - pAbs.x, y: nextAbs.y - pAbs.y },
  };
}
