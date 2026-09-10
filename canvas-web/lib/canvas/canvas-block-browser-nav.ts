import { CANVAS_BLOCK_NAV_GESTURE_SELECTOR } from "@/lib/canvas/canvas-form-wheel";

/** 画布项目页打开时挂到 `<html>`，用于锁滚动 + 全页拦截鼠标侧键 */
export const CANVAS_EDITOR_PAGE_HTML_ATTR = "data-canvas-editor-open";

/** 画布整站打开时挂到 `<html>`，拦截浏览器后退/前进 */
export const CANVAS_SITE_NAV_BLOCK_HTML_ATTR = "data-canvas-site-nav-block";

/** 鼠标侧键：3=后退，4=前进（DOM MouseEvent.button） */
export function isCanvasBrowserNavMouseButton(button: number): boolean {
  return button === 3 || button === 4;
}

export function isCanvasBrowserNavTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return !!target.closest(CANVAS_BLOCK_NAV_GESTURE_SELECTOR);
}

/** 画布整站 / 编辑页是否处于「须拦截浏览器后退/前进手势」状态 */
export function isCanvasNavBlockActive(): boolean {
  if (typeof document === "undefined") return false;
  if (document.documentElement.hasAttribute(CANVAS_SITE_NAV_BLOCK_HTML_ATTR)) {
    return true;
  }
  if (document.documentElement.hasAttribute(CANVAS_EDITOR_PAGE_HTML_ATTR)) {
    return true;
  }
  return !!document.querySelector("[data-canvas-editor]");
}

/** @deprecated 使用 isCanvasNavBlockActive */
export function isCanvasEditorPageNavBlockActive(): boolean {
  return isCanvasNavBlockActive();
}

export function shouldBlockCanvasBrowserNavMouse(event: MouseEvent): boolean {
  if (!isCanvasBrowserNavMouseButton(event.button)) return false;
  if (isCanvasNavBlockActive()) return true;
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

/** 在 document / window capture 阶段安装侧键拦截；返回卸载函数。 */
export function installCanvasBrowserNavBlock(): () => void {
  const onMouse = (event: MouseEvent) => blockCanvasBrowserNavMouse(event);
  const capturePassiveFalse: AddEventListenerOptions = {
    capture: true,
    passive: false,
  };
  const captureOpts: AddEventListenerOptions = { capture: true, passive: false };

  const targets: Array<[EventTarget, AddEventListenerOptions]> = [
    [document, capturePassiveFalse],
    [window, capturePassiveFalse],
  ];
  const eventNames = [
    "pointerdown",
    "mousedown",
    "mouseup",
    "pointerup",
    "auxclick",
    "click",
  ] as const;

  const onKeyDown = (event: KeyboardEvent) => blockCanvasBrowserNavKeyboard(event);
  const keyOpts: AddEventListenerOptions = { capture: true };

  for (const [target, opts] of targets) {
    for (const name of eventNames) {
      target.addEventListener(name, onMouse as EventListener, opts);
    }
  }
  window.addEventListener("keydown", onKeyDown, keyOpts);

  return () => {
    window.removeEventListener("keydown", onKeyDown, keyOpts);
    for (const [target, opts] of targets) {
      for (const name of eventNames) {
        target.removeEventListener(name, onMouse as EventListener, opts);
      }
    }
  };
}

const CANVAS_NAV_TRAP_STATE = { __canvasNavTrap: true as const };

/** 初始压入多条 trap，避免 history 栈较浅时一次 back 就离开编辑页 */
const CANVAS_NAV_TRAP_SEED_DEPTH = 3;

function isEditableNavTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest("input, textarea, select, [contenteditable=''], [contenteditable='true']"),
  );
}

/** Alt+←/→、Cmd+[ / ] 等键盘后退/前进 */
export function blockCanvasBrowserNavKeyboard(event: KeyboardEvent): void {
  if (!isCanvasNavBlockActive()) return;
  if (isEditableNavTarget(event.target)) return;

  const key = event.key;
  const blocksAlt =
    event.altKey && (key === "ArrowLeft" || key === "ArrowRight" || key === "Left" || key === "Right");
  const blocksMeta =
    event.metaKey && !event.altKey && !event.ctrlKey && (key === "[" || key === "]");
  if (!blocksAlt && !blocksMeta) return;

  event.preventDefault();
  event.stopPropagation();
  if (typeof event.stopImmediatePropagation === "function") {
    event.stopImmediatePropagation();
  }
}

/** 画布编辑页 / 整站：拦截浏览器 history.back/forward（侧键 / 触控板手势兜底）。 */
export function installCanvasHistoryPopstateTrap(): () => void {
  if (typeof window === "undefined") return () => undefined;

  let cancelPopstate = false;

  const pushTrap = () => {
    if (!isCanvasNavBlockActive()) return;
    try {
      window.history.pushState(CANVAS_NAV_TRAP_STATE, "", window.location.href);
    } catch {
      /* quota / sandbox */
    }
  };

  const seedTraps = () => {
    for (let i = 0; i < CANVAS_NAV_TRAP_SEED_DEPTH; i += 1) {
      pushTrap();
    }
  };

  seedTraps();

  const onPopState = () => {
    if (!isCanvasNavBlockActive() || cancelPopstate) return;
    cancelPopstate = true;
    try {
      // 立即抵消 back/forward，避免 Next 路由随 popstate 切走编辑页
      window.history.go(1);
    } catch {
      pushTrap();
    } finally {
      window.queueMicrotask(() => {
        cancelPopstate = false;
        if (isCanvasNavBlockActive()) pushTrap();
      });
    }
  };

  window.addEventListener("popstate", onPopState);
  return () => window.removeEventListener("popstate", onPopState);
}

/** 画布编辑页：仅锁 html 滚动（导航拦截由整站 Guard 负责）。 */
export function installCanvasEditorPageScrollLock(): () => void {
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute(CANVAS_EDITOR_PAGE_HTML_ATTR, "");
  }
  return () => {
    if (typeof document !== "undefined") {
      document.documentElement.removeAttribute(CANVAS_EDITOR_PAGE_HTML_ATTR);
    }
  };
}

/** 画布整站：拦截浏览器 history.back/forward + 鼠标侧键；返回卸载函数。 */
export function installCanvasSiteNavGuards(): () => void {
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute(CANVAS_SITE_NAV_BLOCK_HTML_ATTR, "");
  }
  const uninstallBlock = installCanvasBrowserNavBlock();
  const uninstallHistoryTrap = installCanvasHistoryPopstateTrap();
  return () => {
    uninstallHistoryTrap();
    uninstallBlock();
    if (typeof document !== "undefined") {
      document.documentElement.removeAttribute(CANVAS_SITE_NAV_BLOCK_HTML_ATTR);
    }
  };
}

/** 画布编辑页：history 拦截 + 侧键 + 键盘后退/前进 + html 滚动锁 */
export function installCanvasEditorPageNavGuards(): () => void {
  const uninstallScrollLock = installCanvasEditorPageScrollLock();
  const uninstallBlock = installCanvasBrowserNavBlock();
  const uninstallHistoryTrap = installCanvasHistoryPopstateTrap();
  return () => {
    uninstallHistoryTrap();
    uninstallBlock();
    uninstallScrollLock();
  };
}
