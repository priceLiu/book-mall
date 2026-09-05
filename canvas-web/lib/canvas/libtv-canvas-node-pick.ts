import type { CanvasFlowNode } from "./types";
import { isGroupNode } from "./types";
import {
  pro2NodeAbsolutePosition,
  pro2NodeBoxSize,
} from "./pro2-selection-bbox";

type ScreenToFlow = (pos: { x: number; y: number }) => { x: number; y: number };

/** 浮动 Dock / 顶栏 portal · 会遮挡下方节点的层 */
export const LIBTV_CANVAS_OVERLAY_SELECTOR =
  ".pro2-input-dock, .libtv-node-toolbar-portal";

/** 蒙层上须保留点击的子元素（按钮 / 输入框等） */
export const LIBTV_CANVAS_OVERLAY_INTERACTIVE_SELECTOR =
  "button, textarea, input, select, option, a, label, [contenteditable='true'], [role='menuitem'], [role='combobox'], [data-libtv-dock-interactive]";

export function isLibtvCanvasOverlayLayer(target: Element): boolean {
  return Boolean(target.closest(LIBTV_CANVAS_OVERLAY_SELECTOR));
}

export function isLibtvCanvasOverlayInteractiveTarget(target: Element): boolean {
  if (!isLibtvCanvasOverlayLayer(target)) return false;
  if (target.closest("[data-libtv-dock-interactive]")) return true;
  return Boolean(target.closest(LIBTV_CANVAS_OVERLAY_INTERACTIVE_SELECTOR));
}

export function resolveLibtvCanvasNodeIdFromElement(
  target: Element,
): string | null {
  const nodeEl = target.closest(".react-flow__node") as HTMLElement | null;
  if (!nodeEl) return null;
  if (nodeEl.classList.contains("react-flow__node-group")) return null;
  if (nodeEl.dataset.type === "group") return null;
  return nodeEl.dataset.id?.trim() || null;
}

function isElementLike(el: unknown): el is Element {
  return (
    typeof el === "object" &&
    el != null &&
    typeof (el as Element).closest === "function"
  );
}

/** elementsFromPoint 栈 → 最上层非 group 节点 id */
export function pickLibtvCanvasNodeFromElementStack(
  stack: Element[],
): string | null {
  for (const el of stack) {
    if (!isElementLike(el)) continue;
    const id = resolveLibtvCanvasNodeIdFromElement(el);
    if (id) return id;
  }
  return null;
}

/** 屏幕坐标 · DOM 命中（优先于 flow 几何，与视觉叠层一致） */
export function pickLibtvCanvasNodeFromDomAtPoint(
  clientX: number,
  clientY: number,
): string | null {
  if (typeof document === "undefined") return null;
  const fromPoint = document.elementsFromPoint?.bind(document);
  if (!fromPoint) return null;
  return pickLibtvCanvasNodeFromElementStack(fromPoint(clientX, clientY));
}

/** 屏幕坐标 → 最上层 LibTV 节点 id（排除 group）· flow 几何回退 */
export function pickLibtvCanvasNodeAtClientPoint(
  clientX: number,
  clientY: number,
  nodes: CanvasFlowNode[],
  screenToFlowPosition: ScreenToFlow,
): string | null {
  const fromDom = pickLibtvCanvasNodeFromDomAtPoint(clientX, clientY);
  if (fromDom) return fromDom;

  const flow = screenToFlowPosition({ x: clientX, y: clientY });
  const hits: Array<{ id: string; z: number }> = [];

  for (const node of nodes) {
    if (!node.type || isGroupNode(node.type)) continue;
    const pos = pro2NodeAbsolutePosition(node, nodes);
    const { w, h } = pro2NodeBoxSize(node);
    if (
      flow.x < pos.x ||
      flow.x > pos.x + w ||
      flow.y < pos.y ||
      flow.y > pos.y + h
    ) {
      continue;
    }
    hits.push({ id: node.id, z: node.zIndex ?? 0 });
  }

  if (!hits.length) return null;
  hits.sort((a, b) => b.z - a.z);
  return hits[0]!.id;
}
