import { libtvSelectionFlowBox } from "./libtv-marquee-hit";
import { nodeBatchOutHandle } from "./pro2-batch-connect";
import type { CanvasFlowNode } from "./types";
import {
  pro2NodeAbsolutePosition,
  pro2NodeBoxSize,
} from "./pro2-selection-bbox";

function findSourceHandleElement(
  nodeId: string,
  handleId: string,
): Element | null {
  if (typeof document === "undefined") return null;
  return (
    document.querySelector(
      `.react-flow__handle[data-handleid="${handleId}"][data-nodeid="${nodeId}"]`,
    ) ??
    document.querySelector(
      `.react-flow__node[data-id="${nodeId}"] .react-flow__handle[data-handleid="${handleId}"]`,
    )
  );
}

function findNodeElement(nodeId: string): Element | null {
  if (typeof document === "undefined") return null;
  return document.querySelector(`.react-flow__node[data-id="${nodeId}"]`);
}

/** 可见卡片壳（不含侧栏 +、浮动溢出）· 与框选视觉一致 */
function findNodeVisualElement(nodeId: string): Element | null {
  const el = findNodeElement(nodeId);
  if (!el) return null;
  return (
    el.querySelector(".libtv-media-node-bg") ??
    el.querySelector(".libtv-control-node-bg") ??
    el.querySelector(".canvas-group-node") ??
    el
  );
}

/** 批量拖线 · 源点屏幕坐标（document client · 与 pointer clientX/Y 同系） */
export function batchConnectSourceClientPoint(
  node: CanvasFlowNode,
  allNodes: CanvasFlowNode[],
  flowToScreenPosition: (p: { x: number; y: number }) => { x: number; y: number },
  getInternalNode: (id: string) => unknown,
): { x: number; y: number } | null {
  const handleId = nodeBatchOutHandle(node);
  if (!handleId) return null;

  const handleEl = findSourceHandleElement(node.id, handleId);
  if (handleEl) {
    const r = handleEl.getBoundingClientRect();
    if (r.width > 0 || r.height > 0) {
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }
  }

  const nodeEl = findNodeElement(node.id);
  if (nodeEl) {
    const r = nodeEl.getBoundingClientRect();
    return { x: r.right, y: r.top + r.height / 2 };
  }

  const internal = getInternalNode(node.id) as
    | {
        measured?: { width?: number; height?: number };
        internals?: { positionAbsolute?: { x: number; y: number } };
        position: { x: number; y: number };
        width?: number;
        height?: number;
      }
    | undefined;

  const { w, h } = pro2NodeBoxSize(node);
  let flowX: number;
  let flowY: number;

  if (internal) {
    const pos =
      internal.internals?.positionAbsolute ?? internal.position;
    const width =
      internal.measured?.width ??
      (typeof internal.width === "number" ? internal.width : undefined) ??
      w;
    const height =
      internal.measured?.height ??
      (typeof internal.height === "number" ? internal.height : undefined) ??
      h;
    flowX = pos.x + width + 16;
    flowY = pos.y + height / 2;
  } else {
    const abs = pro2NodeAbsolutePosition(node, allNodes);
    flowX = abs.x + w + 16;
    flowY = abs.y + h / 2;
  }

  return flowToScreenPosition({ x: flowX, y: flowY });
}

/** 选中节点合并 client 包围盒（portal 顶栏 / 虚线框） */
export function batchConnectSelectionClientBox(
  nodeIds: string[],
): {
  left: number;
  top: number;
  right: number;
  bottom: number;
  midY: number;
} | null {
  const rects: DOMRect[] = [];
  for (const id of nodeIds) {
    const el = findNodeVisualElement(id);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    if (
      Number.isFinite(r.left) &&
      Number.isFinite(r.top) &&
      (r.width > 0 || r.height > 0)
    ) {
      rects.push(r);
    }
  }
  if (!rects.length) return null;
  const left = Math.min(...rects.map((r) => r.left));
  const top = Math.min(...rects.map((r) => r.top));
  const right = Math.max(...rects.map((r) => r.right));
  const bottom = Math.max(...rects.map((r) => r.bottom));
  return { left, top, right, bottom, midY: (top + bottom) / 2 };
}

export type BatchConnectScreenBox = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  midY: number;
  width: number;
  height: number;
};

/** LibTV 多选 flow 框 → 屏幕包围盒（与 LibtvMultiSelectionOutline 同数据源） */
export function libtvSelectionFlowBoxToScreenBox(
  flowBox: { x: number; y: number; w: number; h: number },
  flowToScreenPosition: (p: { x: number; y: number }) => { x: number; y: number },
): BatchConnectScreenBox {
  const tl = flowToScreenPosition({ x: flowBox.x, y: flowBox.y });
  const br = flowToScreenPosition({
    x: flowBox.x + flowBox.w,
    y: flowBox.y + flowBox.h,
  });
  const left = Math.min(tl.x, br.x);
  const top = Math.min(tl.y, br.y);
  const right = Math.max(tl.x, br.x);
  const bottom = Math.max(tl.y, br.y);
  return {
    left,
    top,
    right,
    bottom,
    midY: (top + bottom) / 2,
    width: right - left,
    height: bottom - top,
  };
}

/** 框选批量 + / 磁吸 · 与蓝色虚线框同一套 libtvSelectionFlowBox */
export function batchConnectSelectionScreenBox(
  nodeIds: string[],
  allNodes: CanvasFlowNode[],
  flowToScreenPosition: (p: { x: number; y: number }) => { x: number; y: number },
  _getInternalNode?: (id: string) => unknown,
): BatchConnectScreenBox | null {
  if (nodeIds.length < 2) return null;
  const flowBox = libtvSelectionFlowBox(allNodes, nodeIds);
  if (!flowBox) return null;
  return libtvSelectionFlowBoxToScreenBox(flowBox, flowToScreenPosition);
}
