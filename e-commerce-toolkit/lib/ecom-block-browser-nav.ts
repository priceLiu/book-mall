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

/** @deprecated 历史陷阱已移除，仅保留别名避免调用方报错 */
export function syncEcomWorkspaceNavTrapUrl(_href?: string): void {}

/** @deprecated 历史陷阱已移除 */
export function primeEcomWorkspaceNavTrapFromAnchor(_anchor: HTMLAnchorElement): void {}

export type EcomWorkspaceNavGuardOptions = {
  onNavBlocked?: (lockedHref: string) => void;
};

/**
 * 电商工作台：仅拦截鼠标侧键后退/前进（防误触离开长任务页）。
 * 不再使用 history.pushState / popstate + router.replace，避免与 Next 侧栏 Link 争用。
 */
export function installEcomWorkspaceNavGuards(
  _opts?: EcomWorkspaceNavGuardOptions,
): () => void {
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute(ECOM_WORKSPACE_PAGE_HTML_ATTR, "");
  }
  const uninstallBlock = installEcomBrowserNavBlock();
  return () => {
    uninstallBlock();
    if (typeof document !== "undefined") {
      document.documentElement.removeAttribute(ECOM_WORKSPACE_PAGE_HTML_ATTR);
    }
  };
}

/** @alias installEcomWorkspaceNavGuards */
export const installEcomSiteNavGuards = installEcomWorkspaceNavGuards;