"use client";

import { useMemo, type ReactNode } from "react";

import { GlobalAssetLibraryProvider } from "@/docker-shared/global-asset-library";
import { createEcomGlobalAssetLibraryApi } from "@/lib/global-asset-library-api";

export function EcomGlobalAssetLibraryRoot({ children }: { children: ReactNode }) {
  const api = useMemo(() => createEcomGlobalAssetLibraryApi(), []);
  return (
    <GlobalAssetLibraryProvider api={api} variant="light">
      {children}
    </GlobalAssetLibraryProvider>
  );
}
