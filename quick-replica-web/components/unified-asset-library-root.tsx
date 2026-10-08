"use client";

import { useMemo, type ReactNode } from "react";

import { GlobalAssetLibraryProvider } from "@/docker-shared/global-asset-library";
import { createQrUnifiedAssetLibraryApi } from "@/lib/unified-asset-library-api";

export function UnifiedAssetLibraryRoot({ children }: { children: ReactNode }) {
  const api = useMemo(() => createQrUnifiedAssetLibraryApi(), []);
  return (
    <GlobalAssetLibraryProvider api={api} variant="light" defaultApp="quick-replica">
      {children}
    </GlobalAssetLibraryProvider>
  );
}
