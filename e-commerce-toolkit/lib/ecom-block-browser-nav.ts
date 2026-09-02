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

export type EcomWorkspaceNavGuardOptions = {
  /** popstate 触发后同步 SPA 路由（Next.js App Router） */
  onNavBlocked?: (lockedHref: string) => void;
};

let lockedWorkspaceHref = "";
let navBlockedHandler: EcomWorkspaceNavGuardOptions["onNavBlocked"];

function pushEcomWorkspaceHistoryTrap(href: string): void {
  if (typeof window === "undefined") return;
  if (!isEcomWorkspaceNavBlockActive()) return;
  lockedWorkspaceHref = href;
  try {
    window.history.pushState({ __ecomWorkspaceNavTrap: true }, "", href);
  } catch {
    /* quota / sandbox */
  }
}

/** 路由切换后刷新锁定 URL（仍禁止浏览器后退离开当前页）。 */
export function syncEcomWorkspaceNavTrapUrl(href?: string): void {
  if (typeof window === "undefined") return;
  pushEcomWorkspaceHistoryTrap(href ?? window.location.href);
}

export function installEcomHistoryPopstateTrap(
  opts?: EcomWorkspaceNavGuardOptions,
): () => void {
  if (typeof window === "undefined") return () => undefined;

  navBlockedHandler = opts?.onNavBlocked;
  pushEcomWorkspaceHistoryTrap(window.location.href);

  const onPopState = () => {
    if (!isEcomWorkspaceNavBlockActive()) return;
    if (!lockedWorkspaceHref) {
      lockedWorkspaceHref = window.location.href;
    }
    try {
      window.history.pushState(
        { __ecomWorkspaceNavTrap: true },
        "",
        lockedWorkspaceHref,
      );
    } catch {
      /* quota / sandbox */
    }
    navBlockedHandler?.(lockedWorkspaceHref);
  };

  window.addEventListener("popstate", onPopState);
  return () => {
    window.removeEventListener("popstate", onPopState);
    navBlockedHandler = undefined;
    lockedWorkspaceHref = "";
  };
}

/** 电商工作台页：拦截浏览器 history.back/forward；返回卸载函数。 */
export function installEcomWorkspaceNavGuards(
  opts?: EcomWorkspaceNavGuardOptions,
): () => void {
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute(ECOM_WORKSPACE_PAGE_HTML_ATTR, "");
  }
  const uninstallBlock = installEcomBrowserNavBlock();
  const uninstallHistoryTrap = installEcomHistoryPopstateTrap(opts);
  return () => {
    uninstallHistoryTrap();
    uninstallBlock();
    if (typeof document !== "undefined") {
      document.documentElement.removeAttribute(ECOM_WORKSPACE_PAGE_HTML_ATTR);
    }
  };
}

/** @alias installEcomWorkspaceNavGuards */
export const installEcomSiteNavGuards = installEcomWorkspaceNavGuards;
