"use client";

import { useCallback, useMemo } from "react";

import type { GlobalAssetCatalogKind } from "@/docker-shared/global-asset-library";
import { useGlobalAssetLibrary } from "@/docker-shared/global-asset-library";
import { buildCanvasGlobalAssetSaveContext } from "@/lib/canvas/global-asset-save-context";
import { useCanvasStore } from "@/lib/canvas/store";
import { pickStoryQwen38MaxLlmEngine } from "@/lib/canvas/system-providers";
import { useUserProviders } from "@/lib/canvas/use-user-providers";
import { useCanvasAdmin } from "@/components/home/use-canvas-admin";

type SaveToCatalogArgs = {
  url: string;
  prompt?: string | null;
  sourceModule?: string;
  sourceAssetId?: string;
  defaultCatalog?: GlobalAssetCatalogKind;
  onCatalogSaved?: () => void;
};

export function useSaveToCatalog() {
  const { openGlobalAssetLibrary } = useGlobalAssetLibrary();
  const projectId = useCanvasStore((s) => s.projectId);
  const { providers } = useUserProviders();
  const isPlatformAdmin = useCanvasAdmin();
  const visionModelKey = useMemo(
    () => pickStoryQwen38MaxLlmEngine(providers).modelKey,
    [providers],
  );

  return useCallback(
    ({
      url,
      prompt,
      sourceModule = "canvas",
      sourceAssetId,
      defaultCatalog = "garment",
      onCatalogSaved,
    }: SaveToCatalogArgs) => {
      if (!url.trim()) return;
      openGlobalAssetLibrary({
        mode: "save",
        sourceImage: {
          url: url.trim(),
          prompt: prompt?.trim() || undefined,
          sourceModule,
          sourceAssetId,
        },
        defaultTab: "catalog",
        defaultCatalog,
        saveContext: buildCanvasGlobalAssetSaveContext(
          projectId,
          visionModelKey,
          isPlatformAdmin,
        ),
        onCatalogSaved,
      });
    },
    [openGlobalAssetLibrary, projectId, visionModelKey, isPlatformAdmin],
  );
}
