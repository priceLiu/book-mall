"use client";

import { useCallback, useMemo, type ReactNode } from "react";

import { CanvasUnifiedAssetLibraryModal } from "@/components/canvas/canvas-unified-asset-library-modal";
import { PlatformAssetHubHost } from "@/components/canvas/platform-asset-hub/platform-asset-hub-host";
import { GlobalAssetLibraryProvider } from "@/docker-shared/global-asset-library";
import { createCanvasGlobalAssetLibraryApi } from "@/lib/global-asset-library-api";
import { useCanvasStore } from "@/lib/canvas/store";

export function CanvasGlobalAssetLibraryRoot({ children }: { children: ReactNode }) {
  const api = useMemo(() => createCanvasGlobalAssetLibraryApi(), []);
  const setGlobalAssetLibraryOpen = useCanvasStore((s) => s.setGlobalAssetLibraryOpen);
  const onOpenChange = useCallback(
    (open: boolean) => setGlobalAssetLibraryOpen(open),
    [setGlobalAssetLibraryOpen],
  );

  return (
    <GlobalAssetLibraryProvider
      api={api}
      variant="dark"
      defaultApp="canvas"
      onOpenChange={onOpenChange}
      UnifiedDialog={CanvasUnifiedAssetLibraryModal}
    >
      {children}
      <PlatformAssetHubHost />
    </GlobalAssetLibraryProvider>
  );
}
