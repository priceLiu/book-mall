"use client";

import { Suspense, useEffect } from "react";

import { unlockEcomDocumentInteraction } from "@/lib/ecom-document-unlock";
import { installEcomSiteNavGuards, primeEcomWorkspaceNavTrapFromAnchor } from "@/lib/ecom-block-browser-nav";

/** 电商工具箱整站 · 拦截鼠标侧键后退/前进；站内链接点击前解锁 body */
function EcomSiteNavGuardInner() {
  useEffect(() => installEcomSiteNavGuards(), []);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest("a[href]");
      if (!anchor || !(anchor instanceof HTMLAnchorElement)) return;
      primeEcomWorkspaceNavTrapFromAnchor(anchor);
      unlockEcomDocumentInteraction();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, []);

  return null;
}

export function EcomSiteNavGuard() {
  return (
    <Suspense fallback={null}>
      <EcomSiteNavGuardInner />
    </Suspense>
  );
}