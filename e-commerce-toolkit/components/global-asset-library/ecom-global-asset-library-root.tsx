"use client";

import { usePathname } from "next/navigation";
import { useCallback, useMemo, type ReactNode } from "react";

import { GlobalAssetLibraryProvider } from "@/docker-shared/global-asset-library";
import { createEcomGlobalAssetLibraryApi } from "@/lib/global-asset-library-api";
import { unlockEcomDocumentInteraction } from "@/lib/ecom-document-unlock";

export function EcomGlobalAssetLibraryRoot({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const api = useMemo(() => createEcomGlobalAssetLibraryApi(), []);
  const onRouteChange = useCallback(() => {
    unlockEcomDocumentInteraction();
  }, []);

  return (
    <GlobalAssetLibraryProvider
      api={api}
      variant="light"
      defaultApp="ecom"
      routeChangeKey={pathname}
      onRouteChange={onRouteChange}
    >
      {children}
    </GlobalAssetLibraryProvider>
  );
}