/**
 * 画布重排 · 顶层节点网格收拢（Pro2 / sbv1 共用）
 */
import { nodeMeasuredSize } from "./normalize-graph-nodes";
import type { CanvasFlowNode } from "./types";

export const CANVAS_REFLOW_ORIGIN = { x: 120, y: 160 };
export const CANVAS_REFLOW_COL_GAP = 64;
export const CANVAS_REFLOW_ROW_GAP = 72;
export const CANVAS_REFLOW_SECTION_GAP = 96;
export const CANVAS_REFLOW_GRID_COLS = 3;

export type PackGridOptions = {
  startX?: number;
  startY: number;
  colGap?: number;
  rowGap?: number;
  maxCols?: number;
};

/** 按组优先、再按标签排序，收拢顺序更稳定 */
export function sortNodesForReflowPack(
  nodes: CanvasFlowNode[],
): CanvasFlowNode[] {
  return [...nodes].sort((a, b) => {
    const aGroup = a.type === "group" ? 0 : 1;
    const bGroup = b.type === "group" ? 0 : 1;
    if (aGroup !== bGroup) return aGroup - bGroup;
    const aLabel = String((a.data as { label?: string }).label ?? "");
    const bLabel = String((b.data as { label?: string }).label ?? "");
    if (aLabel !== bLabel) return aLabel.localeCompare(bLabel, "zh");
    return a.position.x - b.position.x || a.position.y - b.position.y;
  });
}

/** 将节点 id 列表按网格放置，返回新坐标 */
export function packNodesInGrid(
  nodes: CanvasFlowNode[],
  ids: string[],
  opts: PackGridOptions,
): Map<string, { x: number; y: number }> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const startX = opts.startX ?? CANVAS_REFLOW_ORIGIN.x;
  const colGap = opts.colGap ?? CANVAS_REFLOW_COL_GAP;
  const rowGap = opts.rowGap ?? CANVAS_REFLOW_ROW_GAP;
  const maxCols = Math.max(1, opts.maxCols ?? CANVAS_REFLOW_GRID_COLS);

  const positions = new Map<string, { x: number; y: number }>();
  let cursorX = startX;
  let cursorY = opts.startY;
  let col = 0;
  let rowMaxH = 0;

  for (const id of ids) {
    const node = byId.get(id);
    if (!node) continue;
    const { w, h } = nodeMeasuredSize(node);
    positions.set(id, { x: cursorX, y: cursorY });
    rowMaxH = Math.max(rowMaxH, h);
    col += 1;
    if (col >= maxCols) {
      col = 0;
      cursorX = startX;
      cursorY += rowMaxH + rowGap;
      rowMaxH = 0;
    } else {
      cursorX += w + colGap;
    }
  }

  return positions;
}

/** 工作区块底部 Y（仅统计给定 type 集合的顶层节点） */
export function workspaceBlockBottom(
  nodes: CanvasFlowNode[],
  workspaceTypes: ReadonlySet<string>,
  fallbackY = CANVAS_REFLOW_ORIGIN.y,
): number {
  let maxBottom = fallbackY;
  for (const n of nodes) {
    if (n.parentId) continue;
    if (!workspaceTypes.has(n.type ?? "")) continue;
    const { h } = nodeMeasuredSize(n);
    maxBottom = Math.max(maxBottom, n.position.y + h);
  }
  return maxBottom;
}

export function applyNodePositions(
  nodes: CanvasFlowNode[],
  positions: Map<string, { x: number; y: number }>,
): CanvasFlowNode[] {
  if (!positions.size) return nodes;
  return nodes.map((n) => {
    const p = positions.get(n.id);
    return p ? { ...n, position: p } : n;
  });
}
