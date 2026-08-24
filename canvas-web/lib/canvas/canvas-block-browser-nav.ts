import { CANVAS_BLOCK_NAV_GESTURE_SELECTOR } from "@/lib/canvas/canvas-form-wheel";

/** 鼠标侧键：3=后退，4=前进（DOM MouseEvent.button） */
export function isCanvasBrowserNavMouseButton(button: number): boolean {
  return button === 3 || button === 4;
}

export function isCanvasBrowserNavTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return !!target.closest(CANVAS_BLOCK_NAV_GESTURE_SELECTOR);
}

export function shouldBlockCanvasBrowserNavMouse(event: MouseEvent): boolean {
  if (!isCanvasBrowserNavMouseButton(event.button)) return false;
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
  const opts: AddEventListenerOptions = { capture: true };

  document.addEventListener("pointerdown", onMouse, opts);
  document.addEventListener("mousedown", onMouse, opts);
  document.addEventListener("mouseup", onMouse, opts);
  document.addEventListener("auxclick", onMouse, opts);

  return () => {
    document.removeEventListener("pointerdown", onMouse, opts);
    document.removeEventListener("mousedown", onMouse, opts);
    document.removeEventListener("mouseup", onMouse, opts);
    document.removeEventListener("auxclick", onMouse, opts);
  };
}
