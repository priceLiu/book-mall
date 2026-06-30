import { nodeBatchOutHandle } from "./pro2-batch-connect";
import { pro2NodeAbsolutePosition, pro2NodeBoxSize } from "./pro2-selection-bbox";
import type { CanvasFlowNode } from "./types";

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
    const el = findNodeElement(id);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    if (r.width > 0 || r.height > 0) rects.push(r);
  }
  if (!rects.length) return null;
  const left = Math.min(...rects.map((r) => r.left));
  const top = Math.min(...rects.map((r) => r.top));
  const right = Math.max(...rects.map((r) => r.right));
  const bottom = Math.max(...rects.map((r) => r.bottom));
  return { left, top, right, bottom, midY: (top + bottom) / 2 };
}
