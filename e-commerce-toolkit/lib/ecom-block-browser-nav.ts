/** 电商工作台页打开时挂到 `<html>`，用于拦截浏览器后退/前进手势 */
export const ECOM_WORKSPACE_PAGE_HTML_ATTR = "data-ecom-workspace-open";

/** 鼠标侧键：3=后退，4=前进（DOM MouseEvent.button） */
export function isEcomBrowserNavMouseButton(button: number): boolean {
  return button === 3 || button === 4;
}

export function isEcomWorkspaceNavBlockActive(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.hasAttribute(ECOM_WORKSPACE_PAGE_HTML_ATTR);
}

export function shouldBlockEcomBrowserNavMouse(event: MouseEvent): boolean {
  if (!isEcomBrowserNavMouseButton(event.button)) return false;
  return isEcomWorkspaceNavBlockActive();
}

export function blockEcomBrowserNavMouse(event: MouseEvent): void {
  if (!shouldBlockEcomBrowserNavMouse(event)) return;
  event.preventDefault();
  event.stopPropagation();
  if (typeof event.stopImmediatePropagation === "function") {
    event.stopImmediatePropagation();
  }
}

export function installEcomBrowserNavBlock(): () => void {
  const onMouse = (event: MouseEvent) => blockEcomBrowserNavMouse(event);
  const captureOpts: AddEventListenerOptions = { capture: true, passive: false };
  const targets: EventTarget[] = [document, window];
  const eventNames = [
    "pointerdown",
    "mousedown",
    "mouseup",
    "pointerup",
    "auxclick",
    "click",
  ] as const;

  for (const target of targets) {
    for (const name of eventNames) {
      target.addEventListener(name, onMouse as EventListener, captureOpts);
    }
  }

  return () => {
    for (const target of targets) {
      for (const name of eventNames) {
        target.removeEventListener(name, onMouse as EventListener, captureOpts);
      }
    }
  };
}

export function installEcomHistoryPopstateTrap(): () => void {
  if (typeof window === "undefined") return () => undefined;

  const pushTrap = () => {
    if (!isEcomWorkspaceNavBlockActive()) return;
    try {
      window.history.pushState({ __ecomWorkspaceNavTrap: true }, "", window.location.href);
    } catch {
      /* quota / sandbox */
    }
  };

  pushTrap();

  const onPopState = () => {
    if (!isEcomWorkspaceNavBlockActive()) return;
    pushTrap();
  };

  window.addEventListener("popstate", onPopState);
  return () => window.removeEventListener("popstate", onPopState);
}

/** 电商工作台页：拦截浏览器 history.back/forward；返回卸载函数。 */
export function installEcomWorkspaceNavGuards(): () => void {
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute(ECOM_WORKSPACE_PAGE_HTML_ATTR, "");
  }
  const uninstallBlock = installEcomBrowserNavBlock();
  const uninstallHistoryTrap = installEcomHistoryPopstateTrap();
  return () => {
    uninstallHistoryTrap();
    uninstallBlock();
    if (typeof document !== "undefined") {
      document.documentElement.removeAttribute(ECOM_WORKSPACE_PAGE_HTML_ATTR);
    }
  };
}
