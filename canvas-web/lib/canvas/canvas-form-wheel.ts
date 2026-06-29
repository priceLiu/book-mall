import type { WheelEvent as ReactWheelEvent } from "react";

/** 画布内禁用滚轮滚动的控件（仅允许拖动滚动条；滚轮交给画布平移） */
export const CANVAS_FORM_WHEEL_SELECTOR = "textarea, select";

/** Pro2 节点内可滚动预览区：滚轮在区内滚动内容（见 handlePro2NodeScrollWheel） */
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

/** LibTV 浮动 / 内嵌输入坞（prompt · @ 引用等） */
export const LIBTV_INPUT_DOCK_SELECTOR = "[data-libtv-input-dock]";

/** Dock 正文滚动区（textarea 自动增高，滚动条在此容器） */
export const LIBTV_DOCK_SCROLL_SELECTOR = ".pro2-dock-scroll";

function isHorizontalDominantWheel(nativeEvent: WheelEvent): boolean {
  return Math.abs(nativeEvent.deltaX) > Math.abs(nativeEvent.deltaY);
}

function normalizeWheelDeltaY(
  nativeEvent: WheelEvent,
  scrollEl: HTMLElement,
): number {
  let dy = nativeEvent.deltaY;
  if (nativeEvent.deltaMode === WheelEvent.DOM_DELTA_LINE) {
    dy *= 16;
  } else if (nativeEvent.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
    dy *= scrollEl.clientHeight || 240;
  }
  return dy;
}

export function isCanvasFormWheelTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return !!target.closest(CANVAS_FORM_WHEEL_SELECTOR);
}

export function isCanvasNodeScrollWheelTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return !!target.closest(CANVAS_NODE_SCROLL_SELECTOR);
}

export function isLibtvInputDockWheelTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return !!target.closest(LIBTV_INPUT_DOCK_SELECTOR);
}

/** 滚轮不滚内容、交给 React Flow panOnScroll（textarea / select） */
export function isCanvasWheelScrollBlockTarget(target: EventTarget | null): boolean {
  if (isLibtvInputDockWheelTarget(target)) return false;
  if (isCanvasNodeScrollWheelTarget(target)) return false;
  return isCanvasFormWheelTarget(target);
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
  if (target.closest(LIBTV_INPUT_DOCK_SELECTOR)) return false;
  return true;
}

/** 是否应拦截 wheel 默认行为（含触控板横向后退/前进） */
export function shouldBlockCanvasViewportWheel(nativeEvent: WheelEvent): boolean {
  const { target } = nativeEvent;
  if (!(target instanceof Element)) return false;
  if (nativeEvent.ctrlKey || nativeEvent.metaKey) return false;
  if (target.closest(CANVAS_NATIVE_SCROLL_SELECTOR)) return false;
  if (target.closest(LIBTV_INPUT_DOCK_SELECTOR)) return false;

  const horizontal = isHorizontalDominantWheel(nativeEvent);
  const inEditor = isCanvasEditorWheelTarget(target);
  const inViewport = !!target.closest(CANVAS_VIEWPORT_WHEEL_ROOT);

  // 编辑页内任意横向滑动手势：禁止触发浏览器历史导航
  if (horizontal && inEditor) return true;

  if (!inViewport) return false;
  if (target.closest(".nowheel") && !horizontal) return false;
  return true;
}

function resolveLibtvDockScrollEl(target: Element): HTMLElement | null {
  const dock = target.closest(LIBTV_INPUT_DOCK_SELECTOR);
  if (dock) {
    const ta = target.closest("textarea");
    if (ta && dock.contains(ta) && ta.scrollHeight > ta.clientHeight + 1) {
      return ta;
    }
  }

  const direct = target.closest(
    LIBTV_DOCK_SCROLL_SELECTOR,
  ) as HTMLElement | null;
  if (direct) return direct;
  return (
    (dock?.querySelector(LIBTV_DOCK_SCROLL_SELECTOR) as HTMLElement | null) ??
    null
  );
}

/**
 * Pro2 节点预览滚动区：滚轮在区内滚动表格/大纲；顶/底继续滚则交给画布平移。
 * @returns 是否已消费该 wheel 事件
 */
