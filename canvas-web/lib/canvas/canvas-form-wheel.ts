import type { WheelEvent as ReactWheelEvent } from "react";

/** 画布内禁用滚轮滚动的控件（仅允许拖动滚动条；滚轮交给画布平移） */
export const CANVAS_FORM_WHEEL_SELECTOR = "textarea, select";

/** Pro2 节点内可滚动预览区：勿加 nowheel，滚轮仍平移画布 */
export const CANVAS_NODE_SCROLL_SELECTOR = ".pro2-node-scroll";

/** React Flow 根 + 外层 wrap（选区工具条等在 wrap 内、flow 外） */
export const CANVAS_VIEWPORT_WHEEL_ROOT = ".react-flow, .canvas-flow-wrap";

/** 画布项目页编辑区根（含侧栏助手、工具条下方主区域） */
export const CANVAS_EDITOR_SELECTOR = "[data-canvas-editor]";

/** 挂到 body 的浮层（剧本助手沉浸式等）也须拦截横向滑动手势 */
export const CANVAS_BLOCK_NAV_GESTURE_SELECTOR =
  "[data-canvas-editor], [data-canvas-block-nav-gesture]";

/** 需要保留原生滚动的区域（侧栏、弹层列表等） */
export const CANVAS_NATIVE_SCROLL_SELECTOR = "[data-canvas-wheel-scroll]";

function isHorizontalDominantWheel(nativeEvent: WheelEvent): boolean {
  return Math.abs(nativeEvent.deltaX) > Math.abs(nativeEvent.deltaY);
}

export function isCanvasFormWheelTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return !!target.closest(CANVAS_FORM_WHEEL_SELECTOR);
}

export function isCanvasNodeScrollWheelTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return !!target.closest(CANVAS_NODE_SCROLL_SELECTOR);
}

/** 滚轮不滚内容、交给 React Flow panOnScroll（与 textarea 相同策略） */
export function isCanvasWheelScrollBlockTarget(target: EventTarget | null): boolean {
  return (
    isCanvasFormWheelTarget(target) || isCanvasNodeScrollWheelTarget(target)
  );
}

export function isCanvasEditorWheelTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return !!target.closest(CANVAS_BLOCK_NAV_GESTURE_SELECTOR);
}

export function isCanvasViewportWheelTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (!target.closest(CANVAS_VIEWPORT_WHEEL_ROOT)) return false;
  if (target.closest(".nowheel")) return false;
  if (target.closest(CANVAS_NATIVE_SCROLL_SELECTOR)) return false;
  return true;
}

/** 是否应拦截 wheel 默认行为（含触控板横向后退/前进） */
export function shouldBlockCanvasViewportWheel(nativeEvent: WheelEvent): boolean {
  const { target } = nativeEvent;
  if (!(target instanceof Element)) return false;
  if (nativeEvent.ctrlKey || nativeEvent.metaKey) return false;
  if (target.closest(CANVAS_NATIVE_SCROLL_SELECTOR)) return false;

  const horizontal = isHorizontalDominantWheel(nativeEvent);
  const inEditor = isCanvasEditorWheelTarget(target);
  const inViewport = !!target.closest(CANVAS_VIEWPORT_WHEEL_ROOT);

  // 编辑页内任意横向滑动手势：禁止触发浏览器历史导航
  if (horizontal && inEditor) return true;

  if (!inViewport) return false;
  if (target.closest(".nowheel") && !horizontal) return false;
  return true;
}

/**
 * 在 textarea / select 上拦截滚轮默认行为（不滚内容），但不 stopPropagation，
 * 以便 React Flow `panOnScroll` 仍能平移画布。控件勿加 `nowheel`。
 */
export function blockCanvasFormWheelScroll(nativeEvent: WheelEvent): void {
  if (!isCanvasWheelScrollBlockTarget(nativeEvent.target)) return;
  nativeEvent.preventDefault();
}

/**
 * 拦截画布视口上的 wheel 默认行为，避免触控板横向滑动触发浏览器后退/前进，
 * 同时让 React Flow `panOnScroll`（含 Free 模式横向平移）接管。
 */
export function blockCanvasViewportWheelNavigation(nativeEvent: WheelEvent): void {
  if (!shouldBlockCanvasViewportWheel(nativeEvent)) return;
  nativeEvent.preventDefault();
}

export function handleCanvasWheel(nativeEvent: WheelEvent): void {
  blockCanvasFormWheelScroll(nativeEvent);
  blockCanvasViewportWheelNavigation(nativeEvent);
}

export function onCanvasFormWheel(e: ReactWheelEvent<HTMLElement>): void {
  handleCanvasWheel(e.nativeEvent);
}

/** 画布容器 capture：表单 + 视口平移 */
export const onCanvasWheelCapture = onCanvasFormWheel;

/** @deprecated 使用 {@link onCanvasWheelCapture} */
export const onCanvasFormWheelCapture = onCanvasWheelCapture;
