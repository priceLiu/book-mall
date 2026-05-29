import type { WheelEvent as ReactWheelEvent } from "react";

/** 画布内禁用滚轮滚动的控件（仅允许拖动滚动条；滚轮交给画布平移） */
export const CANVAS_FORM_WHEEL_SELECTOR = "textarea, select";

/** React Flow 根节点；其内滚轮用于平移，须拦截浏览器横向滑动手势（后退/前进） */
export const CANVAS_VIEWPORT_WHEEL_ROOT = ".react-flow";

/** 需要保留原生滚动的区域（侧栏、弹层列表等） */
export const CANVAS_NATIVE_SCROLL_SELECTOR = "[data-canvas-wheel-scroll]";

export function isCanvasFormWheelTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return !!target.closest(CANVAS_FORM_WHEEL_SELECTOR);
}

export function isCanvasViewportWheelTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (!target.closest(CANVAS_VIEWPORT_WHEEL_ROOT)) return false;
  if (target.closest(".nowheel")) return false;
  if (target.closest(CANVAS_NATIVE_SCROLL_SELECTOR)) return false;
  return true;
}

/**
 * 在 textarea / select 上拦截滚轮默认行为（不滚内容），但不 stopPropagation，
 * 以便 React Flow `panOnScroll` 仍能平移画布。控件勿加 `nowheel`。
 */
export function blockCanvasFormWheelScroll(nativeEvent: WheelEvent): void {
  if (!isCanvasFormWheelTarget(nativeEvent.target)) return;
  nativeEvent.preventDefault();
}

/**
 * 拦截画布视口上的 wheel 默认行为，避免触控板横向滑动触发浏览器后退/前进，
 * 同时让 React Flow `panOnScroll`（含 Free 模式横向平移）接管。
 */
export function blockCanvasViewportWheelNavigation(nativeEvent: WheelEvent): void {
  if (nativeEvent.ctrlKey || nativeEvent.metaKey) return;
  if (!isCanvasViewportWheelTarget(nativeEvent.target)) return;
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
