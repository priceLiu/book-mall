import { CANVAS_BLOCK_NAV_GESTURE_SELECTOR } from "@/lib/canvas/canvas-form-wheel";

/** 画布项目页打开时挂到 `<html>`，用于锁滚动 + 全页拦截鼠标侧键 */
export const CANVAS_EDITOR_PAGE_HTML_ATTR = "data-canvas-editor-open";

/** 鼠标侧键：3=后退，4=前进（DOM MouseEvent.button） */
export function isCanvasBrowserNavMouseButton(button: number): boolean {
  return button === 3 || button === 4;
}

export function isCanvasBrowserNavTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return !!target.closest(CANVAS_BLOCK_NAV_GESTURE_SELECTOR);
}

/** 画布项目页是否处于「须拦截浏览器后退/前进手势」状态 */
export function isCanvasEditorPageNavBlockActive(): boolean {
  if (typeof document === "undefined") return false;
  if (document.documentElement.hasAttribute(CANVAS_EDITOR_PAGE_HTML_ATTR)) {
    return true;
  }
  return !!document.querySelector("[data-canvas-editor]");
}

export function shouldBlockCanvasBrowserNavMouse(event: MouseEvent): boolean {
  if (!isCanvasBrowserNavMouseButton(event.button)) return false;
  if (isCanvasEditorPageNavBlockActive()) return true;
  return isCanvasBrowserNavTarget(event.target);
}

/** 阻止鼠标侧键触发浏览器历史后退/前进（画布内平移/框选时易误触）。 */
export function blockCanvasBrowserNavMouse(event: MouseEvent): void {
  if (!shouldBlockCanvasBrowserNavMouse(event)) return;
  event.preventDefault();
  event.stopPropagation();
  if (typeof event.stopImmediatePropagation === "function") {
    event.stopImmediatePropagation();
  }
}

/** 在 document capture 阶段安装侧键拦截；返回卸载函数。 */
export function installCanvasBrowserNavBlock(): () => void {
  const onMouse = (event: MouseEvent) => blockCanvasBrowserNavMouse(event);
  const captureOpts: AddEventListenerOptions = { capture: true };
  const capturePassiveFalse: AddEventListenerOptions = {
    capture: true,
    passive: false,
  };

  document.addEventListener("pointerdown", onMouse, capturePassiveFalse);
  document.addEventListener("mousedown", onMouse, capturePassiveFalse);
  document.addEventListener("mouseup", onMouse, captureOpts);
  document.addEventListener("pointerup", onMouse, captureOpts);
  document.addEventListener("auxclick", onMouse, captureOpts);
  document.addEventListener("click", onMouse, captureOpts);

  return () => {
    document.removeEventListener("pointerdown", onMouse, capturePassiveFalse);
    document.removeEventListener("mousedown", onMouse, capturePassiveFalse);
    document.removeEventListener("mouseup", onMouse, captureOpts);
    document.removeEventListener("pointerup", onMouse, captureOpts);
    document.removeEventListener("auxclick", onMouse, captureOpts);
    document.removeEventListener("click", onMouse, captureOpts);
  };
}

/** 画布项目页：锁 html 滚动 + 全页拦截鼠标侧键；返回卸载函数。 */
export function installCanvasEditorPageNavGuards(): () => void {
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute(CANVAS_EDITOR_PAGE_HTML_ATTR, "");
  }
  const uninstallBlock = installCanvasBrowserNavBlock();
  return () => {
    uninstallBlock();
    if (typeof document !== "undefined") {
      document.documentElement.removeAttribute(CANVAS_EDITOR_PAGE_HTML_ATTR);
    }
  };
}
