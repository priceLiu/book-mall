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

/** 路由切换后仅更新锁定 URL（勿 pushState，避免与 Next 侧栏导航争用 popstate）。 */
export function syncEcomWorkspaceNavTrapUrl(href?: string): void {
  if (typeof window === "undefined") return;
  if (!isEcomWorkspaceNavBlockActive()) return;
  lockedWorkspaceHref = href ?? window.location.href;
}

/** 站内链接点击前调用（capture 阶段），避免 popstate 时 locked 仍指向上页导致被 replace 拉回。 */
export function primeEcomWorkspaceNavTrapFromAnchor(anchor: HTMLAnchorElement): void {
  if (typeof window === "undefined") return;
  if (!isEcomWorkspaceNavBlockActive()) return;
  const href = anchor.getAttribute("href");
  if (!href || href.startsWith("#")) return;
  if (anchor.target === "_blank") return;
  try {
    const u = new URL(href, window.location.href);
    if (u.origin !== window.location.origin) return;
    syncEcomWorkspaceNavTrapUrl(u.href);
  } catch {
    /* ignore */
  }
}

export function installEcomHistoryPopstateTrap(
  opts?: EcomWorkspaceNavGuardOptions,
): () => void {
  if (typeof window === "undefined") return () => undefined;

  navBlockedHandler = opts?.onNavBlocked;
  lockedWorkspaceHref = window.location.href;
  try {
    window.history.replaceState(
      { __ecomWorkspaceNavTrap: true },
      "",
      window.location.href,
    );
  } catch {
    /* quota / sandbox */
  }

  const onPopState = () => {
    if (!isEcomWorkspaceNavBlockActive()) return;
    const locked = lockedWorkspaceHref || window.location.href;
    lockedWorkspaceHref = locked;
    const afterPop = window.location.href;

    try {
      window.history.pushState({ __ecomWorkspaceNavTrap: true }, "", locked);
    } catch {
      /* quota / sandbox */
    }

    // 仍是锁定页或用户已通过侧栏 primed 前进：勿 router.replace 拉回
    if (afterPop === locked || window.location.href === locked) {
      return;
    }
    navBlockedHandler?.(locked);
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
