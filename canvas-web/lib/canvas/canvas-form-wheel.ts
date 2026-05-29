import type { WheelEvent as ReactWheelEvent } from "react";

/** 画布内禁用滚轮滚动的控件（仅允许拖动滚动条；滚轮交给画布平移） */
export const CANVAS_FORM_WHEEL_SELECTOR = "textarea, select";

export function isCanvasFormWheelTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return !!target.closest(CANVAS_FORM_WHEEL_SELECTOR);
}

/**
 * 在 textarea / select 上拦截滚轮默认行为（不滚内容），但不 stopPropagation，
 * 以便 React Flow `panOnScroll` 仍能平移画布。控件勿加 `nowheel`。
 */
export function blockCanvasFormWheelScroll(nativeEvent: WheelEvent): void {
  if (!isCanvasFormWheelTarget(nativeEvent.target)) return;
  nativeEvent.preventDefault();
}

export function onCanvasFormWheel(
  e: ReactWheelEvent<HTMLElement>,
): void {
  blockCanvasFormWheelScroll(e.nativeEvent);
}

/** @deprecated 使用 {@link onCanvasFormWheel}；保留别名避免漏改 import */
export const onCanvasFormWheelCapture = onCanvasFormWheel;