export function handlePro2NodeScrollWheel(nativeEvent: WheelEvent): boolean {
  const { target } = nativeEvent;
  if (!(target instanceof Element)) return false;
  if (nativeEvent.ctrlKey || nativeEvent.metaKey) return false;

  const scrollEl = target.closest(
    CANVAS_NODE_SCROLL_SELECTOR,
  ) as HTMLElement | null;
  if (!scrollEl) return false;

  const absX = Math.abs(nativeEvent.deltaX);
  const absY = Math.abs(nativeEvent.deltaY);
  const maxScrollY = scrollEl.scrollHeight - scrollEl.clientHeight;
  const maxScrollX = scrollEl.scrollWidth - scrollEl.clientWidth;

  if (maxScrollY <= 0.5 && maxScrollX <= 0.5) return false;

  if (absY >= absX && absY >= 1 && maxScrollY > 0.5) {
    const dy = normalizeWheelDeltaY(nativeEvent, scrollEl);
    const prevTop = scrollEl.scrollTop;
    const nextTop = Math.max(0, Math.min(maxScrollY, prevTop + dy));
    scrollEl.scrollTop = nextTop;

    const moved = Math.abs(nextTop - prevTop) > 0.5;
    const atTop = prevTop <= 0.5;
    const atBottom = prevTop >= maxScrollY - 0.5;
    const scrollingUp = dy < 0;
    const scrollingDown = dy > 0;

    if (!moved && ((atTop && scrollingUp) || (atBottom && scrollingDown))) {
      return false;
    }

    nativeEvent.preventDefault();
    nativeEvent.stopPropagation();
    if (typeof nativeEvent.stopImmediatePropagation === "function") {
      nativeEvent.stopImmediatePropagation();
    }
    return true;
  }

  if (absX >= 1 && maxScrollX > 0.5) {
    const prevLeft = scrollEl.scrollLeft;
    const nextLeft = Math.max(
      0,
      Math.min(maxScrollX, prevLeft + nativeEvent.deltaX),
    );
    scrollEl.scrollLeft = nextLeft;
    if (Math.abs(nextLeft - prevLeft) > 0.5) {
      nativeEvent.preventDefault();
      nativeEvent.stopPropagation();
      if (typeof nativeEvent.stopImmediatePropagation === "function") {
        nativeEvent.stopImmediatePropagation();
      }
      return true;
    }
  }

  return false;
}

/**
 * LibTV 输入坞：手动滚动 `.pro2-dock-scroll`（textarea 无内滚，滚轮不会自动冒泡到父级）。
 * 须在画布 capture 最前执行并 stopPropagation，避免 React Flow panOnScroll 抢事件。
 * @returns 是否已消费该 wheel 事件
 */
export function handleLibtvDockWheelScroll(nativeEvent: WheelEvent): boolean {
  const { target } = nativeEvent;
  if (!(target instanceof Element)) return false;
  if (!target.closest(LIBTV_INPUT_DOCK_SELECTOR)) return false;
  if (nativeEvent.ctrlKey || nativeEvent.metaKey) return false;

  const scrollEl = resolveLibtvDockScrollEl(target);
  if (!scrollEl) return false;

  const absX = Math.abs(nativeEvent.deltaX);
  const absY = Math.abs(nativeEvent.deltaY);
  if (absY < 1 || absY <= absX) return false;

  const maxScroll = scrollEl.scrollHeight - scrollEl.clientHeight;
  if (maxScroll <= 0.5) return false;

  const dy = normalizeWheelDeltaY(nativeEvent, scrollEl);
  const prevTop = scrollEl.scrollTop;
  const nextTop = Math.max(0, Math.min(maxScroll, prevTop + dy));
  scrollEl.scrollTop = nextTop;

  const atTop = prevTop <= 0.5;
  const atBottom = prevTop >= maxScroll - 0.5;
  const scrollingUp = dy < 0;
  const scrollingDown = dy > 0;
  const moved = Math.abs(nextTop - prevTop) > 0.5;

  // 顶/底继续滚：交给画布平移
  if (!moved && ((atTop && scrollingUp) || (atBottom && scrollingDown))) {
    return false;
  }

  nativeEvent.preventDefault();
  nativeEvent.stopPropagation();
  if (typeof nativeEvent.stopImmediatePropagation === "function") {
    nativeEvent.stopImmediatePropagation();
  }
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
  if (handlePro2NodeScrollWheel(nativeEvent)) return;
  if (handleLibtvDockWheelScroll(nativeEvent)) return;
  blockCanvasFormWheelScroll(nativeEvent);
  blockCanvasViewportWheelNavigation(nativeEvent);
}

export function onCanvasFormWheel(e: ReactWheelEvent<HTMLElement>): void {
  handleCanvasWheel(e.nativeEvent);
}

/** scroll 容器 onWheelCapture 双保险（主逻辑在 {@link handleCanvasWheel}） */
export function onLibtvDockScrollWheelCapture(
  e: ReactWheelEvent<HTMLElement>,
): void {
  handleLibtvDockWheelScroll(e.nativeEvent);
}

/** 画布容器 capture：Dock 滚动优先，其次表单 + 视口平移 */
export const onCanvasWheelCapture = onCanvasFormWheel;

/** @deprecated 使用 {@link onCanvasWheelCapture} */
export const onCanvasFormWheelCapture = onCanvasWheelCapture;
