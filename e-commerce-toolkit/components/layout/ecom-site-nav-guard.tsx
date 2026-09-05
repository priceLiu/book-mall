"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";

import {
  installEcomSiteNavGuards,
  syncEcomWorkspaceNavTrapUrl,
} from "@/lib/ecom-block-browser-nav";

function hrefFromPath(pathname: string, search: string): string {
  if (typeof window === "undefined") return pathname;
  return `${window.location.origin}${pathname}${search}${window.location.hash}`;
}

function EcomSiteNavGuardInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;

  useEffect(() => {
    return installEcomSiteNavGuards({
      onNavBlocked: (lockedHref) => {
        const url = new URL(lockedHref);
        routerRef.current.replace(`${url.pathname}${url.search}${url.hash}`);
      },
    });
  }, []);

  const search = searchParams.toString();
  const searchSuffix = search ? `?${search}` : "";

  useEffect(() => {
    syncEcomWorkspaceNavTrapUrl(hrefFromPath(pathname, searchSuffix));
  }, [pathname, searchSuffix]);

  return null;
}

/** 电商工具箱整站 · 禁止浏览器后退/前进（侧键、触控板手势、history.back） */
export function EcomSiteNavGuard() {
  return (
    <Suspense fallback={null}>
      <EcomSiteNavGuardInner />
    </Suspense>
  );
}
