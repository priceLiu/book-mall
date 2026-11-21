import type { MouseEvent } from "react";

import { unlockEcomDocumentInteraction } from "@/lib/ecom-document-unlock";
import {
  clearEcomSidebarNavIntent,
  markEcomSidebarNavIntent,
} from "@/lib/ecom-nav-in-flight";

const NAV_STUCK_MS = 700;

function normalizePath(href: string): string {
  const raw = href.trim();
  if (!raw) return "/";
  return raw.startsWith("/") ? raw.split("?")[0]! : `/${raw.split("?")[0]!}`;
}

type EcomSidebarRouter = {
  push: (href: string, options?: { scroll?: boolean }) => void;
};

function isModifiedClick(event: MouseEvent): boolean {
  return (
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    event.button !== 0
  );
}

/**
 * 侧栏站内导航：先 client router；若 transition 被工作台轮询打断则硬跳转（仅卡住时）。
 */
export function navigateEcomFromSidebar(
  router: EcomSidebarRouter,
  href: string,
  currentPathname: string,
  event?: MouseEvent,
): void {
  if (event && isModifiedClick(event)) return;

  const target = normalizePath(href);
  const current = normalizePath(currentPathname || "/");
  if (target === current) {
    clearEcomSidebarNavIntent();
    return;
  }

  unlockEcomDocumentInteraction();
  markEcomSidebarNavIntent();

  router.push(href, { scroll: false });

  window.setTimeout(() => {
    const path = window.location.pathname;
    if (path === current) {
      window.location.assign(href);
      return;
    }
    clearEcomSidebarNavIntent();
  }, NAV_STUCK_MS);
}