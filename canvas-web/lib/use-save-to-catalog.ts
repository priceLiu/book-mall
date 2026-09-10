"use client";

import { useCallback } from "react";

import type { GlobalAssetCatalogKind } from "@/docker-shared/global-asset-library";
import { useGlobalAssetLibrary } from "@/docker-shared/global-asset-library";

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

  return useCallback(
    ({
      url,
      prompt,
      sourceModule,
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
        onCatalogSaved,
      });
    },
    [openGlobalAssetLibrary],
  );
}
